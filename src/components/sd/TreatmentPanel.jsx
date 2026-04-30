// ─── TreatmentPanel.jsx ──────────────────────────────────────────────────────
// SD design — Step 5: shows the RN39 dressing recommendation, lets the user
// override the dressing type / binder grade / aggregate, and surfaces the base
// chipping size + binder rate before adjustments.
// ─────────────────────────────────────────────────────────────────────────────
window.SD = window.SD || {};

window.SD.TreatmentPanel = function TreatmentPanel({ scheme, update, recommendation, activeType, baseDesign }) {
  const { CHIPPING_DESIGNATIONS } = window.RN39;
  const isDouble = ['double', 'inverted', 'sandwich'].includes(activeType);
  return (
    <div className="sd-panel" style={{ marginBottom: 14 }}>
      <div className="sd-panel-title"><span className="sd-step-num">5</span> Treatment Selection</div>
      {recommendation && (
        <div className="sd-recommendation">
          <div className="sd-recommendation-title">RN39 Recommends</div>
          <div className="sd-recommendation-text">
            <strong>{recommendation.label}</strong><br />{recommendation.reason}
          </div>
        </div>
      )}
      {recommendation?.type === 'hfs' ? (
        <div className="sd-warning" style={{ marginTop: 12 }}>
          <strong>SURFACE DRESSING NOT APPROPRIATE.</strong> Specify High Friction Surfacing (HFS). Refer to RSTA/ADEPT Code of Practice.
        </div>
      ) : (
        <div className="sd-row-3" style={{ marginTop: 12 }}>
          <label className="sd-field">
            <span className="sd-label">Override Dressing Type</span>
            <select className="sd-select" value={scheme.dressingType}
              onChange={e => update({ dressingType: e.target.value, selectedItem: '' })}>
              <option value="auto">Auto (RN39)</option>
              <option value="single">Single</option>
              <option value="racked">Racked-in</option>
              <option value="double">Double</option>
              <option value="inverted">Inverted Double</option>
              <option value="sandwich">Sandwich</option>
            </select>
          </label>
          <label className="sd-field">
            <span className="sd-label">Binder Grade</span>
            <select className="sd-select" value={scheme.binderGrade}
              onChange={e => update({ binderGrade: e.target.value, selectedItem: '' })}>
              <option value="unmodified">Unmodified (K1-70)</option>
              <option value="intermediate">Intermediate</option>
              <option value="premium">Premium Grade</option>
              <option value="superpremium">Super-Premium</option>
            </select>
          </label>
          <label className="sd-field">
            <span className="sd-label">Aggregate Type</span>
            <select className="sd-select" value={scheme.aggregate}
              onChange={e => update({ aggregate: e.target.value })}>
              <option value="rock">Crushed rock (0)</option>
              <option value="blast">Blast-furnace slag (0)</option>
              <option value="steel">Steel slag (0)</option>
              <option value="gravel">Gravel (+0.1)</option>
            </select>
          </label>
        </div>
      )}
      {baseDesign === null && activeType !== 'hfs' && (
        <div className="sd-warning"><strong>Not suitable:</strong> RN39 does not recommend this combination.</div>
      )}
      {baseDesign === 'multi' && <div className="sd-warning"><strong>Multi-layer preferred</strong> — switch to racked-in or double.</div>}
      {baseDesign === 'unnecessary' && <div className="sd-info">Racking-in is unnecessary for this traffic category.</div>}
      {baseDesign === 'expert' && <div className="sd-warning"><strong>Expert design required</strong> for this combination.</div>}
      {baseDesign && typeof baseDesign === 'object' && (
        <div className="sd-row" style={{ marginTop: 12 }}>
          <div className="sd-result">
            <div className="sd-result-label">Base Chipping Code</div>
            <div className="sd-result-value">{baseDesign.size}</div>
            <div className="sd-result-sub">{CHIPPING_DESIGNATIONS[baseDesign.size?.split('/')[0]]}</div>
          </div>
          <div className="sd-result">
            <div className="sd-result-label">Base Binder Rate</div>
            <div className="sd-result-value">
              {isDouble ? `${baseDesign.l1} / ${baseDesign.l2} L/m²` : `${baseDesign.binder} L/m²`}
            </div>
            <div className="sd-result-sub">Before local adjustment</div>
          </div>
        </div>
      )}
    </div>
  );
};
