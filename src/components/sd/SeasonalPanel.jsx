// ─── SeasonalPanel.jsx ───────────────────────────────────────────────────────
// SD design — Step 7: 12-month installation-risk grid keyed off the
// chipping size and Temperature Category derived from location.
// ─────────────────────────────────────────────────────────────────────────────
window.SD = window.SD || {};

window.SD.SeasonalPanel = function SeasonalPanel({ scheme, update, finalRates, seasonalRisk }) {
  const { MONTHS, SEASON_DATA, LOCATION_TEMP_CAT, RISK_COLORS, RISK_LABELS } = window.RN39;
  const tempCat = LOCATION_TEMP_CAT[scheme.location] || 'C/D';
  return (
    <div className="sd-panel" style={{ marginBottom: 14 }}>
      <div className="sd-panel-title"><span className="sd-step-num">7</span> Seasonal Risk — Temp. Cat. {tempCat}</div>
      <div style={{ fontSize: 12, color: 'var(--sd-text-muted)', marginBottom: 8 }}>
        Click a month to assess installation risk for {finalRates?.size}.
      </div>
      <div className="sd-season-grid">
        {MONTHS.map((m, i) => {
          const primary = finalRates?.size?.split('/')[0];
          const risk = SEASON_DATA[tempCat]?.[primary]?.[i] ?? 'high';
          return (
            <div key={m}
              className={`sd-season-cell ${scheme.installMonth === i + 1 ? 'active' : ''}`}
              style={{ background: RISK_COLORS[risk], color: '#0a0612' }}
              onClick={() => update({ installMonth: i + 1 })}>
              {m}
            </div>
          );
        })}
      </div>
      {seasonalRisk && (
        <div className="sd-info" style={{
          background: RISK_COLORS[seasonalRisk] + '18',
          borderLeftColor: RISK_COLORS[seasonalRisk],
          marginTop: 8,
        }}>
          <strong style={{ color: RISK_COLORS[seasonalRisk] }}>
            {MONTHS[scheme.installMonth - 1]}: {RISK_LABELS[seasonalRisk]}
          </strong>
          {seasonalRisk === 'high' && ' — surface dressing should not be undertaken.'}
          {seasonalRisk === 'sig' && ' — extra care in design and execution required.'}
          {seasonalRisk === 'low' && ' — normally successful given appropriate weather.'}
        </div>
      )}
    </div>
  );
};
