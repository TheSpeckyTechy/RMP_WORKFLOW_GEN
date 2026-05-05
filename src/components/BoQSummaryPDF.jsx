// ─── BoQSummaryPDF.jsx ───────────────────────────────────────────────────────
// Renders the TC BoQ Summary sheet as an HTML table, then captures it with
// html2canvas and saves as a single-page A4 PDF. The HTML uses Excel-style
// pale-blue / pink / green fills so the printed output matches what the
// designer sees in the TC BoQ workbook's Summary tab.
//
// Exports: window.exportBoQSummaryPDF(scheme, boq, computed)
// Depends on: window.jspdf (jsPDF UMD), window.html2canvas, window.BOQ_ENGINE
// ─────────────────────────────────────────────────────────────────────────────

(function () {

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

  const fmtMoney = (v) => '£ ' + (+v || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fmtMoneyOrDash = (v) => (+v > 0) ? fmtMoney(v) : '£                    -';
  const fmtPct = (v) => ((+v || 0) * 100).toFixed(2) + '%';

  // BERR index date display — converts e.g. "Q4 2025" → "Dec-25" and
  // "May 2022" → "May-22" to match the TC sheet's month-year shorthand.
  function berrDateLabel(boq) {
    const raw = (boq && boq.settings && boq.settings.berrDate) || 'May 2022';
    const q = raw.match(/^Q([1-4])\s+(\d{4})$/);
    if (q) {
      const monthByQ = ['Mar', 'Jun', 'Sep', 'Dec'];
      return `${monthByQ[+q[1]-1]}-${q[2].slice(2)}`;
    }
    const my = raw.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (my) return `${my[1].slice(0,3)}-${my[2].slice(2)}`;
    return raw;
  }

  // Build the HTML table that mirrors the TC Summary sheet.
  function buildSummaryHtml(scheme, boq, computed) {
    const totalsByNum = {};
    for (const g of computed.groups) totalsByNum[g.num] = g.subtotal;
    const seriesTotal = SUMMARY_SERIES.reduce((s, r) => s + (+totalsByNum[r.num] || 0), 0);

    // Series 6400: Lot 2 Area Band = sum of percentage additions
    const areaBandTotal = (computed.adjustments || []).reduce((s, a) => s + (+a.amount || 0), 0);
    const series6400Total = areaBandTotal;

    // BERR
    const useBerr = !!computed.useBERR;
    const berrPct = useBerr ? (computed.berrIndex - 1) : 0;
    const berrAdj = +computed.berrAdjustmentAmt || 0;
    const berrLbl = berrDateLabel(boq);

    // Final-column money-or-dash values
    const dashFinal = '£                    -';

    // Header line shown above the table
    const meta = [
      scheme.scheme_extent,
      scheme.ward_selected && `Ward ${scheme.ward_num}: ${scheme.ward_selected}`,
      scheme.area_m2 > 0 && `${(+scheme.area_m2).toLocaleString()} m²`,
      scheme.date_start && `${scheme.date_start}${scheme.date_finish ? ` → ${scheme.date_finish}` : ''}`,
      scheme.treatment_type,
    ].filter(Boolean).join('  ·  ');

    // Excel-matching styles (inline so html2canvas catches them all reliably)
    const td = 'padding:5px 8px; border:1px solid #BFBFBF; font-size:11pt; vertical-align:middle;';
    const tdMoney = td + ' text-align:right; font-family:Calibri,Arial,sans-serif;';
    const tdLabel = td + ' font-family:Calibri,Arial,sans-serif;';
    const blueHdr = ' background:#DDEBF7; font-weight:bold;';
    const blueData = ' background:#DDEBF7;';      // pale blue Design-column fill
    const greyAdj = ' background:#D9D9D9;';       // 6400 adjustments row
    const orangeAdj = ' background:#FCE4D6; font-weight:bold;';   // BERR % cells
    const tcPink = ' background:#FBE5D6; font-weight:bold;';
    const apvGreen = ' background:#E2EFDA; font-weight:bold;';

    let rows = '';
    // Title row
    rows += `<tr>
      <td style="${tdLabel}${blueHdr} width:54%;">SUMMARY SUM OF RATES FOR LOTS 1,2,3</td>
      <td style="${td}${blueHdr} text-align:center; width:8%;"></td>
      <td style="${td}${blueHdr} text-align:center; width:15%;">Design</td>
      <td style="${td} width:3%;"></td>
      <td style="${td}${blueHdr} text-align:center; width:15%;">Final</td>
    </tr>`;
    // Sub-header row (Tayside Contracts both sides)
    rows += `<tr>
      <td style="${tdLabel}"></td>
      <td style="${td}"></td>
      <td style="${td}${blueData} font-weight:bold; text-align:center;">Tayside Contracts</td>
      <td style="${td}"></td>
      <td style="${td}${blueData} font-weight:bold; text-align:center;">Tayside Contracts</td>
    </tr>`;

    // Series rows
    for (const s of SUMMARY_SERIES) {
      const v = totalsByNum[s.num] || 0;
      rows += `<tr>
        <td style="${tdLabel}" colspan="2">${s.label}</td>
        <td style="${tdMoney}${blueData}">${v > 0 ? fmtMoney(v) : '£                    -'}</td>
        <td style="${td}"></td>
        <td style="${tdMoney}${blueData}">${dashFinal}</td>
      </tr>`;
    }
    // Subtotal row
    rows += `<tr>
      <td style="${tdLabel}" colspan="2"></td>
      <td style="${tdMoney}${blueData} font-weight:bold;">${fmtMoney(seriesTotal)}</td>
      <td style="${td}"></td>
      <td style="${tdMoney}${blueData}">${dashFinal}</td>
    </tr>`;
    // Spacer
    rows += `<tr><td colspan="5" style="height:6px; border:none;"></td></tr>`;

    // Series 6400 — Time Band
    rows += `<tr>
      <td style="${tdLabel}${greyAdj} width:5%;"></td>
      <td style="${tdLabel}${greyAdj}">SERIES 6400:  TIME BAND ADJUSTMENT TO SCHEDULE OF RATES AND PRICES*</td>
      <td style="${tdMoney}${greyAdj}">£                    -</td>
      <td style="${td}"></td>
      <td style="${tdMoney}${greyAdj} text-align:center;">No Offer</td>
    </tr>`;
    // Series 6400 — Area Band (Lot 2)
    rows += `<tr>
      <td style="${tdLabel}${greyAdj} text-align:center;">Lot 2</td>
      <td style="${tdLabel}${greyAdj}">SERIES 6400:  AREA BAND ADJUSTMENT TO SCHEDULE OF RATES AND PRICES*</td>
      <td style="${tdMoney}${greyAdj}">${fmtMoneyOrDash(areaBandTotal)}</td>
      <td style="${td}"></td>
      <td style="${tdMoney}${greyAdj}">${dashFinal}</td>
    </tr>`;
    // Series 6400 Total
    rows += `<tr>
      <td style="${tdLabel}" colspan="2" style="text-align:right; font-style:italic;">Series 6400 Total</td>
      <td style="${tdMoney}${blueData} font-weight:bold;">${fmtMoneyOrDash(series6400Total)}</td>
      <td style="${td}"></td>
      <td style="${tdMoney}${blueData}">${dashFinal}</td>
    </tr>`;
    rows += `<tr><td colspan="5" style="height:6px; border:none;"></td></tr>`;

    // BERR INDICES header row
    rows += `<tr>
      <td style="${tdLabel}${blueData} font-weight:bold;" colspan="2">BERR INDICES &nbsp;&nbsp;&nbsp; <span style="font-weight:normal;">Base May 22</span></td>
      <td style="${td}${orangeAdj} text-align:center;">${berrLbl}</td>
      <td style="${td}"></td>
      <td style="${td}${orangeAdj} text-align:center;">${berrLbl}</td>
    </tr>`;
    // 85/1
    rows += `<tr>
      <td style="${tdLabel}${blueData}" colspan="2">BERR INDICES - RATE 85/1 &nbsp;&nbsp;&nbsp; <span style="font-weight:normal;">555.7</span></td>
      <td style="${tdMoney}${orangeAdj}">${fmtPct(berrPct)}</td>
      <td style="${td}"></td>
      <td style="${tdMoney}${orangeAdj}">${fmtPct(berrPct)}</td>
    </tr>`;
    // 85/2
    rows += `<tr>
      <td style="${tdLabel}${blueData}" colspan="2">BERR INDICES - RATE 85/2 &nbsp;&nbsp;&nbsp; <span style="font-weight:normal;">345.7</span></td>
      <td style="${tdMoney}${orangeAdj}">${fmtPct(berrPct)}</td>
      <td style="${td}"></td>
      <td style="${tdMoney}${orangeAdj}">${fmtPct(berrPct)}</td>
    </tr>`;
    // 85/1 PROJECT TOTAL
    rows += `<tr>
      <td style="${tdLabel}${blueData}" colspan="2">BERR INDICES - 85/1 PROJECT TOTAL</td>
      <td style="${tdMoney}${blueData}">£0.00</td>
      <td style="${td}"></td>
      <td style="${tdMoney}${blueData}">${dashFinal}</td>
    </tr>`;
    // 85/2 PROJECT TOTAL
    rows += `<tr>
      <td style="${tdLabel}${blueData}" colspan="2">BERR INDICES - 85/2 PROJECT TOTAL</td>
      <td style="${tdMoney}${blueData}">${fmtMoneyOrDash(berrAdj)}</td>
      <td style="${td}"></td>
      <td style="${tdMoney}${blueData}">${dashFinal}</td>
    </tr>`;
    // BERR INDICE Total
    rows += `<tr>
      <td style="${tdLabel}" colspan="2" style="text-align:right; font-style:italic;">BERR INDICE Total</td>
      <td style="${tdMoney}${blueData} font-weight:bold;">${fmtMoneyOrDash(berrAdj)}</td>
      <td style="${td}"></td>
      <td style="${tdMoney}${blueData}">${dashFinal}</td>
    </tr>`;
    rows += `<tr><td colspan="5" style="height:6px; border:none;"></td></tr>`;

    // TC Project Value
    const tcVal = +computed.pwp || 0;
    rows += `<tr>
      <td style="${tdLabel}${tcPink}" colspan="2"></td>
      <td style="${tdMoney}${tcPink}" colspan="3">
        <span style="float:left; font-style:italic;">TC Project Value</span>
        <span style="float:right; font-weight:bold;">${fmtMoneyOrDash(tcVal)}</span>
        <span style="display:block; clear:both;"></span>
      </td>
    </tr>`;
    rows += `<tr><td colspan="5" style="height:4px; border:none;"></td></tr>`;
    // Average Project Value
    rows += `<tr>
      <td style="${tdLabel}${apvGreen}" colspan="2"></td>
      <td style="${tdMoney}${apvGreen}" colspan="3">
        <span style="float:left; font-style:italic;">Average Project Value</span>
        <span style="float:right; font-weight:bold;">${fmtMoneyOrDash(tcVal)}</span>
        <span style="display:block; clear:both;"></span>
      </td>
    </tr>`;
    // Number of Contractors
    rows += `<tr>
      <td style="${tdLabel}${apvGreen}" colspan="2"></td>
      <td style="${tdMoney}${apvGreen}" colspan="3">
        <span style="float:left; font-style:italic;">Number of Contractors</span>
        <span style="float:right; font-weight:bold;">1</span>
        <span style="display:block; clear:both;"></span>
      </td>
    </tr>`;

    return `
      <div style="font-family:Calibri,Arial,sans-serif; color:#000; padding:24px;">
        <div style="font-size:14pt; font-weight:bold; margin-bottom:2px;">
          ${(scheme.project_number || '—')} · ${scheme.road_name || 'Untitled scheme'}
        </div>
        <div style="font-size:9pt; color:#444; margin-bottom:12px;">
          ${meta || '&nbsp;'}
        </div>
        <table style="width:100%; border-collapse:collapse;">
          ${rows}
        </table>
        <div style="font-size:8pt; color:#777; margin-top:14px; font-style:italic;">
          Rates: Tayside Contracts JMCA schedule · Generated ${new Date().toISOString().slice(0, 10)}
        </div>
      </div>
    `;
  }

  // Public entry — renders the HTML offscreen, captures with html2canvas,
  // then saves as a single-page A4 portrait PDF.
  window.exportBoQSummaryPDF = function (scheme, boq, computed) {
    const E = window.BOQ_ENGINE;
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF not loaded');
    if (!window.html2canvas)                 throw new Error('html2canvas not loaded');
    if (!computed && E)                      computed = E.buildBoQLines(boq, scheme);
    if (!computed)                           throw new Error('No BoQ data');

    const html = buildSummaryHtml(scheme, boq, computed);

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '794px';   // A4 portrait width @ 96dpi
    container.style.background = '#ffffff';
    container.innerHTML = html;
    document.body.appendChild(container);

    return window.html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    }).then(canvas => {
      document.body.removeChild(container);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      const pageW = 210;
      const pageH = 297;
      const imgW  = pageW;
      const imgH  = (canvas.height * pageW) / canvas.width;

      const imgData = canvas.toDataURL('image/png');
      if (imgH <= pageH) {
        pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
      } else {
        // Multi-page fallback if the table grows beyond one page.
        let position = 0;
        while (position < imgH) {
          if (position > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, -position, imgW, imgH);
          position += pageH;
        }
      }

      const ref  = (scheme.project_number || 'BoQ').replace(/[^\w-]+/g, '_');
      const road = (scheme.road_name || 'scheme').replace(/[^\w-]+/g, '_');
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      pdf.save(`${ref}_${road}_BoQ_Summary_${date}.pdf`);

      window.dispatchEvent(new CustomEvent('rmp-download', {
        detail: { label: 'BoQ Summary — ' + (scheme.road_name || 'scheme'), ref: scheme.project_number || '' },
      }));
    }).catch(err => {
      try { document.body.removeChild(container); } catch (e) {}
      throw err;
    });
  };
})();
