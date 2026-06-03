// ── ProgrammePrint.jsx ────────────────────────────────────────────────────────
// Generates a self-contained HTML document in a new popup window, waits for
// fonts to load, then auto-prints. No CSS tricks inside the SPA — the new
// window has only the print content and nothing else.
// Exposed as window.printProgramme(allSchemes, designerView, designers).
// ─────────────────────────────────────────────────────────────────────────────

window.printProgramme = function(allSchemes, designerView, designers) {

  // ── Constants ──────────────────────────────────────────────────────────────
  const PP_START = new Date(2026, 3, 1).getTime();
  const PP_END   = new Date(2027, 2, 31, 23, 59, 59).getTime();
  const PP_SPAN  = PP_END - PP_START;
  const MONTHS   = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
  const STATUS_LABELS = window.STATUS_LABELS || {};

  const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const esc = (s) => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';

  const ppParse = (str) => {
    if (!str) return null;
    const [d, m, y] = str.split('/');
    return new Date(+y, +m - 1, +d).getTime();
  };

  const ppFmtDate = (dmy) => {
    if (!dmy) return '&mdash;';
    const [d, m, y] = dmy.split('/');
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${String(+d).padStart(2,'0')} ${mo[+m-1]} ${y}`;
  };

  const ppArea = (s) => {
    const a = s.scheme_type === 'Footway' ? s.footway_area_m2 : s.carriageway_area_m2;
    return a ? (+a).toLocaleString() : '&mdash;';
  };

  const getSchemes = (did) => allSchemes.filter(s =>
    (did ? s.assigned_designer_id === did : true) &&
    s.status !== 'archived' && s.status !== 'constructed' && s.status !== 'shelved'
  );

  // ── Generate HTML for one designer's programme page ────────────────────────
  const genPage = (designer, schemes) => {
    const dated   = [...schemes].filter(s => s.date_start)
                                .sort((a,b) => ppParse(a.date_start) - ppParse(b.date_start));
    const undated = schemes.filter(s => !s.date_start);
    const all     = [...dated, ...undated];
    const totalM2 = schemes.reduce((a,s) => a + (+(s.scheme_type==='Footway'
                      ? s.footway_area_m2 : s.carriageway_area_m2) || 0), 0);
    const colour  = designer?.colour || '#9ca3af';
    const todayPct = ((Date.now() - PP_START) / PP_SPAN) * 100;

    // Month grid lines (shared by gantt header + each bar row)
    const gridLines = MONTHS.map((_, i) => i > 0
      ? `<span style="position:absolute;top:0;left:${(i/12)*100}%;width:1px;height:100%;background:#e8e8e8;"></span>`
      : '').join('');

    const todayLine = (todayPct >= 0 && todayPct <= 100)
      ? `<span style="position:absolute;top:0;left:${todayPct.toFixed(2)}%;width:2px;height:100%;background:#dc2626;opacity:0.6;"></span>`
      : '';

    // ── Gantt ──────────────────────────────────────────────────────────────
    const ganttRows = dated.map(s => {
      const startMs  = ppParse(s.date_start);
      const finishMs = ppParse(s.date_finish);
      let left = 0, width = 1, hasBar = false;
      if (startMs) {
        const rawL   = ((startMs - PP_START) / PP_SPAN) * 100;
        left         = Math.max(0, Math.min(99, rawL));
        const rawR   = finishMs ? ((finishMs - PP_START) / PP_SPAN) * 100 : rawL + 2;
        const clampR = Math.min(100, Math.max(left, rawR));
        width        = Math.max(0.8, clampR - left);
        hasBar       = startMs >= PP_START - 86400000*90 && startMs <= PP_END + 86400000*90;
      }
      const bar = hasBar ? `
        <span style="position:absolute;left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;
          top:50%;transform:translateY(-50%);height:12px;background:${colour};
          border-radius:3px;display:flex;align-items:center;padding-left:3px;
          overflow:hidden;font-size:6pt;color:white;font-family:'JetBrains Mono',monospace;">
          ${width > 7 ? esc(s.project_number || '') : ''}
        </span>` : '';
      return `
        <tr>
          <td class="gantt-label">${esc(s.road_name)}</td>
          <td class="gantt-track">${gridLines}${todayLine}${bar}</td>
        </tr>`;
    }).join('');

    const monthLabels = MONTHS.map((m, i) =>
      `<span style="position:absolute;left:${((i/12)*100).toFixed(2)}%;bottom:3px;font-size:7pt;
        color:#888;font-family:'JetBrains Mono',monospace;white-space:nowrap;">${m}</span>`
    ).join('');

    const ganttSection = dated.length === 0 ? '' : `
      <div class="sec-hd">Programme Timeline · April 2026 – March 2027
        <span style="font-weight:400;text-transform:none;letter-spacing:0;margin-left:10px;color:#aaa;">
          ${dated.length} dated scheme${dated.length!==1?'s':''}
        </span>
      </div>
      <table class="gantt-table">
        <colgroup><col style="width:185px"><col></colgroup>
        <thead>
          <tr>
            <td></td>
            <td style="position:relative;height:20px;border-bottom:1.5px solid #ccc;vertical-align:bottom;padding-bottom:2px;">
              ${monthLabels}
              ${MONTHS.map((_,i)=>i>0?`<span style="position:absolute;left:${(i/12*100).toFixed(1)}%;top:0;bottom:0;width:1px;background:#ddd;"></span>`:'').join('')}
            </td>
          </tr>
        </thead>
        <tbody>${ganttRows}</tbody>
      </table>`;

    // ── Summary table ──────────────────────────────────────────────────────
    const tableRows = all.map((s, i) => {
      const noDate = !s.date_start;
      const bg     = noDate ? '#fffbf0' : i % 2 === 0 ? '#fff' : '#f5f5f5';
      const status = STATUS_LABELS[s.status] || esc(s.status || '');
      return `
        <tr style="background:${bg};">
          <td style="text-align:center;color:#bbb;font-family:'JetBrains Mono',monospace;">${i+1}</td>
          <td>
            <div class="road-name">${esc(s.road_name)}</div>
            ${s.scheme_extent ? `<div class="road-sub">${esc(s.scheme_extent)}</div>` : ''}
          </td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:8pt;color:#555;">${esc(s.project_number||'—')}</td>
          <td>${esc(s.scheme_type||'—')}</td>
          <td style="text-align:right;font-family:'JetBrains Mono',monospace;font-weight:600;">${ppArea(s)}</td>
          <td style="font-family:'JetBrains Mono',monospace;color:${noDate?'#ccc':'#333'};">${ppFmtDate(s.date_start)}</td>
          <td style="font-family:'JetBrains Mono',monospace;color:${!s.date_finish?'#ccc':'#333'};">${ppFmtDate(s.date_finish)}</td>
          <td>${status}</td>
          <td style="color:#666;">${esc(s.ward_selected||'—')}</td>
        </tr>`;
    }).join('');

    // ── Designer badge ─────────────────────────────────────────────────────
    const badge = designer ? `
      <span style="display:inline-flex;align-items:center;justify-content:center;
        width:26px;height:26px;border-radius:50%;background:${colour};
        color:white;font-size:9pt;font-weight:700;flex-shrink:0;margin-right:8px;">
        ${esc(designer.initials)}
      </span>` : '';

    return `
      <div class="page">
        <!-- Header -->
        <div class="pg-hd">
          <div>
            <div class="org-line">Dundee City Council · Roads Maintenance Partnership · RMP Design Studio</div>
            <div class="doc-title">Design Programme — Financial Year 2026/27</div>
            <div style="display:flex;align-items:center;margin-top:4px;">
              ${badge}
              <span class="designer-name">${esc(designer ? designer.name : 'All Designers')}</span>
              <span class="designer-meta">
                ${all.length} scheme${all.length!==1?'s':''}
                ${totalM2>0 ? ` &middot; ${totalM2.toLocaleString()} m&sup2; total area` : ''}
                ${undated.length>0 ? ` &middot; ${undated.length} undated` : ''}
              </span>
            </div>
          </div>
          <div class="print-meta">
            <div style="font-size:9pt;font-weight:600;color:#333;">Printed: ${today}</div>
            <div>For internal use only</div>
            <div>Dates are indicative &mdash; verify before use</div>
          </div>
        </div>

        ${ganttSection}

        <!-- Summary table -->
        <div class="sec-hd">Scheme Summary</div>
        <table class="summary-table">
          <colgroup>
            <col style="width:26px">
            <col>
            <col style="width:72px">
            <col style="width:88px">
            <col style="width:66px">
            <col style="width:90px">
            <col style="width:90px">
            <col style="width:96px">
            <col style="width:80px">
          </colgroup>
          <thead>
            <tr>
              <th style="text-align:center;">#</th>
              <th style="text-align:left;padding-left:8px;">Road Name / Location</th>
              <th style="text-align:left;">Reference</th>
              <th style="text-align:left;">Type</th>
              <th style="text-align:right;">Area m&sup2;</th>
              <th style="text-align:left;">Start</th>
              <th style="text-align:left;">Finish</th>
              <th style="text-align:left;">Status</th>
              <th style="text-align:left;">Ward</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>

        <!-- Footer -->
        <div class="footer">
          <span>Roads Maintenance Partnership &middot; Dundee City Council</span>
          <span>Design Programme 2026/27 &middot; ${esc(designer ? designer.name : 'All Designers')}</span>
          <span>${today}</span>
        </div>
      </div>`;
  };

  // ── Build group list ───────────────────────────────────────────────────────
  const groups = designerView
    ? [{ designer: designers.find(d => d.id === designerView), schemes: getSchemes(designerView) }]
    : designers.map(d => ({ designer: d, schemes: getSchemes(d.id) })).filter(g => g.schemes.length > 0);

  // ── CSS ────────────────────────────────────────────────────────────────────
  const CSS = `
    @page { size: A4 landscape; margin: 12mm 15mm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Inter', system-ui, sans-serif; color: #111; background: white; font-size: 9.5pt; line-height: 1.45; }

    /* Page breaks between designer sections */
    .page { break-after: page; page-break-after: always; }
    .page:last-child { break-after: auto; page-break-after: avoid; }

    /* Header — never orphaned */
    .pg-hd { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a1d23; padding-bottom: 10px; margin-bottom: 12px; break-after: avoid; page-break-after: avoid; }
    .org-line { font-size: 7.5pt; color: #777; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.09em; text-transform: uppercase; margin-bottom: 3px; }
    .doc-title { font-size: 16pt; font-weight: 700; color: #1a1d23; line-height: 1.1; }
    .designer-name { font-size: 12pt; font-weight: 600; color: #1a1d23; }
    .designer-meta { font-size: 9.5pt; color: #666; margin-left: 10px; }
    .print-meta { text-align: right; font-size: 7.5pt; color: #888; font-family: 'JetBrains Mono', monospace; line-height: 1.8; flex-shrink: 0; margin-left: 20px; }

    /* Section heading — never orphaned at bottom of page */
    .sec-hd { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 12px; break-after: avoid; page-break-after: avoid; }

    /* Gantt */
    .gantt-table { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 4px; }
    .gantt-table thead { display: table-header-group; }
    .gantt-table tr { break-inside: avoid; page-break-inside: avoid; }
    .gantt-label { font-size: 8.5pt; color: #333; padding: 0 6px 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; height: 22px; vertical-align: middle; }
    .gantt-track { position: relative; height: 22px; vertical-align: middle; overflow: hidden; }

    /* Summary table */
    .summary-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 9pt; line-height: 1.5; }
    .summary-table thead { display: table-header-group; }
    .summary-table th { padding: 6px 6px; background: #1a1d23; color: white; font-size: 8pt; font-weight: 700; vertical-align: bottom; border-bottom: 2px solid #333; white-space: nowrap; }
    .summary-table td { padding: 5px 6px; vertical-align: middle; overflow: hidden; }
    .summary-table tbody tr { break-inside: avoid; page-break-inside: avoid; border-bottom: 1px solid #e8e8e8; }
    .road-name { font-weight: 600; color: #1a1d23; font-size: 9.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .road-sub  { font-size: 7.5pt; color: #777; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Footer */
    .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 7pt; color: #bbb; font-family: 'JetBrains Mono', monospace; }
  `;

  // ── Full HTML document ─────────────────────────────────────────────────────
  const designerName = designerView
    ? (designers.find(d => d.id === designerView)?.name || '')
    : 'All Designers';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Design Programme 2026/27${designerView ? ' — ' + designerName : ''}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>${CSS}</style>
</head>
<body>
  ${groups.map(({ designer, schemes }) => genPage(designer, schemes)).join('\n')}
  <script>
    // Wait for fonts, then auto-print
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

  // ── Open popup and write ───────────────────────────────────────────────────
  const win = window.open('', '_blank', 'width=1100,height=750,menubar=no,toolbar=no');
  if (!win) {
    alert('Pop-up blocked — please allow pop-ups for this site, then click Print Programme again.');
    return;
  }
  win.document.write(html);
  win.document.close();
};
