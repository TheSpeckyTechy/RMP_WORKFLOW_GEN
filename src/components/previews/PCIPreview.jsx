// PCIPreview.jsx — PCI/CPP document preview with template injection
//
// The template file is Road_Space_Request_Form_TEMPLATE.docx which contains
// the FM701-10A Pre Construction Information & Construction Phase Plan form
// with {{UPPERCASE_TAG}} placeholders matching the field names below.

// Field list used for the bindings side panel only
const PCI_FIELDS = [
  { tag: 'PROJECT_TITLE',           path: 'road_name' },
  { tag: 'PROJECT_NUMBER',          path: 'project_number' },
  { tag: 'START_DATE',              path: 'date_start' },
  { tag: 'FINISH_DATE',             path: 'date_finish' },
  { tag: 'DESIGNER_NAME',           path: 'prepared_by' },
  { tag: 'DESIGNER_HEAD_OF',        path: 'designer_head_of' },
  { tag: 'DESIGNER_TELEPHONE',      path: 'designer_phone' },
  { tag: 'DESIGNER_EMAIL',          path: 'designer_email' },
  { tag: 'CLIENT_NAME_ADDRESS',     path: 'client_name_address' },
  { tag: 'CLIENT_OFFICER',          path: 'client_officer' },
  { tag: 'CLIENT_TELEPHONE',        path: 'client_phone' },
  { tag: 'CLIENT_EMAIL',            path: 'client_email' },
  { tag: 'DEPARTMENT',              path: 'department' },
  { tag: 'CDM_PRINCIPAL_DESIGNER',  path: 'cdm_principal_designer' },
  { tag: 'CDM_HEAD_OF',             path: 'cdm_head_of' },
  { tag: 'CLIENT_REF_WORK_ORDER',   path: 'client_ref_work_order' },
  { tag: 'CONTRACTOR_NAME',         path: 'contractor' },
  { tag: 'CONTRACTOR_ADDRESS',      path: 'contractor_address' },
  { tag: 'CONTRACTOR_CONTACT',      path: 'contractor_pe' },
  { tag: 'CONTRACTOR_TELEPHONE',    path: 'contractor_ooh' },
  { tag: 'CONTRACTOR_EMAIL',        path: 'contractor_email' },
  { tag: 'CONTRACTOR_OUT_OF_HOURS', path: 'contractor_ooh' },
  { tag: 'OUT_OF_HOURS_CONTACT',    path: 'contractor_ooh' },
  { tag: 'DESCRIPTION_OF_WORK',     path: 'pci_description' },
  { tag: 'OCCUPIER_TENANT_DETAILS', path: 'pci_occupiers' },
  { tag: 'SECURITY_ARRANGEMENTS',   path: 'pci_site_security' },
];

const PCI_TEMPLATE = 'templates/Road_Space_Request_Form_TEMPLATE.docx';

const xmlEscape = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function resolveValue(scheme, path) {
  const val = path.split('.').reduce((obj, k) => (obj || {})[k], scheme);
  if (val === undefined || val === null || val === '') return '';
  return String(val);
}

// ── Auto-description builder ──────────────────────────────────────────────────
const pciWorkingDays = (dmyA, dmyB) => {
  const p = s => { const [d,m,y]=(s||'').split('/'); return new Date(+y,+m-1,+d); };
  const a=p(dmyA), b=p(dmyB);
  if(isNaN(a)||isNaN(b)) return null;
  return Math.max(1, Math.round((b-a)/86400000*5/7));
};

