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
    DESCRIPTION_OF_WORK:     scheme.pci_description || '',
    OCCUPIER_TENANT_DETAILS: scheme.pci_occupiers || '',
    SECURITY_ARRANGEMENTS:   scheme.pci_site_security || '',
  };
}

async function loadDocxBuffer(url) {
  const res = await fetch(url);
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
      await window.docx.renderAsync(buffer, container, null, { className: 'docx-preview', inWrapper: false });
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
              {PCI_FIELDS.map(f => {
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
    window.dispatchEvent(new CustomEvent('rmp-download', { detail: { label: `PCI/CPP — ${scheme.road_name}`, ref: scheme.project_number } }));
  } catch (e) { console.warn('PCI download failed', e); }
};

window.__downloadPCIPdf = async (scheme) => {
  try {
    await downloadPCIPdf(scheme);
    window.dispatchEvent(new CustomEvent('rmp-download', { detail: { label: `PCI/CPP PDF — ${scheme.road_name}`, ref: scheme.project_number } }));
  } catch (e) { console.warn('PCI PDF download failed', e); }
};

window.PCIDoc   = PCIDoc;
window.PCIModal = PCIModal;
