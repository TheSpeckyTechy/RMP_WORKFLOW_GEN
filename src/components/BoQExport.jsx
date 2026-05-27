// ─── BoQExport.jsx ───────────────────────────────────────────────────────────
// Modernised Excel export for the BoQ tab. Three sheets:
//   1. Bill of Quantities — full priced detail, series banners, frozen header
//   2. Summary           — visual summary (header, series breakdown, totals ladder)
//   3. Rate Schedule     — audit trail: rate A/B/C per line + band applied
//
// Exports: window.exportBoQXlsx(scheme, boq, computed)
// Depends on: window.XLSX (xlsx-js-style), window.BOQ_ENGINE
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  const E = window.BOQ_ENGINE;

  // ── Palette (hex, no leading #) ─────────────────────────────────────────────
  const P = {
    ink:       '111111',
    ink2:      '444444',
    ink3:      '888888',
    line:      'E4E4E4',
    bg:        'FFFFFF',
    bgElev:    'F8F8F8',
    bgSunk:    'F2F2F2',
    accent:    'C6572C',   // matches --accent
    accentWsh: 'FDF0E6',
    green:     'D5EBDA',
    amber:     'FDEBD0',
    red:       'FADBD8',
  };

  const border = (colour) => ({ style: 'thin', color: { rgb: colour } });
  const allBorders = (colour) => ({
    top: border(colour), bottom: border(colour),
    left: border(colour), right: border(colour),
  });

  // ── Cell-style presets ──────────────────────────────────────────────────────
  const S = {
    title: {
      fill: { fgColor: { rgb: P.ink } },
      font: { name: 'Inter', color: { rgb: 'FFFFFF' }, bold: true, sz: 16 },
      alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
    },
    titleSub: {
      fill: { fgColor: { rgb: P.ink } },
      font: { name: 'Inter', color: { rgb: 'FFFFFF' }, sz: 10 },
      alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
    },
    metaLabel: {
      font: { name: 'Inter', color: { rgb: P.ink3 }, sz: 9, bold: true },
      alignment: { horizontal: 'left' },
    },
    metaVal: {
      font: { name: 'Inter', color: { rgb: P.ink }, sz: 11 },
      alignment: { horizontal: 'left' },
    },
    colHdr: {
      fill: { fgColor: { rgb: P.bgSunk } },
      font: { name: 'Inter', bold: true, sz: 9, color: { rgb: P.ink2 } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: { bottom: { style: 'medium', color: { rgb: P.ink2 } } },
    },
    colHdrRight: {
      fill: { fgColor: { rgb: P.bgSunk } },
      font: { name: 'Inter', bold: true, sz: 9, color: { rgb: P.ink2 } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: { bottom: { style: 'medium', color: { rgb: P.ink2 } } },
    },
    seriesBanner: {
      fill: { fgColor: { rgb: P.accent } },
      font: { name: 'Inter', bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
      border: {
        left: { style: 'thick', color: { rgb: P.accent } },
        bottom: border(P.line),
      },
    },
    itemId: {
      font: { name: 'JetBrains Mono', sz: 9, color: { rgb: P.ink3 } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: { bottom: border(P.line) },
    },
    itemDesc: {
      font: { name: 'Inter', sz: 9, color: { rgb: P.ink } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: { bottom: border(P.line) },
    },
    itemQty: {
      font: { name: 'JetBrains Mono', sz: 9 },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: { bottom: border(P.line) },
    },
    itemUnit: {
      font: { name: 'Inter', sz: 9, color: { rgb: P.ink3 } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: { bottom: border(P.line) },
    },
    itemMoney: {
      font: { name: 'JetBrains Mono', sz: 9 },
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '"£"#,##0.00',
      border: { bottom: border(P.line) },
    },
    subtotalLbl: {
      fill: { fgColor: { rgb: P.accentWsh } },
      font: { name: 'Inter', bold: true, sz: 10, color: { rgb: P.ink } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: { top: border(P.accent), bottom: border(P.accent) },
    },
    subtotal: {
      fill: { fgColor: { rgb: P.accentWsh } },
      font: { name: 'JetBrains Mono', bold: true, sz: 10, color: { rgb: P.ink } },
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '"£"#,##0.00',
      border: { top: border(P.accent), bottom: border(P.accent) },
    },
    ladderLbl: {
      font: { name: 'Inter', sz: 10, color: { rgb: P.ink } },
      alignment: { horizontal: 'right', vertical: 'center' },
    },
    ladderVal: {
      font: { name: 'JetBrains Mono', sz: 10, color: { rgb: P.ink } },
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '"£"#,##0.00',
    },
    grandLbl: {
      fill: { fgColor: { rgb: P.ink } },
      font: { name: 'Inter', bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'right', vertical: 'center' },
    },
    grandVal: {
      fill: { fgColor: { rgb: P.ink } },
      font: { name: 'JetBrains Mono', bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '"£"#,##0.00',
    },
    footer: {
      font: { name: 'Inter', sz: 8, color: { rgb: P.ink3 }, italic: true },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    },
    bandA: { fill: { fgColor: { rgb: P.amber } }, font: { name: 'Inter', sz: 9, bold: true, color: { rgb: '7A4A00' } }, alignment: { horizontal: 'center' } },
    bandB: { fill: { fgColor: { rgb: P.green } }, font: { name: 'Inter', sz: 9, bold: true, color: { rgb: '1A5A2A' } }, alignment: { horizontal: 'center' } },
    bandC: { fill: { fgColor: { rgb: P.accentWsh } }, font: { name: 'Inter', sz: 9, bold: true, color: { rgb: P.accent } }, alignment: { horizontal: 'center' } },
    blank: {},
  };

  const cell = (v, style) => ({
    v: v,
    t: typeof v === 'number' ? 'n' : 's',
    s: style || S.blank,
  });
  const blank = () => cell('', S.blank);

  // ── Sheet 1: Bill of Quantities (detail) ────────────────────────────────────
  function buildDetailSheet(scheme, computed) {
    const rows = [];

    // Title block — 3 rows
    const ext = scheme.scheme_extent ? ' — ' + scheme.scheme_extent : '';
    rows.push([cell('BILL OF QUANTITIES', S.title), blank(), blank(), blank(), blank(), blank(), blank()]);
    rows.push([cell((scheme.road_name || '') + ext, S.titleSub), blank(), blank(), blank(), blank(), blank(), blank()]);
    rows.push([cell(`Ref ${scheme.project_number || '—'}  ·  ${scheme.ward_selected || 'Ward —'}  ·  ${window.schemeArea(scheme).toLocaleString()} m²`, S.titleSub), blank(), blank(), blank(), blank(), blank(), blank()]);
    rows.push(Array(7).fill(blank()));

    // Column header
    rows.push([
      cell('Item', S.colHdr),
      cell('Description', S.colHdr),
      cell('Qty', S.colHdrRight),
      cell('Unit', S.colHdr),
      cell('Band', S.colHdrRight),
      cell('Rate', S.colHdrRight),
      cell('Total', S.colHdrRight),
    ]);

    for (const g of computed.groups) {
      // Series banner row (merged across all 7 cols)
      rows.push([cell(`Series ${g.num} — ${g.title}`, S.seriesBanner), cell('', S.seriesBanner), cell('', S.seriesBanner), cell('', S.seriesBanner), cell('', S.seriesBanner), cell('', S.seriesBanner), cell('', S.seriesBanner)]);

      for (const l of g.lines) {
        rows.push([
          cell(l.id || '', S.itemId),
          cell(l.desc || '', S.itemDesc),
          cell(+l.qty || 0, S.itemQty),
          cell(l.unit || '', S.itemUnit),
          cell(l.bandApplied || '', (l.bandApplied === 'A' ? S.bandA : l.bandApplied === 'B' ? S.bandB : S.bandC)),
          cell(+l.rate  || 0, S.itemMoney),
          cell(+l.total || 0, S.itemMoney),
        ]);
      }

      // Subtotal row
      rows.push([
        blank(), blank(), blank(), blank(), blank(),
        cell(`Series ${g.num} Subtotal`, S.subtotalLbl),
        cell(g.subtotal, S.subtotal),
      ]);
      rows.push(Array(7).fill(blank()));
    }

    // Totals ladder
    rows.push([blank(), blank(), blank(), blank(), blank(), cell('Subtotal', S.ladderLbl), cell(computed.subtotal, S.ladderVal)]);
    for (const a of computed.adjustments) {
      rows.push([blank(), blank(), blank(), blank(), blank(),
        cell(`+ ${a.label} (${E.fmtPct(a.pct)})`, S.ladderLbl),
        cell(a.amount, S.ladderVal),
      ]);
    }
    if (computed.useBERR) {
      rows.push([blank(), blank(), blank(), blank(), blank(),
        cell(`BERR ${computed.berrDate} (×${computed.berrIndex.toFixed(3)})`, S.ladderLbl),
        cell(computed.berrAdjustmentAmt, S.ladderVal),
      ]);
    }
    rows.push([blank(), blank(), blank(), blank(), blank(),
      cell('TOTAL', S.grandLbl),
      cell(computed.totalIncVat, S.grandVal),
    ]);

    return buildSheet(rows, {
      cols: [{wch:12},{wch:58},{wch:12},{wch:8},{wch:8},{wch:14},{wch:16}],
      merges: [
        {s:{r:0,c:0},e:{r:0,c:6}}, // title
        {s:{r:1,c:0},e:{r:1,c:6}}, // road
        {s:{r:2,c:0},e:{r:2,c:6}}, // meta
        // Each series banner row also merged — added below
      ],
      mergeBannerRows: true,
      freeze: { ySplit: 5, xSplit: 0 },
    });
  }

  // Helper — assemble worksheet from 2D cell grid
  function buildSheet(rows, opts) {
    const ws = {};
    rows.forEach((row, r) => {
      row.forEach((c, col) => {
        ws[XLSX.utils.encode_cell({ r, c: col })] = c;
      });
    });
    const numRows = rows.length;
    const numCols = Math.max(...rows.map(r => r.length));
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: numRows - 1, c: numCols - 1 } });
    if (opts.cols)   ws['!cols']   = opts.cols;
    if (opts.merges) ws['!merges'] = [...opts.merges];
    if (opts.mergeBannerRows) {
      // Merge every series-banner row (detect by empty except col 0 holding "Series ")
      rows.forEach((row, r) => {
        const v = row[0]?.v;
        if (typeof v === 'string' && v.startsWith('Series ') && /— /.test(v)) {
          ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: numCols - 1 } });
        }
      });
    }
    if (opts.freeze) ws['!freeze'] = opts.freeze;
    // Row heights
    ws['!rows'] = rows.map((_, r) => ({ hpx: r === 0 ? 26 : 18 }));
    return ws;
  }

  // ── Sheet 2: Summary (modernised) ───────────────────────────────────────────
  function buildSummarySheet(scheme, computed) {
    const rows = [];
    const ext = scheme.scheme_extent ? ' — ' + scheme.scheme_extent : '';

    // Title
    rows.push([cell('BILL OF QUANTITIES — SUMMARY', S.title), blank(), blank(), blank(), blank(), blank()]);
    rows.push([cell((scheme.road_name || '') + ext, S.titleSub), blank(), blank(), blank(), blank(), blank()]);
    rows.push(Array(6).fill(blank()));

    // Project meta — 2 column block
    const meta = [
      ['Project ref',      scheme.project_number || '—',                'Area',        window.schemeArea(scheme).toLocaleString() + ' m²'],
      ['Ward',             scheme.ward_selected ? `${scheme.ward_num} · ${scheme.ward_selected}` : '—', 'Treatment', window.schemeTreatment(scheme) || '—'],
      ['Start',            scheme.date_start || '—',                   'Finish',      scheme.date_finish || '—'],
      ['Contractor',       scheme.contractor || '—',                   'Designer',    scheme.prepared_by || '—'],
    ];
    for (const [la, va, lb, vb] of meta) {
      rows.push([cell(la, S.metaLabel), cell(va, S.metaVal), blank(), cell(lb, S.metaLabel), cell(vb, S.metaVal), blank()]);
    }
    rows.push(Array(6).fill(blank()));

    // Series breakdown table header
    rows.push([
      cell('Series',      S.colHdr),
      cell('Title',       S.colHdr),
      cell('Items',       S.colHdrRight),
      cell('Subtotal',    S.colHdrRight),
      cell('% of total',  S.colHdrRight),
      cell('',            S.colHdr),
    ]);

    for (const g of computed.groups) {
      const pct = computed.subtotal ? g.subtotal / computed.subtotal : 0;
      // Spark-bar via cell with coloured fill proportional to pct
      const sparkStyle = {
        fill: { fgColor: { rgb: P.accentWsh } },
        font: { name: 'JetBrains Mono', sz: 8, color: { rgb: P.accent } },
        alignment: { horizontal: 'left' },
        border: { bottom: border(P.line) },
      };
      const sparkChars = '█'.repeat(Math.max(1, Math.round(pct * 20)));
      rows.push([
        cell('Series ' + g.num, S.itemId),
        cell(g.title,            S.itemDesc),
        cell(g.itemCount,        S.itemQty),
        cell(g.subtotal,         S.itemMoney),
        cell(pct,                { ...S.itemMoney, numFmt: '0.0%' }),
        cell(sparkChars,         sparkStyle),
      ]);
    }

    // Subtotal row
    rows.push([
      blank(), blank(), blank(),
      cell('Subtotal', S.subtotalLbl),
      cell(computed.subtotal,   S.subtotal),
      blank(),
    ]);
    rows.push(Array(6).fill(blank()));

    // Totals ladder
    for (const a of computed.adjustments) {
      rows.push([blank(), blank(), blank(), blank(),
        cell(`+ ${a.label} (${E.fmtPct(a.pct)})`, S.ladderLbl),
        cell(a.amount, S.ladderVal),
      ]);
    }
    if (computed.useBERR) {
      rows.push([blank(), blank(), blank(), blank(),
        cell(`BERR ${computed.berrDate} (×${computed.berrIndex.toFixed(3)})`, S.ladderLbl),
        cell(computed.berrAdjustmentAmt, S.ladderVal),
      ]);
    }
    if (computed.adjustments.length || computed.useBERR) {
      rows.push([blank(), blank(), blank(), blank(),
        cell('PWP (Works value)', S.ladderLbl),
        cell(computed.pwp, S.ladderVal),
      ]);
    }
    rows.push([blank(), blank(), blank(), blank(),
      cell('TOTAL', S.grandLbl),
      cell(computed.totalIncVat, S.grandVal),
    ]);
    rows.push(Array(6).fill(blank()));

    // Footer
    const bits = [];
    if (computed.useBERR) bits.push(`BERR ${computed.berrDate} ×${computed.berrIndex.toFixed(3)}`);
    if (computed.areaBandOverride) bits.push(`Area band forced: ${computed.areaBandOverride}`);
    bits.push('Rates: Tayside Contracts JMCA schedule');
    bits.push('Generated ' + new Date().toISOString().slice(0, 10));
    rows.push([cell(bits.join(' · '), S.footer), blank(), blank(), blank(), blank(), blank()]);

    return buildSheet(rows, {
      cols: [{wch:14},{wch:40},{wch:10},{wch:16},{wch:11},{wch:22}],
      merges: [
        {s:{r:0,c:0},e:{r:0,c:5}},
        {s:{r:1,c:0},e:{r:1,c:5}},
        {s:{r:rows.length-1,c:0},e:{r:rows.length-1,c:5}},
      ],
      freeze: null,
    });
  }

  // ── Sheet 3: Rate Schedule (audit trail) ────────────────────────────────────
  function buildRateScheduleSheet(computed) {
    const rows = [];
    rows.push([cell('RATE SCHEDULE — AUDIT TRAIL', S.title), blank(), blank(), blank(), blank(), blank(), blank(), blank()]);
    rows.push(Array(8).fill(blank()));

    rows.push([
      cell('Item',         S.colHdr),
      cell('Description',  S.colHdr),
      cell('Unit',         S.colHdr),
      cell('Qty',          S.colHdrRight),
      cell('Rate A',       S.colHdrRight),
      cell('Rate B',       S.colHdrRight),
      cell('Rate C',       S.colHdrRight),
      cell('Applied',      S.colHdrRight),
    ]);

    for (const l of computed.lines) {
      const item = window.boqFullItem ? window.boqFullItem(l.id) : null;
      const rA = item ? (+item.rateA || 0) : 0;
      const rB = item ? (+item.rateB || 0) : 0;
      const rC = item ? (+item.rateC || 0) : 0;
      const bandStyle = l.bandApplied === 'A' ? S.bandA : l.bandApplied === 'B' ? S.bandB : S.bandC;
      rows.push([
        cell(l.id || '',       S.itemId),
        cell(l.desc || '',     S.itemDesc),
        cell(l.unit || '',     S.itemUnit),
        cell(+l.qty || 0,      S.itemQty),
        cell(rA,               S.itemMoney),
        cell(rB,               S.itemMoney),
        cell(rC,               S.itemMoney),
        cell(l.bandApplied || '', bandStyle),
      ]);
    }

    return buildSheet(rows, {
      cols: [{wch:12},{wch:48},{wch:8},{wch:10},{wch:12},{wch:12},{wch:12},{wch:10}],
      merges: [{s:{r:0,c:0},e:{r:0,c:7}}],
      freeze: { ySplit: 3, xSplit: 0 },
    });
  }

  // ── Filename ───────────────────────────────────────────────────────────────
  function makeFilename(scheme) {
    const ref  = (scheme.project_number || 'BoQ').replace(/[^\w-]+/g, '_');
    const road = (scheme.road_name || 'scheme').replace(/[^\w-]+/g, '_');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${ref}_${road}_BoQ_${date}.xlsx`;
  }

  // ── Public entry point ─────────────────────────────────────────────────────
  window.exportBoQXlsx = async function (scheme, boq, computed) {
    if (!window.XLSX) throw new Error('xlsx-js-style not loaded');
    // If caller didn't precompute, do it now so the helper can be called standalone.
    if (!computed) computed = E.buildBoQLines(boq, scheme);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildDetailSheet(scheme, computed),       'Bill of Quantities');
    XLSX.utils.book_append_sheet(wb, buildSummarySheet(scheme, computed),      'Summary');
    XLSX.utils.book_append_sheet(wb, buildRateScheduleSheet(computed),         'Rate Schedule');

    const xlsxFilename = makeFilename(scheme);
    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const saved = window.fsSaveToProjectFolder
      ? await window.fsSaveToProjectFolder(scheme, ['Contract'], xlsxFilename, bytes, { versioned: true })
      : false;

    if (!saved) {
      XLSX.writeFile(wb, xlsxFilename);
    } else {
      try {
        const pdfBuf = await window.__getBoQPdfBuffer(scheme);
        await window.fsSaveToProjectFolder(scheme, ['Contract'], xlsxFilename.replace('.xlsx', '.pdf'), pdfBuf, { versioned: true });
      } catch { /* PDF generation is best-effort */ }
      if (window.Toast) window.Toast.show({ kind: 'success', msg: `BoQ saved to ${window.schemeFolderName(scheme)}/Contract/`, duration: 4000 });
    }

    // Notify the app's download log (existing convention from legacy BoQTab)
    window.dispatchEvent(new CustomEvent('rmp-download', {
      detail: { label: 'BoQ — ' + (scheme.road_name || 'scheme'), ref: scheme.project_number || '', fn: '__exportBoQForScheme', schemeId: scheme.id },
    }));
  };
})();

