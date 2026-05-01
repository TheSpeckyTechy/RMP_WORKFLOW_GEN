// ─── SDStorePatch.jsx ────────────────────────────────────────────────────────
// Three small patches that wire the SD module into the rest of RMP without
// touching the big store.jsx / SchemeDetail.jsx files:
//
//   1. window.baseScheme — augmented so every new scheme gets an `sd` block.
//      Existing schemes are lazy-seeded by SDTab on first open.
//   2. window.PACK_DOCS — adds the RN39 proforma as a downloadable handover doc.
//   3. window.__downloadSDProformaPdf — global one-shot PDF render so the
//      Generate-pack flow can include the proforma without the SD tab being
//      mounted. Renders ProformaView offscreen, html2canvas → jsPDF.
//
// Loaded AFTER src/data/store.jsx and the SD module, BEFORE App.jsx.
// ─────────────────────────────────────────────────────────────────────────────
(function () {

  // 1. Augment baseScheme so future schemes carry scheme.sd
  if (typeof window.baseScheme === 'function' && !window.baseScheme.__sdPatched) {
    const Original = window.baseScheme;
    const patched = function (overrides) {
      const base = Original(overrides);
      if (!base.sd && window.SD && typeof window.SD.defaultSD === 'function') {
        base.sd = window.SD.defaultSD();
      }
      return base;
    };
    patched.__sdPatched = true;
    window.baseScheme = patched;
  }

  // 2. Add the proforma to PACK_DOCS (if not already)
  if (Array.isArray(window.PACK_DOCS) && !window.PACK_DOCS.some(d => d.key === 'sd_proforma')) {
    window.PACK_DOCS.push({
      key: 'sd_proforma',
      name: 'RN39 Surface Dressing Proforma',
      type: 'PDF',
      auto: true,
      working: true,
    });
  }

  // 3. Global one-shot proforma PDF generator
  window.__downloadSDProformaPdf = async function (scheme) {
    if (!window.SD || !window.SD.ProformaView || !window.RN39_LOGIC) {
      throw new Error('SD module not loaded');
    }
    if (!window.html2canvas || !(window.jspdf && window.jspdf.jsPDF)) {
      throw new Error('PDF libraries not loaded');
    }
    const L = window.RN39_LOGIC;
    const sd = scheme.sd || (window.SD.seedFromMaster ? window.SD.seedFromMaster(scheme) : window.SD.defaultSD());

    const trafficCat   = L.getTrafficCategory(sd.cvDay);
    const tempCat      = L.getTempCategory(sd.location);
    const recommendation = L.recommendDressing(sd, trafficCat);
    const activeType   = L.getActiveType(sd, recommendation);
    const baseDesign   = L.getBaseDesign(sd, trafficCat, activeType);
    const totalAdj     = L.getTotalAdjustment(sd);
    const finalRates   = L.getFinalRates(baseDesign, totalAdj, activeType);
    const seasonalRisk = L.getSeasonalRisk(finalRates, sd);

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:white;';
    document.body.appendChild(container);

    try {
      const root = ReactDOM.createRoot(container);
      root.render(
        React.createElement(window.SD.ProformaView, {
          scheme: sd, finalRates, trafficCat, tempCat,
          totalAdjustment: totalAdj, activeType, seasonalRisk,
        })
      );
      await new Promise(r => setTimeout(r, 600));

      const node = container.querySelector('.pf-page');
      if (!node) throw new Error('Proforma node not rendered');

      const canvas = await window.html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
      const img    = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW  = pdf.internal.pageSize.getWidth();
      const pageH  = pdf.internal.pageSize.getHeight();
      const ratio  = canvas.width / canvas.height;
      let imgW = pageW, imgH = pageW / ratio;
      if (imgH > pageH) { imgH = pageH; imgW = pageH * ratio; }
      pdf.addImage(img, 'PNG', (pageW - imgW) / 2, 0, imgW, imgH);

      const ref = sd.schemeRef || scheme.project_number || scheme.id || 'scheme';
      const name = (sd.siteName || scheme.road_name || '').replace(/\s+/g, '_');
      pdf.save(`RN39_Proforma_${ref}${name ? '_' + name : ''}.pdf`);

      root.unmount();

      window.dispatchEvent(new CustomEvent('rmp-download', {
        detail: {
          label: 'RN39 Proforma — ' + (sd.siteName || scheme.road_name || 'scheme'),
          ref: ref,
          fn: '__downloadSDProformaPdf',
          schemeId: scheme.id,
        },
      }));
    } finally {
      document.body.removeChild(container);
    }
  };

})();
