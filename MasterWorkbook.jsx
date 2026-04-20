// ─── MasterWorkbook.jsx ──────────────────────────────────────────────────────
// Editable spreadsheet-style view of a scheme's Master Workbook.
// Renders all 9 sections of WORKBOOK_SCHEMA (49 named ranges) as a live form.
// Every edit calls updateScheme() so changes propagate to all downstream docs
// (RSR, PCI/CPP, Resident Letter) without any copy-paste.
//
// Props:
//   schemeId (string) — the scheme to display and edit
//
// Exports (via window): MasterWorkbook
// Depends on: React, window.SchemeContext, window.WORKBOOK_SCHEMA,
//             window.WARDS, window.Icon
// ─────────────────────────────────────────────────────────────────────────────

const MasterWorkbook = ({ schemeId }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);
  const update = (key, val) => updateScheme(schemeId, { [key]: val });

  const renderField = (f) => {
    const computed = f.type === "calc" ? f.formula(scheme) : scheme[f.key];
    const value = computed ?? "";
    if (f.type === "calc") return (
      <div className="mwb-row calc" key={f.key}>
        <div className="mwb-key mono">{f.key}</div><div className="mwb-label">{f.label}</div>
        <div className="mwb-val calc-val"><span className={f.mono?"mono":""}>{value}</span><span className="calc-badge">calc</span></div>
      </div>
    );
    if (f.type === "ward") return (
      <div className="mwb-row" key={f.key}>
        <div className="mwb-key mono">{f.key}</div><div className="mwb-label">{f.label}</div>
        <div className="mwb-val"><select value={scheme.ward_num} onChange={e => { const num=+e.target.value; const w=window.WARDS.find(x=>x.num===num); updateScheme(schemeId,{ward_num:num,ward_selected:w.name}); }}>
          {window.WARDS.map(w => <option key={w.num} value={w.num}>W{w.num} {w.name}</option>)}
        </select></div>
      </div>
    );
    if (f.type === "select") return (
      <div className="mwb-row" key={f.key}>
        <div className="mwb-key mono">{f.key}</div><div className="mwb-label">{f.label}</div>
        <div className="mwb-val"><select value={value} onChange={e=>update(f.key,e.target.value)}>{f.options.map(o=><option key={o} value={o}>{o}</option>)}</select></div>
      </div>
    );
    if (f.type === "link") return (
      <div className="mwb-row" key={f.key}>
        <div className="mwb-key mono">{f.key}</div><div className="mwb-label">{f.label}</div>
        <div className="mwb-val"><span style={{color:"var(--accent)",fontSize:12}}>🔗 {value||"Click to open DCC lookup"}</span></div>
      </div>
    );
    if (f.type === "textarea") return (
      <div className="mwb-row" key={f.key}>
        <div className="mwb-key mono">{f.key}</div><div className="mwb-label">{f.label}</div>
        <div className="mwb-val"><textarea value={value} rows={Math.min(8,Math.max(2,String(value).split("\n").length+1))} onChange={e=>update(f.key,e.target.value)} style={{width:"100%",fontFamily:"inherit",fontSize:12,padding:"6px 8px",border:"1px solid var(--line)",borderRadius:3,background:"var(--bg)",color:"var(--ink)",resize:"vertical",lineHeight:1.45}} /></div>
      </div>
    );
    return (
      <div className="mwb-row" key={f.key}>
        <div className="mwb-key mono">{f.key}</div><div className="mwb-label">{f.label}</div>
        <div className="mwb-val"><input type={f.type==="email"?"email":f.type==="number"?"number":"text"} className={f.mono?"mono":""} value={value} onChange={e=>update(f.key,f.type==="number"?(e.target.value===""?"":+e.target.value):e.target.value)} /></div>
      </div>
    );
  };

  return (
    <div className="master-workbook">
      <div className="mwb-head">
        <div>
          <div style={{fontSize:15,fontWeight:600,display:"flex",alignItems:"center",gap:10}}>
            <span style={{width:22,height:22,background:"#1D6F42",color:"white",display:"grid",placeItems:"center",borderRadius:3,fontFamily:"var(--font-mono)",fontWeight:700,fontSize:11}}>X</span>
            Master Workbook · Project Info tab
          </div>
          <div style={{fontSize:12,color:"var(--ink-3)",fontFamily:"var(--font-mono)",marginTop:4}}>
            {scheme.project_number}_{(scheme.road_name||"").replace(/\s+/g,"_")}_Master.xlsx · 49 named ranges
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,color:"var(--green)",fontFamily:"var(--font-mono)"}}>● synced · all docs will refresh</span>
          <button className="btn sm"><Icon.Download /> Export .xlsx</button>
        </div>
      </div>
      <div className="mwb-legend">
        <span><span className="swatch input" /> Input cell</span>
        <span><span className="swatch calc" /> Calculated</span>
        <span><span className="swatch link" /> Linked to downstream docs</span>
      </div>
      {window.WORKBOOK_SCHEMA.map(section => (
        <div className="mwb-section" key={section.section}>
          <div className="mwb-section-head">
            <span className="mwb-section-num">{section.section.split(".")[0]}</span>
            <span>{section.section.split(". ")[1]}</span>
            <span style={{marginLeft:"auto",fontSize:10,color:"var(--ink-3)",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"0.06em"}}>{section.fields.length} fields</span>
          </div>
          <div className="mwb-grid">
            <div className="mwb-row header"><div className="mwb-key mono">named range</div><div className="mwb-label">label</div><div className="mwb-val">value</div></div>
            {section.fields.map(renderField)}
          </div>
        </div>
      ))}
      <div className="mwb-foot">
        <div style={{fontSize:12,color:"var(--ink-2)"}}><strong>How it works:</strong> Every value here is a named range in the master workbook. Downstream Word templates use Content Controls linked to these ranges — when you change a value here, regenerating the pack updates every document. No copy-paste.</div>
      </div>
    </div>
  );
};

window.MasterWorkbook = MasterWorkbook;
