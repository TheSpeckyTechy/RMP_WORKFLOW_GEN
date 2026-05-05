// ─── SchemeDetail.jsx ────────────────────────────────────────────────────────
// Per-scheme tabbed detail page with five tabs:
//
//   Master Workbook  — all 49 named ranges (MasterWorkbook component)
//   Treatment        — traffic-category-based treatment recommendation engine
//   Ward & Copies    — ward picker + auto-generated councillor copy list
//   Utilities        — 9-utility search tracker with date toggling
//   Pack             — handover pack progress with live document previews
//
// Components exported:
//   SchemeDetail   — tab shell + page header + flag banner
//   TreatmentTab   — treatment selection with recommendation logic
//   WardTab        — ward picker + copy list builder
//   UtilitiesTab   — utility search status tracker
//   DocPreview     — thumbnail for each pack document type
//   PackTab        — full pack grid with preview / generate buttons
//
// Exports (via window): SchemeDetail
// Depends on: React, window.SchemeContext, window.MasterWorkbook,
//             window.Icon, window.WARDS, window.UTILITIES,
//             window.PACK_DOCS, window.STATUS_LABELS, window.fmtDate
// ─────────────────────────────────────────────────────────────────────────────

const SchemeDetail = ({ schemeId, onBack, onGenerate, onPreview }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);
  const [tab, setTab] = React.useState("workbook");
  const tabs = [
    { k:"workbook", l:"Master Workbook", badge:"49" },
    { k:"treatment", l:"Treatment" },
    { k:"ward", l:"Ward & Copies" },
    { k:"utilities", l:"Utilities", badge:"9" },
    { k:"pack", l:"Pack", badge:`${scheme.packProgress}/${scheme.packTotal}` },
  ];
  return (
    <>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:12,color:"var(--ink-3)"}}>
        <span className="mono" onClick={onBack} style={{cursor:"pointer"}}>← All schemes</span>
        <span>/</span><span className="mono">{scheme.id}</span>
      </div>
      <div className="page-head">
        <div>
          <h1 className="page-title">{scheme.road_name}</h1>
          <p className="page-sub">{scheme.scheme_extent} · <span className="mono">{(+scheme.area_m2).toLocaleString()} m²</span> · {scheme.treatment_type} · <span className={"pill "+scheme.status} style={{marginLeft:8}}>{STATUS_LABELS[scheme.status]}</span></p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn"><Icon.Download /> Export workbook</button>
          <button className="btn accent" onClick={()=>onGenerate(scheme)}><Icon.Wand /> Generate pack <span className="kbd">⌘G</span></button>
        </div>
      </div>
      {scheme.flags&&scheme.flags.length>0&&(
        <div style={{background:"var(--amber-wash)",border:"1px solid var(--amber)",padding:"10px 14px",borderRadius:"var(--radius-sm)",marginBottom:20,display:"flex",gap:10,alignItems:"flex-start",fontSize:13}}>
          <span style={{color:"var(--amber)",paddingTop:2}}><Icon.Alert /></span>
          <div><strong>Inconsistencies detected</strong><ul style={{margin:"4px 0 0",paddingLeft:16}}>{scheme.flags.map((f,i)=><li key={i} style={{color:"var(--ink-2)"}}>{f}</li>)}</ul></div>
        </div>
      )}
      <div className="tabs">
        {tabs.map(t=><div key={t.k} className={"tab "+(tab===t.k?"active":"")} onClick={()=>setTab(t.k)}>{t.l}{t.badge&&<span className="badge">{t.badge}</span>}</div>)}
      </div>
      {tab==="workbook"&&<MasterWorkbook schemeId={schemeId} />}
      {tab==="treatment"&&<TreatmentTab schemeId={schemeId} />}
      {tab==="ward"&&<WardTab schemeId={schemeId} />}
      {tab==="utilities"&&<UtilitiesTab scheme={scheme} />}
      {tab==="pack"&&<PackTab scheme={scheme} onGenerate={onGenerate} onPreview={onPreview} />}
    </>
  );
};

