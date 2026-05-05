// ─── BoQSummaryPDF.jsx ───────────────────────────────────────────────────────
// Compiles a single-page A4 PDF that mirrors the BoQ tab's Summary panel —
// project header, stacked cost-breakdown bar, series cards grid, totals
// adjustment ladder, and rates footer. Intended for the handover pack.
//
// Exports: window.exportBoQSummaryPDF(scheme, boq, computed)
// Depends on: window.jspdf (jsPDF UMD), window.BOQ_ENGINE
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  const E = window.BOQ_ENGINE;

  // 12-entry palette aligned with BoQSummary on-screen colours.
  const SERIES_COLOUR = {
    100:  [198, 93, 46],
    200:  [122, 90, 58],
    300:  [46, 122, 138],
    400:  [74, 111, 165],
    500:  [91, 94, 168],
    600:  [61, 122, 92],
    700:  [184, 92, 26],
    1100: [138, 106, 42],
    1200: [74, 138, 61],
    2700: [107, 74, 138],
    3000: [61, 138, 109],
    6400: [138, 61, 92],
  };
  const colourFor = (n) => SERIES_COLOUR[n] || [122, 122, 122];

  const ACCENT = [198, 87, 44];        // matches --accent
  const INK    = [17, 17, 17];
  const INK2   = [68, 68, 68];
  const INK3   = [136, 136, 136];
  const LINE   = [228, 228, 228];
  const WASH   = [253, 240, 230];      // accent-wash
  const AMBER  = [180, 83, 9];

  // A4 portrait, mm, with comfortable margins.
  const PAGE_W  = 210;
  const PAGE_H  = 297;
  const MARGIN  = 14;
  const CONTENT = PAGE_W - 2 * MARGIN;

  // Helpers ─────────────────────────────────────────────────────────────────
  const fmtMoney = (v) => '£' + (+v || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fmtInt   = (v) => (+v || 0).toLocaleString();
  const fmtPct   = (v) => ((+v || 0) * 100).toFixed(1).replace(/\.0$/, '') + '%';

  function workingDays(start, finish) {
    if (!start || !finish) return null;
    const p = s => { const [d,m,y] = String(s).split('/'); return new Date(+y, +m-1, +d); };
    const a = p(start), b = p(finish);
    if (isNaN(a) || isNaN(b)) return null;
    return Math.max(1, Math.round((b - a) / 86400000 * 5/7));
  }

  // Wrap text to fit width — uses jsPDF's splitTextToSize.
  function wrap(doc, txt, w) {
    return doc.splitTextToSize(String(txt || ''), w);
  }

  // Single-section drawers ──────────────────────────────────────────────────

  function drawHeader(doc, scheme, computed, y) {
    // Banner band
    doc.setFillColor(...INK);
    doc.rect(0, 0, PAGE_W, 32, 'F');

    // Project ref pill
    doc.setFillColor(...ACCENT);
    doc.roundedRect(MARGIN, 8, 32, 6.5, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(scheme.project_number || '—', MARGIN + 16, 12.6, { align: 'center' });

    // Road name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(scheme.road_name || 'Untitled scheme', MARGIN + 36, 14);

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

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(204, 204, 204);
    doc.text(meta, MARGIN + 36, 22, { maxWidth: PAGE_W - MARGIN - 60 });

    // Title chip on right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('BILL OF QUANTITIES — SUMMARY', PAGE_W - MARGIN, 14, { align: 'right' });

    return 36;
  }

  function drawCostBar(doc, computed, y) {
    if (!computed.subtotal || !computed.groups.length) return y;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...INK3);
    doc.text('COST BREAKDOWN', MARGIN, y);
    y += 3;

    const barH = 7;
    let x = MARGIN;
    for (const g of computed.groups) {
      const w = (g.subtotal / computed.subtotal) * CONTENT;
      doc.setFillColor(...colourFor(g.num));
      doc.rect(x, y, w, barH, 'F');
      // Series number label if wide enough
      if (w > 12) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(String(g.num), x + w/2, y + barH/2 + 1.4, { align: 'center' });
      }
      x += w;
    }
    y += barH + 5;

    // Legend, 2 cols
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const colW = CONTENT / 2;
    let col = 0;
    let rowY = y;
    for (const g of computed.groups) {
      const cx = MARGIN + col * colW;
      doc.setFillColor(...colourFor(g.num));
      doc.rect(cx, rowY - 2.4, 2.4, 2.4, 'F');
      doc.setTextColor(...INK2);
      doc.text(`${g.num} · ${g.title}`, cx + 4, rowY);
      doc.setTextColor(...INK3);
      doc.text(`${fmtMoney(g.subtotal)}  (${((g.subtotal / computed.subtotal) * 100).toFixed(1)}%)`,
               cx + colW - 1, rowY, { align: 'right' });
      col = 1 - col;
      if (col === 0) rowY += 4.5;
    }
    if (col === 1) rowY += 4.5;
    return rowY + 2;
  }

  function drawSeriesCards(doc, computed, y) {
    if (!computed.groups.length) return y;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...INK3);
    doc.text('BY SERIES', MARGIN, y);
    y += 3;

    const cols = 3;
    const cardW = (CONTENT - 4 * (cols - 1)) / cols;
    const cardH = 22;
    let col = 0;
    let rowY = y;
    for (const g of computed.groups) {
      const cx = MARGIN + col * (cardW + 4);
      // Card body
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...LINE);
      doc.roundedRect(cx, rowY, cardW, cardH, 1.2, 1.2, 'FD');
      // Series chip
      doc.setFillColor(...colourFor(g.num));
      doc.roundedRect(cx + 3, rowY + 3, 12, 4.5, 0.8, 0.8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(String(g.num), cx + 9, rowY + 6.1, { align: 'center' });
      // Item count
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...INK3);
      doc.text(`${g.itemCount} item${g.itemCount === 1 ? '' : 's'}`, cx + 17, rowY + 6.1);
      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      const titleLines = wrap(doc, g.title, cardW - 6);
      doc.text(titleLines.slice(0, 1), cx + 3, rowY + 12);
      // Subtotal
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...colourFor(g.num));
      doc.text(fmtMoney(g.subtotal), cx + 3, rowY + 18);
      // Pct
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...INK3);
      const pct = computed.subtotal ? (g.subtotal / computed.subtotal) * 100 : 0;
      doc.text(`${pct.toFixed(1)}%`, cx + cardW - 3, rowY + 18, { align: 'right' });

      col++;
      if (col >= cols) { col = 0; rowY += cardH + 3; }
    }
    if (col !== 0) rowY += cardH + 3;
    return rowY + 1;
  }

  function drawGrandTotal(doc, computed, y) {
    const panelH = 38 + (computed.adjustments.length * 5) + (computed.useBERR ? 5 : 0) + (computed.vatRate > 0 ? 5 : 0);
    doc.setFillColor(...INK);
    doc.roundedRect(MARGIN, y, CONTENT, panelH, 1.5, 1.5, 'F');

    let lineY = y + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text('TOTALS', MARGIN + 4, lineY);
    lineY += 5;

    const drawRow = (label, value, opts = {}) => {
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setFontSize(opts.large ? 12 : 9);
      doc.setTextColor(255, 255, 255);
      doc.text(label, MARGIN + 4, lineY);
      doc.text(value, MARGIN + CONTENT - 4, lineY, { align: 'right' });
      lineY += opts.large ? 7 : 5;
    };

    drawRow('Subtotal (ex-VAT)', fmtMoney(computed.subtotal));
    for (const a of computed.adjustments) {
      drawRow(`+ ${a.label} (${fmtPct(a.pct)})`, fmtMoney(a.amount));
    }
    if (computed.useBERR) {
      drawRow(`BERR ${computed.berrDate} (×${computed.berrIndex.toFixed(3)})`,
              (computed.berrAdjustmentAmt >= 0 ? '+ ' : '− ') + fmtMoney(Math.abs(computed.berrAdjustmentAmt)));
    }
    if (computed.adjustments.length || computed.useBERR) {
      // Subtle separator
      doc.setDrawColor(80, 80, 80);
      doc.line(MARGIN + 4, lineY - 2.5, MARGIN + CONTENT - 4, lineY - 2.5);
      drawRow('PWP (Works value)', fmtMoney(computed.pwp));
    }
    if (computed.vatRate > 0) {
      drawRow(`+ VAT (${(computed.vatRate * 100).toFixed(0)}%)`, fmtMoney(computed.vat));
    }
    // Final separator + grand total
    doc.setDrawColor(120, 120, 120);
    doc.line(MARGIN + 4, lineY - 2, MARGIN + CONTENT - 4, lineY - 2);
    lineY += 1;
    drawRow(computed.vatRate > 0 ? 'TOTAL (incl. VAT)' : 'TOTAL (ex-VAT)',
            fmtMoney(computed.totalIncVat), { bold: true, large: true });

    return y + panelH + 4;
  }

  function drawFooter(doc, scheme, boq, computed, y) {
    const overrideCount = Object.keys((boq && boq.overrides) || {}).length;
    const bits = [];
    if (overrideCount) bits.push(`${overrideCount} override${overrideCount === 1 ? '' : 's'} from Master`);
    if (computed.useBERR) bits.push(`BERR ${computed.berrDate} ×${computed.berrIndex.toFixed(3)}`);
    if (computed.areaBandOverride) bits.push(`Area band forced: ${computed.areaBandOverride}`);
    bits.push('Rates: Tayside Contracts JMCA schedule');
    bits.push('Generated ' + new Date().toISOString().slice(0, 10));

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...INK3);
    const txt = bits.join(' · ');
    const lines = wrap(doc, txt, CONTENT);
    doc.text(lines, MARGIN, PAGE_H - 10);
  }

  // Public entry point ─────────────────────────────────────────────────────
  window.exportBoQSummaryPDF = function (scheme, boq, computed) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('jsPDF not loaded');
    }
    if (!computed) computed = E.buildBoQLines(boq, scheme);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    let y = drawHeader(doc, scheme, computed, 0);
    y += 4;
    y = drawCostBar(doc, computed, y);
    y += 2;
    y = drawSeriesCards(doc, computed, y);
    y += 3;
    drawGrandTotal(doc, computed, y);
    drawFooter(doc, scheme, boq, computed, 0);

    const ref  = (scheme.project_number || 'BoQ').replace(/[^\w-]+/g, '_');
    const road = (scheme.road_name || 'scheme').replace(/[^\w-]+/g, '_');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    doc.save(`${ref}_${road}_BoQ_Summary_${date}.pdf`);

    window.dispatchEvent(new CustomEvent('rmp-download', {
      detail: { label: 'BoQ Summary — ' + (scheme.road_name || 'scheme'), ref: scheme.project_number || '' },
    }));
  };
})();