const buildAutoDescription = (scheme) => {
  const lines = [];
  const ext = scheme.scheme_extent ? ` (${scheme.scheme_extent})` : '';
  const treatment = scheme.treatment_type === 'Other'
    ? (scheme.treatment_description || 'specialist treatment')
    : (scheme.treatment_type || 'carriageway works');

  // Opening
  lines.push(`${scheme.scheme_type || 'Carriageway'} resurfacing of ${scheme.road_name}${ext}.`);

  // Programme
  const days = pciWorkingDays(scheme.date_start, scheme.date_finish);
  const dateRange = [scheme.date_start, scheme.date_finish].filter(Boolean).join(' to ');
  if (days) lines.push(`Works programme: ${days} working day${days!==1?'s':''}${dateRange ? ` (${dateRange})` : ''}.`);

  // Treatment zones
  const zones = (scheme.treatments||[]).filter(z => +z.area_m2 > 0);
  if (zones.length > 1) {
    lines.push('\nTreatment zones:');
    zones.forEach(z => {
      const t = z.treatment_type === 'Other' ? (z.treatment_description || 'specialist') : (z.treatment_type || treatment);
      lines.push(`• ${z.zone}: ${(+z.area_m2).toLocaleString()} m² at ${z.depth_mm}mm — ${t}.`);
    });
    const total = zones.reduce((s,z)=>s+(+z.area_m2),0);
    lines.push(`Total scheme area: ${total.toLocaleString()} m².`);
  } else {
    const area = +scheme.area_m2;
    if (area > 0) lines.push(`Total scheme area: ${area.toLocaleString()} m².`);
    if (+scheme.surface_depth_mm > 0) lines.push(`Surface course: ${treatment} at ${scheme.surface_depth_mm}mm nominal depth.`);
    if (+scheme.binder_depth_mm > 0)  lines.push(`Binder course: ${scheme.binder_depth_mm}mm.`);
  }

  // Traffic management
  if (scheme.tm_type) {
    let tm = `\nTraffic management: ${scheme.tm_type}`;
    if (+scheme.tm_phases > 1) tm += ` (${scheme.tm_phases} phases)`;
    if (scheme.tm_hours)       tm += `. Working hours: ${scheme.tm_hours}`;
    if (scheme.tm_diversion_by) tm += `. Diversion by: ${scheme.tm_diversion_by}`;
    lines.push(tm + '.');
  }

  // Ironwork
  const iron = [];
  if (+scheme.iron_mh     > 0) iron.push(`${scheme.iron_mh} no. manhole cover${+scheme.iron_mh>1?'s':''} to be reset`);
  if (+scheme.iron_water  > 0) iron.push(`${scheme.iron_water} no. water authority cover${+scheme.iron_water>1?'s':''} to be reset`);
  if (+scheme.iron_gas    > 0) iron.push(`${scheme.iron_gas} no. gas cover${+scheme.iron_gas>1?'s':''} to be reset`);
  if (+scheme.iron_bt     > 0) iron.push(`${scheme.iron_bt} no. BT/comms cover${+scheme.iron_bt>1?'s':''} to be reset`);
  if (+scheme.iron_gullies> 0) iron.push(`${scheme.iron_gullies} no. gully grating${+scheme.iron_gullies>1?'s':''} to be adjusted to new surface level`);
  lines.push(iron.length > 0
    ? `\nIronwork: ${iron.join('; ')}.`
    : '\nIronwork: None identified — confirm on site prior to works commencing.');

  // Kerbs
  if (+scheme.kerb_length > 0)
    lines.push(`Kerb works: approximately ${scheme.kerb_length} m of kerb to be replaced / adjusted.`);

  // Lining
  lines.push(`Road markings: ${scheme.lining_req === 'Yes'
    ? 'Full reinstatement of road markings required on completion of surfacing.'
    : 'No road marking reinstatement required.'}`);

  // Justification
  if (scheme.pci_justification)
    lines.push(`\nJustification: ${scheme.pci_justification}`);

  return lines.join('\n');
};

window.buildPCIAutoDescription = buildAutoDescription;

function buildPCIFields(scheme) {
  const ext = scheme.scheme_extent ? `: ${scheme.scheme_extent}` : '';
  return {
    PROJECT_TITLE:           `${scheme.road_name || ''}${ext}`,
    PROJECT_NUMBER:          scheme.project_number || '',
    PROJECT_ADDRESS:         `${scheme.road_name || ''}${ext}`,
    START_DATE:              scheme.date_start || '',
    FINISH_DATE:             scheme.date_finish || '',
    DESIGNER_NAME:           scheme.prepared_by || '',
    DESIGNER_HEAD_OF:        scheme.designer_head_of || '',
    DESIGNER_TELEPHONE:      scheme.designer_phone || '',
    DESIGNER_EMAIL:          scheme.designer_email || '',
    CLIENT_NAME_ADDRESS:     scheme.client_name_address || '',
    CLIENT_OFFICER:          scheme.client_officer || '',
    CLIENT_TELEPHONE:        scheme.client_phone || '',
    CLIENT_EMAIL:            scheme.client_email || '',
    DEPARTMENT:              scheme.department || '',
    CDM_PRINCIPAL_DESIGNER:  scheme.cdm_principal_designer || '',
    CDM_HEAD_OF:             scheme.cdm_head_of || '',
    CLIENT_REF_WORK_ORDER:   scheme.client_ref_work_order || '',
    CONTRACTOR_NAME:         scheme.contractor || '',
    CONTRACTOR_ADDRESS:      scheme.contractor_address || '',
    CONTRACTOR_CONTACT:      scheme.contractor_pe || '',
    CONTRACTOR_TELEPHONE:    scheme.contractor_ooh || '',
    CONTRACTOR_EMAIL:        scheme.contractor_email || '',
    CONTRACTOR_OUT_OF_HOURS: scheme.contractor_ooh || '',
    OUT_OF_HOURS_CONTACT:    scheme.contractor_ooh || '',
    DESCRIPTION_OF_WORK:     scheme.pci_description || buildAutoDescription(scheme),
    OCCUPIER_TENANT_DETAILS: scheme.pci_occupiers || '',
    SECURITY_ARRANGEMENTS:   scheme.pci_site_security || '',
  };
}

