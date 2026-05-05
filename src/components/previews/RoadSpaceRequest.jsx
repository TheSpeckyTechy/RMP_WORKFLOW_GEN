// ─── RoadSpaceRequest.jsx ─────────────────────────────────────────────────────
// Road Space Request form — inline HTML preview built entirely from live scheme
// data. No external template file is needed; all 16 bound fields are resolved
// directly from the scheme object and highlighted in the side panel.
//
// Components:
//   RoadSpaceRequestDoc  — the A4 form layout (used inside RSRModal)
//   RSRModal             — full-screen preview with field binding inspector
//
// Exports (via window): RoadSpaceRequestDoc, RSRModal
// Depends on: React, window.Icon
// ─────────────────────────────────────────────────────────────────────────────

const daysBetween = (dmyA, dmyB) => {
  const p = (s) => { const [d,m,y] = (s||"").split("/"); return new Date(+y,+m-1,+d); };
  const a = p(dmyA), b = p(dmyB);
  if (isNaN(a)||isNaN(b)) return "___";
  return Math.max(1, Math.round((b-a)/86400000*5/7));
};

const compressImage = (file, maxWidth = 1000) => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const scale = Math.min(1, maxWidth / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    resolve(canvas.toDataURL('image/jpeg', 0.82));
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
  img.src = url;
});

