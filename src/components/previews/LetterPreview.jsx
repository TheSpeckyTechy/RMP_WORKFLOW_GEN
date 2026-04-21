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
// Template file: templates/Residential_Letter_Template (1) (2).docx
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

const LETTER_BINDINGS = [
  { tag: "<<Our_Ref>>", derive: s => s.project_number || "" },
  { tag: "<<Letter_Date>>", derive: s => new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}) },
  { tag: "<<Letter_Subject>>", derive: s => {
    const road = s.road_name||""; const ext = s.scheme_extent?` (${s.scheme_extent})`:""; return `RESURFACING WORKS \u2014 ${road.toUpperCase()}${ext.toUpperCase()}`;
  }},
  { tag: "<<Letter_Body_Text>>", derive: s => {
    const start=s.date_start||"[start date]", finish=s.date_finish||"[finish date]", road=s.road_name||"[road]",
      ext=s.scheme_extent?` between ${s.scheme_extent}`:"", tm=s.tm_type?s.tm_type.toLowerCase():"temporary traffic management", tmH=s.tm_hours||"07:30 to 15:30";
    return `Dundee City Council will shortly be carrying out resurfacing works on ${road}${ext}. The works are programmed to commence on ${start} and are expected to be completed by ${finish}.\n\nTo enable the works to be carried out safely, ${tm.charAt(0).toUpperCase()+tm.slice(1)} will be in place during working hours (${tmH}). Pedestrian access to properties will be maintained at all times.\n\nWe apologise in advance for any inconvenience caused.`;
  }},
  { tag: "<<Ward_Councillor_1>>", derive: s => { const w=window.WARDS.find(x=>x.num===s.ward_num); if(!w)return""; const c=w.councillors[0]; return c?`${c.title} ${c.name} (Ward ${w.num} ${w.name})`:"";}},
  { tag: "<<Ward_Councillor_2>>", derive: s => { const w=window.WARDS.find(x=>x.num===s.ward_num); if(!w)return""; const c=w.councillors[1]; return c?`${c.title} ${c.name} (Ward ${w.num} ${w.name})`:"";}},
  { tag: "<<Ward_Councillor_3>>", derive: s => { const w=window.WARDS.find(x=>x.num===s.ward_num); if(!w)return""; const c=w.councillors[2]; return c?`${c.title} ${c.name} (Ward ${w.num} ${w.name})`:"";}},
];

const loadLetterBuffer = async () => {
  const res = await fetch("templates/Residential_Letter_Template%20(1).docx", { cache: 'no-cache' });
  if (!res.ok) throw new Error('Letter template not found');
  return res.arrayBuffer();
};

const xmlEscape = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const bodyToXml = text =>
  xmlEscape(text).replace(/\n\n/g,'</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">').replace(/\n/g,'</w:t><w:br/><w:t xml:space="preserve">');

