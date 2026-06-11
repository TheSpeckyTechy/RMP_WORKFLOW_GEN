// TCBoQExport.jsx — Fills the TC JMCA Bill of Quantities XLSX template with
// live quantities from the BoQ engine.
//
// Approach: JSZip + raw XML (same as RSR/PCI DOCX templates).
// Only the <v> elements inside column C cells of "* Input" sheets are written.
// Every style, formula, colour, and merged cell stays byte-for-byte identical
// to the original template — SheetJS is not used here because it strips styles.
//
// Architecture of the JMCA workbook:
//   "* Input" sheets  — where quantities are entered (column C = plain numeric cell)
//   "* Design" sheets — hidden; column C formula reads from Input: ='Series X Input'!C9
//   "* Final" sheets  — post-completion measured values (untouched)
//
// The template (TC_BoQ_JMCA_TEMPLATE.xlsx) is pre-cleaned: all Input sheet column C
// cells are zeroed and all formula cached <v> values are stripped across every sheet.
// This export therefore only needs to WRITE quantities — no clearing required.
//
// Item ID mapping: engine and JMCA template both use TC series notation (e.g. "7/023",
// "2700/01"). The item part is normalised: leading zeros stripped while preserving any
// alphanumeric suffix (e.g. "023A" → "23A", "023" → "23") so that "7/134A" maps
// consistently from both the engine line list and the template column A cells.
// Series 6400 Input is skipped — it contains lot/band designators, not quantities.

const TC_BOQ_TEMPLATE = 'templates/TC_BoQ_JMCA_TEMPLATE.xlsx';

