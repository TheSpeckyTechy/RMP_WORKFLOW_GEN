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
  { tag: 'HAZ_WORKING_HEIGHT',      path: 'haz_working_height' },
  { tag: 'HAZ_SLIPS',               path: 'haz_slips' },
  { tag: 'HAZ_EXCAVATIONS',         path: 'haz_excavations' },
  { tag: 'HAZ_STRUCTURES',          path: 'haz_structures' },
  { tag: 'HAZ_HEALTH',              path: 'haz_health' },
  { tag: 'HAZ_ASBESTOS',            path: 'haz_asbestos' },
  { tag: 'HAZ_PUBLIC',              path: 'haz_public' },
  { tag: 'HAZ_ENVIRONMENT',         path: 'haz_environment' },
  { tag: 'HAZ_OTHER',               path: 'haz_other' },
  { tag: 'HAZ_ADDITIONAL',          path: 'haz_additional' },
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
    HAZ_WORKING_HEIGHT:      scheme.haz_working_height || 'N/A',
    HAZ_SLIPS:               scheme.haz_slips || 'N/A',
    HAZ_EXCAVATIONS:         scheme.haz_excavations || 'N/A',
    HAZ_STRUCTURES:          scheme.haz_structures || 'N/A',
    HAZ_HEALTH:              scheme.haz_health || 'N/A',
    HAZ_ASBESTOS:            scheme.haz_asbestos || 'N/A',
    HAZ_PUBLIC:              scheme.haz_public || 'N/A',
    HAZ_ENVIRONMENT:         scheme.haz_environment || 'N/A',
    HAZ_OTHER:               scheme.haz_other || 'N/A',
    HAZ_ADDITIONAL:          scheme.haz_additional || '',
  };
}

