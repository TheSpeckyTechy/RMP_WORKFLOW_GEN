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

// Walk-the-calendar working-day count via the BoQ engine. Falls back to
// the primitive ratio formula only if the engine isn't loaded yet (e.g.
// during the brief window of Babel JSX compilation on first paint).
const daysBetween = (dmyA, dmyB, pattern) => {
  const E = window.BOQ_ENGINE;
  if (E?.computeWorkingDays) return E.computeWorkingDays(dmyA, dmyB, pattern) || 0;
  return _daysBetweenLegacy(dmyA, dmyB);
};
const _daysBetweenLegacy = (dmyA, dmyB) => {
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
          <tr><td className="rsr-th">Duration of Closure</td><td>{daysBetween(scheme.date_start,scheme.date_finish,scheme.working_pattern)} working days</td></tr>
          <tr><td className="rsr-th">Working Hours</td><td>{window.schemeTM(scheme).hours || scheme.tm_hours || <span className="bound" data-field="tm_hours">[tm_hours]</span>}</td></tr>
          <tr><td className="rsr-th">Diversion Route(s)</td><td>{window.schemeTM(scheme).diversion_by || scheme.tm_diversion_by || '—'}</td></tr>
        </tbody></table>
        <div className="rsr-section-title">3. Sign-Off</div>
        <table className="rsr-table"><tbody>
          <tr><td className="rsr-th">Signed:</td><td><Bound k="prepared_by" /></td></tr>
          <tr><td className="rsr-th">Date:</td><td>{scheme.date_prepared || new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}</td></tr>
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

const RSR_TEMPLATE = 'templates/RSR_TEMPLATE.docx';

const xmlEscapeRSR = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function buildRSRFields(scheme) {
  const days = daysBetween(scheme.date_start, scheme.date_finish, scheme.working_pattern);
  const treatment = window.schemeTreatment(scheme) || '';
  const tm = window.schemeTM(scheme);
  return {
    PREPARED_BY:      scheme.prepared_by || '',
    DESIGNER_EMAIL:   scheme.designer_email || '',
    DESIGNER_PHONE:   scheme.designer_phone || '',
    CONTRACTOR_NAME:  scheme.contractor || '',
    CONTRACTOR_PE:    scheme.contractor_pe || '',
    CONTRACTOR_OOH:   scheme.contractor_ooh || '',
    ROAD_NAME:        scheme.road_name || '',
    PROJECT_NUMBER:   scheme.project_number || '',
    WARD_SELECTED:    scheme.ward_selected || '',
    GRID_REF:         scheme.grid_ref || '',
    SCHEME_EXTENT:    scheme.scheme_extent || '',
    TREATMENT_TYPE:   treatment,
    DATE_START:       scheme.date_start || '',
    DATE_FINISH:      scheme.date_finish || '',
    DURATION:         String(days),
    TM_HOURS:         tm.hours || scheme.tm_hours || '',
    TM_DIVERSION:     tm.diversion_by || scheme.tm_diversion_by || scheme.tm_diversion || '',
    DATE_PREPARED:    scheme.date_prepared || new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }),
  };
}

let _rsrTemplateBuf = null;
async function loadRSRDocxBuffer() {
  if (_rsrTemplateBuf) return _rsrTemplateBuf.slice(0);
  const res = await fetch(RSR_TEMPLATE, { cache: 'no-cache' });
  if (!res.ok) throw new Error('RSR template not found: ' + RSR_TEMPLATE);
  _rsrTemplateBuf = await res.arrayBuffer();
  return _rsrTemplateBuf.slice(0);
}

// Convert a plain-text value to safe XML for insertion inside a <w:t> run.
// \n must become <w:br/> elements — a literal newline inside <w:t> is not a
// line break in WordprocessingML and will be collapsed by Word.
const multilineXmlRSR = (value) => {
  const escaped = xmlEscapeRSR(value);
  return escaped.replace(/\n/g, '</w:t><w:br/><w:t xml:space="preserve">');
};