async function loadDocxBuffer(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Template not found: ' + url);
  return res.arrayBuffer();
}

async function injectValues(buffer, scheme) {
  const zip = new window.JSZip();
  await zip.loadAsync(buffer);
  const fields = buildPCIFields(scheme);
  const xmlPaths = ['word/document.xml','word/header1.xml','word/header2.xml','word/footer1.xml','word/footer2.xml'];
  for (const xmlPath of xmlPaths) {
    const file = zip.file(xmlPath);
    if (!file) continue;
    let xml = await file.async('string');
    for (const [tag, value] of Object.entries(fields)) {
      xml = xml.split(`{{${tag}}}`).join(xmlEscape(value));
    }
    zip.file(xmlPath, xml);
  }
  return zip.generateAsync({ type: 'arraybuffer' });
}

const PCIDoc = ({ scheme }) => {
  const containerRef = React.useRef(null);
  const [status, setStatus]   = React.useState('idle');
  const [errMsg, setErrMsg]   = React.useState('');

  React.useEffect(() => {
    if (!scheme) return;
    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        let buffer;
        try {
          buffer = await loadDocxBuffer(PCI_TEMPLATE);
          buffer = await injectValues(buffer, scheme);
        } catch (_templateErr) {
          // No template — render a plain data summary
          if (!cancelled && containerRef.current) {
            const rows = PCI_FIELDS
              .map(f => { const v = resolveValue(scheme, f.path); return v ? `<tr><th>${f.tag}</th><td>${v}</td></tr>` : ''; })
              .join('');
            containerRef.current.innerHTML =
              `<div class="pci-fallback"><h2>${scheme.road_name || scheme.project_number}</h2><table class="pci-table">${rows}</table></div>`;
            setStatus('ready');
          }
          return;
        }

        if (cancelled) return;

        if (window.docx && window.docx.renderAsync) {
          await window.docx.renderAsync(buffer, containerRef.current, null, {
            className: 'docx-preview',
            inWrapper: false,
            useBase64URL: true,
          });
        } else {
          containerRef.current.innerHTML = '<p class="pci-err">docx-preview library not loaded.</p>';
        }
        if (!cancelled) setStatus('ready');
      } catch (err) {
        if (!cancelled) { setStatus('error'); setErrMsg(err.message); }
      }
    })();

    return () => { cancelled = true; };
  }, [scheme && scheme.id]);

  return (
    <div className="pci-doc-wrap">
      {status === 'loading' && (
        <div className="pci-loading">
          <div className="spinner" />
          <span>Generating PCI/CPP document…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="pci-err-banner">
          <window.Icon.Alert size={16} />
          <span>{errMsg}</span>
        </div>
      )}
      <div ref={containerRef} className="pci-doc-content" />
    </div>
  );
};