// ─── Treatment Tab ────────────────────────────────────────────────────────────

const TreatmentTab = ({ schemeId }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);
  const rec = React.useMemo(() => {
    const t=scheme.traffic_category, d=+scheme.total_depth_mm||40;
    if(t==="Low") return {t:"AC10 Taycoat 100/150",d:"40mm SC only",notes:"Budget-appropriate for low-traffic footways."};
    if(t==="Medium") return {t:"AC14 close binder 40/60",d:"40mm inlay",notes:"Standard medium-duty treatment."};
    if(t==="Medium-High") return {t:"HRA 30/14F surf 40/60",d:d>=100?"100mm deep inlay":"40mm inlay",notes:"HRA surface recommended."};
    return {t:"HRA 55/10F surf + 50/20 bin",d:"100mm deep inlay minimum",notes:"High-traffic route. Full construction depth rebuild recommended."};
  },[scheme.traffic_category,scheme.total_depth_mm]);
  return (
    <div style={{maxWidth:720}}>
      <div className="form-section">
        <div className="section-head"><div className="section-title"><span className="section-num">TR</span> Treatment selection logic</div></div>
        <div className="field-row">
          <div className="field"><label>Traffic category</label><select value={scheme.traffic_category} onChange={e=>updateScheme(schemeId,{traffic_category:e.target.value})}><option>Low</option><option>Medium</option><option>Medium-High</option><option>High</option></select></div>
          <div className="field"><label>Total depth (mm)</label><input className="mono" type="number" value={scheme.total_depth_mm} onChange={e=>updateScheme(schemeId,{total_depth_mm:+e.target.value})} /></div>
        </div>
        <div className="treatment-rec"><span className="label">Recommended treatment</span><div style={{fontSize:15,fontWeight:600,marginBottom:4}}>{rec.t}</div><div style={{fontFamily:"var(--font-mono)",fontSize:12,color:"var(--slate)",marginBottom:8}}>{rec.d}</div><div style={{fontSize:12,color:"var(--ink-2)"}}>{rec.notes}</div></div>
        <div style={{marginTop:14,display:"flex",gap:8}}><button className="btn sm">Override</button><button className="btn sm primary" onClick={()=>updateScheme(schemeId,{treatment_type:rec.t})}>Accept &amp; apply</button></div>
      </div>
    </div>
  );
};

// ─── Ward Tab ─────────────────────────────────────────────────────────────────

const WardTab = ({ schemeId }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);
  const setWardNum = (num) => { const w=window.WARDS.find(x=>x.num===num); updateScheme(schemeId,{ward_num:num,ward_selected:w.name}); };
  const ward = window.WARDS.find(w=>w.num===scheme.ward_num);
  const copyList = React.useMemo(() => {
    const entries=[],seen=new Set();
    const convener=window.WARDS.flatMap(w=>w.councillors).find(c=>c.role==="Convener of City Development");
    const deputeConv=window.WARDS.flatMap(w=>w.councillors).find(c=>c.role==="Depute Convener of City Development");
    const lordProvost=window.WARDS.flatMap(w=>w.councillors).find(c=>c.isLordProvost);
    if(convener){entries.push({role:"Convener of City Development",name:"Councillor "+convener.name});seen.add(convener.name);}
    if(deputeConv){entries.push({role:"Depute Convener of City Development",name:"Councillor "+deputeConv.name});seen.add(deputeConv.name);}
    if(lordProvost){entries.push({role:"Lord Provost",name:lordProvost.name});seen.add(lordProvost.name);}
    ward.councillors.forEach(c=>{if(seen.has(c.name))return;entries.push({ward:true,role:c.title,name:c.name});seen.add(c.name);});
    ["Executive Director of City Development","Head of Public Relations","RMP Manager","Depute RMP Manager","Team Leader Customer Services"].forEach(r=>entries.push({role:r,nameless:true}));
    return entries;
  },[scheme.ward_num]);
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
      <div className="form-section">
        <div className="section-head"><div className="section-title"><span className="section-num">W</span> Ward selection</div></div>
        <div className="ward-picker">{window.WARDS.map(w=><button key={w.num} className={"ward-btn "+(w.num===scheme.ward_num?"active":"")} onClick={()=>setWardNum(w.num)}><span className="ward-num">W{w.num.toString().padStart(2,"0")}</span><span className="ward-name">{w.name}</span></button>)}</div>
      </div>
      <div className="form-section">
        <div className="section-head"><div className="section-title"><span className="section-num">CC</span> Letter copy list</div><span className="mono" style={{fontSize:11,color:"var(--green)"}}>● live</span></div>
        <div className="copy-list">{copyList.map((e,i)=>(<div key={i} className={"entry "+(e.ward?"ward-entry":"")}>{e.nameless?<span className="role">{e.role}</span>:e.ward?<span className="name">{e.role==="Bailie"?"Bailie":"Councillor"} {e.name}</span>:e.role==="Lord Provost"?<span><span className="role">Lord Provost</span> <span className="name">{e.name}</span></span>:<span><span className="role">{e.role}</span> – <span className="name">{e.name}</span></span>}</div>))}</div>
      </div>
    </div>
  );
};

