// ─── LetterPreview.jsx ────────────────────────────────────────────────────────
// Resident / business letter preview.
// Renders a Word template via docx-preview then walks the rendered DOM to
// replace <<TAG>> and «TAG» placeholders with values derived from the scheme.
// Each scheme has its own recipients list; selecting one re-renders the letter
// for that address. The download button triggers a mail-merge for all.
//
// CAG Upload: the "Import from CAG" panel in the recipients sidebar accepts a
// Common Address Gazetteer CSV export, parses it client-side, and lets the
// user search, filter, and select addresses to add as scheme recipients.
//
// Template file: templates/Residential_Letter_Template (1).docx
//
// Components:
//   LetterDoc      — renders one letter for a given recipient
//   CAGImportPanel — CSV upload + address search/select UI
//   LetterModal    — full-screen preview with recipient selector + binding list
//
// Exports (via window): LetterDoc, LetterModal
// Depends on: React, window.Icon, window.WARDS, window.SchemeContext,
//             window.docx (docx-preview CDN)
// ─────────────────────────────────────────────────────────────────────────────

const defaultLetterSubject = s => {
  const road = s.road_name||""; const ext = s.scheme_extent?` (${s.scheme_extent})`:"";
  return `RESURFACING WORKS \u2014 ${road.toUpperCase()}${ext.toUpperCase()}`;
};

const defaultLetterBody = s => {
  const start=s.date_start||"[start date]", finish=s.date_finish||"[finish date]", road=s.road_name||"[road]",
    ext=s.scheme_extent?` between ${s.scheme_extent}`:"", tm=s.tm_type?s.tm_type.toLowerCase():"temporary traffic management", tmH=s.tm_hours||"07:30 to 15:30";
  return `Dundee City Council will shortly be carrying out resurfacing works on ${road}${ext}. The works are programmed to commence on ${start} and are expected to be completed by ${finish}.\n\nTo enable the works to be carried out safely, ${tm.charAt(0).toUpperCase()+tm.slice(1)} will be in place during working hours (${tmH}). Pedestrian access to properties will be maintained at all times.\n\nWe apologise in advance for any inconvenience caused.`;
};

const resolvedSubject = s => (s.letter_subject_override && s.letter_subject_override.trim()) || defaultLetterSubject(s);
const resolvedBody    = s => (s.letter_body_override    && s.letter_body_override.trim())    || defaultLetterBody(s);

// ─── Collapsible side panel section ──────────────────────────────────────────
const Collapsible = ({ title, count, defaultOpen=false, right, children }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{marginBottom:10,borderBottom:"1px solid var(--line)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,padding:"8px 0"}}>
        <button
          onClick={()=>setOpen(o=>!o)}
          style={{
            flex:1,display:"flex",alignItems:"center",gap:6,
            background:"none",border:0,padding:0,cursor:"pointer",
            fontSize:10,color:"var(--ink-3)",fontFamily:"var(--font-mono)",
            textTransform:"uppercase",letterSpacing:"0.08em",textAlign:"left",
          }}>
          <span style={{display:"inline-block",width:10,transition:"transform 0.12s",
            transform:open?"rotate(90deg)":"rotate(0deg)"}}>▸</span>
          <span>{title}{typeof count==="number"?` (${count})`:""}</span>
        </button>
        {right && <div onClick={e=>e.stopPropagation()}>{right}</div>}
      </div>
      {open && <div style={{paddingBottom:10}}>{children}</div>}
    </div>
  );
};

// Letter reference: project number + SL + designer initials (skip blank parts).
// e.g. prepared_by "Jake McAllister" with project "R5008" → "R5008/SL/JM".
const initialsOf = name => String(name||'').trim().split(/\s+/).map(w => w[0]||'').join('').toUpperCase();
const buildLetterRef = s => [s.project_number||'', 'SL', initialsOf(s.prepared_by)].filter(p => p && p !== '').join('/');

