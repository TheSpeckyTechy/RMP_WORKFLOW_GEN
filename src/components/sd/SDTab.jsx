// ─── SDTab.jsx ───────────────────────────────────────────────────────────────
// Surface Dressing Automator — RN39 design + proforma tab. Lazy-seeds
// scheme.sd from the master scheme on first open, computes all derived design
// values once per render, and switches between Design / Proforma views.
//
// Persists scheme.sd via SchemeContext.updateScheme. Print uses the
// .printing-sd-proforma body class so only the .pf-page is visible on paper.
//
// Exports (via window): SD.SDTab
// Depends on: React, SchemeContext, RN39, RN39_LOGIC, all SD.* panels & ProformaView, SD.RateEditor
// ─────────────────────────────────────────────────────────────────────────────
window.SD = window.SD || {};

window.SD.defaultSD = function defaultSD() {
  return {
    // Site
    siteName: '', schemeRef: '', roadNumber: '', regionArea: 'Dundee City',
    length: '', width: '', numLanes: '2', areaM2: '', laneId: 'NB', location: 'North',
    // Traffic
    cvDay: '', trafficSpeed: '30',
    // Hardness
    rhProbeDepth: '', rhProbeTemp: '20', hardness: 'Normal',
    minPSV: '65', maxAAV: '14',
    // Surface & geometry
    surfaceCondition: 'Normal & homogeneous',
    radiusCurvature: 'over250', junctionCrossing: 'nonApproach',
    gradientMag: 'lt5', gradientDir: 'flat', highStressBraking: false,
    // Treatment / adjustments
    dressingType: 'auto', binderGrade: 'intermediate', aggregate: 'rock',
    shape: 'f15', shade: 'open', condition: 'normal', speed: 'low',
    localTraffic: 'normal', installMonth: 7,
    // Pricing
    selectedItem: '',
    rateOverrides: {},
    // Designer
    designerName: '', designerInitials: '',
    designDate: new Date().toISOString().slice(0, 10),
    notes: '',
  };
};

window.SD.seedFromMaster = function seedFromMaster(scheme) {
  const sd = window.SD.defaultSD();
  if (scheme.road_name) sd.siteName = scheme.road_name;
  if (scheme.area_m2)   sd.areaM2   = String(scheme.area_m2);
  if (scheme.project_number) sd.schemeRef = scheme.project_number;
  if (scheme.prepared_by) {
    sd.designerName = scheme.prepared_by;
    sd.designerInitials = scheme.prepared_by.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 4).toUpperCase();
  }
  return sd;
};

