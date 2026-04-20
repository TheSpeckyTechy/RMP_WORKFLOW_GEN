// PCIPreview.jsx — PCI/CPP document preview with named-range injection

const PCI_FIELDS = [
  { tag: 'SchemeRef',       path: 'schemeRef' },
  { tag: 'SchemeName',      path: 'schemeName' },
  { tag: 'Ward',            path: 'ward' },
  { tag: 'ContractorName',  path: 'contractorName' },
  { tag: 'ContractorRef',   path: 'contractorRef' },
  { tag: 'StartDate',       path: 'startDate',     fmt: 'date' },
  { tag: 'EndDate',         path: 'endDate',       fmt: 'date' },
  { tag: 'TotalCost',       path: 'totalCost',     fmt: 'gbp' },
  { tag: 'NetworkLength',   path: 'networkLength' },
  { tag: 'TreatmentType',   path: 'treatmentType' },
  { tag: 'RoadCategory',    path: 'roadCategory' },
  { tag: 'PCIBefore',       path: 'pciBefore' },
  { tag: 'PCIAfter',        path: 'pciAfter' },
  { tag: 'SupervisorName',  path: 'supervisorName' },
  { tag: 'SupervisorPhone', path: 'supervisorPhone' },
  { tag: 'SupervisorEmail', path: 'supervisorEmail' },
  { tag: 'Description',     path: 'description' },
  { tag: 'Justification',   path: 'justification' },
  { tag: 'BudgetCode',      path: 'budgetCode' },
  { tag: 'FinancialYear',   path: 'financialYear' },
  { tag: 'CPPRef',          path: 'cppRef' },
  { tag: 'DrawingRef',      path: 'drawingRef' },
  { tag: 'CouncilContact',  path: 'councilContact' },
  { tag: 'CouncilEmail',    path: 'councilEmail' },
  { tag: 'CouncilPhone',    path: 'councilPhone' },
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
              `<div class="pci-fallback"><h2>${scheme.schemeName || scheme.schemeRef}</h2><table class="pci-table">${rows}</table></div>`;
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
  const { getScheme } = React.useContext(window.SchemeContext);
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
      a.download = `PCI_CPP_${scheme.schemeRef}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
  }, [scheme]);

  if (!scheme) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel--wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">PCI / CPP Document</h2>
            <p className="modal-sub">{scheme.schemeName} — {scheme.schemeRef}</p>
          </div>
          <div className="modal-actions">
            <button className="btn btn--secondary" onClick={handleDownload}>
              <window.Icon.Download size={14} /> Download .docx
            </button>
            <button className="btn btn--ghost" onClick={onClose}>
              <window.Icon.X size={16} />
            </button>
          </div>
        </div>

        <div className="modal-body modal-body--doc">
          <div className="doc-sidebar">
            <h3 className="doc-sidebar__title">Field Bindings</h3>
            <ul className="field-list">
              {PCI_FIELDS.map(f => (
                <li key={f.tag} className="field-list__item">
                  <span className="field-list__tag">{f.tag}</span>
                  <span className="field-list__val">{resolveValue(scheme, f.path, f.fmt) || <em>—</em>}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="doc-preview-area">
            <PCIDoc scheme={scheme} />
          </div>
        </div>
      </div>
    </div>
  );
};

window.PCIDoc   = PCIDoc;
window.PCIModal = PCIModal;