const LETTER_BINDINGS = [
  { tag: "<<Our_Ref>>",  derive: buildLetterRef },
  { tag: "<<Your_Ref>>", derive: buildLetterRef },
  { tag: "<<Letter_Date>>", derive: s => new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}) },
  { tag: "<<Letter_Subject>>", derive: resolvedSubject },
  { tag: "<<Letter_Body_Text>>", derive: resolvedBody },
  { tag: "<<Ward_Councillor_1>>", derive: s => { const w=window.WARDS.find(x=>x.num===s.ward_num); if(!w)return""; const c=w.councillors[0]; return c?`${c.title} ${c.name} (Ward ${w.num} ${w.name})`:"";}},
  { tag: "<<Ward_Councillor_2>>", derive: s => { const w=window.WARDS.find(x=>x.num===s.ward_num); if(!w)return""; const c=w.councillors[1]; return c?`${c.title} ${c.name} (Ward ${w.num} ${w.name})`:"";}},
  { tag: "<<Ward_Councillor_3>>", derive: s => { const w=window.WARDS.find(x=>x.num===s.ward_num); if(!w)return""; const c=w.councillors[2]; return c?`${c.title} ${c.name} (Ward ${w.num} ${w.name})`:"";}},
];

const loadLetterBuffer = async () => {
  const res = await fetch("templates/Residential_Letter_Template (1).docx", { cache: 'no-cache' });
  if (!res.ok) throw new Error('Letter template not found');
  return res.arrayBuffer();
};

const xmlEscape = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// When the body text contains paragraph breaks (\n\n) we open a new <w:p>.
// Without explicit <w:pPr>/<w:rPr> Word falls back to the default ~10pt
// after-spacing, which inflates the letter onto a second page. Emit the
// same compact 60/60 spacing + 10pt black run formatting the template uses
// so multi-paragraph bodies stay tight on a single page.
const BODY_PARA_BREAK = '</w:t></w:r></w:p>'
  + '<w:p><w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="both"/></w:pPr>'
  + '<w:r><w:rPr><w:color w:val="000000"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
  + '<w:t xml:space="preserve">';

const bodyToXml = text =>
  xmlEscape(text)
    .replace(/\n\n/g, BODY_PARA_BREAK)
    .replace(/\n/g,   '</w:t><w:br/><w:t xml:space="preserve">');

