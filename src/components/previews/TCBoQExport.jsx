// TCBoQExport.jsx — Fills the TC JMCA Bill of Quantities XLSX template with
// live quantities from the BoQ engine. Only the Qty column (C) in each
// "* Design" sheet is written; all other cells (rates, formulas, styles) are
// preserved so Excel recalculates costs on open.
//
// Item ID mapping: engine uses XXX/YYY (e.g. 700/023); TC JMCA uses (XXX÷100)/YYY
// (e.g. 7/023). Both sides normalise the item number to strip leading zeros
// so 700/023 and 700/23 both match TC's 7/023.

const TC_BOQ_TEMPLATE = 'templates/TC_BoQ_JMCA_TEMPLATE.xlsx';

async function downloadTCBoQXlsx(scheme, computed) {
  const res = await fetch(TC_BOQ_TEMPLATE, { cache: 'no-cache' });
  if (!res.ok) throw new Error('TC BoQ template not found: ' + TC_BOQ_TEMPLATE);
  const buffer = await res.arrayBuffer();

  const wb = window.XLSX.read(new Uint8Array(buffer), {
    type: 'array',
    cellFormula: true,
    cellStyles: true,
  });

  // Build normalised map: "tcSeries/itemNum" → qty
  const qtyMap = {};
  for (const line of (computed.lines || [])) {
    const parts = (line.id || '').split('/');
    if (parts.length !== 2) continue;
    const [series, item] = parts;
    const tcSeries = Number(series) / 100;
    const tcItemNum = String(parseInt(item, 10));
    if (!isFinite(tcSeries) || isNaN(parseInt(item, 10))) continue;
    qtyMap[`${tcSeries}/${tcItemNum}`] = line.qty || 0;
  }

  // Update Qty (col index 2) in all "* Design" sheets
  const designSheets = wb.SheetNames.filter(n => n.endsWith(' Design'));
  for (const shName of designSheets) {
    const ws = wb.Sheets[shName];
    if (!ws || !ws['!ref']) continue;
    const range = window.XLSX.utils.decode_range(ws['!ref']);
    for (let r = range.s.r; r <= range.e.r; r++) {
      const idCell = ws[window.XLSX.utils.encode_cell({ r, c: 0 })];
      if (!idCell || idCell.v == null) continue;
      const raw = String(idCell.v).trim();
      if (!/^\d+\/\d+$/.test(raw)) continue;
      const [idS, idN] = raw.split('/');
      const normId = `${idS}/${parseInt(idN, 10)}`;
      const addr = window.XLSX.utils.encode_cell({ r, c: 2 });
      ws[addr] = { t: 'n', v: qtyMap[normId] ?? 0 };
    }
  }

  const out = window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `TC_BoQ_${scheme.project_number}_${(scheme.road_name || '').replace(/\s+/g, '_')}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);

  window.dispatchEvent(new CustomEvent('rmp-download', {
    detail: {
      label: `TC BoQ — ${scheme.road_name}`,
      ref: scheme.project_number,
      fn: '__downloadTCBoQ',
      schemeId: scheme.id,
    },
  }));
}

window.__downloadTCBoQ = downloadTCBoQXlsx;
