const daysBetween = (dmyA, dmyB) => {
  const p = (s) => { const [d,m,y] = (s||"").split("/"); return new Date(+y,+m-1,+d); };
  const a = p(dmyA), b = p(dmyB);
  if (isNaN(a)||isNaN(b)) return "___";
  return Math.max(1, Math.round((b-a)/86400000*5/7));
};

const RoadSpaceRequestDoc = ({ scheme }) => {
  const Bound = ({ k, children, fallback }) => {
    const v = scheme[k];
    const show = v!==undefined&&v!=="" ? (children||v) : (fallback||`[${k}]`);
    return <span className="bound" data-field={k}>{show}</span>;
  };
  return (
    <div className="rsr-doc">
      <div className="rsr-page">
        <div className="rsr-header">
          <div className="rsr-title-bar">
            <div className="rsr-title">TEMPORARY ROAD CLOSURES</div>
            <div className="rsr-sub">Information Sheet — to be submitted to Network Management</div>
          </div>
        </div>
        <div className="rsr-section-title">1. Applicant Details</div>
        <table className="rsr-table"><tbody>
          <tr><td className="rsr-th">Division</td><td>Road Maintenance Partnership</td></tr>
          <tr><td className="rsr-th">Name of Applicant</td><td><Bound k="prepared_by" /></td></tr>
          <tr><td className="rsr-th">Applicant Contact Email</td><td><Bound k="designer_email" /></td></tr>
          <tr><td className="rsr-th">Applicant Contact Phone</td><td><Bound k="designer_phone" /></td></tr>
          <tr><td className="rsr-th">Name &amp; Address of Contractor</td><td><Bound k="contractor" /><br/>Contracts House, 1 Soutar Street, Dundee DD3 8SS</td></tr>
          <tr><td className="rsr-th">Contact Person (Contractor)</td><td><Bound k="contractor_pe" /></td></tr>
          <tr><td className="rsr-th">Contractor Out-of-Hours</td><td><Bound k="contractor_ooh" /></td></tr>
        </tbody></table>
        <div className="rsr-section-title">2. Closure Details</div>
        <table className="rsr-table"><tbody>
          <tr><td className="rsr-th">Name of Road</td><td><Bound k="road_name" /></td></tr>
          <tr><td className="rsr-th">Project Number</td><td><Bound k="project_number" /></td></tr>
          <tr><td className="rsr-th">Ward</td><td><Bound k="ward_selected" /></td></tr>
          <tr><td className="rsr-th">Grid Reference</td><td><Bound k="grid_ref" /></td></tr>
          <tr><td className="rsr-th">Exact Location</td><td><Bound k="scheme_extent" /></td></tr>
          <tr><td className="rsr-th">Reason for Closure</td><td><Bound k="treatment_type" /> — planned maintenance resurfacing</td></tr>
          <tr><td className="rsr-th">Starting Date</td><td><Bound k="date_start" /></td></tr>
          <tr><td className="rsr-th">Finish Date</td><td><Bound k="date_finish" /></td></tr>
          <tr><td className="rsr-th">Duration of Closure</td><td>{daysBetween(scheme.date_start,scheme.date_finish)} working days</td></tr>
          <tr><td className="rsr-th">Working Hours</td><td><Bound k="tm_hours" /></td></tr>
        </tbody></table>
        <div className="rsr-section-title">3. Supporting Images</div>
        <div className="rsr-image-grid">
          <div className="rsr-image"><div className="rsr-image-label">IMAGE 1 — SITE LOCATION</div><div className="rsr-image-body">Paste site location map here</div></div>
          <div className="rsr-image"><div className="rsr-image-label">IMAGE 2 — DIVERSION DRAWING</div><div className="rsr-image-body">Paste diversion route drawing here</div></div>
        </div>
        <div className="rsr-section-title">4. Sign-Off</div>
        <table className="rsr-table"><tbody>
          <tr><td className="rsr-th">Signed:</td><td><Bound k="prepared_by" /></td></tr>
          <tr><td className="rsr-th">Date:</td><td><Bound k="date_prepared" /></td></tr>
        </tbody></table>
        <div className="rsr-notes">
          <div style={{fontWeight:600,marginBottom:4}}>Notes</div>
          • Official diversion plan to be passed to Network team once produced.<br/>
          • Emergency service vehicular access will be maintained throughout.<br/>
          • Residents and businesses notified via the separate Residents &amp; Businesses Letter.
        </div>
      </div>
    </div>
  );
};

const RSRModal = ({ scheme, onClose }) => {
  const bindings = ["prepared_by","designer_email","designer_phone","contractor","contractor_pe","contractor_ooh","road_name","project_number","ward_selected","grid_ref","scheme_extent","treatment_type","date_start","date_finish","tm_hours","date_prepared"];
  const missing = bindings.filter(k => !scheme[k] && scheme[k] !== 0);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal rsr-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{fontWeight:600,fontSize:15}}>Road Space Request Form · Preview</div>
            <div style={{fontSize:12,color:"var(--ink-3)",fontFamily:"var(--font-mono)"}}>{scheme.project_number} · {scheme.road_name} · {bindings.length-missing.length}/{bindings.length} fields bound</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button className="btn sm"><Icon.Download /> Download .docx</button>
            <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>
          </div>
        </div>
        <div className="rsr-body">
          <div className="rsr-preview-pane"><RoadSpaceRequestDoc scheme={scheme} /></div>
          <div className="rsr-side">
            <div className="rsr-side-title">Field bindings</div>
            <div className="rsr-bind-list">
              {bindings.map(b => {
                const val = scheme[b]; const filled = val!==undefined&&val!==""&&val!==null;
                return (
                  <div key={b} className={"rsr-bind "+(filled?"":"missing")}
                    onMouseEnter={()=>document.querySelectorAll(`[data-field="${b}"]`).forEach(el=>el.classList.add("hover"))}
                    onMouseLeave={()=>document.querySelectorAll(`[data-field="${b}"]`).forEach(el=>el.classList.remove("hover"))}>
                    <div className="rsr-bind-key mono">{b}</div>
                    <div className="rsr-bind-val">{filled?String(val):"\u2014"}</div>
                  </div>
                );
              })}
            </div>
            {missing.length>0&&<div style={{fontSize:11,color:"var(--amber)",marginTop:10,padding:8,background:"var(--amber-wash)",borderRadius:4}}><Icon.Alert /> {missing.length} field{missing.length>1?"s":""} empty</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
window.RoadSpaceRequestDoc = RoadSpaceRequestDoc;
window.RSRModal = RSRModal;