window.SD.SDTab = function SDTab({ schemeId }) {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);
  const [view, setView] = React.useState('design');
  const [showRates, setShowRates] = React.useState(false);

  // Lazy seed scheme.sd if it doesn't exist yet (legacy schemes from before
  // this feature shipped). Persist immediately so subsequent renders are stable.
  React.useEffect(() => {
    if (!scheme.sd) {
      updateScheme(schemeId, { sd: window.SD.seedFromMaster(scheme) });
    }
  }, [schemeId]); // eslint-disable-line

  const sd = scheme.sd || window.SD.seedFromMaster(scheme);
  const updateSD = (patch) => updateScheme(schemeId, { sd: { ...sd, ...patch } });
  const setRateOverrides = (rateOverrides) => updateSD({ rateOverrides });

  const L = window.RN39_LOGIC;
  const { SERIES_700 } = window.RN39;

  // Effective Series 700 rates — overrides win per item.
  const effectiveSeries700 = React.useMemo(() => {
    const overrides = sd.rateOverrides || {};
    return SERIES_700.map(item => {
      const o = overrides[item.item];
      if (!o) return item;
      return { ...item, rates: { ...item.rates, ...o } };
    });
  }, [sd.rateOverrides]);

  const trafficCat   = React.useMemo(() => L.getTrafficCategory(sd.cvDay), [sd.cvDay]);
  const tempCat      = L.getTempCategory(sd.location);
  const probeHardness = React.useMemo(() => L.getProbeHardness(sd.rhProbeDepth, sd.rhProbeTemp), [sd.rhProbeDepth, sd.rhProbeTemp]);
  const suitability  = React.useMemo(() => L.getSuitability(sd, trafficCat), [sd.surfaceCondition, trafficCat]);
  const recommendation = React.useMemo(() => L.recommendDressing(sd, trafficCat), [sd, trafficCat]);
  const activeType   = L.getActiveType(sd, recommendation);
  const baseDesign   = React.useMemo(() => L.getBaseDesign(sd, trafficCat, activeType), [sd.hardness, trafficCat, activeType]);
  const totalAdj     = React.useMemo(() => L.getTotalAdjustment(sd), [sd]);
  const finalRates   = React.useMemo(() => L.getFinalRates(baseDesign, totalAdj, activeType), [baseDesign, totalAdj, activeType]);
  const chippingSpread = React.useMemo(() => L.getChippingSpread(finalRates), [finalRates]);
  const seasonalRisk = React.useMemo(() => L.getSeasonalRisk(finalRates, sd), [finalRates, sd.installMonth, sd.location]);
  const matchingItems = React.useMemo(() => L.getMatchingItems(finalRates, activeType, effectiveSeries700), [finalRates, activeType, effectiveSeries700]);

  // Auto-derive area from length × width when both present and area is blank.
  React.useEffect(() => {
    const l = parseFloat(sd.length), w = parseFloat(sd.width);
    if (!isNaN(l) && !isNaN(w) && !sd.areaM2) updateSD({ areaM2: (l * w).toFixed(0) });
  }, [sd.length, sd.width]); // eslint-disable-line

  // Auto-pick best matching Series 700 item if none selected.
  React.useEffect(() => {
    if (matchingItems.length === 0) return;
    if (sd.selectedItem && matchingItems.some(i => i.item === sd.selectedItem)) return;
    const best = L.pickDefaultItem(matchingItems, sd);
    if (best && best.item !== sd.selectedItem) updateSD({ selectedItem: best.item });
  }, [matchingItems, sd.minPSV, sd.binderGrade]); // eslint-disable-line

  // Print: only the .pf-page should be visible on paper.
  const handlePrint = () => {
    document.body.classList.add('printing-sd-proforma');
    const cleanup = () => {
      document.body.classList.remove('printing-sd-proforma');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  // PDF: render only the .pf-page node into html2canvas → jspdf, then notify
  // the existing download-tracker so it shows up in the bell menu.
  const handleDownloadPdf = async () => {
    const node = document.querySelector('.sd-tab .pf-page');
    if (!node) return;
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF || !window.html2canvas) {
      alert('PDF export libraries not loaded.');
      return;
    }
    const canvas = await window.html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    let imgW = pageW, imgH = pageW / ratio;
    if (imgH > pageH) { imgH = pageH; imgW = pageH * ratio; }
    pdf.addImage(img, 'PNG', (pageW - imgW) / 2, 0, imgW, imgH);
    const filename = `RN39_Proforma_${(sd.schemeRef || scheme.project_number || scheme.id).replace(/\s+/g, '_')}.pdf`;
    pdf.save(filename);
    window.dispatchEvent(new CustomEvent('rmp-download', {
      detail: { label: 'RN39 Proforma — ' + (sd.siteName || scheme.road_name || 'scheme'),
                ref: sd.schemeRef || scheme.project_number || '',
                fn: '__downloadSDProformaPdf', schemeId: scheme.id },
    }));
  };

  // Expose for GenerateModal so the pack bundle can include the proforma PDF.
  React.useEffect(() => {
    window.__downloadSDProformaPdf = async () => {
      // GenerateModal iterates over all scheme docs; ensure we're on this tab.
      if (view !== 'proforma') setView('proforma');
      await new Promise(r => setTimeout(r, 200));
      await handleDownloadPdf();
    };
    return () => { window.__downloadSDProformaPdf = null; };
  }, [scheme.id, sd, view]); // eslint-disable-line

  return (
    <div className="sd-tab">
      <div className="sd-actions sd-no-print" style={{ marginTop: 0, marginBottom: 14 }}>
        <button className={`sd-btn ${view === 'design' ? '' : 'sd-btn-secondary'}`}
          onClick={() => setView('design')} type="button">Design</button>
        <button className={`sd-btn ${view === 'proforma' ? '' : 'sd-btn-secondary'}`}
          onClick={() => setView('proforma')} type="button">View Proforma</button>
        <span style={{ flex: 1 }} />
        {view === 'proforma' && (
          <>
            <button className="sd-btn" onClick={handlePrint} type="button">⎙ Print</button>
            <button className="sd-btn" onClick={handleDownloadPdf} type="button">⬇ Download PDF</button>
          </>
        )}
      </div>

      {view === 'design' && (
        <>
          <window.SD.SitePanel scheme={sd} update={updateSD} tempCat={tempCat} />
          <window.SD.TrafficPanel scheme={sd} update={updateSD} trafficCat={trafficCat} />
          <div className="sd-grid">
            <window.SD.HardnessPanel scheme={sd} update={updateSD} probeHardness={probeHardness} />
            <window.SD.SurfacePanel scheme={sd} update={updateSD} suitability={suitability} />
          </div>
          <window.SD.TreatmentPanel scheme={sd} update={updateSD} recommendation={recommendation}
            activeType={activeType} baseDesign={baseDesign} />
          {recommendation?.type !== 'hfs' && (
            <window.SD.AdjustmentsPanel scheme={sd} update={updateSD} totalAdjustment={totalAdj} />
          )}
          {finalRates && (
            <window.SD.SeasonalPanel scheme={sd} update={updateSD} finalRates={finalRates} seasonalRisk={seasonalRisk} />
          )}
          {finalRates && matchingItems.length > 0 && (
            <window.SD.PricingPanel scheme={sd} update={updateSD} matchingItems={matchingItems}
              chippingSpread={chippingSpread} onShowRates={() => setShowRates(true)} />
          )}
          <window.SD.DesignerPanel scheme={sd} update={updateSD} />
        </>
      )}

      {view === 'proforma' && (
        <window.SD.ProformaView
          scheme={sd}
          finalRates={finalRates}
          trafficCat={trafficCat}
          tempCat={tempCat}
          totalAdjustment={totalAdj}
          activeType={activeType}
          seasonalRisk={seasonalRisk}
          onBack={() => setView('design')}
          onPrint={handlePrint}
        />
      )}

      {showRates && (
        <window.SD.RateEditor
          rates={sd.rateOverrides || {}}
          onRatesChange={setRateOverrides}
          onClose={() => setShowRates(false)}
        />
      )}
    </div>
  );
};