async function downloadPCIPdf(scheme) {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:white;';
  document.body.appendChild(container);
  try {
    let buffer = await loadDocxBuffer(PCI_TEMPLATE);
    buffer = await injectValues(buffer, scheme);
    if (window.docx && window.docx.renderAsync) {
      await window.docx.renderAsync(buffer, container, null, { className: 'docx-preview', inWrapper: false, useBase64URL: true });
    }
    await window.htmlToPdf(container, `PCI_CPP_${scheme.project_number}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

const PCIModal = ({ schemeId, onClose }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);
  const [downloading, setDownloading] = React.useState(null);

  const handleDownload = React.useCallback(async (fmt) => {
    if (!scheme) return;
    setDownloading(fmt);
    try {
      if (fmt === 'pdf') {
        await downloadPCIPdf(scheme);
        window.dispatchEvent(new CustomEvent('rmp-download', { detail: { label: `PCI/CPP PDF — ${scheme.road_name}`, ref: scheme.project_number } }));
      } else {
        let buffer = await loadDocxBuffer(PCI_TEMPLATE);
        buffer = await injectValues(buffer, scheme);
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `PCI_CPP_${scheme.project_number}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        updateScheme(schemeId, { docs_generated: { ...(scheme.docs_generated||{}), pci: true } });
        window.dispatchEvent(new CustomEvent('rmp-download', { detail: { label: `PCI/CPP — ${scheme.road_name}`, ref: scheme.project_number } }));
      }
    } catch (err) {
      alert('Download failed: ' + err.message);
    } finally { setDownloading(null); }
  }, [scheme]);

  if (!scheme) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal rsr-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{fontWeight:600,fontSize:15}}>PCI / CPP Document</div>
            <div style={{fontSize:12,color:"var(--ink-3)",fontFamily:"var(--font-mono)"}}>{scheme.road_name} — {scheme.project_number}</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button className="btn sm" onClick={()=>handleDownload('docx')} disabled={!!downloading}>
              <Icon.Download /> {downloading==='docx'?'Generating…':'Download .docx'}
            </button>
            <button className="btn sm" onClick={()=>handleDownload('pdf')} disabled={!!downloading}>
              <Icon.Download /> {downloading==='pdf'?'Generating…':'Download .pdf'}
            </button>
            <button className="btn ghost sm" onClick={onClose}>
              <Icon.X />
            </button>
          </div>
        </div>

        <div className="rsr-body">
          <div className="rsr-preview-pane">
            <PCIDoc scheme={scheme} />
          </div>
          <div className="rsr-side">
            <div className="rsr-side-title">Field Bindings</div>
            <div className="rsr-bind-list">

              {/* Editable: Description of Work */}
              <div className={"rsr-bind "+(scheme.pci_description?"":"missing")}>
                <div className="rsr-bind-key mono">DESCRIPTION_OF_WORK</div>
                <div style={{display:'flex',gap:4,marginBottom:4}}>
                  <button className="btn ghost sm" style={{fontSize:11,padding:'2px 8px'}}
                    onClick={() => updateScheme(schemeId, { pci_description: buildAutoDescription(scheme) })}>
                    ⟳ Auto-generate
                  </button>
                  {scheme.pci_description && (
                    <button className="btn ghost sm" style={{fontSize:11,padding:'2px 8px'}}
                      onClick={() => updateScheme(schemeId, { pci_description: '' })}>
                      ✕ Clear
                    </button>
                  )}
                </div>
                <textarea className="rsr-field-input" rows={8}
                  placeholder="Leave blank to use auto-generated text"
                  value={scheme.pci_description || ''}
                  onChange={e => updateScheme(schemeId, { pci_description: e.target.value })} />
                {!scheme.pci_description && (
                  <div style={{fontSize:11,color:'var(--ink-3)',marginTop:2}}>
                    Auto-generated from scheme data (click ⟳ to preview &amp; lock)
                  </div>
                )}
              </div>

              {/* Editable: Occupier / Tenant Details */}
              <div className={"rsr-bind "+(scheme.pci_occupiers?"":"missing")}>
                <div className="rsr-bind-key mono">OCCUPIER_TENANT_DETAILS</div>
                <textarea className="rsr-field-input" rows={3}
                  placeholder="e.g. Residential tenants on Guthrie Terrace — letter drop required"
                  value={scheme.pci_occupiers || ''}
                  onChange={e => updateScheme(schemeId, { pci_occupiers: e.target.value })} />
              </div>

              {/* Editable: Security Arrangements */}
              <div className={"rsr-bind "+(scheme.pci_site_security?"":"missing")}>
                <div className="rsr-bind-key mono">SECURITY_ARRANGEMENTS</div>
                <textarea className="rsr-field-input" rows={3}
                  placeholder="e.g. Coned exclusion zone maintained at all times. Overnight barriers and lights required."
                  value={scheme.pci_site_security || ''}
                  onChange={e => updateScheme(schemeId, { pci_site_security: e.target.value })} />
              </div>

              <div className="rsr-side-title" style={{marginTop:12}}>Read-only Bindings</div>
              {PCI_FIELDS.filter(f => !['pci_description','pci_occupiers','pci_site_security'].includes(f.path)).map(f => {
                const val = resolveValue(scheme, f.path);
                return (
                  <div key={f.tag} className={"rsr-bind "+(val?"":"missing")}>
                    <div className="rsr-bind-key mono">{f.tag}</div>
                    <div className="rsr-bind-val">{val || "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.__downloadPCI = async (scheme) => {
  try {
    let buffer = await loadDocxBuffer(PCI_TEMPLATE);
    buffer = await injectValues(buffer, scheme);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PCI_CPP_${scheme.project_number}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    window.dispatchEvent(new CustomEvent('rmp-download', { detail: { label: `PCI/CPP — ${scheme.road_name}`, ref: scheme.project_number, fn: '__downloadPCI', schemeId: scheme.id } }));
  } catch (e) { console.warn('PCI download failed', e); }
};

window.__downloadPCIPdf = async (scheme) => {
  try {
    await downloadPCIPdf(scheme);
    window.dispatchEvent(new CustomEvent('rmp-download', { detail: { label: `PCI/CPP PDF — ${scheme.road_name}`, ref: scheme.project_number, fn: '__downloadPCIPdf', schemeId: scheme.id } }));
  } catch (e) { console.warn('PCI PDF download failed', e); }
};

window.PCIDoc   = PCIDoc;
window.PCIModal = PCIModal;