// ─── Utilities Tab ────────────────────────────────────────────────────────────

const UtilitiesTab = ({ scheme }) => {
  const [rows,setRows]=React.useState(()=>window.UTILITIES.map((u,i)=>({...u,requested:i<7?"2026-02-24":"",received:i<5?"2026-03-02":"",filed:i<5?"2026-03-03":""})));
  const toggle=(i,field)=>setRows(r=>r.map((x,j)=>j===i?{...x,[field]:x[field]?"":"2026-04-20"}:x));
  return (
    <div className="form-section" style={{padding:0}}>
      <div className="util-row" style={{background:"var(--bg-sunken)",fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em",color:"var(--ink-3)",fontFamily:"var(--font-mono)"}}><div>Utility</div><div>Requested</div><div>Received</div><div>Filed</div><div>Status</div></div>
      {rows.map((r,i)=>{ const done=r.requested&&r.received&&r.filed; return (
        <div key={i} className="util-row">
          <div><div className="util-name">{r.name}</div><div className="util-portal">{r.portal}</div></div>
          <div className={"util-date "+(r.requested?"":"empty")} onClick={()=>toggle(i,"requested")} style={{cursor:"pointer"}}>{r.requested?fmtDate(r.requested):"— click —"}</div>
          <div className={"util-date "+(r.received?"":"empty")} onClick={()=>toggle(i,"received")} style={{cursor:"pointer"}}>{r.received?fmtDate(r.received):"—"}</div>
          <div className={"util-date "+(r.filed?"":"empty")} onClick={()=>toggle(i,"filed")} style={{cursor:"pointer"}}>{r.filed?fmtDate(r.filed):"—"}</div>
          <div><span className={"pill "+(done?"ready":r.requested?"review":"archived")}>{done?"done":r.requested?"waiting":"todo"}</span></div>
        </div>
      );})}
    </div>
  );
};

// ─── Doc Preview (thumbnail per document type) ────────────────────────────────

const DocPreview = ({ docKey, scheme, upload }) => {
  if(docKey==="front") return <div><div style={{fontWeight:700,fontSize:6,marginBottom:2}}>DUNDEE CITY COUNCIL</div><div style={{fontSize:5,marginBottom:4,color:"#666"}}>Road Maintenance Partnership</div><div style={{fontWeight:700,fontSize:7,margin:"6px 0"}}>{scheme.road_name}</div><div style={{fontSize:5,color:"#666"}}>Project {scheme.project_number} · {scheme.financial_year}</div><div style={{height:30,border:"1px dashed #ccc",margin:"6px 0"}}></div><div style={{fontSize:5}}>Area: {scheme.area_m2} m²<br/>Tender: £{(+scheme.tender_total||0).toLocaleString()}<br/>Start: {scheme.date_start}</div></div>;
  if(docKey==="rsr") return <div><div style={{background:"#1f4e79",color:"white",fontSize:5,padding:"2px 3px",fontWeight:700,textAlign:"center"}}>TEMPORARY ROAD CLOSURES</div><div style={{fontSize:4,marginTop:2,marginBottom:3,textAlign:"center",fontStyle:"italic",color:"#555"}}>Info sheet — Network Management</div><div style={{fontSize:4,color:"#1f4e79",fontWeight:700,marginTop:3}}>1. Applicant Details</div><div style={{fontSize:4}}>Applicant: {scheme.prepared_by}<br/>Road: {scheme.road_name}<br/>Ref: {scheme.project_number}</div></div>;
  if(docKey==="pci") return <div><div style={{fontWeight:700,fontSize:6}}>PCI / CPP · FM710-10A</div><div style={{fontSize:5,marginTop:4}}>Pre-Construction Information</div><div style={{height:2,background:"#eee",margin:"4px 0"}}></div><div style={{fontSize:5}}>Site: {scheme.road_name}<br/>Ref: {scheme.project_number}</div></div>;
  if(docKey==="letter") return <div><div style={{fontSize:5}}>Dear Resident,</div><div style={{fontSize:5,marginTop:3}}>Works on {scheme.road_name} from {scheme.date_start}...</div><div style={{fontSize:4,marginTop:6,color:"#666"}}>Copies to ward councillors ({scheme.ward_selected})</div></div>;
  if(docKey==="boq") return <div><div style={{fontWeight:700,fontSize:6}}>BILL OF QUANTITIES</div><div style={{fontSize:4,marginBottom:3}}>{scheme.road_name} · {scheme.project_number}</div>{["Series 100","Series 500","Series 900","Series 1000","Series 3000"].map((s,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:4,borderBottom:"1px solid #eee",padding:"1px 0"}}><span>{s}</span><span>£{(Math.random()*20000+5000).toFixed(0)}</span></div>)}</div>;
  if(upload) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:4}}>
      <div style={{fontWeight:700,fontSize:9,color:"var(--red)",letterSpacing:"0.06em",fontFamily:"var(--font-mono)"}}>PDF</div>
      <div style={{fontSize:4,color:"#555",textAlign:"center",wordBreak:"break-all",maxWidth:"90%"}}>{upload.name}</div>
      <div style={{fontSize:4,color:"var(--green)",fontWeight:600,marginTop:2}}>✓ Uploaded</div>
    </div>
  );
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:3,color:"#bbb"}}>
      <div style={{fontSize:14}}>↑</div>
      <div style={{fontSize:4,textAlign:"center",color:"#aaa"}}>Click to upload<br/>{docKey.toUpperCase()}</div>
    </div>
  );
};

