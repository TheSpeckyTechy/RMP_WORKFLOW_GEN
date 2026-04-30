// ─── HardnessPanel.jsx ───────────────────────────────────────────────────────
// SD design — Step 3: RH probe depth/temp → suggested hardness category, plus
// PSV / AAV inputs for chipping selection.
// ─────────────────────────────────────────────────────────────────────────────
window.SD = window.SD || {};

window.SD.HardnessPanel = function HardnessPanel({ scheme, update, probeHardness }) {
  const { HARDNESS_GUIDANCE } = window.RN39;
  const { correctProbeDepth, getProbeHardness } = window.RN39_LOGIC;

  const onProbeChange = (e) => {
    const v = e.target.value;
    const suggested = getProbeHardness(v, scheme.rhProbeTemp);
    update(suggested ? { rhProbeDepth: v, hardness: suggested } : { rhProbeDepth: v });
  };
  const onTempChange = (e) => {
    const v = e.target.value;
    const suggested = getProbeHardness(scheme.rhProbeDepth, v);
    update(suggested ? { rhProbeTemp: v, hardness: suggested } : { rhProbeTemp: v });
  };
  const fromProbe = scheme.rhProbeDepth !== '' && probeHardness === scheme.hardness;
  const corrected = correctProbeDepth(scheme.rhProbeDepth, scheme.rhProbeTemp);
  const tempOff20 = parseFloat(scheme.rhProbeTemp) !== 20 && !isNaN(parseFloat(scheme.rhProbeTemp));

  return (
    <div className="sd-panel">
      <div className="sd-panel-title">
        <span><span className="sd-step-num">3</span> Road Hardness</span>
      </div>
      <div className="sd-row">
        <label className="sd-field">
          <span className="sd-label">RH Probe Depth (mm)</span>
          <input className="sd-input" type="number" inputMode="decimal" step="0.1" value={scheme.rhProbeDepth}
            onChange={onProbeChange} placeholder="e.g. 4.2" />
          {corrected != null && tempOff20 && (
            <span className="sd-hint">Corrected to 20°C: <strong style={{ color: 'var(--sd-copper)' }}>{corrected} mm</strong></span>
          )}
        </label>
        <label className="sd-field">
          <span className="sd-label">Probe Test Temp (°C)</span>
          <input className="sd-input" type="number" inputMode="decimal" value={scheme.rhProbeTemp}
            onChange={onTempChange} />
        </label>
      </div>
      <label className="sd-field">
        <span className="sd-label">
          RH Category
          {fromProbe && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--sd-copper)' }}>· auto from probe</span>}
        </span>
        <select className="sd-select" value={scheme.hardness}
          onChange={e => update({ hardness: e.target.value })}>
          <option>Very Hard</option><option>Hard</option><option>Normal</option>
          <option>Soft</option><option>Very Soft</option><option>Variable</option>
        </select>
        <span className="sd-hint">{HARDNESS_GUIDANCE[scheme.hardness]}</span>
      </label>
      <div className="sd-row">
        <label className="sd-field">
          <span className="sd-label">Min PSV</span>
          <input className="sd-input" type="number" inputMode="numeric" value={scheme.minPSV}
            onChange={e => update({ minPSV: e.target.value, selectedItem: '' })} />
        </label>
        <label className="sd-field">
          <span className="sd-label">Max AAV</span>
          <input className="sd-input" type="number" inputMode="numeric" value={scheme.maxAAV}
            onChange={e => update({ maxAAV: e.target.value })} />
        </label>
      </div>
    </div>
  );
};
