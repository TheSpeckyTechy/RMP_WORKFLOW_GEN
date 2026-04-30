// ─── AdjustmentsPanel.jsx ────────────────────────────────────────────────────
// SD design — Step 6: Table 9.2.6 local adjustments. Season is auto-derived
// from install month; the rest are user-selectable.
// ─────────────────────────────────────────────────────────────────────────────
window.SD = window.SD || {};

window.SD.AdjustmentsPanel = function AdjustmentsPanel({ scheme, update, totalAdjustment }) {
  const { MONTHS } = window.RN39;
  const { fmtAdj, seasonFromMonth } = window.RN39_LOGIC;
  const { capped, raw, wasCapped, expert, components } = totalAdjustment;
  const derivedSeason = seasonFromMonth(scheme.installMonth);
  return (
    <div className="sd-panel" style={{ marginBottom: 14 }}>
      <div className="sd-panel-title"><span className="sd-step-num">6</span> Local Adjustments — Table 9.2.6</div>
      <div className="sd-grid">
        <div>
          <div className="sd-row">
            <div className="sd-field">
              <span className="sd-label">Season <span style={{ fontSize: 10, color: 'var(--sd-copper)' }}>· auto from install month</span></span>
              <div className="sd-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{derivedSeason === 'late' ? 'Late season (+0.2)' : 'Early/mid-season (0)'}</span>
                <span style={{ fontSize: 11, color: 'var(--sd-text-muted)' }}>{MONTHS[scheme.installMonth - 1]}</span>
              </div>
            </div>
            <label className="sd-field">
              <span className="sd-label">Flakiness Cat. (BS EN)</span>
              <select className="sd-select" value={scheme.shape} onChange={e => update({ shape: e.target.value })}>
                <option value="f10">F10 (−0.1)</option>
                <option value="f15">F15 (0)</option>
                <option value="f20">F20 (+0.1)</option>
                <option value="f25">F25 (expert)</option>
              </select>
            </label>
          </div>
          <div className="sd-row">
            <label className="sd-field">
              <span className="sd-label">Shade</span>
              <select className="sd-select" value={scheme.shade} onChange={e => update({ shade: e.target.value })}>
                <option value="open">Open to sun (0)</option>
                <option value="partial">Partially shaded (+0.1)</option>
                <option value="full">Fully shaded (+0.2)</option>
              </select>
            </label>
            <label className="sd-field">
              <span className="sd-label">Local Traffic</span>
              <select className="sd-select" value={scheme.localTraffic} onChange={e => update({ localTraffic: e.target.value })}>
                <option value="normal">Design range (0)</option>
                <option value="untrafficked">Effectively untrafficked (+0.2)</option>
              </select>
            </label>
          </div>
        </div>
        <div>
          <div className="sd-result">
            <div className="sd-result-label">Cumulative Adjustment</div>
            <div className="sd-result-value">
              {capped >= 0 ? '+' : ''}{capped.toFixed(2)} L/m²
              {wasCapped && (
                <span style={{ fontSize: 11, color: 'var(--sd-warn)', marginLeft: 10 }}>
                  (raw {raw >= 0 ? '+' : ''}{raw.toFixed(2)} capped)
                </span>
              )}
            </div>
            <div className="sd-result-sub">Max +0.4 / −0.2 L/m² per RN39 Table 9.2.6</div>
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--sd-text-muted)', lineHeight: 1.6 }}>
              Season {fmtAdj(components.season)} · Aggregate {fmtAdj(components.aggregate)} · Shape {fmtAdj(components.shape)} · Shade {fmtAdj(components.shade)}<br />
              Condition {fmtAdj(components.condition)} · Gradient {fmtAdj(components.gradient)} · Speed {fmtAdj(components.speed)} · Local {fmtAdj(components.localTraffic)}
            </div>
          </div>
          {expert && <div className="sd-warning" style={{ marginTop: 8 }}><strong>Expert design required</strong> — refer to specialist.</div>}
        </div>
      </div>
    </div>
  );
};