// ─── PDF Preview Modal ────────────────────────────────────────────────────────

const PDFModal = ({ name, url, onClose }) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div className="modal" style={{width:"min(96vw,960px)",height:"min(92vh,840px)",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
      <div className="modal-head">
        <div style={{fontWeight:600,fontSize:14}}>{name}</div>
        <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>
      </div>
      <div style={{flex:1,overflow:"hidden",background:"var(--bg-sunken)"}}>
        <iframe src={url} style={{width:"100%",height:"100%",border:"none"}} title={name} />
      </div>
    </div>
  </div>
);

// ─── Pack Tab ─────────────────────────────────────────────────────────────────

const PackTab = ({ scheme, onGenerate, onPreview }) => {
  const { updateScheme } = React.useContext(window.SchemeContext);
  const [pdfModal, setPdfModal] = React.useState(null);
  const [draggingKey, setDraggingKey] = React.useState(null);
  const fileRefs = React.useRef({});

  const handleUpload = (docKey, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const uploads = { ...(scheme.uploads||{}), [docKey]: { url: e.target.result, name: file.name } };
      updateScheme(scheme.id, { uploads });
    };
    reader.readAsDataURL(file);
  };

  const uploads = scheme.uploads || {};
  const manualDone = window.PACK_DOCS.filter(d => !d.auto).filter(d => uploads[d.key]).length;
  const totalReady = 5 + manualDone;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div>
          <div style={{fontSize:15,fontWeight:600}}>Handover pack · {scheme.project_number} · {scheme.road_name}</div>
          <div style={{fontSize:12,color:"var(--ink-3)",fontFamily:"var(--font-mono)"}}>{totalReady} of {window.PACK_DOCS.length} items ready</div>
        </div>
        <button className="btn accent" onClick={()=>onGenerate(scheme)}><Icon.Wand /> Generate pack</button>
      </div>
      <div className="pack-grid">
        {window.PACK_DOCS.map((d)=>{
          const upload = uploads[d.key];
          const done = d.auto || !!upload;
          const isDragging = draggingKey === d.key;
          return (
            <div key={d.key} className="doc-card">
              <div
                className="doc-preview"
                style={!d.auto ? {cursor:"pointer", outline: isDragging ? "2px solid var(--accent)" : "none"} : {}}
                onClick={()=>{ if(!d.auto && !upload) fileRefs.current[d.key]?.click(); }}
                onDragOver={e=>{ if(!d.auto){ e.preventDefault(); setDraggingKey(d.key); }}}
                onDragLeave={()=>setDraggingKey(null)}
                onDrop={e=>{ e.preventDefault(); setDraggingKey(null); if(!d.auto) handleUpload(d.key, e.dataTransfer.files[0]); }}
              >
                <div className="sheet"><DocPreview docKey={d.key} scheme={scheme} upload={upload} /></div>
                {d.working&&<div style={{position:"absolute",top:10,right:10,background:"var(--accent)",color:"white",fontFamily:"var(--font-mono)",fontSize:9,padding:"3px 6px",borderRadius:2,letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:600}}>Live</div>}
                {!d.auto && !upload && (
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",
                    background:isDragging?"var(--accent-wash)":"rgba(255,255,255,0.55)",transition:"background 0.15s"}}>
                    <button className="btn sm primary" onClick={e=>{ e.stopPropagation(); fileRefs.current[d.key]?.click(); }}>
                      ↑ Upload
                    </button>
                  </div>
                )}
                {upload && (
                  <div style={{position:"absolute",top:8,right:8,background:"var(--green)",color:"white",fontFamily:"var(--font-mono)",
                    fontSize:8,padding:"2px 5px",borderRadius:2,letterSpacing:"0.06em",fontWeight:600}}>
                    ✓
                  </div>
                )}
                <input ref={el=>fileRefs.current[d.key]=el} type="file" accept=".pdf,.dwg,.png,.jpg"
                  style={{display:"none"}} onChange={e=>handleUpload(d.key, e.target.files[0])} />
              </div>
              <div className="doc-info">
                <div className="doc-name">{d.name}</div>
                <div className="doc-meta"><span>{d.type}</span><span>{d.auto?"Auto":"Manual upload"}</span></div>
              </div>
              <div className="doc-status">
                <span className={"pill "+(done?"ready":"review")}>{done?"ready":"pending"}</span>
                <button className="btn sm ghost" style={{marginLeft:"auto"}} onClick={()=>{
                  if(d.working) onPreview(scheme, d.key);
                  else if(upload) setPdfModal({ name: d.name, url: upload.url });
                  else fileRefs.current[d.key]?.click();
                }}>
                  {upload ? <>View <Icon.Arrow /></> : d.working ? <>Preview <Icon.Arrow /></> : "Upload"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{marginTop:20,padding:"14px 18px",background:"var(--bg-elev)",border:"1px solid var(--line)",borderRadius:"var(--radius-sm)",fontSize:12,color:"var(--ink-2)"}}>
        <strong>Connected templates:</strong> Road Space Request Form, PCI / CPP, and Resident Letter are live — click Preview on any card. Manual documents can be uploaded by clicking or dragging a file onto the card.
      </div>
      {pdfModal && <PDFModal name={pdfModal.name} url={pdfModal.url} onClose={()=>setPdfModal(null)} />}
    </div>
  );
};

window.SchemeDetail = SchemeDetail;
