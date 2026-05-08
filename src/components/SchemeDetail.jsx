// ─── SchemeDetail.jsx ────────────────────────────────────────────────────────
// Per-scheme tabbed detail page:
//
//   Master Workbook  — scheme identity + dates + people (MasterWorkbook)
//   Designer         — surface zones, ironworks, kerbs, lining, TM
//                      (TreatmentDesigner — owns scheme.design{})
//   Ward & Copies    — ward picker + auto-generated councillor copy list
//   Utilities        — 9-utility search tracker with date toggling
//   Bill of Quantities — BoQTab
//   Pack             — handover pack progress with live document previews
//
// Components exported:
//   SchemeDetail   — tab shell + page header + flag banner
//   WardTab        — ward picker + copy list builder
//   UtilitiesTab   — utility search status tracker
//   DocPreview     — thumbnail for each pack document type
//   PackTab        — full pack grid with preview / generate buttons
//
// Exports (via window): SchemeDetail
// Depends on: React, window.SchemeContext, window.MasterWorkbook,
//             window.TreatmentDesigner, window.Icon, window.WARDS,
//             window.UTILITIES, window.PACK_DOCS, window.STATUS_LABELS,
//             window.fmtDate
// ─────────────────────────────────────────────────────────────────────────────

const SchemeMobileCard = ({ scheme, onExpand, onBack, onGenerate }) => {
  const { updateScheme } = React.useContext(window.SchemeContext);
  const docsGenerated = scheme.docs_generated || {};
  const packDone = window.PACK_DOCS.filter(d => docsGenerated[d.key]).length;
  const packTotal = window.PACK_DOCS.length;
  const packPct = packTotal > 0 ? Math.round((packDone / packTotal) * 100) : 0;
  return (
    <div className="scheme-mobile-card">
      <div>
        <span className="mono" style={{fontSize:12,color:"var(--ink-3)",cursor:"pointer"}} onClick={onBack}>← All schemes</span>
      </div>
      <div className="smc-header">
        <div style={{flex:1,minWidth:0}}>
          <div className="smc-title">{scheme.road_name}</div>
          {scheme.scheme_extent && <div style={{fontSize:12,color:"var(--ink-3)",marginTop:4}}>{scheme.scheme_extent}</div>}
        </div>
        <select value={scheme.status} onChange={e=>updateScheme(scheme.id,{status:e.target.value})}
          className={"pill "+scheme.status}
          style={{border:"none",background:"inherit",color:"inherit",fontWeight:500,fontSize:11,cursor:"pointer",padding:"2px 6px",borderRadius:12,appearance:"none",WebkitAppearance:"none",flexShrink:0}}>
          {Object.entries(STATUS_LABELS).map(([k,l])=><option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div className="smc-meta">
        {[["Start date",scheme.date_start||"—"],["Finish date",scheme.date_finish||"—"],
          ["Area",window.schemeArea(scheme).toLocaleString()+" m²"],["Treatment",scheme.treatment_type||"—"],
          ["Ward",scheme.ward||"—"],["TM type",scheme.tm_type||"—"]].map(([label,val])=>(
          <div key={label} className="smc-meta-item">
            <div className="smc-meta-label">{label}</div>
            <div className="smc-meta-value" style={{fontSize:12}}>{val}</div>
          </div>
        ))}
      </div>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--ink-3)",marginBottom:6}}>
          <span>Pack progress</span><span className="mono">{packDone}/{packTotal} docs ready</span>
        </div>
        <div className="pack-bar-track" style={{height:8,borderRadius:4}}>
          <div className={"pack-bar-fill"+(packDone===packTotal&&packTotal>0?" full":"")} style={{width:packPct+"%"}} />
        </div>
      </div>
      <div className="smc-actions">
        <button className="btn accent" style={{justifyContent:"center"}} onClick={()=>onGenerate(scheme)}><Icon.Wand /> Generate pack</button>
        <button className="btn" style={{justifyContent:"center"}} onClick={()=>onExpand("boq")}>View BoQ</button>
      </div>
      <button className="smc-expand" onClick={()=>onExpand(null)}>Full scheme details →</button>
    </div>
  );
};

const SchemeDetail = ({ schemeId, onBack, onGenerate, onPreview, onDuplicate }) => {
  const { getScheme, updateScheme, deleteScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);
  const [tab, setTab] = React.useState("workbook");
  const [showSketch, setShowSketch] = React.useState(false);
  const isMobile = React.useMemo(()=>window.innerWidth<=768,[]);
  const [mobileExpanded, setMobileExpanded] = React.useState(false);
  const workbookFieldCount = window.WORKBOOK_SCHEMA.flatMap(s=>s.fields).filter(f=>f.type!=="subheader"&&f.type!=="zone-label").length;
  const tabs = [
    { k:"workbook", l:"Master Workbook", badge: String(workbookFieldCount) },
    { k:"treatment", l:"Designer" },
    { k:"ward", l:"Ward & Copies" },
    { k:"utilities", l:"Utilities", badge: String(window.UTILITIES.length) },
    { k:"boq", l:"Bill of Quantities" },
    { k:"pack", l:"Pack", badge:`${window.PACK_DOCS.filter(d=>(scheme.docs_generated||{})[d.key]).length}/${window.PACK_DOCS.length}` },
  ];

  if (isMobile && !mobileExpanded) {
    return (
      <SchemeMobileCard
        scheme={scheme}
        onExpand={(targetTab)=>{ setMobileExpanded(true); if(targetTab) setTab(targetTab); window.scrollTo({top:0,behavior:'smooth'}); }}
        onBack={onBack}
        onGenerate={onGenerate}
      />
    );
  }

  return (
    <>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:12,color:"var(--ink-3)"}}>
        <span className="mono" onClick={onBack} style={{cursor:"pointer"}}>← All schemes</span>
        <span>/</span><span className="mono">{scheme.id}</span>
      </div>
      <div className="page-head">
        <div>
          <h1 className="page-title">{scheme.road_name}</h1>
          <p className="page-sub" style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            <span>{scheme.scheme_extent}</span>
            <span>·</span><span className="mono">{window.schemeArea(scheme).toLocaleString()} m²</span>
            <span>·</span><span>{scheme.treatment_type}</span>
            <span>·</span>
            <select
              value={scheme.status}
              onChange={e=>updateScheme(schemeId,{status:e.target.value})}
              className={"pill "+scheme.status}
              style={{border:"none",background:"inherit",color:"inherit",fontWeight:500,fontSize:11,cursor:"pointer",padding:"2px 6px",borderRadius:12,appearance:"none",WebkitAppearance:"none"}}>
              {Object.entries(STATUS_LABELS).map(([k,l])=><option key={k} value={k}>{l}</option>)}
            </select>
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          {scheme.sketch_pdf && <button className="btn ghost" onClick={()=>setShowSketch(true)} title="View pre-design sketch">📄 View sketch</button>}
          <button className="btn" onClick={()=>{ if(tab==="workbook"&&window.__workbookExport){ window.__workbookExport(); } else { setTab("workbook"); } }}><Icon.Download /> Export workbook</button>
          <button className="btn accent" onClick={()=>onGenerate(scheme)}><Icon.Wand /> Generate pack <span className="kbd">⌘G</span></button>
          {onDuplicate && <button className="btn ghost sm" title="Duplicate scheme" onClick={()=>onDuplicate(scheme)}><Icon.Copy /></button>}
          <button className="btn ghost sm" title="Delete scheme" style={{color:"var(--red)"}} onClick={async()=>{
            const ask = window.confirmDialog || ((o)=>Promise.resolve(window.confirm(o.body||o.title)));
            const ok = await ask({ title:`Delete "${scheme.road_name}"?`, body:'This cannot be undone.', confirmLabel:'Delete', danger:true });
            if (ok) { deleteScheme(schemeId); onBack(); if (window.Toast) window.Toast.show({kind:'info',msg:`Deleted "${scheme.road_name}".`}); }
          }}><Icon.Trash /></button>
        </div>
      </div>
      {(() => {
        // Merge persisted scheme.flags with live BoQ-override flags and
        // zone-area / scheme-area mismatches so every form of drift is
        // visible at the top of the page.
        const persisted = scheme.flags || [];
        const zones = (scheme.design && scheme.design.zones) || [];
        const zoneFlags = [];
        if (zones.length && window.schemeArea(scheme) > 0) {
          const zoneTotal = zones.reduce((s, z) => s + (+z.area_m2 || 0), 0);
          const masterArea = window.schemeArea(scheme);
          const diff = zoneTotal - masterArea;
          if (Math.abs(diff) > 0.5) {
            zoneFlags.push(
              `Treatment zones sum to ${zoneTotal.toLocaleString()} m² but scheme area is ${masterArea.toLocaleString()} m² ` +
              `(${diff > 0 ? '+' : ''}${diff.toLocaleString()} m² ${diff > 0 ? 'over' : 'under'})`
            );
          }
        }
        const flags = [...persisted, ...zoneFlags];
        if (!flags.length) return null;
        return (
          <div style={{background:"var(--amber-wash)",border:"1px solid var(--amber)",padding:"10px 14px",borderRadius:"var(--radius-sm)",marginBottom:20,display:"flex",gap:10,alignItems:"flex-start",fontSize:13}}>
            <span style={{color:"var(--amber)",paddingTop:2}}><Icon.Alert /></span>
            <div><strong>Inconsistencies detected</strong><ul style={{margin:"4px 0 0",paddingLeft:16}}>{flags.map((f,i)=><li key={i} style={{color:"var(--ink-2)"}}>{f}</li>)}</ul></div>
          </div>
        );
      })()}
      <div className="tabs">
        {tabs.map(t=><div key={t.k} className={"tab "+(tab===t.k?"active":"")} onClick={()=>setTab(t.k)}>{t.l}{t.badge&&<span className="badge">{t.badge}</span>}</div>)}
      </div>
      {tab==="workbook"&&<MasterWorkbook schemeId={schemeId} />}
      {tab==="treatment"&&<window.TreatmentDesigner schemeId={schemeId} />}
      {tab==="ward"&&<WardTab schemeId={schemeId} />}
      {tab==="utilities"&&<UtilitiesTab scheme={scheme} />}
      {tab==="boq"&&<BoQTab schemeId={schemeId} onOpenDesigner={()=>setTab("treatment")} />}
      {tab==="pack"&&<PackTab scheme={scheme} onGenerate={onGenerate} onPreview={onPreview} onTabSwitch={setTab} />}
      {showSketch && <SketchModal pdf={scheme.sketch_pdf} road={scheme.road_name} onClose={()=>setShowSketch(false)} />}
    </>
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
  const { updateScheme } = React.useContext(window.SchemeContext);
  const today = new Date().toISOString().slice(0,10);
  const addMonths = (dateStr, n) => { const d = new Date(dateStr); d.setMonth(d.getMonth()+n); return d.toISOString().slice(0,10); };
  const applied = scheme.utility_applied || {};
  const rows = window.UTILITIES.map(u => ({ ...u, applied: applied[u.name] || "" }));
  const setApplied = (name, date) => updateScheme(scheme.id, { utility_applied: { ...applied, [name]: date } });
  const toggleApplied = (i) => { const u = rows[i]; setApplied(u.name, u.applied ? "" : today); };

  const getStatus = (applied) => {
    if (!applied) return { label:"todo", cls:"archived" };
    const expiry = addMonths(applied, 3);
    const daysLeft = Math.ceil((new Date(expiry)-new Date()) / 86400000);
    if (daysLeft < 0)  return { label:"expired", cls:"design", expiry };
    if (daysLeft < 14) return { label:`exp. soon`, cls:"review", expiry };
    return { label:"valid", cls:"ready", expiry };
  };

  return (
    <div>
    <div className="portal-links">
      {window.PORTAL_LINKS.map(p => (
        <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" className="portal-card">
          <img className="portal-logo" src={`https://www.google.com/s2/favicons?domain=${p.domain}&sz=48`} alt={p.name} />
          <div className="portal-info">
            <div className="portal-name">{p.name}</div>
            <div className="portal-desc">{p.desc}</div>
          </div>
          <div className="portal-arrow">↗</div>
        </a>
      ))}
    </div>
    <div style={{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",color:"var(--ink-3)",padding:"14px 0 8px"}}>Utility Search Tracker</div>
    <div className="form-section" style={{padding:0}}>
      <div className="util-row util-row--tracker" style={{background:"var(--bg-sunken)",fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em",color:"var(--ink-3)",fontFamily:"var(--font-mono)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <input type="checkbox"
            checked={rows.length > 0 && rows.every(r=>!!r.applied)}
            ref={el=>{ if(el) el.indeterminate = rows.some(r=>!!r.applied) && !rows.every(r=>!!r.applied); }}
            onChange={e => {
              const next = {};
              window.UTILITIES.forEach(u => { next[u.name] = e.target.checked ? (applied[u.name] || today) : ""; });
              updateScheme(scheme.id, { utility_applied: next });
            }}
            style={{width:15,height:15,accentColor:"var(--accent)",cursor:"pointer",flexShrink:0}} />
          <span>Utility</span>
        </div>
        <div>Applied</div><div>Expiry</div><div>Status</div>
      </div>
      {rows.map((r,i) => {
        const st = getStatus(r.applied);
        return (
          <div key={i} className="util-row util-row--tracker">
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <input type="checkbox" checked={!!r.applied} onChange={()=>toggleApplied(i)}
                style={{width:15,height:15,accentColor:"var(--accent)",cursor:"pointer",flexShrink:0}} />
              <div>
                <div className="util-name">{r.name}</div>
                <div className="util-portal">{r.portal}</div>
              </div>
            </div>
            <div className={"util-date "+(r.applied?"":"empty")}>{r.applied ? fmtDate(r.applied) : "—"}</div>
            <div className={"util-date "+(st.expiry?"":"empty")}>{st.expiry ? fmtDate(st.expiry) : "—"}</div>
            <div><span className={"pill "+st.cls}>{st.label}</span></div>
          </div>
        );
      })}
    </div>
    </div>
  );
};

// ─── Front Sheet (A4 HTML doc, rendered offscreen then exported as PDF) ─────────

const FRONT_STATUS_COLORS = { design:"#3b82f6", review:"#f59e0b", ready:"#22c55e", works:"#6366f1", archived:"#9ca3af", constructed:"#0f5c42" };

const FrontSheetDoc = ({ scheme }) => {
  const docsGen = scheme.docs_generated || {};
  const statusLabels = { design:"In Design", review:"In Review", ready:"Ready to Issue", works:"On Site", archived:"Archived", constructed:"Constructed" };
  const statusColor = FRONT_STATUS_COLORS[scheme.status] || "#6b7280";
  const teamRows = [
    ["Designer",      scheme.prepared_by],
    ["Reviewer",      scheme.reviewer_name],
    ["Approver",      scheme.approver_name],
    ["Client Officer",scheme.client_officer],
    ["Contractor",    scheme.contractor],
  ];
  const summaryRows = [
    ["Traffic Category", scheme.traffic_category],
    ["Scheme Type",      scheme.scheme_type],
    ["Tender Total",     scheme.tender_total ? `£${(+scheme.tender_total).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}` : null],
    ["Date Prepared",    scheme.date_prepared],
  ];
  return (
    <div style={{width:794,minHeight:1123,background:'white',fontFamily:"'Arial',Helvetica,sans-serif",color:'#111',boxSizing:'border-box',display:'flex',flexDirection:'column'}}>
      {/* Letterhead */}
      <div style={{background:'#1a3a5c',color:'white',padding:'28px 40px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:10,letterSpacing:'0.15em',textTransform:'uppercase',opacity:0.7,marginBottom:4}}>Dundee City Council</div>
          <div style={{fontSize:20,fontWeight:700,letterSpacing:'-0.01em'}}>Road Maintenance Partnership</div>
        </div>
        <div style={{textAlign:'right',opacity:0.65,fontSize:10,fontFamily:'monospace',lineHeight:1.6}}>
          <div>Handover Pack</div>
          <div>{scheme.project_number}</div>
        </div>
      </div>

      {/* Title band */}
      <div style={{background:'#f0f4f8',borderBottom:'3px solid #1a3a5c',padding:'20px 40px'}}>
        <div style={{fontSize:20,fontWeight:800,lineHeight:1.2,marginBottom:4}}>{scheme.road_name || 'Untitled Scheme'}</div>
        {scheme.scheme_extent && <div style={{fontSize:13,color:'#555',marginBottom:8}}>{scheme.scheme_extent}</div>}
        <div style={{display:'flex',gap:24,flexWrap:'wrap',fontSize:12,marginTop:6}}>
          {[["Project Ref",scheme.project_number],["Financial Year",scheme.financial_year],["Ward",scheme.ward_selected?`${scheme.ward_num} — ${scheme.ward_selected}`:'—']].map(([l,v])=>(
            <div key={l}><span style={{color:'#888',marginRight:6}}>{l}</span><span style={{fontWeight:600,fontFamily:l==='Project Ref'?'monospace':'inherit'}}>{v||'—'}</span></div>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div style={{background:statusColor,color:'white',padding:'12px 40px',display:'flex',gap:32,alignItems:'center',fontSize:12,flexWrap:'wrap'}}>
        {[["Status",statusLabels[scheme.status]||scheme.status||'—'],["Treatment",scheme.treatment_type||'—'],["Area",`${window.schemeArea(scheme).toLocaleString()} m²`],["Works Period",scheme.date_start&&scheme.date_finish?`${scheme.date_start} → ${scheme.date_finish}`:scheme.date_start||'—']].map(([l,v])=>(
          <div key={l}>
            <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'0.1em',opacity:0.8,marginBottom:2}}>{l}</div>
            <div style={{fontWeight:700}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Two-column detail */}
      <div style={{padding:'28px 40px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:32,flex:1}}>
        <div>
          <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'#888',paddingBottom:6,borderBottom:'2px solid #1a3a5c',marginBottom:12}}>Design Team</div>
          {teamRows.map(([l,v])=>(
            <div key={l} style={{display:'grid',gridTemplateColumns:'120px 1fr',gap:6,marginBottom:9,fontSize:12}}>
              <div style={{color:'#888'}}>{l}</div>
              <div style={{fontWeight:v?500:400,color:v?'#111':'#bbb'}}>{v||'—'}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'#888',paddingBottom:6,borderBottom:'2px solid #1a3a5c',marginBottom:12}}>Scheme Details</div>
          {summaryRows.map(([l,v])=>(
            <div key={l} style={{display:'grid',gridTemplateColumns:'130px 1fr',gap:6,marginBottom:9,fontSize:12}}>
              <div style={{color:'#888'}}>{l}</div>
              <div style={{fontFamily:l==='Tender Total'?'monospace':'inherit',fontWeight:v?500:400,color:v?'#111':'#bbb'}}>{v||'—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pack checklist */}
      <div style={{padding:'0 40px 28px'}}>
        <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'#888',paddingBottom:6,borderBottom:'2px solid #1a3a5c',marginBottom:12}}>Pack Checklist</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
          {window.PACK_DOCS.map(d=>{
            const done = !!docsGen[d.key];
            return (
              <div key={d.key} style={{display:'flex',alignItems:'center',gap:7,fontSize:11,padding:'7px 10px',background:done?'#f0fdf4':'#f9fafb',borderRadius:5,border:`1px solid ${done?'#86efac':'#e5e7eb'}`}}>
                <span style={{width:16,height:16,borderRadius:'50%',background:done?'#22c55e':'#d1d5db',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>{done?'✓':'○'}</span>
                <span style={{fontWeight:done?600:400,color:done?'#166534':'#9ca3af',lineHeight:1.2}}>{d.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{padding:'14px 40px',background:'#f8f9fa',borderTop:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:10,color:'#aaa'}}>
        <div>Generated by RMP Design Studio · {new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
        <div style={{fontFamily:'monospace'}}>{scheme.project_number} · {scheme.road_name}</div>
      </div>
    </div>
  );
};

async function downloadFrontPdf(scheme) {
  if (!window.htmlToPdf) throw new Error('PDF library not loaded');
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:white;';
  document.body.appendChild(container);
  try {
    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(FrontSheetDoc, { scheme }));
    await new Promise(r => setTimeout(r, 500));
    const filename = `Front_Sheet_${scheme.project_number}_${(scheme.road_name||'').replace(/\s+/g,'_')}.pdf`;
    await window.htmlToPdf(container.firstChild || container, filename);
    root.unmount();
    window.dispatchEvent(new CustomEvent('rmp-download', {
      detail: { label: 'Front Sheet — ' + (scheme.road_name || 'scheme'), ref: scheme.project_number || '', fn: '__downloadFrontPdf', schemeId: scheme.id },
    }));
  } finally {
    document.body.removeChild(container);
  }
}

// Expose at file scope so GenerateModal can use it without PackTab being mounted.
window.__downloadFrontPdf = downloadFrontPdf;

window.__getFrontPdfBuffer = async (scheme) => {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:white;';
  document.body.appendChild(container);
  try {
    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(FrontSheetDoc, { scheme }));
    await new Promise(r => setTimeout(r, 500));
    const buf = await window.htmlToPdfBuffer(container.firstChild || container);
    root.unmount();
    return buf;
  } finally {
    document.body.removeChild(container);
  }
};

window.FrontSheetDoc = FrontSheetDoc;

// ─── Pack file upload helpers ─────────────────────────────────────────────────

const readPDFasDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload  = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Failed to read file'));
  reader.readAsDataURL(file);
});

const PackFileModal = ({ packFile, docName, onClose }) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div className="modal sketch-modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head">
        <div style={{fontWeight:600,fontSize:15}}>{docName} — {packFile.name}</div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <a className="btn sm" href={packFile.data} download={packFile.name} title="Download file">
            <Icon.Download /> Download
          </a>
          <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>
        </div>
      </div>
      <div className="sketch-body">
        <iframe src={packFile.data} title={docName} className="sketch-frame" />
      </div>
    </div>
  </div>
);

// ─── Doc Preview (thumbnail per document type) ────────────────────────────────

const DocPreview = ({ docKey, scheme }) => {
  // Multi-file sections: show stacked thumbnail with count
  if (docKey === 'drawings' || docKey === 'utilities') {
    const files = scheme[`pack_files_${docKey}`] || [];
    if (files.length > 0) {
      return (
        <div style={{textAlign:'center',paddingTop:8,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
          <div style={{display:'flex',justifyContent:'center'}}>
            {files.slice(0,3).map((f,i)=>(
              <svg key={i} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{marginLeft:i?-5:0,filter:'drop-shadow(0 1px 2px rgba(0,0,0,0.25))'}}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            ))}
          </div>
          <div style={{fontSize:5,fontWeight:700,color:'#dc2626'}}>{files.length} PDF{files.length!==1?'s':''}</div>
          <div style={{fontSize:4,color:'#555',lineHeight:1.3,wordBreak:'break-all',maxWidth:'90%'}}>{files[0].name}</div>
          {files.length>1&&<div style={{fontSize:4,color:'#888'}}>+{files.length-1} more</div>}
        </div>
      );
    }
  }

  // Single uploaded pack PDF takes priority over doc-specific previews
  const packFile = scheme[`pack_file_${docKey}`];
  if (packFile) {
    return (
      <div style={{textAlign:'center',paddingTop:10,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
        </svg>
        <div style={{fontSize:5,fontWeight:700,color:'#dc2626',letterSpacing:'0.05em'}}>PDF</div>
        <div style={{fontSize:4,color:'#555',lineHeight:1.3,wordBreak:'break-all',maxWidth:'90%'}}>{packFile.name}</div>
      </div>
    );
  }
  if(docKey==="front") return (
    <div>
      <div style={{background:'#1a3a5c',color:'white',fontSize:4,padding:'2px 3px',fontWeight:700,marginBottom:2}}>DUNDEE CITY COUNCIL · RMP</div>
      <div style={{fontWeight:700,fontSize:6,margin:'3px 0'}}>{scheme.road_name}</div>
      <div style={{fontSize:4,color:'#666',marginBottom:3}}>Project {scheme.project_number} · {scheme.financial_year}</div>
      <div style={{height:12,background:'#3b82f6',margin:'3px 0',borderRadius:1,display:'flex',alignItems:'center',paddingLeft:3}}>
        <span style={{fontSize:3,color:'white',fontWeight:700}}>{(STATUS_LABELS[scheme.status]||scheme.status||'').toUpperCase()}</span>
      </div>
      <div style={{fontSize:4,marginTop:3}}>Area: {window.schemeArea(scheme).toLocaleString()} m²<br/>{scheme.date_start} → {scheme.date_finish}</div>
    </div>
  );
  if(docKey==="rsr") return <div><div style={{background:"#1f4e79",color:"white",fontSize:5,padding:"2px 3px",fontWeight:700,textAlign:"center"}}>TEMPORARY ROAD CLOSURES</div><div style={{fontSize:4,marginTop:2,marginBottom:3,textAlign:"center",fontStyle:"italic",color:"#555"}}>Info sheet — Network Management</div><div style={{fontSize:4,color:"#1f4e79",fontWeight:700,marginTop:3}}>1. Applicant Details</div><div style={{fontSize:4}}>Applicant: {scheme.prepared_by}<br/>Road: {scheme.road_name}<br/>Ref: {scheme.project_number}</div></div>;
  if(docKey==="pci") return <div><div style={{fontWeight:700,fontSize:6}}>PCI / CPP · FM710-10A</div><div style={{fontSize:5,marginTop:4}}>Pre-Construction Information</div><div style={{height:2,background:"#eee",margin:"4px 0"}}></div><div style={{fontSize:5}}>Site: {scheme.road_name}<br/>Ref: {scheme.project_number}</div></div>;
  if(docKey==="letter") return <div><div style={{fontSize:5}}>Dear Resident,</div><div style={{fontSize:5,marginTop:3}}>Works on {scheme.road_name} from {scheme.date_start}...</div><div style={{fontSize:4,marginTop:6,color:"#666"}}>Copies to ward councillors ({scheme.ward_selected})</div></div>;
  if(docKey==="boq"){
    // Read real series subtotals from scheme.boq when available; fall back to a
    // labelled placeholder if the designer hasn't touched the BoQ tab yet.
    const E=window.BOQ_ENGINE;
    let breakdown=[];
    if(scheme.boq && E){
      const eff = E.effectiveQuickInputs ? E.effectiveQuickInputs(scheme, scheme.boq) : scheme.boq.quick_inputs;
      const computed = E.buildBoQLines({...scheme.boq, quick_inputs: eff}, scheme);
      breakdown=computed.groups.map(g=>({l:`Series ${g.num}`,v:E.fmtGBP(g.subtotal)}));
      if(computed.totalIncVat) breakdown.push({l:'Total inc VAT',v:E.fmtGBP(computed.totalIncVat),bold:true});
    }
    if(!breakdown.length) breakdown=[{l:'(not generated yet)',v:'—'}];
    return <div><div style={{fontWeight:700,fontSize:6}}>BILL OF QUANTITIES</div><div style={{fontSize:4,marginBottom:3}}>{scheme.road_name} · {scheme.project_number}</div>{breakdown.map((b,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:4,borderBottom:"1px solid #eee",padding:"1px 0",fontWeight:b.bold?700:400}}><span>{b.l}</span><span>{b.v}</span></div>)}</div>;
  }
  return <div style={{color:"#aaa",fontSize:5,textAlign:"center",paddingTop:20}}>[{docKey.toUpperCase()}]<br/>Upload PDF below</div>;
};

// ─── Pack Tab ─────────────────────────────────────────────────────────────────

const PackTab = ({ scheme, onGenerate, onPreview, onTabSwitch }) => {
  const { updateScheme } = React.useContext(window.SchemeContext);
  const docsGen = scheme.docs_generated || {};
  const packReady = window.PACK_DOCS.filter(d => docsGen[d.key]).length;
  const packTotal = window.PACK_DOCS.length;
  const [generatingFront, setGeneratingFront] = React.useState(false);
  const [viewingPackFile, setViewingPackFile] = React.useState(null);

  const handlePackFileUpload = async (docKey, file) => {
    if (file.size > 20 * 1024 * 1024) {
      alert('File is too large — maximum 20 MB per document.');
      return;
    }
    try {
      const data = await readPDFasDataUrl(file);
      updateScheme(scheme.id, {
        [`pack_file_${docKey}`]: { data, name: file.name },
        docs_generated: { ...docsGen, [docKey]: true },
      });
    } catch (e) {
      alert('Upload failed: ' + e.message);
    }
  };

  const clearPackFile = (docKey) => {
    updateScheme(scheme.id, {
      [`pack_file_${docKey}`]: null,
      docs_generated: { ...docsGen, [docKey]: false },
    });
  };

  // Multi-file helpers (drawings, utilities)
  const handleMultiFileUpload = async (docKey, files) => {
    const existing = scheme[`pack_files_${docKey}`] || [];
    const added = [];
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) { alert(`${file.name} exceeds 20 MB — skipped.`); continue; }
      try {
        const data = await readPDFasDataUrl(file);
        added.push({ id: `${Date.now()}-${Math.random()}`, data, name: file.name });
      } catch (e) { alert(`Failed to read ${file.name}: ${e.message}`); }
    }
    if (!added.length) return;
    const updated = [...existing, ...added];
    updateScheme(scheme.id, {
      [`pack_files_${docKey}`]: updated,
      docs_generated: { ...docsGen, [docKey]: true },
    });
  };

  const removeMultiFile = (docKey, id) => {
    const updated = (scheme[`pack_files_${docKey}`] || []).filter(f => f.id !== id);
    updateScheme(scheme.id, {
      [`pack_files_${docKey}`]: updated,
      docs_generated: { ...docsGen, [docKey]: updated.length > 0 },
    });
  };

  const reorderMultiFile = (docKey, id, dir) => {
    const arr = [...(scheme[`pack_files_${docKey}`] || [])];
    const idx = arr.findIndex(f => f.id === id);
    const next = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || next < 0 || next >= arr.length) return;
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    updateScheme(scheme.id, { [`pack_files_${docKey}`]: arr });
  };

  // Register __downloadFront so GenerateModal can call it too (PR C).
  React.useEffect(() => {
    window.__downloadFront = async () => {
      setGeneratingFront(true);
      try {
        await downloadFrontPdf(scheme);
        updateScheme(scheme.id, { docs_generated: { ...docsGen, front: true } });
      } finally {
        setGeneratingFront(false);
      }
    };
    return () => { window.__downloadFront = null; };
  }, [scheme, docsGen]); // eslint-disable-line

  const toggleManual = (key) => {
    updateScheme(scheme.id, { docs_generated: { ...docsGen, [key]: !docsGen[key] } });
  };


  const handleWorkingClick = (d) => {
    if (d.key === 'boq')   return onTabSwitch('boq');
    if (d.key === 'front') return window.__downloadFront && window.__downloadFront();
    onPreview(scheme, d.key);
  };

  const workingLabel = (d) => {
    if (d.key === 'boq')   return 'Open BoQ';
    if (d.key === 'front') return generatingFront ? 'Generating…' : 'Download PDF';
    return 'Preview';
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div>
          <div style={{fontSize:15,fontWeight:600}}>Handover pack · {scheme.project_number} · {scheme.road_name}</div>
          <div style={{fontSize:12,color:"var(--ink-3)",fontFamily:"var(--font-mono)"}}>{packReady} of {packTotal} items ready</div>
        </div>
        <button className="btn accent" onClick={()=>onGenerate(scheme)}><Icon.Wand /> Generate pack</button>
      </div>
      <div className="pack-grid">
        {window.PACK_DOCS.map((d) => {
          const done = !!docsGen[d.key];
          const isWorking = !!d.working;
          const isGenerating = d.key === 'front' && generatingFront;
          return (
            <div key={d.key} className="doc-card">
              <div className="doc-preview">
                <div className="sheet"><DocPreview docKey={d.key} scheme={scheme} /></div>
                {isWorking && <div style={{position:"absolute",top:10,right:10,background:"var(--accent)",color:"white",fontFamily:"var(--font-mono)",fontSize:9,padding:"3px 6px",borderRadius:2,letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:600}}>Live</div>}
              </div>
              <div className="doc-info">
                <div className="doc-name">{d.name}</div>
                <div className="doc-meta"><span>{d.type}</span><span>{d.auto?"Auto":"Manual"}</span></div>
              </div>
              {(d.key === 'drawings' || d.key === 'utilities' || d.key === 'tm') ? (
                // ── Multi-file card (drawings / utilities) ───────
                (() => {
                  const mf = scheme[`pack_files_${d.key}`] || [];
                  return (
                    <div className="doc-status" style={{flexDirection:'column',alignItems:'stretch',gap:6}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span className={"pill "+(mf.length>0?"ready":"review")}>{mf.length>0?"ready":"pending"}</span>
                        {mf.length>0&&<span style={{fontSize:10,color:'var(--ink-3)',fontFamily:'var(--font-mono)'}}>{mf.length} file{mf.length!==1?'s':''}</span>}
                      </div>
                      {mf.length>0&&(
                        <div style={{display:'flex',flexDirection:'column',gap:3}}>
                          {mf.map((file,idx,arr)=>(
                            <div key={file.id} style={{display:'flex',alignItems:'center',gap:4,background:'var(--bg-sunken)',padding:'4px 6px',borderRadius:'var(--radius-sm)'}}>
                              <span style={{color:'var(--ink-3)',fontFamily:'var(--font-mono)',fontSize:10,minWidth:14,textAlign:'center',flexShrink:0}}>{idx+1}</span>
                              <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:11,color:'var(--ink)'}}>{file.name}</span>
                              <div style={{display:'flex',gap:2,flexShrink:0}}>
                                <button className="btn ghost sm" style={{padding:'2px 5px',fontSize:13,lineHeight:1}} disabled={idx===0} title="Move up"
                                  onClick={()=>reorderMultiFile(d.key,file.id,'up')}>↑</button>
                                <button className="btn ghost sm" style={{padding:'2px 5px',fontSize:13,lineHeight:1}} disabled={idx===arr.length-1} title="Move down"
                                  onClick={()=>reorderMultiFile(d.key,file.id,'down')}>↓</button>
                                <button className="btn ghost sm" style={{padding:'2px 5px'}} title="View"
                                  onClick={()=>setViewingPackFile({packFile:file,docName:d.name})}><Icon.Eye /></button>
                                <button className="btn ghost sm" style={{padding:'2px 5px',color:'var(--red)'}} title="Remove"
                                  onClick={()=>removeMultiFile(d.key,file.id)}><Icon.Trash /></button>
                              </div>
                            </div>
                          ))}
                          {mf.length>1&&<div style={{fontSize:10,color:'var(--ink-3)',textAlign:'right',paddingRight:2}}>↑ ↓ to reorder · merged in order shown</div>}
                        </div>
                      )}
                      <label style={{cursor:'pointer',display:'inline-flex',alignSelf:'flex-start'}}>
                        <input type="file" accept=".pdf,application/pdf" multiple style={{display:'none'}}
                          onChange={e=>{if(e.target.files.length)handleMultiFileUpload(d.key,e.target.files);e.target.value='';}} />
                        <span className="btn sm ghost"><Icon.Upload /> {mf.length>0?'Add more':'Upload PDFs'}</span>
                      </label>
                    </div>
                  );
                })()
              ) : (
                // ── Single-file / working card ───────────────────
                <div className="doc-status">
                  <span className={"pill "+(done?"ready":"review")}>{done?"ready":"pending"}</span>
                  {isWorking ? (
                    <div style={{marginLeft:"auto",display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                      <button className="btn sm ghost" disabled={isGenerating}
                        onClick={() => handleWorkingClick(d)}>
                        {workingLabel(d)} {!isGenerating && <Icon.Arrow />}
                      </button>
                      {(d.key === 'boq' || d.key === 'pci' || d.key === 'rsr') && (() => {
                        const docFile = scheme[`pack_file_${d.key}`];
                        const uploadLabel = d.key === 'pci' ? 'Upload Pack PDF' : 'PDF';
                        return docFile ? (
                          <>
                            <button className="btn sm ghost"
                              onClick={() => setViewingPackFile({ packFile: docFile, docName: d.name })}>
                              <Icon.Eye /> PDF
                            </button>
                            <button className="btn sm ghost" style={{color:"var(--red)"}}
                              title="Remove uploaded PDF" onClick={() => clearPackFile(d.key)}>
                              <Icon.Trash />
                            </button>
                          </>
                        ) : (
                          <label style={{cursor:"pointer",display:"inline-flex"}} title={d.key==='pci'?"Upload printed PDF to include in pack — overrides auto-render":"Upload PDF to use in place of auto-render"}>
                            <input type="file" accept=".pdf,application/pdf" style={{display:"none"}}
                              onChange={e => { const f = e.target.files[0]; if (f) handlePackFileUpload(d.key, f); e.target.value = ''; }} />
                            <span className="btn sm ghost"><Icon.Upload /> {uploadLabel}</span>
                          </label>
                        );
                      })()}
                    </div>
                  ) : (() => {
                    const packFile = scheme[`pack_file_${d.key}`];
                    return (
                      <div style={{marginLeft:"auto",display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                        {packFile ? (
                          <>
                            <button className="btn sm ghost"
                              onClick={() => setViewingPackFile({ packFile, docName: d.name })}>
                              <Icon.Eye /> View
                            </button>
                            <button className="btn sm ghost" style={{color:"var(--red)"}}
                              title="Remove uploaded file"
                              onClick={() => clearPackFile(d.key)}>
                              <Icon.Trash />
                            </button>
                          </>
                        ) : (
                          <label style={{cursor:"pointer",display:"inline-flex"}}>
                            <input type="file" accept=".pdf,application/pdf" style={{display:"none"}}
                              onChange={e => { const f = e.target.files[0]; if (f) handlePackFileUpload(d.key, f); e.target.value = ''; }} />
                            <span className="btn sm ghost"><Icon.Upload /> Upload PDF</span>
                          </label>
                        )}
                        <label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,cursor:"pointer",userSelect:"none",color:"var(--ink-3)"}}>
                          <input type="checkbox" checked={done} onChange={()=>toggleManual(d.key)} style={{width:"auto"}} />
                          Received
                        </label>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{marginTop:20,padding:"14px 18px",background:"var(--bg-elev)",border:"1px solid var(--line)",borderRadius:"var(--radius-sm)",fontSize:12,color:"var(--ink-2)"}}>
        <strong>Pack generation rule:</strong> If you upload a PDF for any document, that file is used in the compiled pack — overriding auto-render. <strong>PCI / CPP must be uploaded</strong> (use Preview → Download .docx → print-to-PDF in Word, then upload here). RSR and Front Sheet auto-render if no upload is present. All other documents require upload (max 20 MB each).
      </div>
      {viewingPackFile && (
        <PackFileModal
          packFile={viewingPackFile.packFile}
          docName={viewingPackFile.docName}
          onClose={() => setViewingPackFile(null)}
        />
      )}
    </div>
  );
};

const SketchModal = ({ pdf, road, onClose }) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div className="modal sketch-modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-head">
        <div style={{fontWeight:600,fontSize:15}}>Pre-design sketch · {road}</div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <a className="btn sm" href={`templates/${pdf}`} download={pdf} title="Download sketch PDF"><Icon.Download /> Download</a>
          <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>
        </div>
      </div>
      <div className="sketch-body">
        <iframe src={`templates/${pdf}`} title={`Sketch — ${road}`} className="sketch-frame" />
      </div>
    </div>
  </div>
);

window.SchemeDetail = SchemeDetail;
