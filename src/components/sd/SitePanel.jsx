// ─── SitePanel.jsx ───────────────────────────────────────────────────────────
// SD design — Step 1: site identity, length/width/area, and Location which
// drives Temperature Category.
// ─────────────────────────────────────────────────────────────────────────────
window.SD = window.SD || {};

window.SD.SitePanel = function SitePanel({ scheme, update, tempCat }) {
  const { QTY_BAND, QTY_BAND_LABEL, SCHEME_STATUS } = window.RN39;
  return (
    <div className="sd-panel sd-no-print" style={{ marginBottom: 14 }}>
      <div className="sd-panel-title">
        <span className="sd-step-num">1</span> Site Identification
      </div>
      <div className="sd-row-3">
        <label className="sd-field">
          <span className="sd-label">Site / Section Location</span>
          <input className="sd-input" value={scheme.siteName}
            onChange={e => update({ siteName: e.target.value })}
            placeholder="e.g. Charleston Drive" />
        </label>
        <label className="sd-field">
          <span className="sd-label">Road Number</span>
          <input className="sd-input" value={scheme.roadNumber}
            onChange={e => update({ roadNumber: e.target.value })} placeholder="e.g. U1234" />
        </label>
        <label className="sd-field">
          <span className="sd-label">Region / Area</span>
          <input className="sd-input" value={scheme.regionArea}
            onChange={e => update({ regionArea: e.target.value })} />
        </label>
      </div>
      <div className="sd-row-4">
        <label className="sd-field">
          <span className="sd-label">Length (m)</span>
          <input className="sd-input" type="number" inputMode="decimal" value={scheme.length}
            onChange={e => update({ length: e.target.value })} />
        </label>
        <label className="sd-field">
          <span className="sd-label">Width (m)</span>
          <input className="sd-input" type="number" inputMode="decimal" value={scheme.width}
            onChange={e => update({ width: e.target.value })} />
        </label>
        <label className="sd-field">
          <span className="sd-label">No. of Lanes</span>
          <input className="sd-input" type="number" inputMode="numeric" value={scheme.numLanes}
            onChange={e => update({ numLanes: e.target.value })} />
        </label>
        <label className="sd-field">
          <span className="sd-label">Area (m²)</span>
          <input className="sd-input" type="number" inputMode="decimal" value={scheme.areaM2}
            onChange={e => update({ areaM2: e.target.value })} />
          {scheme.areaM2 && !isNaN(parseFloat(scheme.areaM2)) && (
            <span className="sd-hint">{QTY_BAND_LABEL[QTY_BAND(parseFloat(scheme.areaM2))]}</span>
          )}
        </label>
      </div>
      <div className="sd-row-3">
        <label className="sd-field">
          <span className="sd-label">Lane(s)</span>
          <input className="sd-input" value={scheme.laneId}
            onChange={e => update({ laneId: e.target.value })} placeholder="NB/SB/EB/WB" />
        </label>
        <label className="sd-field">
          <span className="sd-label">Scheme Reference</span>
          <input className="sd-input" value={scheme.schemeRef}
            onChange={e => update({ schemeRef: e.target.value })} />
        </label>
        <label className="sd-field">
          <span className="sd-label">Location (drives Temp. Cat.)</span>
          <select className="sd-select" value={scheme.location}
            onChange={e => update({ location: e.target.value })}>
            <option>South</option><option>Central</option><option>North</option>
          </select>
          <span className="sd-hint">Temperature Category: <strong style={{ color: 'var(--sd-copper)' }}>{tempCat}</strong></span>
        </label>
      </div>
    </div>
  );
};
