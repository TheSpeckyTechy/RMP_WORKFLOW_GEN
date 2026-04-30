// ─── TrafficPanel.jsx ────────────────────────────────────────────────────────
// SD design — Step 2: traffic (cv/lane/day → traffic category) and speed.
// Reads scheme.cvDay / .trafficSpeed, derives category via window.RN39_LOGIC.
// Ported from Surface_Dressing_App/src/components/design/TrafficPanel.jsx.
// ─────────────────────────────────────────────────────────────────────────────
window.SD = window.SD || {};

window.SD.TrafficPanel = function TrafficPanel({ scheme, update, trafficCat }) {
  return (
    <div className="sd-panel sd-no-print" style={{ marginBottom: 14 }}>
      <div className="sd-panel-title">
        <span className="sd-step-num">2</span> Traffic
      </div>
      <div className="sd-row">
        <label className="sd-field">
          <span className="sd-label">Medium/Heavy Traffic (cv/lane/day)</span>
          <input className="sd-input" type="number" inputMode="numeric" value={scheme.cvDay}
            onChange={e => update({ cvDay: e.target.value })} placeholder="HGV/CV count" />
          {trafficCat && (
            <div className="sd-result" style={{ marginTop: 8 }}>
              <div className="sd-result-label">Traffic Category</div>
              <div className="sd-result-value">
                {trafficCat.cat}
                <span style={{ fontSize: 13, color: 'var(--sd-text-muted)', fontWeight: 400 }}>
                  {' '}({trafficCat.range} cv/l/d)
                </span>
              </div>
              <div className="sd-result-sub">NRSWA Road Type {trafficCat.nrswa}</div>
            </div>
          )}
        </label>
        <label className="sd-field">
          <span className="sd-label">Traffic Speed (mph)</span>
          <select className="sd-select" value={scheme.trafficSpeed}
            onChange={e => update({ trafficSpeed: e.target.value, speed: parseInt(e.target.value) >= 50 ? 'high' : 'low' })}>
            <option>20</option><option>30</option><option>40</option>
            <option>50</option><option>60</option><option>70</option>
          </select>
        </label>
      </div>
    </div>
  );
};
