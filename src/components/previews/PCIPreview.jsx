// PCIPreview.jsx — PCI/CPP document preview with named-range injection

const PCI_FIELDS = [
  { tag: 'SchemeRef',       path: 'project_number' },
  { tag: 'SchemeName',      path: 'road_name' },
  { tag: 'Ward',            path: 'ward_selected' },
  { tag: 'ContractorName',  path: 'contractor' },
  { tag: 'ContractorRef',   path: 'contractor_ref' },
  { tag: 'StartDate',       path: 'date_start' },
  { tag: 'EndDate',         path: 'date_finish' },
  { tag: 'TotalCost',       path: 'tender_total',      fmt: 'gbp' },
  { tag: 'NetworkLength',   path: 'network_length' },
  { tag: 'TreatmentType',   path: 'treatment_type' },
  { tag: 'RoadCategory',    path: 'road_category' },
  { tag: 'PCIBefore',       path: 'pci_before' },
  { tag: 'PCIAfter',        path: 'pci_after' },
  { tag: 'SupervisorName',  path: 'supervisor_name' },
  { tag: 'SupervisorPhone', path: 'supervisor_phone' },
  { tag: 'SupervisorEmail', path: 'supervisor_email' },
  { tag: 'Description',     path: 'pci_description' },
  { tag: 'Justification',   path: 'pci_justification' },
  { tag: 'BudgetCode',      path: 'budget_code' },
  { tag: 'FinancialYear',   path: 'financial_year' },
  { tag: 'CPPRef',          path: 'cpp_ref' },
  { tag: 'DrawingRef',      path: 'drawing_ref' },
  { tag: 'CouncilContact',  path: 'client_officer' },
  { tag: 'CouncilEmail',    path: 'client_email' },
  { tag: 'CouncilPhone',    path: 'client_phone' },
];

const PCI_TEMPLATE = 'templates/FM701-10A_DCC_Category_2_PCI-CPP_combined_.docx';

function resolveValue(scheme, path, fmt) {
  const val = path.split('.').reduce((obj, k) => (obj || {})[k], scheme);
  if (val === undefined || val === null || val === '') return '';
  if (fmt === 'date') return window.fmtDate ? window.fmtDate(val) : val;
  if (fmt === 'gbp')  return window.fmtGBP  ? window.fmtGBP(val)  : val;
  return String(val);
}

async function loadDocxBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Template not found: ' + url);
  return res.arrayBuffer();
}

async function injectValues(buffer, scheme) {
  // JSZip is loaded globally from the HTML script tag
  const zip = new window.JSZip();
  await zip.loadAsync(buffer);

  const xmlFiles = [
    'word/document.xml',
    'word/header1.xml',
    'word/header2.xml',
    'word/footer1.xml',
    'word/footer2.xml',
  ];

  for (const xmlPath of xmlFiles) {
    const file = zip.file(xmlPath);
    if (!file) continue;
    let xml = await file.async('string');

    for (const field of PCI_FIELDS) {
      const value = resolveValue(scheme, field.path, field.fmt);

      // Replace w:sdt content controls matched by alias tag
      const sdtRe = new RegExp(
        `(<w:sdt>[\\s\\S]*?<w:alias[^/]*/>[\\s\\S]*?<w:tag w:val="${field.tag}"[^/]*/>[\\s\\S]*?<w:sdtContent>)([\\s\\S]*?)(<\/w:sdtContent>[\\s\\S]*?<\/w:sdt>)`,
        'g'
      );
      xml = xml.replace(sdtRe, (_, open, _inner, close) =>
        open + `<w:r><w:t xml:space="preserve">${value}</w:t></w:r>` + close
      );

      // Also replace {{TAG}} placeholders
      xml = xml.split(`{{${field.tag}}}`).join(value);
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
              .map(f => { const v = resolveValue(scheme, f.path, f.fmt); return v ? `<tr><th>${f.tag}</th><td>${v}</td></tr>` : ''; })
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

const PCIModal = ({ schemeId, onClose }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);

  const handleDownload = React.useCallback(async () => {
    if (!scheme) return;
    try {
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
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
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
            <button className="btn sm" onClick={handleDownload}>
              <Icon.Download /> Download .docx
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
                const val = resolveValue(scheme, f.path, f.fmt);
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

window.PCIDoc   = PCIDoc;
window.PCIModal = PCIModal;
