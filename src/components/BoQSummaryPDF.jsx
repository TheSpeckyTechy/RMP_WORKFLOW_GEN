// ─── BoQSummaryPDF.jsx ───────────────────────────────────────────────────────
// Compiles a single-page A4 PDF that mirrors the TC BoQ workbook's Summary
// sheet — series subtotals (Design / Final columns), Series 6400 time/area
// band adjustments, BERR INDICES block (rates 85/1 and 85/2), TC Project
// Value, Average Project Value, and Number of Contractors.
//
// Exports: window.exportBoQSummaryPDF(scheme, boq, computed)
// Depends on: window.jspdf (jsPDF UMD), window.BOQ_ENGINE
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  const E = window.BOQ_ENGINE;

  const ACCENT = [198, 87, 44];
  const INK    = [17, 17, 17];
  const INK2   = [68, 68, 68];
  const INK3   = [136, 136, 136];
  const LINE   = [220, 220, 220];
  const HDR_BG = [223, 235, 247];        // pale blue header
  const ROW_LT = [251, 252, 253];        // very pale row fill
  const TC_PV  = [248, 226, 226];        // pink TC Project Value row
  const APV    = [220, 240, 224];        // green Average Project Value row
  const ADJ_BG = [232, 232, 232];        // grey 6400 / BERR background
  const ADJ_LT = [243, 244, 245];        // lighter grey

  // A4 portrait, mm
  const PAGE_W  = 210;
  const PAGE_H  = 297;
  const MARGIN  = 12;
  const CONTENT = PAGE_W - 2 * MARGIN;

  // The 11 series the TC Summary sheet always lists, even if zero.
  const SUMMARY_SERIES = [
    { num: 100,  label: 'SERIES 100:  PRELIMINARIES' },
    { num: 200,  label: 'SERIES 200:  SITE CLEARANCE' },
    { num: 300,  label: 'SERIES 300 : FENCING' },
    { num: 400,  label: 'SERIES 400:  SAFETY FENCES & GUARDRAILS' },
    { num: 500,  label: 'SERIES 500:  DRAINAGE & DUCTS' },
    { num: 600,  label: 'SERIES 600:  EARTHWORKS' },
    { num: 700,  label: 'SERIES 700:  PAVEMENTS' },
    { num: 1100, label: 'SERIES 1100: FOOTWAYS AND PAVED AREAS' },
    { num: 1200, label: 'SERIES 1200: TRAFFIC SIGNS & MARKINGS' },
    { num: 2700, label: 'SERIES 2700: ACCOMMODATION WORKS, WORKS FOR STATUTORY UNDERTAKERS, PROVISIONAL SUMS AND PRIME COST ITEMS' },
    { num: 3000, label: 'SERIES 3000: LANDSCAPE AND ECOLOGY' },
  ];

  // ── Helpers ──────────────────────────────────────────────────────────────

  const fmtMoney = (v) => '£' + (+v || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fmtMoneyOrDash = (v) => (+v > 0) ? fmtMoney(v) : '£                    -';
  const fmtPct = (v) => ((+v || 0) * 100).toFixed(2) + '%';
  const fmtInt = (v) => (+v || 0).toLocaleString();

  function workingDays(start, finish) {
    if (!start || !finish) return null;
    const p = s => { const [d,m,y] = String(s).split('/'); return new Date(+y, +m-1, +d); };
    const a = p(start), b = p(finish);
    if (isNaN(a) || isNaN(b)) return null;
    return Math.max(1, Math.round((b - a) / 86400000 * 5/7));
  }

  // BERR index date display — converts e.g. "Q4 2025" → "Feb-24" style. The
  // TC sheet uses month-year shorthand; if the scheme stores a quarter, we
  // pick the middle month for display. Falls back to whatever string is
  // already on the scheme.
  function berrDateLabel(boq) {
    const s = boq && boq.settings;
    if (!s) return 'Base May 22';
    const raw = s.berrDate || 'May 2022';
    const m = raw.match(/^Q([1-4])\s+(\d{4})$/);
    if (m) {
      const monthByQ = ['Mar', 'Jun', 'Sep', 'Dec'];
      const yy = m[2].slice(2);
      return `${monthByQ[+m[1]-1]}-${yy}`;
    }
    const m2 = raw.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (m2) {
      return `${m2[1].slice(0,3)}-${m2[2].slice(2)}`;
    }
    return raw;
  }

  // ── Drawing primitives ──────────────────────────────────────────────────

  function drawHeader(doc, scheme) {
    doc.setFillColor(...INK);
    doc.rect(0, 0, PAGE_W, 30, 'F');

    // Project ref pill
    doc.setFillColor(...ACCENT);
    doc.roundedRect(MARGIN, 7, 28, 6, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(scheme.project_number || '—', MARGIN + 14, 11.3, { align: 'center' });

    // Road name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(scheme.road_name || 'Untitled scheme', MARGIN + 32, 12.8);

    // Right header label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(204, 204, 204);
    doc.text('BILL OF QUANTITIES — SUMMARY', PAGE_W - MARGIN, 12.8, { align: 'right' });

    // Sub-line
    const wd = workingDays(scheme.date_start, scheme.date_finish);
    const meta = [
      scheme.scheme_extent,
      scheme.ward_selected && `Ward ${scheme.ward_num}: ${scheme.ward_selected}`,
      scheme.area_m2 > 0 && `${fmtInt(scheme.area_m2)} m²`,
      scheme.date_start && `${scheme.date_start}${scheme.date_finish ? ` → ${scheme.date_finish}` : ''}`,
      wd && `${wd} wd`,
      scheme.treatment_type,
    ].filter(Boolean).join('  ·  ');
    doc.setFontSize(8.5);
    doc.text(meta, MARGIN + 32, 20, { maxWidth: PAGE_W - MARGIN - 60 });

    return 34;
  }

  function drawSummaryTable(doc, scheme, computed, boq, y) {
    // Geometry
    const labelW   = 120;
    const designW  = (CONTENT - labelW) / 2;
    const finalW   = (CONTENT - labelW) / 2;
    const designX  = MARGIN + labelW;
    const finalX   = designX + designW;

    // Title row
    doc.setFillColor(...HDR_BG);
    doc.rect(MARGIN, y, CONTENT, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text('SUMMARY SUM OF RATES FOR LOTS 1,2,3', MARGIN + 2, y + 4);
    // Column headers ("Design" / "Final")
    doc.text('Design', designX + designW/2, y + 4, { align: 'center' });
    doc.text('Final',  finalX + finalW/2,   y + 4, { align: 'center' });
    y += 6;

    // Sub-header row
    doc.setFillColor(...HDR_BG);
    doc.rect(designX, y, designW + finalW, 5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...INK2);
    doc.text('Tayside Contracts', designX + designW/2, y + 3.4, { align: 'center' });
    doc.text('Tayside Contracts', finalX  + finalW/2,  y + 3.4, { align: 'center' });
    y += 5;

    // Build series-num → subtotal map
    const totalsByNum = {};
    for (const g of computed.groups) totalsByNum[g.num] = g.subtotal;

    // Series rows
    let runningTotal = 0;
    doc.setFontSize(8);
    SUMMARY_SERIES.forEach((s, i) => {
      const rowH = 5.5;
      const fill = i % 2 === 0 ? null : ROW_LT;
      if (fill) { doc.setFillColor(...fill); doc.rect(MARGIN, y, CONTENT, rowH, 'F'); }
      doc.setDrawColor(...LINE);
      doc.line(MARGIN, y + rowH, MARGIN + CONTENT, y + rowH);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...INK);
      // Series 2700 label is long — wrap
      const labelLines = doc.splitTextToSize(s.label, labelW - 4);
      doc.text(labelLines.slice(0, 2), MARGIN + 2, y + 3.6);
      const v = totalsByNum[s.num] || 0;
      runningTotal += v;
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(255, 255, 255);
      doc.text(fmtMoneyOrDash(v), designX + designW - 3, y + 3.6, { align: 'right' });
      doc.text('£                    -', finalX + finalW - 3, y + 3.6, { align: 'right' });
      // Series 2700 needs an extra row of height because the label wraps
      const extraH = (s.num === 2700) ? 4 : 0;
      y += rowH + extraH;
    });

    // Subtotal row
    doc.setFillColor(...HDR_BG);
    doc.rect(MARGIN, y, CONTENT, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text('Subtotal', MARGIN + 2, y + 4);
    doc.text(fmtMoney(runningTotal), designX + designW - 3, y + 4, { align: 'right' });
    doc.text('£                    -',     finalX + finalW - 3,  y + 4, { align: 'right' });
    y += 7;

    // ── Series 6400 block ───────────────────────────────────────────────
    // Time Band Adjustment — typically £- (no time-band variation in the
    // standard scheme). Kept for layout fidelity with the TC sheet.
    const drawAdjRow = (label, value, finalValue, opts = {}) => {
      const rowH = 6;
      doc.setFillColor(...(opts.dark ? ADJ_BG : ADJ_LT));
      doc.rect(MARGIN, y, CONTENT, rowH, 'F');
      doc.setDrawColor(...LINE);
      doc.line(MARGIN, y + rowH, MARGIN + CONTENT, y + rowH);
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text(label, MARGIN + 2, y + 4, { maxWidth: labelW - 4 });
      doc.setFont('helvetica', 'bold');
      doc.text(value,      designX + designW - 3, y + 4, { align: 'right' });
      doc.text(finalValue, finalX  + finalW - 3,  y + 4, { align: 'right' });
      y += rowH;
    };

    drawAdjRow('SERIES 6400:  TIME BAND ADJUSTMENT TO SCHEDULE OF RATES AND PRICES*',
               '£                    -', 'No Offer', { dark: true });

    // Area Band = sum of percentage additions (OH&P, Contingency, OIS, …)
    const areaBandTotal = (computed.adjustments || []).reduce((s, a) => s + (+a.amount || 0), 0);
    drawAdjRow('Lot 2  SERIES 6400:  AREA BAND ADJUSTMENT TO SCHEDULE OF RATES AND PRICES*',
               fmtMoneyOrDash(areaBandTotal), '£                    -', { dark: true });
    drawAdjRow('Series 6400 Total', fmtMoneyOrDash(areaBandTotal), '£                    -',
               { bold: true });
    y += 1;

    // ── BERR INDICES block ──────────────────────────────────────────────
    const berrPct = (computed.useBERR ? (computed.berrIndex - 1) : 0);
    const berrAdj = +computed.berrAdjustmentAmt || 0;
    const berrLbl = berrDateLabel(boq);

    // Header row: blank | Base May 22 | Feb-24 | Feb-24
    const berrColW = (designW + finalW) / 3;
    const berrCol1X = designX;
    const berrCol2X = designX + berrColW;
    const berrCol3X = designX + 2 * berrColW;
    doc.setFillColor(...HDR_BG);
    doc.rect(MARGIN, y, CONTENT, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text('BERR INDICES', MARGIN + 2, y + 4);
    doc.text('Base May 22', berrCol1X + berrColW/2, y + 4, { align: 'center' });
    doc.text(berrLbl,       berrCol2X + berrColW/2, y + 4, { align: 'center' });
    doc.text(berrLbl,       berrCol3X + berrColW/2, y + 4, { align: 'center' });
    y += 6;

    const drawBerrRow = (label, c1, c2, c3, opts = {}) => {
      const rowH = 5.5;
      doc.setFillColor(...(opts.dark ? ADJ_BG : ADJ_LT));
      doc.rect(MARGIN, y, CONTENT, rowH, 'F');
      doc.setDrawColor(...LINE);
      doc.line(MARGIN, y + rowH, MARGIN + CONTENT, y + rowH);
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text(label, MARGIN + 2, y + 3.7, { maxWidth: labelW - 4 });
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.text(c1, berrCol1X + berrColW - 3, y + 3.7, { align: 'right' });
      doc.text(c2, berrCol2X + berrColW - 3, y + 3.7, { align: 'right' });
      doc.text(c3, berrCol3X + berrColW - 3, y + 3.7, { align: 'right' });
      y += rowH;
    };

    drawBerrRow('BERR INDICES - RATE 85/1', '555.7', fmtPct(berrPct), fmtPct(berrPct));
    drawBerrRow('BERR INDICES - RATE 85/2', '345.7', fmtPct(berrPct), fmtPct(berrPct));
    // Project total per index — without authoritative BEIS split formulas we
    // attribute 100 % of the BERR adjustment to RATE 85/2 (the general
    // construction index). Designers can edit by hand if a specific 85/1
    // bitumen split is required. Leaving 85/1 at £0.00 matches the typical
    // shape of the TC sheet (a tiny number) and avoids overstating it.
    drawBerrRow('BERR INDICES - 85/1 PROJECT TOTAL', '', '£0.00',           '£                    -');
    drawBerrRow('BERR INDICES - 85/2 PROJECT TOTAL', '', fmtMoneyOrDash(berrAdj), '£                    -');
    drawBerrRow('BERR INDICE Total', '', fmtMoneyOrDash(berrAdj), '£                    -',
                { bold: true });
    y += 1;

    // ── TC Project Value ────────────────────────────────────────────────
    const tcProjectValue = (+computed.pwp || 0);

    const drawValueRow = (label, value, finalValue, fillRGB) => {
      const rowH = 6.5;
      doc.setFillColor(...fillRGB);
      doc.rect(MARGIN, y, CONTENT, rowH, 'F');
      doc.setDrawColor(...LINE);
      doc.line(MARGIN, y + rowH, MARGIN + CONTENT, y + rowH);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(label, designX - 3, y + 4.2, { align: 'right' });
      doc.text(value, designX + designW - 3, y + 4.2, { align: 'right' });
      doc.text(finalValue, finalX + finalW - 3, y + 4.2, { align: 'right' });
      y += rowH;
    };

    drawValueRow('TC Project Value',      fmtMoneyOrDash(tcProjectValue), '£                    -', TC_PV);
    drawValueRow('Average Project Value', fmtMoneyOrDash(tcProjectValue), '£                    -', APV);
    // Number of Contractors row
    const rowH = 6.5;
    doc.setFillColor(...APV);
    doc.rect(MARGIN, y, CONTENT, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text('Number of Contractors', designX - 3, y + 4.2, { align: 'right' });
    doc.text('1', designX + designW - 3, y + 4.2, { align: 'right' });
    doc.text('-', finalX  + finalW - 3,  y + 4.2, { align: 'right' });
    y += rowH;

    return y;
  }

  function drawFooter(doc, scheme, boq, computed) {
    const overrideCount = Object.keys((boq && boq.overrides) || {}).length;
    const bits = [];
    if (computed.vatRate > 0) {
      bits.push(`+ VAT (${(computed.vatRate*100).toFixed(0)}%): ${
        '£' + ((+computed.vat || 0)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      }`);
      bits.push(`Total inc VAT: ${
        '£' + ((+computed.totalIncVat || 0)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      }`);
    }
    if (overrideCount) bits.push(`${overrideCount} override${overrideCount === 1 ? '' : 's'} from Master`);
    bits.push('Rates: Tayside Contracts JMCA schedule');
    bits.push('Generated ' + new Date().toISOString().slice(0, 10));

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...INK3);
    const lines = doc.splitTextToSize(bits.join(' · '), CONTENT);
    doc.text(lines, MARGIN, PAGE_H - 10);
  }

  // ── Public entry point ──────────────────────────────────────────────────
  window.exportBoQSummaryPDF = function (scheme, boq, computed) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('jsPDF not loaded');
    }
    if (!computed) computed = E.buildBoQLines(boq, scheme);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    let y = drawHeader(doc, scheme);
    y += 4;
    drawSummaryTable(doc, scheme, computed, boq, y);
    drawFooter(doc, scheme, boq, computed);

    const ref  = (scheme.project_number || 'BoQ').replace(/[^\w-]+/g, '_');
    const road = (scheme.road_name || 'scheme').replace(/[^\w-]+/g, '_');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    doc.save(`${ref}_${road}_BoQ_Summary_${date}.pdf`);

    window.dispatchEvent(new CustomEvent('rmp-download', {
      detail: { label: 'BoQ Summary — ' + (scheme.road_name || 'scheme'), ref: scheme.project_number || '' },
    }));
  };
})();