const RoadSpaceRequestDoc = ({ scheme, onUpload }) => {
  const Bound = ({ k, children, fallback }) => {
    const v = scheme[k];
    const show = v!==undefined&&v!=="" ? (children||v) : (fallback||`[${k}]`);
    return <span className="bound" data-field={k}>{show}</span>;
  };
  const ImageSlot = ({ field, label }) => {
    const src = scheme[field];
    if (onUpload) {
      return (
        <label className="rsr-image rsr-image-upload" style={{display:"block",cursor:"pointer",position:"relative"}}>
          <input type="file" accept="image/*" style={{display:"none"}}
            onChange={e => { const f = e.target.files[0]; if (f) onUpload(field, f); e.target.value=''; }} />
          <div className="rsr-image-label">{label}<span className="rsr-upload-hint"> · click to upload</span></div>
          {src
            ? <><img src={src} alt={label} style={{width:"100%",height:"auto",display:"block"}} /><div className="rsr-image-replace">↺ Replace</div></>
            : <div className="rsr-image-body">Click to upload photo or map</div>
          }
        </label>
      );
    }
    return (
      <div className="rsr-image">
        <div className="rsr-image-label">{label}</div>
        {src
          ? <img src={src} alt={label} style={{width:"100%",height:"auto",display:"block"}} />
          : <div className="rsr-image-body">Paste site image here</div>
        }
      </div>
    );
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
          <ImageSlot field="rsr_image_1" label="IMAGE 1 — SITE LOCATION" />
          <ImageSlot field="rsr_image_2" label="IMAGE 2 — DIVERSION DRAWING" />
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

const RSR_TEMPLATE = 'templates/Road_Space_Request_Form_TEMPLATE.docx';

async function downloadRSR(scheme) {
  const res = await fetch(RSR_TEMPLATE, { cache: 'no-cache' });
  if (!res.ok) throw new Error('RSR template not found');
  const buffer = await res.arrayBuffer();
  const zip = new window.JSZip();
  await zip.loadAsync(buffer);
  const ext = scheme.scheme_extent ? `: ${scheme.scheme_extent}` : '';
  const fields = {
    PROJECT_TITLE:           `${scheme.road_name||''}${ext}`,
    PROJECT_NUMBER:          scheme.project_number||'',
    PROJECT_ADDRESS:         `${scheme.road_name||''}${ext}`,
    START_DATE:              scheme.date_start||'',
    FINISH_DATE:             scheme.date_finish||'',
    DESIGNER_NAME:           scheme.prepared_by||'',
    DESIGNER_HEAD_OF:        scheme.designer_head_of||'',
    DESIGNER_TELEPHONE:      scheme.designer_phone||'',
    DESIGNER_EMAIL:          scheme.designer_email||'',
    CLIENT_NAME_ADDRESS:     scheme.client_name_address||'',
    CLIENT_OFFICER:          scheme.client_officer||'',
    CLIENT_TELEPHONE:        scheme.client_phone||'',
    CLIENT_EMAIL:            scheme.client_email||'',
    DEPARTMENT:              scheme.department||'',
    CDM_PRINCIPAL_DESIGNER:  scheme.cdm_principal_designer||'',
    CDM_HEAD_OF:             scheme.cdm_head_of||'',
    CLIENT_REF_WORK_ORDER:   scheme.client_ref_work_order||'',
    CONTRACTOR_NAME:         scheme.contractor||'',
    CONTRACTOR_ADDRESS:      scheme.contractor_address||'',
    CONTRACTOR_CONTACT:      scheme.contractor_pe||'',
    CONTRACTOR_TELEPHONE:    scheme.contractor_ooh||'',
    CONTRACTOR_EMAIL:        scheme.contractor_email||'',
    CONTRACTOR_OUT_OF_HOURS: scheme.contractor_ooh||'',
    OUT_OF_HOURS_CONTACT:    scheme.contractor_ooh||'',
    DESCRIPTION_OF_WORK:     scheme.pci_description||'',
    OCCUPIER_TENANT_DETAILS: scheme.pci_occupiers||'',
    SECURITY_ARRANGEMENTS:   scheme.pci_site_security||'',
  };
  const xmlPaths = ['word/document.xml','word/header1.xml','word/header2.xml','word/footer1.xml','word/footer2.xml'];
  for (const p of xmlPaths) {
    const f = zip.file(p); if (!f) continue;
    let xml = await f.async('string');
    for (const [k,v] of Object.entries(fields)) {
      const safe = String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      xml = xml.split(`{{${k}}}`).join(safe);
    }
    zip.file(p, xml);
  }
  const out = await zip.generateAsync({ type:'arraybuffer' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
  a.download = `RSR_${scheme.project_number}_${(scheme.road_name||'').replace(/\s+/g,'_')}.docx`;
  a.click(); URL.revokeObjectURL(a.href);
}

async function downloadRSRPdf(scheme) {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:white;';
  document.body.appendChild(container);
  try {
    const root = ReactDOM.createRoot(container);
    const displayScheme = { ...scheme, treatment_type: scheme.treatment_type === 'Other' ? (scheme.treatment_description || 'Other') : scheme.treatment_type };
    root.render(React.createElement(RoadSpaceRequestDoc, { scheme: displayScheme }));
    await new Promise(r => setTimeout(r, 400));
    await window.htmlToPdf(
      container.firstChild || container,
      `RSR_${scheme.project_number}_${(scheme.road_name||'').replace(/\s+/g,'_')}.pdf`
    );
    root.unmount();
  } finally {
    document.body.removeChild(container);
  }
}

const RSR_FIELD_META = {
  prepared_by:    { label: "Applicant name" },
  designer_email: { label: "Applicant email" },
  designer_phone: { label: "Applicant phone" },
  contractor:     { label: "Contractor name" },
  contractor_pe:  { label: "Contractor contact" },
  contractor_ooh: { label: "Out-of-hours" },
  road_name:      { label: "Road name" },
  project_number: { label: "Project number" },
  ward_selected:  { label: "Ward" },
  grid_ref:       { label: "Grid reference" },
  scheme_extent:  { label: "Exact location", multi: true },
  treatment_type: { label: "Reason for closure" },
  date_start:     { label: "Start date", hint: "DD/MM/YYYY" },
  date_finish:    { label: "Finish date", hint: "DD/MM/YYYY" },
  tm_hours:       { label: "Working hours", multi: true },
  date_prepared:  { label: "Date prepared", hint: "DD/MM/YYYY" },
};

const RSRModal = ({ scheme, onClose }) => {
  const { updateScheme } = React.useContext(window.SchemeContext);
  const bindings = Object.keys(RSR_FIELD_META);
  const missing = bindings.filter(k => !scheme[k] && scheme[k] !== 0);
  const [downloading, setDownloading] = React.useState(false);

  const set = (k, v) => updateScheme(scheme.id, { [k]: v });

  const handleUpload = async (field, file) => {
    try {
      const dataUrl = await compressImage(file);
      updateScheme(scheme.id, { [field]: dataUrl });
    } catch(err) { alert('Image upload failed: ' + err.message); }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadRSRPdf(scheme);
      updateScheme(scheme.id, { docs_generated: { ...(scheme.docs_generated||{}), rsr: true } });
      window.dispatchEvent(new CustomEvent('rmp-download', { detail: { label: `RSR — ${scheme.road_name}`, ref: scheme.project_number } }));
    }
    catch(e) { alert('Download failed: ' + e.message); }
    finally { setDownloading(false); }
  };

  const displayScheme = { ...scheme, treatment_type: scheme.treatment_type === 'Other' ? (scheme.treatment_description || 'Other') : scheme.treatment_type };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal rsr-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{fontWeight:600,fontSize:15}}>Road Space Request Form · Preview</div>
            <div style={{fontSize:12,color:"var(--ink-3)",fontFamily:"var(--font-mono)"}}>{scheme.project_number} · {scheme.road_name} · {bindings.length-missing.length}/{bindings.length} fields bound</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {(scheme.rsr_image_1||scheme.rsr_image_2) &&
              <button className="btn ghost sm" style={{color:"var(--red)"}} onClick={()=>updateScheme(scheme.id,{rsr_image_1:"",rsr_image_2:""})} title="Clear both images">✕ Clear images</button>}
            <button className="btn sm" onClick={handleDownload} disabled={downloading}><Icon.Download /> {downloading?"Generating…":"Download .pdf"}</button>
            <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>
          </div>
        </div>
        <div className="rsr-body">
          <div className="rsr-preview-pane">
            <RoadSpaceRequestDoc scheme={displayScheme} onUpload={handleUpload} />
          </div>
          <div className="rsr-side">
            <div className="rsr-side-title">Edit fields</div>
            <div className="rsr-bind-list">
              {bindings.map(b => {
                const meta = RSR_FIELD_META[b];
                const val = scheme[b] || '';
                const filled = !!scheme[b];
                return (
                  <div key={b} className={"rsr-bind "+(filled?"":"missing")}
                    onMouseEnter={()=>document.querySelectorAll(`[data-field="${b}"]`).forEach(el=>el.classList.add("hover"))}
                    onMouseLeave={()=>document.querySelectorAll(`[data-field="${b}"]`).forEach(el=>el.classList.remove("hover"))}>
                    <div className="rsr-bind-key mono">{meta.label}</div>
                    {meta.multi
                      ? <textarea className="rsr-field-input" rows={2} value={val} placeholder={meta.hint||meta.label}
                          onChange={e=>set(b,e.target.value)} />
                      : <input className="rsr-field-input" type="text" value={val} placeholder={meta.hint||meta.label}
                          onChange={e=>set(b,e.target.value)} />
                    }
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--line)"}}>
              <div className="rsr-side-title">Images</div>
              {[{field:"rsr_image_1",label:"Image 1 — Site location"},{field:"rsr_image_2",label:"Image 2 — Diversion drawing"}].map(({field,label})=>(
                <label key={field} className="rsr-image-bind" style={{display:"block",cursor:"pointer"}}>
                  <input type="file" accept="image/*" style={{display:"none"}}
                    onChange={e => { const f = e.target.files[0]; if(f) handleUpload(field,f); e.target.value=''; }} />
                  {scheme[field]
                    ? <img src={scheme[field]} alt={label} style={{width:"100%",borderRadius:3,display:"block",marginBottom:4}} />
                    : <div className="rsr-image-bind-empty">+ Upload {label}</div>}
                  <div style={{fontSize:10,color:"var(--ink-3)",fontFamily:"var(--font-mono)"}}>{label}</div>
                </label>
              ))}
            </div>
            {missing.length>0&&<div style={{fontSize:11,color:"var(--amber)",marginTop:10,padding:8,background:"var(--amber-wash)",borderRadius:4}}><Icon.Alert /> {missing.length} field{missing.length>1?"s":""} empty</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

window.__downloadRSR = async (scheme) => {
  try {
    await downloadRSR(scheme);
    window.dispatchEvent(new CustomEvent('rmp-download', { detail: { label: `RSR — ${scheme.road_name}`, ref: scheme.project_number, fn: '__downloadRSR', schemeId: scheme.id } }));
  } catch (e) { console.warn('RSR download failed', e); }
};

window.__downloadRSRPdf = async (scheme) => {
  try {
    await downloadRSRPdf(scheme);
    window.dispatchEvent(new CustomEvent('rmp-download', { detail: { label: `RSR PDF — ${scheme.road_name}`, ref: scheme.project_number, fn: '__downloadRSRPdf', schemeId: scheme.id } }));
  } catch (e) { console.warn('RSR PDF download failed', e); }
};

window.RoadSpaceRequestDoc = RoadSpaceRequestDoc;
window.RSRModal = RSRModal;