async function injectLetterXml(buffer, scheme, recipient) {
  const zip = new window.JSZip();
  await zip.loadAsync(buffer);

  const ext = scheme.scheme_extent ? ` (${scheme.scheme_extent})` : '';

  const bodyText = (() => {
    const start = scheme.date_start || '[start date]';
    const finish = scheme.date_finish || '[finish date]';
    const road = scheme.road_name || '[road]';
    const extPhrase = scheme.scheme_extent ? ` between ${scheme.scheme_extent}` : '';
    const tm = scheme.tm_type ? scheme.tm_type.toLowerCase() : 'temporary traffic management';
    const tmH = scheme.tm_hours || '07:30 to 15:30';
    return `Dundee City Council will shortly be carrying out resurfacing works on ${road}${extPhrase}. The works are programmed to commence on ${start} and are expected to be completed by ${finish}.\n\nTo enable the works to be carried out safely, ${tm.charAt(0).toUpperCase()+tm.slice(1)} will be in place during working hours (${tmH}). Pedestrian access to properties will be maintained at all times.\n\nWe apologise in advance for any inconvenience caused.`;
  })();

  const getCouncillor = (idx) => {
    const w = window.WARDS.find(x => x.num === scheme.ward_num);
    if (!w) return '';
    const c = w.councillors[idx];
    return c ? `${c.title} ${c.name} (Ward ${w.num} ${w.name})` : '';
  };

  // <<TAG>> placeholders are XML-encoded as &lt;&lt;TAG&gt;&gt; in document.xml
  // «TAG» MERGEFIELD visible text uses guillemet characters (U+00AB / U+00BB)
  const replacements = [
    ['&lt;&lt;Our_Ref&gt;&gt;',          xmlEscape(scheme.project_number || '')],
    ['&lt;&lt;Letter_Date&gt;&gt;',       xmlEscape(new Date().toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'}))],
    ['&lt;&lt;Letter_Subject&gt;&gt;',    xmlEscape(`RESURFACING WORKS — ${(scheme.road_name||'').toUpperCase()}${ext.toUpperCase()}`)],
    ['&lt;&lt;Letter_Body_Text&gt;&gt;',  bodyToXml(bodyText)],
    ['&lt;&lt;Ward_Councillor_1&gt;&gt;', xmlEscape(getCouncillor(0))],
    ['&lt;&lt;Ward_Councillor_2&gt;&gt;', xmlEscape(getCouncillor(1))],
    ['&lt;&lt;Ward_Councillor_3&gt;&gt;', xmlEscape(getCouncillor(2))],
    ['«AddressLine4»',          xmlEscape(recipient?.address1 || '')],
    ['«POSTCODE»',              xmlEscape(recipient?.postcode || '')],
    ['«TOWN_NAME»',             xmlEscape(recipient?.town || 'DUNDEE')],
  ];

  const xmlPaths = ['word/document.xml','word/header1.xml','word/header2.xml','word/footer1.xml','word/footer2.xml'];
  for (const xmlPath of xmlPaths) {
    const file = zip.file(xmlPath);
    if (!file) continue;
    let xml = await file.async('string');
    for (const [placeholder, value] of replacements) {
      xml = xml.split(placeholder).join(value);
    }
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
};

const LetterDoc = ({ scheme, recipient }) => {
  const ref = React.useRef(null);
  const [status, setStatus] = React.useState("loading");
  React.useEffect(() => {
    let cancelled=false;
    (async()=>{
      try {
        const buf=await loadLetterBuffer();
        if(cancelled||!ref.current)return;
        ref.current.innerHTML="";
        await window.docx.renderAsync(buf,ref.current,null,{className:"docx",inWrapper:true,ignoreWidth:false,ignoreHeight:false,ignoreFonts:false,breakPages:true,experimental:false,trimXmlDeclaration:true,useBase64URL:true});
        if(cancelled)return;
        applyLetter(ref.current,scheme,recipient); setStatus("ready");
      } catch(e){ console.error(e); setStatus("error:"+e.message); }
    })();
    return ()=>{cancelled=true;};
  }, [recipient?.address1, recipient?.name]);
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
  const recipient = recipients[selectedIdx];

  const handleMailMerge = async () => {
    setMerging(true);
    try {
      await mailMergeLetter(scheme, recipients);
      updateScheme(scheme.id, { docs_generated: { ...(scheme.docs_generated||{}), letter: true } });
      window.dispatchEvent(new CustomEvent('rmp-download', { detail: { label: `Letter — ${scheme.road_name} (${recipients.length} recipient${recipients.length!==1?'s':''})`, ref: scheme.project_number } }));
    }
    catch(e) { alert('Mail merge failed: ' + e.message); }
    finally { setMerging(false); }
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
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button className="btn sm" onClick={handleMailMerge} disabled={merging||recipients.length===0}>
              <Icon.Download /> {merging ? "Generating…" : `Mail merge · ${recipients.length} letter${recipients.length!==1?"s":""}`}
            </button>
            <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>
          </div>
        </div>
        <div className="rsr-body">
          <div className="rsr-preview-pane">
            {recipient
              ? <LetterDoc scheme={scheme} recipient={recipient}/>
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
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:10,color:"var(--ink-3)",fontFamily:"var(--font-mono)",
                    textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>
                    Residents ({residents.length})
                  </div>
                  <div className="letter-recip-list">
                    {recipients.map((r,i)=>r.type==="resident"&&(
                      <button key={i} className={"letter-recip "+(i===selectedIdx?"active":"")}
                        onClick={()=>setSelectedIdx(i)}>
                        <div className="letter-recip-addr">{r.address1}</div>
                        <div className="letter-recip-meta">{r.postcode}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {businesses.length>0&&(
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:10,color:"var(--ink-3)",fontFamily:"var(--font-mono)",
                    textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>
                    Businesses ({businesses.length})
                  </div>
                  <div className="letter-recip-list">
                    {recipients.map((r,i)=>r.type==="business"&&(
                      <button key={i} className={"letter-recip "+(i===selectedIdx?"active":"")}
                        onClick={()=>setSelectedIdx(i)}>
                        <div className="letter-recip-addr"><strong>{r.name}</strong></div>
                        <div className="letter-recip-meta">{r.address1} · {r.postcode}</div>
                      </button>
                    ))}
                  </div>
                </div>
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

              <div style={{marginTop:18}}>
                <div style={{fontSize:10,color:"var(--ink-3)",fontFamily:"var(--font-mono)",
                  textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>
                  Template bindings
                </div>
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

window.LetterDoc=LetterDoc; window.LetterModal=LetterModal;
