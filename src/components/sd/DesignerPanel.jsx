// ─── DesignerPanel.jsx ───────────────────────────────────────────────────────
// SD design — Step 9: designer name/initials, design date, and free-text notes.
// ─────────────────────────────────────────────────────────────────────────────
window.SD = window.SD || {};

window.SD.DesignerPanel = function DesignerPanel({ scheme, update }) {
  return (
    <div className="sd-panel sd-no-print" style={{ marginBottom: 14 }}>
      <div className="sd-panel-title"><span className="sd-step-num">9</span> Designer &amp; Notes</div>
      <div className="sd-row-3">
        <label className="sd-field">
          <span className="sd-label">Designer</span>
          <input className="sd-input" value={scheme.designerName}
            onChange={e => update({ designerName: e.target.value })} placeholder="Full name" />
        </label>
        <label className="sd-field">
          <span className="sd-label">Initials</span>
          <input className="sd-input" value={scheme.designerInitials}
            onChange={e => update({ designerInitials: e.target.value })} maxLength={5} />
        </label>
        <label className="sd-field">
          <span className="sd-label">Design Date</span>
          <input className="sd-input" type="date" value={scheme.designDate}
            onChange={e => update({ designDate: e.target.value })} />
        </label>
      </div>
      <label className="sd-field">
        <span className="sd-label">Design Notes</span>
        <textarea className="sd-textarea" value={scheme.notes}
          onChange={e => update({ notes: e.target.value })}
          placeholder="Site visit observations, drawing references, photo refs, special considerations…"
          rows={3} />
      </label>
    </div>
  );
};