// ── Custom HTML renderer for pack PDF compilation ─────────────────────────────
// Renders the PCI/CPP form as two A4-sized HTML pages (794×1123px each).
// Each page is captured independently by __getPCIPdfBuffer so page breaks and
// margins match the physical template exactly.
const PCIPackDoc = ({ scheme }) => {
  const f = buildPCIFields(scheme);

  const PAGE = {
    width: '794px', minHeight: '1123px', background: 'white',
    padding: '52px 52px 48px 66px',
    fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '9.5pt',
    color: '#000', boxSizing: 'border-box',
  };

  const SEC_HEAD = {
    background: '#003087', color: 'white', padding: '4px 8px',
    fontSize: '9pt', fontWeight: 'bold', marginBottom: 0,
  };

  const TBL = { width: '100%', borderCollapse: 'collapse', marginBottom: '10px', tableLayout: 'fixed' };

  const TDL = {
    border: '1px solid #aaa', padding: '4px 7px', width: '38%',
    verticalAlign: 'top', background: '#f0f0f0',
    fontSize: '8.5pt', fontWeight: 'bold', lineHeight: '1.4',
  };

  const TDV = {
    border: '1px solid #aaa', padding: '4px 7px', verticalAlign: 'top',
    fontSize: '9pt', lineHeight: '1.4', wordBreak: 'break-word',
  };

  const TDV_ML = { ...TDV, whiteSpace: 'pre-wrap' };

  const R = (label, value) => (
    <tr>
      <td style={TDL}>{label}</td>
      <td style={TDV}>{value || ''}</td>
    </tr>
  );

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>

      {/* ── PAGE 1 — Project / Designer / Client / Contractor ───── */}
      <div data-pci-page="1" style={PAGE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #003087', paddingBottom: '10px', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '13pt', fontWeight: 'bold', color: '#003087', lineHeight: 1.2 }}>Dundee City Council</div>
            <div style={{ fontSize: '10pt', color: '#003087' }}>Roads &amp; Transportation</div>
            <div style={{ fontSize: '8pt', color: '#555', marginTop: '4px' }}>Road Maintenance Partnership</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#003087' }}>FM701-10A</div>
            <div style={{ fontSize: '8pt', color: '#666' }}>Rev 1</div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '12pt', fontWeight: 'bold', textDecoration: 'underline', color: '#003087' }}>
            Pre Construction Information &amp; Construction Phase Plan
          </div>
        </div>

        <div style={{ marginBottom: '4px' }}>
          <div style={SEC_HEAD}>Part 1 — Project Information</div>
          <table style={TBL}><tbody>
            {R('Project Title', f.PROJECT_TITLE)}
            {R('Project Number', f.PROJECT_NUMBER)}
            {R('Project Address', f.PROJECT_ADDRESS)}
            {R('Proposed Start Date', f.START_DATE)}
            {R('Proposed Finish Date', f.FINISH_DATE)}
          </tbody></table>
        </div>

        <div style={{ marginBottom: '4px' }}>
          <div style={SEC_HEAD}>Part 2 — Designer Details</div>
          <table style={TBL}><tbody>
            {R('Designer Name', f.DESIGNER_NAME)}
            {R('Head of Service', f.DESIGNER_HEAD_OF)}
            {R('Telephone', f.DESIGNER_TELEPHONE)}
            {R('Email', f.DESIGNER_EMAIL)}
          </tbody></table>
        </div>

        <div style={{ marginBottom: '4px' }}>
          <div style={SEC_HEAD}>Part 3 — Client Details</div>
          <table style={TBL}><tbody>
            {R('Client Name & Address', f.CLIENT_NAME_ADDRESS)}
            {R('Client Officer', f.CLIENT_OFFICER)}
            {R('Telephone', f.CLIENT_TELEPHONE)}
            {R('Email', f.CLIENT_EMAIL)}
            {R('Department', f.DEPARTMENT)}
            {R('CDM Principal Designer', f.CDM_PRINCIPAL_DESIGNER)}
            {R('CDM Head Of', f.CDM_HEAD_OF)}
            {R('Client Ref / Work Order', f.CLIENT_REF_WORK_ORDER)}
          </tbody></table>
        </div>

        <div style={{ marginBottom: '4px' }}>
          <div style={SEC_HEAD}>Part 4 — Principal Contractor Details</div>
          <table style={TBL}><tbody>
            {R('Contractor Name', f.CONTRACTOR_NAME)}
            {R('Contractor Address', f.CONTRACTOR_ADDRESS)}
            {R('Contact Name', f.CONTRACTOR_CONTACT)}
            {R('Telephone', f.CONTRACTOR_TELEPHONE)}
            {R('Email', f.CONTRACTOR_EMAIL)}
            {R('Out of Hours Contact', f.CONTRACTOR_OUT_OF_HOURS)}
          </tbody></table>
        </div>
      </div>

      {/* ── PAGE 2 — Description / Occupiers / Security ─────────── */}
      <div data-pci-page="2" style={PAGE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #003087', paddingBottom: '6px', marginBottom: '14px' }}>
          <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#003087' }}>
            Pre Construction Information &amp; Construction Phase Plan
          </div>
          <div style={{ fontSize: '8.5pt', color: '#555', textAlign: 'right' }}>
            <div>{f.PROJECT_NUMBER}</div>
            <div>{f.PROJECT_TITLE}</div>
          </div>
        </div>

        <div style={{ marginBottom: '4px' }}>
          <div style={SEC_HEAD}>Part 5 — Description of Works &amp; Construction Phase Plan</div>
          <table style={TBL}><tbody>
            <tr>
              <td style={{ ...TDL, width: '38%' }}>Description of Works &amp; Construction Phase Plan</td>
              <td style={{ ...TDV_ML, minHeight: '400px' }}>{f.DESCRIPTION_OF_WORK || ''}</td>
            </tr>
          </tbody></table>
        </div>

        <div style={{ marginBottom: '4px' }}>
          <div style={SEC_HEAD}>Part 6 — Occupier / Tenant Details</div>
          <table style={TBL}><tbody>
            <tr>
              <td style={{ ...TDL, width: '38%' }}>Occupier / Tenant Details</td>
              <td style={{ ...TDV_ML, minHeight: '90px' }}>{f.OCCUPIER_TENANT_DETAILS || 'None identified.'}</td>
            </tr>
          </tbody></table>
        </div>

        <div style={{ marginBottom: '4px' }}>
          <div style={SEC_HEAD}>Part 7 — Security Arrangements</div>
          <table style={TBL}><tbody>
            <tr>
              <td style={{ ...TDL, width: '38%' }}>Security Arrangements</td>
              <td style={{ ...TDV_ML, minHeight: '90px' }}>{f.SECURITY_ARRANGEMENTS || 'Standard site security applies.'}</td>
            </tr>
          </tbody></table>
        </div>

        <div style={{ marginTop: '16px', paddingTop: '6px', borderTop: '1px solid #ccc', fontSize: '7.5pt', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
          <span>FM701-10A — DCC Roads &amp; Transportation</span>
          <span>Generated by RMP Design Studio · {new Date().toLocaleDateString('en-GB')}</span>
        </div>
      </div>

      {/* ── PAGE 3 — Hazards (Section 1.2) + Additional Info (Section 1.3) ── */}
      <div data-pci-page="3" style={PAGE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #003087', paddingBottom: '6px', marginBottom: '14px' }}>
          <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#003087' }}>
            Pre Construction Information &amp; Construction Phase Plan
          </div>
          <div style={{ fontSize: '8.5pt', color: '#555', textAlign: 'right' }}>
            <div>{f.PROJECT_NUMBER}</div>
            <div>{f.PROJECT_TITLE}</div>
          </div>
        </div>

        {/* Section 1.2 header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#003087', color: 'white', padding: '4px 8px', fontWeight: 'bold', fontSize: '9pt', marginBottom: 0 }}>
          <span>1.2 &nbsp; Project specific hazards</span>
          <span style={{ fontSize: '8pt', fontWeight: 'normal' }}>Contractors RAMS reference</span>
        </div>

        {/* Hazard rows */}
        {[
          ['Working at Height',                                 f.HAZ_WORKING_HEIGHT],
          ['Slips, Trips & Falls',                              f.HAZ_SLIPS],
          ['Excavations and Services',                          f.HAZ_EXCAVATIONS],
          ['Collapse of Structures/Materials',                  f.HAZ_STRUCTURES],
          ['Health Hazards',                                    f.HAZ_HEALTH],
          ['Exposure to Asbestos',                              f.HAZ_ASBESTOS],
          ['Risks to Members of the Public, Building Users and Others', f.HAZ_PUBLIC],
          ['Environmental Policies',                            f.HAZ_ENVIRONMENT],
          ['Other Dangers on Site',                             f.HAZ_OTHER],
        ].map(([label, value]) => (
          <table key={label} style={{ ...TBL, marginBottom: 0 }}><tbody>
            <tr>
              <td style={{ border: '1px solid #aaa', borderBottom: 'none', padding: '3px 7px 1px', fontWeight: 'bold', fontSize: '8.5pt', background: '#f8f8f8' }}>{label}</td>
              <td style={{ border: '1px solid #aaa', borderLeft: 'none', borderBottom: 'none', width: '22%', background: '#f8f8f8' }}></td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #aaa', borderTop: 'none', padding: '3px 7px 5px', fontSize: '8.5pt', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{value || 'N/A'}</td>
              <td style={{ border: '1px solid #aaa', borderLeft: 'none', borderTop: 'none', width: '22%' }}></td>
            </tr>
          </tbody></table>
        ))}

        {/* Section 1.3 */}
        <div style={{ ...SEC_HEAD, marginTop: '10px' }}>1.3 &nbsp; Additional information provided by client</div>
        <table style={{ ...TBL, marginBottom: 0 }}><tbody>
          <tr>
            <td style={{ border: '1px solid #aaa', padding: '5px 7px', fontSize: '8.5pt', whiteSpace: 'pre-wrap', lineHeight: 1.5, minHeight: '60px' }}>
              {f.HAZ_ADDITIONAL || '—'}
            </td>
          </tr>
        </tbody></table>

        <div style={{ marginTop: '16px', paddingTop: '6px', borderTop: '1px solid #ccc', fontSize: '7.5pt', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
          <span>FM701-10A — DCC Roads &amp; Transportation</span>
          <span>Generated by RMP Design Studio · {new Date().toLocaleDateString('en-GB')}</span>
        </div>
      </div>
    </div>
  );
};

let _pciTemplateBuf = null;
async function loadDocxBuffer(url) {
  if (_pciTemplateBuf) return _pciTemplateBuf.slice(0);
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Template not found: ' + url);
  _pciTemplateBuf = await res.arrayBuffer();
  return _pciTemplateBuf.slice(0);
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
  }, [scheme && JSON.stringify(buildPCIFields(scheme))]);

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

              <div className="rsr-side-title" style={{marginTop:12}}>Section 1.2 — Hazards</div>
              {[
                { key: 'haz_working_height', tag: 'HAZ_WORKING_HEIGHT', label: 'Working at Height' },
                { key: 'haz_slips',          tag: 'HAZ_SLIPS',          label: 'Slips, Trips & Falls' },
                { key: 'haz_excavations',    tag: 'HAZ_EXCAVATIONS',    label: 'Excavations & Services' },
                { key: 'haz_structures',     tag: 'HAZ_STRUCTURES',     label: 'Collapse of Structures' },
                { key: 'haz_health',         tag: 'HAZ_HEALTH',         label: 'Health Hazards' },
                { key: 'haz_asbestos',       tag: 'HAZ_ASBESTOS',       label: 'Exposure to Asbestos' },
                { key: 'haz_public',         tag: 'HAZ_PUBLIC',         label: 'Risks to Public' },
                { key: 'haz_environment',    tag: 'HAZ_ENVIRONMENT',    label: 'Environmental Policies' },
                { key: 'haz_other',          tag: 'HAZ_OTHER',          label: 'Other Dangers on Site' },
                { key: 'haz_additional',     tag: 'HAZ_ADDITIONAL',     label: '1.3 Additional Information' },
              ].map(({ key, tag, label }) => (
                <div key={key} className="rsr-bind">
                  <div className="rsr-bind-key mono">{tag}</div>
                  <div style={{fontSize:10,color:'var(--ink-3)',marginBottom:2}}>{label}</div>
                  <textarea className="rsr-field-input" rows={3}
                    value={scheme[key] || ''}
                    onChange={e => updateScheme(schemeId, { [key]: e.target.value })} />
                </div>
              ))}

              <div className="rsr-side-title" style={{marginTop:12}}>Read-only Bindings</div>
              {PCI_FIELDS.filter(f => !['pci_description','pci_occupiers','pci_site_security','haz_working_height','haz_slips','haz_excavations','haz_structures','haz_health','haz_asbestos','haz_public','haz_environment','haz_other','haz_additional'].includes(f.path)).map(f => {
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

window.__getPCIPdfBuffer = async (scheme) => {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:white;';
  document.body.appendChild(container);
  let root = null;
  try {
    root = ReactDOM.createRoot(container);
    await new Promise(resolve => {
      root.render(React.createElement(PCIPackDoc, { scheme }));
      // Allow React to fully paint and fonts to load
      setTimeout(resolve, 300);
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pages = Array.from(container.querySelectorAll('[data-pci-page]'));
    let firstPage = true;

    for (const pageEl of pages) {
      const canvas = await window.html2canvas(pageEl, {
        scale: 2, backgroundColor: '#ffffff',
        useCORS: true, allowTaint: true, logging: false,
        width: 794,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const imgW = 210;
      const imgH = (canvas.height / canvas.width) * imgW;
      const pdfPageH = 297;
      let y = 0;
      // Paginate if content taller than one A4 page (e.g. very long description)
      while (y < imgH - 1) {
        if (!firstPage) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -y, imgW, imgH);
        y += pdfPageH;
        firstPage = false;
      }
    }

    return pdf.output('arraybuffer');
  } finally {
    if (root) { try { root.unmount(); } catch (_) {} }
    document.body.removeChild(container);
  }
};

window.PCIDoc   = PCIDoc;
window.PCIModal = PCIModal;
