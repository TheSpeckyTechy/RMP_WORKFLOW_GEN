// ─── PricingPanel.jsx ────────────────────────────────────────────────────────
// SD design — Step 8: Series 700 BERR 85/1 picker. Selects a single item from
// matching items, computes an indicative scheme cost from the area-band rate,
// and surfaces a chipping tonnage estimate.
// ─────────────────────────────────────────────────────────────────────────────
window.SD = window.SD || {};

window.SD.PricingPanel = function PricingPanel({ scheme, update, matchingItems, chippingSpread, onShowRates }) {
  const { QTY_BAND, QTY_BAND_LABEL } = window.RN39;
  const { getChippingTonnes } = window.RN39_LOGIC;
  const area = parseFloat(scheme.areaM2);
  const band = !isNaN(area) ? QTY_BAND(area) : null;
  const selected = matchingItems.find(i => i.item === scheme.selectedItem);
  const cost = selected && band ? selected.rates[band] * area : null;
  const chippingTonnes = getChippingTonnes(chippingSpread, scheme.areaM2);

  return (
    <div className="sd-panel" style={{ marginBottom: 14 }}>
      <div className="sd-panel-title" style={{ justifyContent: 'space-between' }}>
        <span><span className="sd-step-num">8</span> Series 700 Pricing</span>
        {onShowRates && (
          <button className="sd-btn sd-btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={onShowRates} type="button">Edit Rates</button>
        )}
      </div>
      <table className="sd-table sd-pricing-table">
        <thead>
          <tr><th>Item</th><th>Description</th><th>&lt; 500</th><th>500–5,000</th><th>&gt; 5,000</th></tr>
        </thead>
        <tbody>
          {matchingItems.map(item => (
            <tr key={item.item}
              className={item.item === scheme.selectedItem ? 'selected' : ''}
              onClick={() => update({ selectedItem: item.item })}>
              <td><strong style={{ color: 'var(--sd-copper)' }}>{item.item}</strong></td>
              <td>{item.desc}</td>
              <td>£{item.rates.small.toFixed(2)}</td>
              <td>£{item.rates.medium.toFixed(2)}</td>
              <td>£{item.rates.large.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected && band && (
        <div className="sd-pricing-headline">
          <div>
            <div className="sd-result-label">Selected</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{selected.item}</div>
          </div>
          <div>
            <div className="sd-result-label">Band</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{QTY_BAND_LABEL[band]}</div>
          </div>
          <div>
            <div className="sd-result-label">Rate</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>£{selected.rates[band].toFixed(2)}/m²</div>
          </div>
          <div>
            <div className="sd-result-label">Indicative Total</div>
            <div className="sd-pricing-big">£{cost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      )}
      {chippingSpread && chippingTonnes && (
        <div className="sd-info" style={{ marginTop: 10 }}>
          <strong>Chipping order:</strong> ~{chippingTonnes} tonnes of {chippingSpread.nominal}mm
          {' '}<span style={{ color: 'var(--sd-text-muted)' }}>(spread {chippingSpread.min}–{chippingSpread.max} kg/m²)</span>
        </div>
      )}
    </div>
  );
};