async function injectLetterXml(buffer, scheme, recipient) {
  const zip = new window.JSZip();
  await zip.loadAsync(buffer);

  const subjectText = resolvedSubject(scheme);
  const bodyText    = resolvedBody(scheme);

  const getCouncillor = (idx) => {
    const w = window.WARDS.find(x => x.num === scheme.ward_num);
    if (!w) return '';
    const c = w.councillors[idx];
    return c ? `${c.title} ${c.name} (Ward ${w.num} ${w.name})` : '';
  };

  // <<TAG>> placeholders are XML-encoded as &lt;&lt;TAG&gt;&gt; in document.xml
  // «TAG» MERGEFIELD visible text uses guillemet characters (U+00AB / U+00BB)
  const letterRef = buildLetterRef(scheme);

  const replacements = [
    ['&lt;&lt;Our_Ref&gt;&gt;',           xmlEscape(letterRef)],
    ['&lt;&lt;Your_Ref&gt;&gt;',          xmlEscape(letterRef)],  // harmless if not in template
    ['&lt;&lt;Letter_Date&gt;&gt;',       xmlEscape(new Date().toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'}))],
    ['&lt;&lt;Letter_Subject&gt;&gt;',    xmlEscape(subjectText)],
    ['&lt;&lt;Letter_Body_Text&gt;&gt;',  bodyToXml(bodyText)],
    ['&lt;&lt;Ward_Councillor_1&gt;&gt;', xmlEscape(getCouncillor(0))],
    ['&lt;&lt;Ward_Councillor_2&gt;&gt;', xmlEscape(getCouncillor(1))],
    ['&lt;&lt;Ward_Councillor_3&gt;&gt;', xmlEscape(getCouncillor(2))],
    ['«AddressLine4»',          xmlEscape(recipient?.address1 || '')],
    ['«POSTCODE»',              xmlEscape(recipient?.postcode || '')],
    ['«TOWN_NAME»',             xmlEscape(recipient?.town || 'DUNDEE')],
  ];

  // The template has "Your Ref:" as a static label with an empty value cell
  // (no <<Your_Ref>> placeholder). Inject the ref into that empty paragraph.
  const injectYourRefValue = (xml, value) => {
    const labelIdx = xml.indexOf('Your Ref:');
    if (labelIdx < 0) return xml;
    const labelPEnd = xml.indexOf('</w:p>', labelIdx);            // end of label paragraph
    if (labelPEnd < 0) return xml;
    const valuePEnd = xml.indexOf('</w:p>', labelPEnd + 6);       // end of empty value paragraph
    if (valuePEnd < 0) return xml;
    const run = `<w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>${xmlEscape(value)}</w:t></w:r>`;
    return xml.slice(0, valuePEnd) + run + xml.slice(valuePEnd);
  };

  const xmlPaths = ['word/document.xml','word/header1.xml','word/header2.xml','word/footer1.xml','word/footer2.xml'];
  for (const xmlPath of xmlPaths) {
    const file = zip.file(xmlPath);
    if (!file) continue;
    let xml = await file.async('string');
    for (const [placeholder, value] of replacements) {
      xml = xml.split(placeholder).join(value);
    }
    xml = injectYourRefValue(xml, letterRef);
    zip.file(xmlPath, xml);
  }

  return zip.generateAsync({ type: 'arraybuffer' });
}

async function mailMergeLetter(scheme, recipients) {
  if (!recipients.length) throw new Error('No recipients');
  const templateBuffer = await loadLetterBuffer();
  const docType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const slug = (scheme.project_number || 'letter').replace(/\s+/g,'_');

  if (recipients.length === 1) {
    const buf = await injectLetterXml(templateBuffer, scheme, recipients[0]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: docType }));
    a.download = `Letter_${slug}_${(recipients[0].address1||'').replace(/[^a-zA-Z0-9]/g,'_').slice(0,30)}.docx`;
    a.click(); URL.revokeObjectURL(a.href);
    return;
  }

  const outZip = new window.JSZip();
  for (let i = 0; i < recipients.length; i++) {
    const buf = await injectLetterXml(templateBuffer, scheme, recipients[i]);
    const label = (recipients[i].address1||'').replace(/[^a-zA-Z0-9]/g,'_').slice(0,30);
    outZip.file(`Letter_${String(i+1).padStart(3,'0')}_${label}.docx`, buf);
  }
  const zipBuf = await outZip.generateAsync({ type: 'arraybuffer' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([zipBuf], { type: 'application/zip' }));
  a.download = `MailMerge_${slug}_${recipients.length}letters.zip`;
  a.click(); URL.revokeObjectURL(a.href);
}

// Render every letter into one multi-page PDF by rendering each recipient's
// letter off-screen via docx-preview, capturing with html2canvas, and
// appending pages to a single jsPDF document.
async function mailMergeLetterPdf(scheme, recipients, onProgress) {
  if (!recipients.length) throw new Error('No recipients');
  if (!window.html2canvas || !window.jspdf || !window.docx) {
    throw new Error('PDF libraries not loaded');
  }
  const { jsPDF } = window.jspdf;
  const templateBuffer = await loadLetterBuffer();

  // Off-screen host. Fixed A4 width at 96dpi keeps html2canvas output
  // consistent across devices.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:794px;background:#fff;pointer-events:none;';
  document.body.appendChild(host);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageW = 210, pageH = 297;
  let isFirstPage = true;

  try {
    for (let i = 0; i < recipients.length; i++) {
      onProgress?.(i, recipients.length);
      host.innerHTML = '';
      // docx-preview may mutate the buffer — pass a fresh copy each time.
      const buf = templateBuffer.slice(0);
      await window.docx.renderAsync(buf, host, null, {
        className:'docx', inWrapper:true, ignoreWidth:false, ignoreHeight:false,
        ignoreFonts:false, breakPages:true, experimental:false,
        trimXmlDeclaration:true, useBase64URL:true,
      });
      applyLetter(host, scheme, recipients[i]);

      // Let the browser compute layout before screenshotting.
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const canvas = await window.html2canvas(host, {
        scale: 2, backgroundColor: '#ffffff', useCORS: true, allowTaint: true, logging: false,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const imgH = (canvas.height * pageW) / canvas.width;

      // Split a tall letter across as many A4 pages as it needs, and
      // always start a new page for a new recipient.
      let y = 0;
      while (y < imgH) {
        if (!isFirstPage) pdf.addPage();
        isFirstPage = false;
        pdf.addImage(imgData, 'JPEG', 0, -y, pageW, imgH);
        y += pageH;
      }
    }
  } finally {
    host.remove();
  }

  onProgress?.(recipients.length, recipients.length);
  const slug = (scheme.project_number || scheme.road_name || 'letter').replace(/\s+/g,'_');
  const name = recipients.length === 1
    ? `Letter_${slug}_${(recipients[0].address1||'').replace(/[^a-zA-Z0-9]/g,'_').slice(0,30)}.pdf`
    : `MailMerge_${slug}_${recipients.length}letters.pdf`;
  pdf.save(name);
}

const applyLetter = (root, scheme, recipient) => {
  const recipientBindings = { AddressLine4: recipient?.address1||"", POSTCODE: recipient?.postcode||"", TOWN_NAME: recipient?.town||"DUNDEE" };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = []; let n;
  while ((n=walker.nextNode())) { if (/<<[A-Za-z0-9_]+>>|«[A-Za-z0-9_]+»/.test(n.nodeValue)) nodes.push(n); }
  const byTag = {}; LETTER_BINDINGS.forEach(b => { byTag[b.tag] = b; });
  nodes.forEach(node => {
    const parts = node.nodeValue.split(/(<<[A-Za-z0-9_]+>>|«[A-Za-z0-9_]+»)/);
    const frag = document.createDocumentFragment();
    parts.forEach(p => {
      if (!p) return;
      const mA=/^<<([A-Za-z0-9_]+)>>$/.exec(p), mG=/^«([A-Za-z0-9_]+)»$/.exec(p), m=mA||mG;
      if (m) {
        const name=m[1]; let val,filled;
        if (mG&&recipientBindings.hasOwnProperty(name)) { val=recipientBindings[name]; filled=val!==" "&&val!==undefined; }
        else { const b=byTag[mA?p:`<<${name}>>`]; val=b?b.derive(scheme):""; filled=val!==undefined&&val!=""; }
        const span=document.createElement("span"); span.className="pci-bound"+(filled?"":" pci-missing"); span.dataset.key=name;
        String(filled?val:p).split("\n").forEach((line,i)=>{ if(i>0){span.appendChild(document.createElement("br"));span.appendChild(document.createElement("br"));} span.appendChild(document.createTextNode(line)); });
        frag.appendChild(span);
      } else frag.appendChild(document.createTextNode(p));
    });
    node.parentNode.replaceChild(frag, node);
  });

  // Inject Your Ref value into the empty cell next to the "Your Ref:" label
  // (the template has no placeholder there).
  const yourRefValue = buildLetterRef(scheme);
  const allCells = root.querySelectorAll('td, th');
  for (const cell of allCells) {
    if (/^\s*Your Ref:\s*$/.test(cell.textContent||'')) {
      const nextCell = cell.nextElementSibling;
      if (!nextCell) break;
      const target = nextCell.querySelector('p, div') || nextCell;
      if ((target.textContent||'').trim() === '') {
        const span = document.createElement('span');
        span.className = 'pci-bound' + (yourRefValue ? '' : ' pci-missing');
        span.dataset.key = 'Your_Ref';
        span.textContent = yourRefValue || '<<Your_Ref>>';
        target.appendChild(span);
      }
      break;
    }
  }
};

const LetterDoc = ({ scheme, recipient, onPageCount }) => {
  const ref = React.useRef(null);
  const [status, setStatus] = React.useState("loading");
  React.useEffect(() => {
    let cancelled=false;
    if (onPageCount) onPageCount(null);
    (async()=>{
      try {
        const buf=await loadLetterBuffer();
        if(cancelled||!ref.current)return;
        ref.current.innerHTML="";
        await window.docx.renderAsync(buf,ref.current,null,{className:"docx",inWrapper:true,ignoreWidth:false,ignoreHeight:false,ignoreFonts:false,breakPages:true,experimental:false,trimXmlDeclaration:true,useBase64URL:true});
        if(cancelled)return;
        applyLetter(ref.current,scheme,recipient);
        if (onPageCount) {
          const pages = ref.current.querySelectorAll('.docx-page-wrapper, .docx-page, section[class*="page"]');
          onPageCount(Math.max(1, pages.length));
        }
        setStatus("ready");
      } catch(e){ console.error(e); setStatus("error:"+e.message); }
    })();
    return ()=>{cancelled=true;};
  }, [recipient?.address1, recipient?.name, scheme.letter_subject_override, scheme.letter_body_override]);
  return (
    <div className="pci-doc-host">
      {status==="loading"&&<div className="pci-loading">Rendering letter…</div>}
      {status.startsWith("error")&&<div className="pci-loading err">Could not render: {status.slice(6)}</div>}
      <div ref={ref} className="pci-docx-mount" />
    </div>
  );
};

// ─── CAG CSV Parser ───────────────────────────────────────────────────────────

const parseCAGCsv = (text) => {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];

  const headers = [];
  let hField = '', hInQ = false;
  for (let i = 0; i < lines[0].length; i++) {
    const c = lines[0][i];
    if (c === '"') { hInQ = !hInQ; }
    else if (c === ',' && !hInQ) { headers.push(hField.trim()); hField = ''; }
    else { hField += c; }
  }
  headers.push(hField.trim());

  const idx = name => headers.indexOf(name);
  const iOrg  = idx('ORGANISATION');
  const iA2   = idx('AddressLine2');
  const iA3   = idx('AddressLine3');
  const iA4   = idx('AddressLine4');
  const iTown = idx('TOWN_NAME');
  const iPost = idx('POSTCODE');
  const iClass = idx('CLASSIFICATION');

  const parseRow = (line) => {
    const fields = [];
    let field = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { fields.push(field); field = ''; }
      else { field += c; }
    }
    fields.push(field);
    return fields;
  };

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const f = parseRow(lines[i]);
    const address1 = (f[iA4] || '').trim();
    if (!address1) continue;
    const org = (f[iOrg] || '').trim();
    const classification = (f[iClass] || '').trim();
    results.push({
      type: classification === 'R' ? 'resident' : 'business',
      name: org || 'The Current Occupier',
      address1,
      address2: (f[iA3] || f[iA2] || '').trim(),
      postcode: (f[iPost] || '').trim(),
      town: (f[iTown] || 'DUNDEE').trim(),
    });
  }
  return results;
};