async function injectRSRValues(buffer, scheme) {
  const zip = new window.JSZip();
  await zip.loadAsync(buffer);
  const fields = buildRSRFields(scheme);
  const xmlPaths = ['word/document.xml','word/header1.xml','word/header2.xml','word/footer1.xml','word/footer2.xml'];
  const allXml = [];
  for (const p of xmlPaths) {
    const f = zip.file(p); if (!f) continue;
    let xml = await f.async('string');
    for (const [k,v] of Object.entries(fields)) {
      xml = xml.split(`{{${k}}}`).join(multilineXmlRSR(v));
    }
    zip.file(p, xml);
    allXml.push(xml);
  }
  // Warn if any {{...}} placeholders survived replacement — likely a run-split
  // tag from a Word re-save. Does not block the save.
  const combined = allXml.join('');
  const surviving = [...combined.matchAll(/\{\{[A-Z0-9_]+\}\}/g)].map(m => m[0]);
  if (surviving.length > 0) {
    const unique = [...new Set(surviving)];
    window.Toast?.show({ kind: 'error', msg: `RSR: ${unique.length} placeholder${unique.length>1?'s':''} not replaced: ${unique.join(', ')}`, duration: 7000 });
    console.warn('RSR injectRSRValues — unreplaced placeholders:', unique);
  }
  return zip.generateAsync({ type: 'arraybuffer' });
}

