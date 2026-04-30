// ─── SurfacePanel.jsx ────────────────────────────────────────────────────────
// SD design — Step 4: Fig 8.1 surface characteristic, Table 9.2.6 binder-rich
// condition, gradient and curvature, plus the high-stress braking flag.
// ─────────────────────────────────────────────────────────────────────────────
window.SD = window.SD || {};

window.SD.SurfacePanel = function SurfacePanel({ scheme, update, suitability }) {
  const { SUITABILITY_MATRIX, CONDITION_GUIDANCE, SURFACE_TO_CONDITION } = window.RN39;

  const onSurfaceChange = (e) => {
    const v = e.target.value;
    const mapped = SURFACE_TO_CONDITION[v];
    update(mapped ? { surfaceCondition: v, condition: mapped } : { surfaceCondition: v });
  };
  return (
    <div className="sd-panel">
      <div className="sd-panel-title">
        <span className="sd-step-num">4</span> Surface &amp; Geometry
      </div>
      <label className="sd-field">
        <span className="sd-label">Surface Characteristic (RN39 Fig. 8.1)</span>
        <select className="sd-select" value={scheme.surfaceCondition} onChange={onSurfaceChange}>
          {Object.keys(SUITABILITY_MATRIX).map(k => <option key={k}>{k}</option>)}
        </select>
        <span className="sd-hint">{CONDITION_GUIDANCE[scheme.surfaceCondition]}</span>
      </label>
      <label className="sd-field">
        <span className="sd-label">Surface Condition (Binder adjustment)</span>
        <select className="sd-select" value={scheme.condition}
          onChange={e => update({ condition: e.target.value })}>
          <option value="veryRich">Very binder rich (−0.2)</option>
          <option value="rich">Binder rich (−0.1)</option>
          <option value="normal">Normal (0)</option>
          <option value="wheelTracks">Texture in wheel tracks (+0.1)</option>
          <option value="lean">Binder lean / Porous (+0.2)</option>
        </select>
      </label>
      <div className="sd-row">
        <label className="sd-field">
          <span className="sd-label">Radius of Curvature</span>
          <select className="sd-select" value={scheme.radiusCurvature}
            onChange={e => update({ radiusCurvature: e.target.value })}>
            <option value="under100">Under 100 m</option>
            <option value="100to250">100 – 250 m</option>
            <option value="over250">Over 250 m</option>
          </select>
        </label>
        <label className="sd-field">
          <span className="sd-label">Junction or Crossing</span>
          <select className="sd-select" value={scheme.junctionCrossing}
            onChange={e => update({ junctionCrossing: e.target.value })}>
            <option value="approach">Approach</option>
            <option value="nonApproach">Non-approach</option>
          </select>
        </label>
      </div>
      <div className="sd-row">
        <label className="sd-field">
          <span className="sd-label">Gradient Magnitude</span>
          <select className="sd-select" value={scheme.gradientMag}
            onChange={e => update({ gradientMag: e.target.value })}>
            <option value="lt5">Up to 5% (0)</option>
            <option value="mid">5 – 10% (+0.1)</option>
            <option value="gt10">Over 10% (+0.2)</option>
          </select>
        </label>
        <label className="sd-field">
          <span className="sd-label">Gradient Direction</span>
          <select className="sd-select" value={scheme.gradientDir}
            onChange={e => update({ gradientDir: e.target.value })}>
            <option value="flat">Flat / N/A</option>
            <option value="uphill">Uphill (reduces)</option>
            <option value="downhill">Downhill (increases)</option>
          </select>
        </label>
      </div>
      <label className="sd-field" style={{ marginBottom: 0 }}>
        <span className="sd-label">Site Risk</span>
        <label className="sd-checkbox-label">
          <input type="checkbox" checked={scheme.highStressBraking}
            onChange={e => update({ highStressBraking: e.target.checked })} />
          <span style={{ color: scheme.highStressBraking ? 'var(--sd-danger)' : 'var(--sd-text-muted)' }}>
            High-stress braking zone (e.g. fast dual carriageway → roundabout)
          </span>
        </label>
      </label>
      {suitability && !scheme.highStressBraking && (
        <div className="sd-suitability-box" style={{ borderLeftColor: suitability.color, background: suitability.color + '18' }}>
          <div className="sd-suitability-title" style={{ color: suitability.color }}>{suitability.label.toUpperCase()}</div>
          <div className="sd-suitability-desc">{suitability.desc}</div>
        </div>
      )}
    </div>
  );
};