// ─── CAG Import Panel ─────────────────────────────────────────────────────────

const CAGImportPanel = ({ scheme, onClose }) => {
  const { updateScheme } = React.useContext(window.SchemeContext);
  const [rows, setRows] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [selected, setSelected] = React.useState(new Set());
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCAGCsv(e.target.result);
      setRows(parsed);
      setSelected(new Set());
      setSearch('');
      setTypeFilter('all');
    };
    reader.readAsText(file);
  };

  const getKey = r => `${r.address1}|${r.postcode}`;

  const existingKeys = React.useMemo(
    () => new Set((scheme.recipients || []).map(r => getKey(r))),
    [scheme.recipients]
  );

  const filtered = React.useMemo(() => {
    if (!rows) return [];
    return rows.filter(r => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.address1.toLowerCase().includes(q) ||
          (r.postcode || '').toLowerCase().includes(q) ||
          (r.name || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [rows, search, typeFilter]);

  const toggleRow = key => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const allFilteredSelected = filtered.length > 0 &&
    filtered.every(r => selected.has(getKey(r)) || existingKeys.has(getKey(r)));

  const toggleAll = () => {
    const eligible = filtered.filter(r => !existingKeys.has(getKey(r)));
    const allEligibleSelected = eligible.every(r => selected.has(getKey(r)));
    setSelected(prev => {
      const next = new Set(prev);
      if (allEligibleSelected) { eligible.forEach(r => next.delete(getKey(r))); }
      else { eligible.forEach(r => next.add(getKey(r))); }
      return next;
    });
  };

  const handleImport = () => {
    const toAdd = (rows || []).filter(r => selected.has(getKey(r)) && !existingKeys.has(getKey(r)));
    updateScheme(scheme.id, { recipients: [...(scheme.recipients || []), ...toAdd] });
    onClose();
  };

  const newCount = rows ? rows.filter(r => selected.has(getKey(r)) && !existingKeys.has(getKey(r))).length : 0;

  // ── Drop zone (no file loaded yet) ──────────────────────────────────────────
  if (!rows) {
    return (
      <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div className="rsr-side-title" style={{margin:0}}>Import from CAG</div>
          <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>
        </div>
        <div
          style={{
            flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
            border:`2px dashed ${dragging?'var(--accent)':'var(--line)'}`,
            borderRadius:'var(--radius)',padding:24,textAlign:'center',cursor:'pointer',
            background:dragging?'var(--accent-wash)':'var(--bg-elev)',transition:'all 0.15s',
          }}
          onDragOver={e=>{ e.preventDefault(); setDragging(true); }}
          onDragLeave={()=>setDragging(false)}
          onDrop={e=>{ e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={()=>fileRef.current?.click()}
        >
          <div style={{fontSize:28,marginBottom:8,color:'var(--ink-3)'}}>↑</div>
          <div style={{fontWeight:600,marginBottom:4,fontSize:13}}>Drop CAG CSV here</div>
          <div style={{fontSize:11,color:'var(--ink-3)',marginBottom:14}}>or click to browse</div>
          <button className="btn sm primary" onClick={e=>{ e.stopPropagation(); fileRef.current?.click(); }}>
            Choose file
          </button>
          <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}}
            onChange={e=>handleFile(e.target.files[0])} />
        </div>
        <div style={{marginTop:10,fontSize:10,color:'var(--ink-3)',textAlign:'center',fontFamily:'var(--font-mono)'}}>
          Accepted: Common Address Gazetteer CSV export
        </div>
      </div>
    );
  }

  // ── Address list (file parsed) ───────────────────────────────────────────────
  const resTotal = rows.filter(r=>r.type==='resident').length;
  const bizTotal = rows.filter(r=>r.type==='business').length;

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <div className="rsr-side-title" style={{margin:0}}>Import from CAG</div>
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          <button className="btn ghost sm" title="Upload different file"
            onClick={()=>{ setRows(null); setSelected(new Set()); setSearch(''); }}>
            ↺
          </button>
          <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>
        </div>
      </div>

      <div style={{fontSize:10,color:'var(--ink-3)',fontFamily:'var(--font-mono)',marginBottom:8}}>
        {rows.length.toLocaleString()} addresses · {resTotal.toLocaleString()} residential · {bizTotal.toLocaleString()} business
      </div>

      <input
        style={{width:'100%',marginBottom:6,padding:'5px 8px',fontSize:12,
          border:'1px solid var(--line)',borderRadius:'var(--radius-sm)',outline:'none'}}
        placeholder="Search street, postcode, or name…"
        value={search}
        onChange={e=>setSearch(e.target.value)}
        autoFocus
      />

      <div style={{display:'flex',gap:3,marginBottom:8}}>
        {[
          ['all',     `All (${rows.length.toLocaleString()})`],
          ['resident',`Res. (${resTotal.toLocaleString()})`],
          ['business',`Biz. (${bizTotal.toLocaleString()})`],
        ].map(([v,l])=>(
          <button key={v}
            className={'btn sm'+(typeFilter===v?' primary':'')}
            onClick={()=>setTypeFilter(v)}
            style={{flex:1,justifyContent:'center',padding:'4px 2px'}}>
            {l}
          </button>
        ))}
      </div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
        marginBottom:5,paddingBottom:5,borderBottom:'1px solid var(--line)'}}>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,cursor:'pointer',userSelect:'none'}}>
          <input type="checkbox" checked={allFilteredSelected && filtered.length>0}
            onChange={toggleAll} style={{width:'auto'}} />
          Select all visible ({filtered.length})
        </label>
        <span style={{fontSize:10,color:'var(--accent-ink)',fontFamily:'var(--font-mono)',fontWeight:600}}>
          {[...selected].filter(k=>!existingKeys.has(k)).length} new
        </span>
      </div>

      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:1}}>
        {filtered.length===0 ? (
          <div style={{textAlign:'center',color:'var(--ink-3)',padding:'24px 0',fontSize:12}}>
            No addresses match
          </div>
        ) : filtered.map((r,i)=>{
          const key = getKey(r);
          const already = existingKeys.has(key);
          const checked = selected.has(key) || already;
          return (
            <label key={i} style={{
              display:'flex',alignItems:'flex-start',gap:7,padding:'5px 6px',
              borderRadius:'var(--radius-sm)',cursor:already?'default':'pointer',
              background:already?'var(--bg-sunken)':selected.has(key)?'var(--accent-wash)':'transparent',
              opacity:already?0.55:1,fontSize:12,userSelect:'none',
            }}>
              <input type="checkbox" checked={checked} disabled={already}
                onChange={()=>!already&&toggleRow(key)}
                style={{width:'auto',flexShrink:0,marginTop:2}} />
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {r.address1}
                </div>
                <div style={{fontSize:10,color:'var(--ink-3)',fontFamily:'var(--font-mono)',
                  display:'flex',gap:6,marginTop:1,flexWrap:'wrap'}}>
                  <span>{r.postcode}</span>
                  <span style={{color:r.type==='resident'?'var(--green)':'var(--accent-ink)'}}>
                    {r.type==='resident'?'res':'biz'}
                  </span>
                  {already&&<span style={{color:'var(--slate)'}}>already added</span>}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--line)',display:'flex',gap:6}}>
        <button className="btn ghost sm" onClick={onClose}
          style={{flex:1,justifyContent:'center'}}>Cancel</button>
        <button className="btn sm primary" onClick={handleImport} disabled={newCount===0}
          style={{flex:2,justifyContent:'center'}}>
          Add {newCount>0?newCount:''} recipient{newCount!==1?'s':''}
        </button>
      </div>
    </div>
  );
};

// ─── Letter Modal ─────────────────────────────────────────────────────────────

const LetterModal = ({ scheme: schemeProp, onClose }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeProp.id);
  const recipients = scheme.recipients || [];
  const [selectedIdx, setSelectedIdx] = React.useState(0);
  const [showImport, setShowImport] = React.useState(false);
  const [merging, setMerging] = React.useState(false);
  const [mergeProgress, setMergeProgress] = React.useState(null);
  const [pageCount, setPageCount] = React.useState(null);
  const recipient = recipients[selectedIdx];

  const runMailMerge = async (mode) => {
    setMerging(true);
    setMergeProgress(mode === 'pdf' ? { done: 0, total: recipients.length } : null);
    try {
      if (mode === 'pdf') {
        await mailMergeLetterPdf(scheme, recipients, (done, total) => setMergeProgress({ done, total }));
      } else {
        await mailMergeLetter(scheme, recipients);
      }
      updateScheme(scheme.id, { docs_generated: { ...(scheme.docs_generated||{}), letter: true } });
      window.dispatchEvent(new CustomEvent('rmp-download', { detail: { label: `Letter — ${scheme.road_name} (${recipients.length} recipient${recipients.length!==1?'s':''}, ${mode.toUpperCase()})`, ref: scheme.project_number } }));
    }
    catch(e) { alert('Mail merge failed: ' + e.message); }
    finally { setMerging(false); setMergeProgress(null); }
  };
  const residents = recipients.filter(r=>r.type==="resident");
  const businesses = recipients.filter(r=>r.type==="business");

  React.useEffect(() => {
    if (selectedIdx >= recipients.length) setSelectedIdx(Math.max(0, recipients.length-1));
  }, [recipients.length]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal rsr-modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{fontWeight:600,fontSize:15}}>Resident / Business Letter · Preview</div>
            <div style={{fontSize:12,color:"var(--ink-3)",fontFamily:"var(--font-mono)"}}>
              {scheme.project_number} · {scheme.road_name} · {recipients.length} recipient{recipients.length!==1?"s":""}
            </div>
            {pageCount && (
              <span className={'letter-page-badge' + (pageCount > 1 ? ' letter-page-warn' : '')}>
                {pageCount === 1 ? '1 page' : `${pageCount} pages — aim for 1`}
              </span>
            )}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button className="btn sm" onClick={()=>runMailMerge('pdf')} disabled={merging||recipients.length===0}>
              <Icon.Download /> {merging && mergeProgress
                ? `Generating PDF · ${mergeProgress.done}/${mergeProgress.total}`
                : merging
                  ? "Generating…"
                  : `Mail merge · ${recipients.length} letter${recipients.length!==1?"s":""} (PDF)`}
            </button>
            <button className="btn ghost sm" onClick={()=>runMailMerge('docx')} disabled={merging||recipients.length===0}
              title="Download as editable DOCX (ZIP for multiple recipients)">
              DOCX
            </button>
            <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>
          </div>
        </div>
        <div className="rsr-body">
          <div className="rsr-preview-pane">
            {recipient
              ? <LetterDoc scheme={scheme} recipient={recipient} onPageCount={setPageCount}/>
              : <div style={{padding:40,textAlign:"center",color:"var(--ink-3)"}}>
                  No recipients yet — import from CAG or add manually.
                </div>
            }
          </div>

          {showImport ? (
            <div className="rsr-side" style={{display:'flex',flexDirection:'column'}}>
              <CAGImportPanel scheme={scheme} onClose={()=>setShowImport(false)} />
            </div>
          ) : (
            <div className="rsr-side">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div className="rsr-side-title" style={{margin:0}}>Recipients</div>
                <button className="btn sm" onClick={()=>setShowImport(true)}>
                  ↑ Import from CAG
                </button>
              </div>

              {residents.length>0&&(
                <Collapsible title="Residents" count={residents.length} defaultOpen={true}>
                  <div className="letter-recip-list">
                    {recipients.map((r,i)=>r.type==="resident"&&(
                      <button key={i} className={"letter-recip "+(i===selectedIdx?"active":"")}
                        onClick={()=>setSelectedIdx(i)}>
                        <div className="letter-recip-addr">{r.address1}</div>
                        <div className="letter-recip-meta">{r.postcode}</div>
                      </button>
                    ))}
                  </div>
                </Collapsible>
              )}

              {businesses.length>0&&(
                <Collapsible title="Businesses" count={businesses.length} defaultOpen={false}>
                  <div className="letter-recip-list">
                    {recipients.map((r,i)=>r.type==="business"&&(
                      <button key={i} className={"letter-recip "+(i===selectedIdx?"active":"")}
                        onClick={()=>setSelectedIdx(i)}>
                        <div className="letter-recip-addr"><strong>{r.name}</strong></div>
                        <div className="letter-recip-meta">{r.address1} · {r.postcode}</div>
                      </button>
                    ))}
                  </div>
                </Collapsible>
              )}

              {recipients.length===0&&(
                <div style={{padding:'20px 0',textAlign:'center',color:'var(--ink-3)',fontSize:12}}>
                  No recipients yet.<br/>
                  <button className="btn sm primary" style={{marginTop:10}}
                    onClick={()=>setShowImport(true)}>
                    ↑ Import from CAG
                  </button>
                </div>
              )}

              <Collapsible
                title="Letter content"
                defaultOpen={false}
                right={(scheme.letter_subject_override||scheme.letter_body_override) && (
                  <button className="btn ghost sm"
                    title="Reset letter content to the auto-generated default"
                    onClick={()=>updateScheme(scheme.id,{letter_subject_override:"",letter_body_override:""})}>
                    ↺ Reset
                  </button>
                )}>
                <label style={{display:"block",fontSize:11,color:"var(--ink-3)",marginBottom:3}}>Subject line</label>
                <input
                  style={{width:"100%",marginBottom:10,padding:"6px 8px",fontSize:12,
                    border:"1px solid var(--line)",borderRadius:"var(--radius-sm)",outline:"none",
                    fontFamily:"inherit"}}
                  placeholder={defaultLetterSubject(scheme)}
                  value={scheme.letter_subject_override||""}
                  onChange={e=>updateScheme(scheme.id,{letter_subject_override:e.target.value})}
                />
                <label style={{display:"block",fontSize:11,color:"var(--ink-3)",marginBottom:3}}>Body text</label>
                <textarea
                  style={{width:"100%",minHeight:160,padding:"6px 8px",fontSize:12,
                    border:"1px solid var(--line)",borderRadius:"var(--radius-sm)",outline:"none",
                    fontFamily:"inherit",resize:"vertical",lineHeight:1.45}}
                  placeholder={defaultLetterBody(scheme)}
                  value={scheme.letter_body_override||""}
                  onChange={e=>updateScheme(scheme.id,{letter_body_override:e.target.value})}
                />
                <div style={{fontSize:10,color:"var(--ink-3)",marginTop:4,lineHeight:1.4}}>
                  Leave blank to use the auto-generated text shown above. Edits save automatically and flow into the preview and mail-merged DOCX.
                </div>
              </Collapsible>

              <Collapsible title="Template bindings" count={LETTER_BINDINGS.length} defaultOpen={false}>
                <div className="rsr-bind-list">
                  {LETTER_BINDINGS.map(b=>{
                    const val=recipient?b.derive(scheme):"";
                    const filled=val!==" "&&val!==undefined&&val!=="";
                    return (
                      <div key={b.tag} className={"rsr-bind "+(filled?"":"missing")}>
                        <div className="rsr-bind-key mono">{b.tag}</div>
                        <div className="rsr-bind-val" style={{marginTop:3}}>
                          {filled?String(val).slice(0,60):"—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Collapsible>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

window.LetterDoc=LetterDoc; window.LetterModal=LetterModal;