async function downloadRSR(scheme) {
  const buffer = await loadRSRDocxBuffer();
  const out = await injectRSRValues(buffer, scheme);
  const docxFilename = `RSR_${scheme.project_number}_${(scheme.road_name||'').replace(/\s+/g,'_')}.docx`;
  const saved = window.fsSaveToProjectFolder
    ? await window.fsSaveToProjectFolder(scheme, ['Project Admin'], docxFilename, out, { versioned: true })
    : false;
  if (!saved) {
    const _url = URL.createObjectURL(new Blob([out], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
    const a = document.createElement('a');
    a.href = _url; a.download = docxFilename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(_url), 100);
  } else {
    if (window.Toast) window.Toast.show({ kind: 'success', msg: `RSR saved to ${window.schemeFolderName(scheme)}/Project Admin/`, duration: 4000 });
  }
}

// Renders the actual DOCX template via docx-preview — preview = download
const RSRDoc = ({ scheme }) => {
  const containerRef = React.useRef(null);
  const genRef       = React.useRef(0);
  const [status, setStatus] = React.useState('idle');
  const [errMsg, setErrMsg] = React.useState('');

  React.useEffect(() => {
    if (!scheme) return;
    const gen = ++genRef.current;
    setStatus('loading');
    (async () => {
      try {
        const buffer = await loadRSRDocxBuffer();
        const injected = await injectRSRValues(buffer, scheme);
        if (gen !== genRef.current) return;
        // Render into a detached node so a stale run cannot overwrite the
        // live container after a newer render has already committed.
        const tmp = document.createElement('div');
        if (window.docx && window.docx.renderAsync) {
          await window.docx.renderAsync(injected, tmp, null, {
            className: 'docx-preview',
            inWrapper: false,
            useBase64URL: true,
          });
        } else {
          tmp.innerHTML = '<p class="pci-err">docx-preview library not loaded.</p>';
        }
        if (gen !== genRef.current || !containerRef.current) return;
        containerRef.current.innerHTML = '';
        while (tmp.firstChild) containerRef.current.appendChild(tmp.firstChild);
        setStatus('ready');
      } catch (err) {
        if (gen === genRef.current) { setStatus('error'); setErrMsg(err.message); }
      }
    })();
  }, [scheme && JSON.stringify(buildRSRFields(scheme))]);

  return (
    <div className="pci-doc-wrap">
      {status === 'loading' && (
        <div className="pci-loading">
          <div className="spinner" />
          <span>Loading RSR form…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="pci-err-banner">
          <Icon.Alert size={16} />
          <span>{errMsg}</span>
        </div>
      )}
      <div ref={containerRef} className="pci-doc-content" />
    </div>
  );
};

async function downloadRSRPdf(scheme) {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:white;';
  document.body.appendChild(container);
  const root = ReactDOM.createRoot(container);
  try {
    const displayScheme = { ...scheme, treatment_type: window.schemeTreatment(scheme) || '' };
    root.render(React.createElement(RoadSpaceRequestDoc, { scheme: displayScheme }));
    await new Promise(r => setTimeout(r, 400));
    const pdfFilename = `RSR_${scheme.project_number}_${(scheme.road_name||'').replace(/\s+/g,'_')}.pdf`;
    const pdfSaved = window.fsSaveToProjectFolder
      ? await window.htmlToPdfBuffer(container.firstChild || container).then(buf =>
          window.fsSaveToProjectFolder(scheme, ['Project Admin'], pdfFilename, buf, { versioned: true }))
      : false;
    if (!pdfSaved) await window.htmlToPdf(container.firstChild || container, pdfFilename);
    else if (window.Toast) window.Toast.show({ kind: 'success', msg: `RSR PDF saved to ${window.schemeFolderName(scheme)}/Project Admin/`, duration: 4000 });
  } finally {
    root.unmount();
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
  tm_diversion_by: { label: "Diversion route(s)", multi: true },
  date_prepared:  { label: "Date prepared", hint: "DD/MM/YYYY" },
};

const RSRModal = ({ scheme: schemeProp, onClose }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeProp.id) || schemeProp;
  const bindings = Object.keys(RSR_FIELD_META);
  const missing = bindings.filter(k => !scheme[k] && scheme[k] !== 0);
  const [downloading, setDownloading] = React.useState(false);
  const [downloadingDocx, setDownloadingDocx] = React.useState(false);
  // Mobile tab state — controls which pane is visible on phones via the
  // [data-pane] selector in styles.css. Inert on desktop (the .modal-tabs
  // bar is display:none above 768px), so the form/preview grid keeps
  // showing both panes side-by-side as before.
  const [activePane, setActivePane] = React.useState('form');

  const set = (k, v) => updateScheme(scheme.id, { [k]: v });

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

  const handleDownloadDocx = async () => {
    setDownloadingDocx(true);
    try {
      await downloadRSR(scheme);
      window.dispatchEvent(new CustomEvent('rmp-download', { detail: { label: `RSR DOCX — ${scheme.road_name}`, ref: scheme.project_number } }));
    }
    catch(e) { alert('Download failed: ' + e.message); }
    finally { setDownloadingDocx(false); }
  };

  const displayScheme = { ...scheme, treatment_type: window.schemeTreatment(scheme) || '' };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal rsr-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{fontWeight:600,fontSize:15}}>Road Space Request Form · Preview</div>
            <div style={{fontSize:12,color:"var(--ink-3)",fontFamily:"var(--font-mono)"}}>{scheme.project_number} · {scheme.road_name} · {bindings.length-missing.length}/{bindings.length} fields bound</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button className="btn ghost sm" onClick={handleDownloadDocx} disabled={downloadingDocx}><Icon.Download /> {downloadingDocx?"Generating…":"Download .docx"}</button>
            <button className="btn sm" onClick={handleDownload} disabled={downloading}><Icon.Download /> {downloading?"Generating…":"Download .pdf"}</button>
            <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>
          </div>
        </div>
        <div className="modal-tabs">
          <button className={"modal-tab"+(activePane==='form'?' active':'')}    onClick={()=>setActivePane('form')}>Form</button>
          <button className={"modal-tab"+(activePane==='preview'?' active':'')} onClick={()=>setActivePane('preview')}>Preview</button>
        </div>
        <div className="rsr-body" data-pane={activePane}>
          <div className="rsr-preview-pane">
            <RSRDoc scheme={displayScheme} />
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
  } catch (e) {
    console.warn('RSR download failed', e);
    window.Toast?.show({ kind: 'error', msg: `RSR download failed: ${e.message}`, duration: 6000 });
  }
};

window.__downloadRSRPdf = async (scheme) => {
  try {
    await downloadRSRPdf(scheme);
    window.dispatchEvent(new CustomEvent('rmp-download', { detail: { label: `RSR PDF — ${scheme.road_name}`, ref: scheme.project_number, fn: '__downloadRSRPdf', schemeId: scheme.id } }));
  } catch (e) {
    console.warn('RSR PDF download failed', e);
    window.Toast?.show({ kind: 'error', msg: `RSR PDF download failed: ${e.message}`, duration: 6000 });
  }
};

window.__getRSRPdfBuffer = async (scheme) => {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:white;';
  document.body.appendChild(container);
  const root = ReactDOM.createRoot(container);
  try {
    const displayScheme = { ...scheme, treatment_type: window.schemeTreatment(scheme) || '' };
    root.render(React.createElement(RoadSpaceRequestDoc, { scheme: displayScheme }));
    await new Promise(r => setTimeout(r, 400));
    return await window.htmlToPdfBuffer(container.firstChild || container);
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
};

window.RoadSpaceRequestDoc = RoadSpaceRequestDoc;
window.RSRModal = RSRModal;