async function downloadTCBoQXlsx(scheme, computed) {
  const res = await fetch(TC_BOQ_TEMPLATE, { cache: 'no-cache' });
  if (!res.ok) throw new Error('TC BoQ template not found: ' + TC_BOQ_TEMPLATE);
  const buffer = await res.arrayBuffer();

  const zip = new window.JSZip();
  await zip.loadAsync(buffer);

  // 1. Parse shared strings → index array
  const sharedStrings = [];
  const ssFile = zip.file('xl/sharedStrings.xml');
  if (ssFile) {
    const ssXml = await ssFile.async('string');
    for (const si of ssXml.split('<si>').slice(1)) {
      const texts = [...si.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(m => m[1]);
      sharedStrings.push(texts.join('').trim());
    }
  }

  // 2. Build engine qty map: "series/normalisedItem" → qty  (e.g. "7/23A" → 500)
  // Normalise the item part by stripping leading zeros while keeping any alphanumeric
  // suffix (e.g. "023" → "23", "023A" → "23A"). This matches the template side below.
  // When duplicate catalogue ids appear (auto + user-added, or a Ledger Duplicate) the
  // quantities are SUMMED so none are silently dropped.
  const normItem = (s) => String(s).replace(/^0+(?=.)/, '');
  const qtyMap = {};
  for (const line of (computed.lines || [])) {
    const [series, item] = (line.id || '').split('/');
    if (!series || !item) continue;
    const key = `${series}/${normItem(item)}`;
    qtyMap[key] = (qtyMap[key] || 0) + (+line.qty || 0);
  }

  // 3. Resolve "* Input" sheet file paths via workbook + rels
  // Series 6400 Input is excluded — its column C holds lot/band designators, not quantities.
  const wbXml   = await zip.file('xl/workbook.xml').async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');

  const relMap = {};
  for (const m of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2];

  const inputPaths = [];
  for (const m of wbXml.matchAll(/<sheet\b[^/]*\/>/g)) {
    const nameM = m[0].match(/name="([^"]*)"/);
    const ridM  = m[0].match(/r:id="([^"]*)"/);
    if (!nameM || !ridM || !nameM[1].endsWith(' Input')) continue;
    if (nameM[1] === 'Series 6400 Input') continue;
    const target = relMap[ridM[1]];
    if (target) inputPaths.push('xl/' + target);
  }

  // 4. Write column C Qty cells in each Input sheet
  for (const path of inputPaths) {
    const file = zip.file(path);
    if (!file) continue;
    let xml = await file.async('string');

    xml = xml.replace(/<row\b([^>]*)>([\s\S]*?)<\/row>/g, (full, rowAttrs, rowContent) => {
      const colAM = rowContent.match(/<c\b[^>]*r="A\d+"[^>]*t="s"[^>]*>\s*<v>(\d+)<\/v>/);
      if (!colAM) return full;
      const cellStr = (sharedStrings[parseInt(colAM[1])] || '').trim();
      // Accept item ids like "7/134" and alphanumeric variants like "7/134A"
      if (!/^\d+\/\w+$/.test(cellStr)) return full;

      const [idS, idN] = cellStr.split('/');
      const qty = qtyMap[`${idS}/${normItem(idN)}`] ?? 0;

      // Update column C cell — preserves s="..." style attr
      const cRe = /<c r="C(\d+)"([^>]*)(?:\/>|>(?:<v>[^<]*<\/v>)?<\/c>)/;
      const cM  = rowContent.match(cRe);
      if (cM) {
        const rN    = cM[1];
        const attrs = cM[2];
        const newCell = qty > 0
          ? `<c r="C${rN}"${attrs}><v>${qty}</v></c>`
          : `<c r="C${rN}"${attrs}/>`;
        return `<row${rowAttrs}>${rowContent.replace(cRe, newCell)}</row>`;
      }

      // No C cell yet — insert only if qty > 0
      if (qty > 0) {
        const rM = rowAttrs.match(/\br="(\d+)"/);
        const rNum = rM ? rM[1] : '';
        const newCell = `<c r="C${rNum}"><v>${qty}</v></c>`;
        const afterB = rowContent.replace(/(<c\b[^>]*r="B\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>))/, `$1${newCell}`);
        if (afterB !== rowContent) return `<row${rowAttrs}>${afterB}</row>`;
        const afterA = rowContent.replace(/(<c\b[^>]*r="A\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>))/, `$1${newCell}`);
        return `<row${rowAttrs}>${afterA}</row>`;
      }

      return full;
    });

    zip.file(path, xml);
  }

  // 5. Force full recalculation on open: set fullCalcOnLoad and drop stale calcChain
  const wbXmlUpdated = wbXml.replace(
    /<calcPr\b([^/]*)\/>/,
    (m, attrs) => attrs.includes('fullCalcOnLoad') ? m : `<calcPr${attrs} fullCalcOnLoad="1"/>`
  );
  zip.file('xl/workbook.xml', wbXmlUpdated);
  zip.remove('xl/calcChain.xml');

  // 6. Generate and save
  const _tcRef  = (scheme.project_number || scheme.id || 'TC').replace(/[^\w-]+/g, '_');
  const _tcRoad = (scheme.road_name      || 'scheme').replace(/[^\w-]+/g, '_');
  const xlsxFilename = `TC_BoQ_${_tcRef}_${_tcRoad}.xlsx`;
  const out = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  const saved = window.fsSaveToProjectFolder
    ? await window.fsSaveToProjectFolder(scheme, ['Contract'], xlsxFilename, out, { versioned: true })
    : false;

  if (!saved) {
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const _url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = _url; a.download = xlsxFilename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(_url), 100);
  } else {
    if (window.Toast) window.Toast.show({ kind: 'success', msg: `TC BoQ saved to ${window.schemeFolderName(scheme)}/Contract/`, duration: 4000 });
  }

  window.dispatchEvent(new CustomEvent('rmp-download', {
    detail: { label: `TC BoQ — ${scheme.road_name}`, ref: scheme.project_number,
              fn: '__downloadTCBoQ', schemeId: scheme.id },
  }));
}

window.__downloadTCBoQ = downloadTCBoQXlsx;
