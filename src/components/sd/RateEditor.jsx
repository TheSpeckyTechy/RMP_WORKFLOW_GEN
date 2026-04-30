// ─── RateEditor.jsx ──────────────────────────────────────────────────────────
// Modal for overriding the Series 700 BERR 85/1 placeholder rates. Edits are
// persisted on the scheme as scheme.sd.rateOverrides[itemCode] = { small, medium, large }.
// ─────────────────────────────────────────────────────────────────────────────
window.SD = window.SD || {};

window.SD.RateEditor = function RateEditor({ rates, onRatesChange, onClose }) {
  const { SERIES_700 } = window.RN39;
  const setRate = (item, band, val) => {
    const v = parseFloat(val);
    const next = { ...rates };
    next[item] = { ...(next[item] || {}), [band]: isNaN(v) ? 0 : v };
    onRatesChange(next);
  };
  const reset = (item) => {
    const next = { ...rates };
    delete next[item];
    onRatesChange(next);
  };
  return (
    <div className="sd-rate-modal-backdrop" onClick={onClose}>
      <div className="sd-rate-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>Edit Series 700 BERR 85/1 Rates</h3>
          <button className="sd-btn sd-btn-secondary" style={{ padding: '4px 10px' }}
            onClick={onClose} type="button">Close</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--sd-text-muted)', marginBottom: 8 }}>
          Override the placeholder figures with your actual contracted rates. Leave a band blank to fall back to the placeholder.
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th><th>Description</th>
              <th>&lt; 500 m²</th><th>500–5,000 m²</th><th>&gt; 5,000 m²</th><th></th>
            </tr>
          </thead>
          <tbody>
            {SERIES_700.map(it => {
              const o = rates[it.item] || {};
              const def = it.rates;
              return (
                <tr key={it.item}>
                  <td><strong>{it.item}</strong></td>
                  <td style={{ maxWidth: 240 }}>{it.desc}</td>
                  {['small', 'medium', 'large'].map(b => (
                    <td key={b}>
                      <input type="number" step="0.01"
                        defaultValue={o[b] != null ? o[b] : def[b]}
                        onBlur={e => setRate(it.item, b, e.target.value)} />
                    </td>
                  ))}
                  <td>
                    {rates[it.item] && (
                      <button className="sd-btn sd-btn-secondary"
                        style={{ padding: '2px 6px', fontSize: 10 }}
                        onClick={() => reset(it.item)} type="button">↺</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
