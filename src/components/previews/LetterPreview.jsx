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

const derive = (tag, scheme) => {
  const b = LETTER_BINDINGS.find(x => x.tag === tag);
  return b ? b.derive(scheme) : "";
};

const LetterDoc = ({ scheme, recipient }) => {
  const date     = derive("<<Letter_Date>>", scheme);
  const ourRef   = derive("<<Our_Ref>>", scheme);
  const subject  = derive("<<Letter_Subject>>", scheme);
  const body     = derive("<<Letter_Body_Text>>", scheme);
  const cc1      = derive("<<Ward_Councillor_1>>", scheme);
  const cc2      = derive("<<Ward_Councillor_2>>", scheme);
  const cc3      = derive("<<Ward_Councillor_3>>", scheme);
  const copies   = [cc1, cc2, cc3].filter(Boolean);

  const addrLine  = recipient?.address1 || "";
  const postcode  = recipient?.postcode  || "";
  const town      = recipient?.town      || "DUNDEE";

  const cell = (label, value, mono) => (
    <tr>
      <td style={{width:140,padding:"4px 8px",fontWeight:600,fontSize:11,color:"#555",verticalAlign:"top",whiteSpace:"nowrap"}}>{label}</td>
      <td style={{padding:"4px 8px",fontSize:11,fontFamily:mono?"var(--font-mono)":"inherit"}}>{value||<span style={{color:"#bbb"}}>—</span>}</td>
    </tr>
  );

  return (
    <div style={{maxWidth:680,margin:"0 auto",background:"white",boxShadow:"0 2px 12px rgba(0,0,0,0.1)",fontFamily:"Georgia, 'Times New Roman', serif"}}>
      {/* Letterhead */}
      <div style={{background:"#1f4e79",color:"white",padding:"18px 32px",display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
        <div>
          <div style={{fontWeight:700,fontSize:14,letterSpacing:"0.04em",fontFamily:"var(--font-sans)"}}>DUNDEE CITY COUNCIL</div>
          <div style={{fontSize:11,opacity:0.8,marginTop:2,fontFamily:"var(--font-sans)"}}>Road Maintenance Partnership</div>
        </div>
        <div style={{fontSize:10,opacity:0.75,textAlign:"right",fontFamily:"var(--font-mono)"}}>
          Our ref: {ourRef||"—"}
        </div>
      </div>

      <div style={{padding:"28px 32px"}}>
        {/* Date */}
        <div style={{marginBottom:20,fontSize:12}}>{date}</div>

        {/* Recipient address */}
        <div style={{marginBottom:20,fontSize:12,lineHeight:1.7}}>
          {addrLine&&<div style={{fontWeight:600}}>{addrLine}</div>}
          {town&&<div>{town}</div>}
          {postcode&&<div style={{fontFamily:"var(--font-mono)",fontSize:11}}>{postcode}</div>}
          {!addrLine&&!postcode&&<div style={{color:"#aaa",fontStyle:"italic"}}>No recipient selected</div>}
        </div>

        {/* Salutation */}
        <div style={{marginBottom:14,fontSize:12}}>Dear Resident,</div>

        {/* Subject */}
        <div style={{fontWeight:700,fontSize:12,marginBottom:14,textDecoration:"underline",textUnderlineOffset:3}}>
          {subject||<span style={{color:"#aaa",fontStyle:"italic"}}>Subject not set</span>}
        </div>

        {/* Body */}
        <div style={{fontSize:12,lineHeight:1.8,marginBottom:28}}>
          {body ? body.split("\n\n").map((para,i)=>(
            <p key={i} style={{marginBottom:12}}>{para}</p>
          )) : <span style={{color:"#aaa",fontStyle:"italic"}}>Body text will appear here</span>}
        </div>

        {/* Sign-off */}
        <div style={{fontSize:12,marginBottom:6}}>Yours faithfully,</div>
        <div style={{height:40,borderBottom:"1px solid #ccc",width:180,marginBottom:6}}></div>
        <div style={{fontSize:11,color:"#555"}}>Road Maintenance Partnership</div>
        <div style={{fontSize:11,color:"#555"}}>Dundee City Council</div>

        {/* CC list */}
        {copies.length>0&&(
          <div style={{marginTop:28,paddingTop:14,borderTop:"1px solid #eee"}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.08em",color:"#888",marginBottom:6,fontFamily:"var(--font-sans)"}}>
              COPIES TO:
            </div>
            {copies.map((c,i)=>(
              <div key={i} style={{fontSize:11,color:"#555",marginBottom:2}}>
                {i===0?"Convener of City Development":i===1?"Depute Convener":""}{i<2?" – ":""}{c}
              </div>
            ))}
          </div>
        )}
      </div>
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
  const { getScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeProp.id);
  const recipients = scheme.recipients || [];
  const [selectedIdx, setSelectedIdx] = React.useState(0);
  const [showImport, setShowImport] = React.useState(false);
  const recipient = recipients[selectedIdx];
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
            <button className="btn sm"><Icon.Download /> Mail merge · {recipients.length} letters</button>
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
