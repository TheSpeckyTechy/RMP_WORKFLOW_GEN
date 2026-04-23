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
// Item ID mapping: engine uses XXX/YYY (e.g. 700/023), JMCA uses (XXX÷100)/YYY (7/023).

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

  // 2. Build engine qty map: "tcSeries/itemNum" → qty  (e.g. "7/23" → 500)
  const qtyMap = {};
  for (const line of (computed.lines || [])) {
    const [series, item] = (line.id || '').split('/');
    if (!series || !item) continue;
    const tcSeries = Number(series) / 100;
    const tcItem   = parseInt(item, 10);
    if (!isFinite(tcSeries) || isNaN(tcItem)) continue;
    qtyMap[`${tcSeries}/${tcItem}`] = line.qty || 0;
  }

  // 3. Resolve "* Input" sheet file paths via workbook + rels
  const wbXml   = await zip.file('xl/workbook.xml').async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');

  const relMap = {};
  for (const m of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2];

  const inputPaths = [];
  for (const m of wbXml.matchAll(/<sheet\b[^/]*\/>/g)) {
    const nameM = m[0].match(/name="([^"]*)"/);
    const ridM  = m[0].match(/r:id="([^"]*)"/);
    if (!nameM || !ridM || !nameM[1].endsWith(' Input')) continue;
    const target = relMap[ridM[1]];
    if (target) inputPaths.push('xl/' + target);
  }

  // 4. Update column C Qty cells in each Input sheet
  for (const path of inputPaths) {
    const file = zip.file(path);
    if (!file) continue;
    let xml = await file.async('string');

    xml = xml.replace(/<row\b([^>]*)>([\s\S]*?)<\/row>/g, (full, rowAttrs, rowContent) => {
      // Find column A shared-string cell to get the item ID
      const colAM = rowContent.match(/<c\b[^>]*r="A\d+"[^>]*t="s"[^>]*>\s*<v>(\d+)<\/v>/);
      if (!colAM) return full;
      const cellStr = (sharedStrings[parseInt(colAM[1])] || '').trim();
      if (!/^\d+\/\d+$/.test(cellStr)) return full;

      // Look up engine qty for this TC item ID
      const [idS, idN] = cellStr.split('/');
      const qty = qtyMap[`${idS}/${parseInt(idN, 10)}`] ?? 0;

      // Update column C cell — preserves s="..." style attr, handles both:
      //   self-closing: <c r="C9" s="406"/>
      //   with value:   <c r="C9" s="406"><v>1595</v></c>
      const cRe = /<c r="C(\d+)"([^>]*)(?:\/>|>(?:<v>[^<]*<\/v>)?<\/c>)/;
      const cM  = rowContent.match(cRe);
      if (cM) {
        const rN   = cM[1];
        const attrs = cM[2];
        const newCell = qty > 0
          ? `<c r="C${rN}"${attrs}><v>${qty}</v></c>`
          : `<c r="C${rN}"${attrs}/>`;
        return `<row${rowAttrs}>${rowContent.replace(cRe, newCell)}</row>`;
      }

      // No C cell exists yet — insert only if qty > 0
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

  // 5. Generate and download
  const out = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `TC_BoQ_${scheme.project_number}_${(scheme.road_name || '').replace(/\s+/g, '_')}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);

  window.dispatchEvent(new CustomEvent('rmp-download', {
    detail: { label: `TC BoQ — ${scheme.road_name}`, ref: scheme.project_number,
              fn: '__downloadTCBoQ', schemeId: scheme.id },
  }));
}

window.__downloadTCBoQ = downloadTCBoQXlsx;
