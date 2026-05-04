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
          ["Area",(+(scheme.area_m2)||0).toLocaleString()+" m²"],["Treatment",scheme.treatment_type||"—"],
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
    { k:"treatment", l:"Treatment" },
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
            <span>·</span><span className="mono">{(+scheme.area_m2).toLocaleString()} m²</span>
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
          <button className="btn ghost sm" title="Delete scheme" style={{color:"var(--red)"}} onClick={()=>{ if(confirm(`Delete "${scheme.road_name}"? This cannot be undone.`)){ deleteScheme(schemeId); onBack(); } }}><Icon.Trash /></button>
        </div>
      </div>
      {(() => {
        // Merge persisted scheme.flags with live BoQ-override flags and
        // zone-area / scheme-area mismatches so every form of drift is
        // visible at the top of the page.
        const persisted = scheme.flags || [];
        const E = window.BOQ_ENGINE;
        let overrideFlags = [];
        if (E && scheme.boq && scheme.boq.overrides) {
          const derived = E.deriveQuickInputsFromScheme(scheme);
          const stored  = scheme.boq.quick_inputs || {};
          const labelOf = (key) => (E.LINKED_FIELDS.find(f => f.key === key) || { label: key }).label;
          const fmt     = v => v === true ? 'Yes' : v === false ? 'No' : v == null || v === '' ? '—' : String(v);
          overrideFlags = Object.keys(scheme.boq.overrides).map(k =>
            `BoQ "${labelOf(k)}" overridden — Master: ${fmt(derived[k])} · BoQ: ${fmt(stored[k])}`
          );
        }
        const zoneFlags = [];
        if (scheme.treatments && scheme.treatments.length && +scheme.area_m2 > 0) {
          const zoneTotal = scheme.treatments.reduce((s, z) => s + (+z.area_m2 || 0), 0);
          const diff = zoneTotal - (+scheme.area_m2 || 0);
          if (Math.abs(diff) > 0.5) {
            zoneFlags.push(
              `Treatment zones sum to ${zoneTotal.toLocaleString()} m² but scheme area is ${(+scheme.area_m2).toLocaleString()} m² ` +
              `(${diff > 0 ? '+' : ''}${diff.toLocaleString()} m² ${diff > 0 ? 'over' : 'under'})`
            );
          }
        }
        const flags = [...persisted, ...zoneFlags, ...overrideFlags];
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
      {tab==="treatment"&&<TreatmentTab schemeId={schemeId} />}
      {tab==="ward"&&<WardTab schemeId={schemeId} />}
      {tab==="utilities"&&<UtilitiesTab scheme={scheme} />}
      {tab==="boq"&&<BoQTab schemeId={schemeId} />}
      {tab==="pack"&&<PackTab scheme={scheme} onGenerate={onGenerate} onPreview={onPreview} onTabSwitch={setTab} />}
      {showSketch && <SketchModal pdf={scheme.sketch_pdf} road={scheme.road_name} onClose={()=>setShowSketch(false)} />}
    </>
  );
};

// ─── Treatment Tab ────────────────────────────────────────────────────────────

const TreatmentTab = ({ schemeId }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);

  // ── Factors (grouped) ────────────────────────────────────────────────────────
  const TRAFFIC_FACTORS = [
    { key:"traffic",   label:"Traffic level",       opts:[["Light",0],["Moderate",2],["Heavy",4],["Very Heavy",6]] },
    { key:"bus_stops", label:"Bus stops",            opts:[["None",0],["1–2",2],["3+",4]] },
    { key:"junctions", label:"Junctions present",    opts:[["None",0],["Minor",1],["Major",2]] },
    { key:"turning",   label:"Vehicle turning",      opts:[["None",0],["Occasional",1],["Frequent",2]] },
    { key:"parking",   label:"Parking bays",         opts:[["No",0],["Yes",1]] },
  ];
  const SURFACE_FACTORS = [
    { key:"condition", label:"Surface condition",    opts:[["Good",0],["Fair",1],["Poor",2],["Very Poor",3]] },
    { key:"cracking",  label:"Cracking",             opts:[["None",0],["Edge / linear",1],["Block",2],["Alligator",3]] },
    { key:"rutting",   label:"Rutting / deformation",opts:[["None",0],["< 5mm",1],["5–15mm",2],["> 15mm",3]] },
  ];
  const ALL_FACTORS = [...TRAFFIC_FACTORS, ...SURFACE_FACTORS];
  const MAX_SCORE = 24;

  const DEFAULT_MX = { traffic:"Moderate", bus_stops:"None", junctions:"None", turning:"None", parking:"No", condition:"Good", cracking:"None", rutting:"None" };
  const mx    = { ...DEFAULT_MX, ...(scheme.matrix || {}) };
  const setMx = (key, val) => updateScheme(schemeId, { matrix: { ...mx, [key]: val } });
  const score = ALL_FACTORS.reduce((acc, f) => { const o = f.opts.find(([l]) => l === mx[f.key]); return acc + (o ? o[1] : 0); }, 0);

  const getRec = (depthMm) => {
    const d = +depthMm || 40;
    if (score <= 3)  return { category:"Low",         material:"Micro-asphalt",           depthNote:"15–20mm overlay",                      notes:"A cold-applied emulsion-based surface treatment that restores waterproofing and surface texture. Adds no structural capacity — appropriate only where the existing pavement is structurally sound and the primary defect is surface oxidation or minor fretting." };
    if (score <= 7)  return { category:"Low",         material:"AC10 Taycoat 100/150",    depthNote:"40mm SC only",                         notes:"Thin asphalt concrete with 10mm aggregate and a soft 100/150 pen binder. The softer binder grade improves low-temperature flexibility and reduces thermal cracking risk. Limited deformation resistance — appropriate where PSV loading is low and the existing base is structurally sound." };
    if (score <= 11) return { category:"Medium",      material:"AC14 close binder 40/60", depthNote:"40mm inlay",                           notes:"Close-graded asphalt concrete with 14mm aggregate and 40/60 pen binder. The denser aggregate packing and stiffer binder provide improved rutting resistance under moderate axle loads compared to softer mixes. Suitable where the existing base is intact and surface-only intervention is appropriate." };
    if (score <= 16) return { category:"Medium-High", material:"HRA 30/14F surf 40/60",   depthNote:d>=100?"100mm deep inlay":"40mm inlay", notes:"Gap-graded Hot Rolled Asphalt with 30% coarse aggregate by mass in a high-bitumen mortar matrix. The mortar-rich structure provides excellent durability and waterproofing. Pre-coated chippings rolled into the surface deliver the required PSV and macrotexture. 40/60 pen binder gives adequate stiffness for the Scottish climate — industry standard for medium-high traffic carriageways." };
    if (score <= 20) return { category:"High",        material:"HRA 55/10F surf 40/60",   depthNote:"100mm deep inlay minimum",             notes:"High-aggregate-content HRA (55% coarse aggregate) with a stronger stone skeleton that resists permanent deformation under repeated heavy axle loading. The increased aggregate content stiffens the mix, making it suited to heavily trafficked routes and junction approaches where braking and turning forces are highest. Full-depth inlay required to address structural fatigue in the lower layers." };
    return                  { category:"High",        material:"HRA 55/10F surf 40/60",   depthNote:"100mm deep inlay minimum — consider full reconstruction", notes:"HRA 55/10F with full structural investigation recommended. The combination of heavy loading and significant surface deterioration (cracking, rutting) indicates the pavement structure is likely fatigued beyond surface-only treatment. Core samples and FWD deflection testing should be considered before finalising the design." };
  };

  const scoreColor = score <= 7 ? "var(--green)" : score <= 16 ? "var(--accent)" : "var(--red)";
  const scorePct   = Math.min(100, Math.round((score / MAX_SCORE) * 100));

  // ── Treatment zones ──────────────────────────────────────────────────────────
  const TREATMENTS = ["HRA 30/14F surf 40/60","HRA 55/10F surf 40/60","AC14 close binder 40/60","AC10 Taycoat 100/150","AC6 dense 100/150","SMA 10 surf 40/60","Micro-asphalt","Other"];
  const zones    = (scheme.treatments && scheme.treatments.length > 0) ? scheme.treatments : [{ id:1, zone:"Main carriageway", area_m2:+scheme.area_m2||0, depth_mm:+scheme.total_depth_mm||40, treatment_type:"" }];
  const setZones = (z) => {
    const zoneUpdates = {};
    for (let i = 0; i < 5; i++) {
      const p = `zone_a${i + 1}`;
      if (z[i]) {
        zoneUpdates[`${p}_description`] = z[i].zone;
        zoneUpdates[`${p}_area_m2`]     = z[i].area_m2;
        zoneUpdates[`${p}_depth_mm`]    = z[i].depth_mm;
        zoneUpdates[`${p}_treatment`]   = z[i].treatment_type;
      } else {
        zoneUpdates[`${p}_description`] = "";
        zoneUpdates[`${p}_area_m2`]     = 0;
        zoneUpdates[`${p}_depth_mm`]    = 0;
        zoneUpdates[`${p}_treatment`]   = "";
      }
    }
    updateScheme(schemeId, { treatments: z, ...zoneUpdates });
  };
  const updZone  = (id, p) => setZones(zones.map(z => z.id === id ? { ...z, ...p } : z));
  const addZone  = () => setZones([...zones, { id:Date.now(), zone:"", area_m2:0, depth_mm:40, treatment_type:"" }]);
  const rmZone   = (id) => setZones(zones.filter(z => z.id !== id));
  const applyZone = (zone) => {
    const rec = getRec(zone.depth_mm);
    const treatment = zone.treatment_type || rec.material;
    updateScheme(schemeId, { treatment_type:treatment, total_depth_mm:zone.depth_mm, traffic_category:rec.category, treatments:zones.map(z => z.id===zone.id ? {...z, treatment_type:treatment} : z) });
  };
  const totalZoneArea = zones.reduce((s, z) => s + (+z.area_m2||0), 0);
  const schemeArea    = +scheme.area_m2 || 0;
  const areaDiff      = totalZoneArea - schemeArea;

  const FactorGroup = ({ factors }) => (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"14px 20px" }}>
      {factors.map(f => (
        <div key={f.key}>
          <div style={{ fontSize:11, fontWeight:500, color:"var(--ink-2)", marginBottom:7 }}>{f.label}</div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {f.opts.map(([label]) => {
              const active = mx[f.key] === label;
              return <button key={label} onClick={() => setMx(f.key, label)} style={{ padding:"5px 11px", fontSize:12, borderRadius:"var(--radius-sm)", border: active?"1px solid var(--accent)":"1px solid var(--line)", background: active?"var(--accent-wash)":"var(--bg)", color: active?"var(--accent-ink)":"var(--ink-2)", cursor:"pointer", fontWeight: active?600:400, transition:"all 0.1s" }}>{label}</button>;
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const groupLabel = (text) => (
    <div style={{ fontSize:10, fontWeight:700, color:"var(--ink-3)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>{text}</div>
  );

  return (
    <div style={{ maxWidth:960 }}>

      {/* ── 01 Site conditions ── */}
      <div className="form-section" style={{ marginBottom:16 }}>
        <div className="section-head">
          <div className="section-title"><span className="section-num">01</span> Site conditions</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:24, alignItems:"start" }}>

          {/* Left: factor questions */}
          <div>
            {groupLabel("Traffic & Use")}
            <FactorGroup factors={TRAFFIC_FACTORS} />
            <div style={{ margin:"18px 0 10px", borderTop:"1px solid var(--line)" }} />
            {groupLabel("Surface Condition")}
            <FactorGroup factors={SURFACE_FACTORS} />
          </div>

          {/* Right: score + preview */}
          <div style={{ background:"var(--bg-sunken)", borderRadius:"var(--radius)", padding:16, display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7, fontSize:11 }}>
                <span style={{ color:"var(--ink-3)" }}>Weighted score</span>
                <span style={{ fontFamily:"var(--font-mono)", fontWeight:700, color:scoreColor }}>{score} / {MAX_SCORE}</span>
              </div>
              <div style={{ height:7, background:"var(--line)", borderRadius:4, overflow:"hidden", marginBottom:10 }}>
                <div style={{ height:"100%", width:`${scorePct}%`, background:scoreColor, borderRadius:4, transition:"width 0.35s" }} />
              </div>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {["Low","Medium","Medium-High","High"].map(cat => {
                  const active = getRec(40).category === cat;
                  return <span key={cat} className="pill" style={{ background: active?"var(--accent-wash)":"var(--bg)", color: active?"var(--accent-ink)":"var(--ink-3)", border:`1px solid ${active?"var(--accent)":"var(--line)"}`, fontSize:11 }}>{cat}</span>;
                })}
              </div>
            </div>
            <div style={{ borderTop:"1px solid var(--line)", paddingTop:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"var(--ink-3)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Suggested material</div>
              <div className="treatment-rec" style={{ margin:0 }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:3 }}>{getRec(40).material}</div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--slate)", marginBottom:6 }}>{getRec(40).depthNote}</div>
                <div style={{ fontSize:11, color:"var(--ink-2)" }}>{getRec(40).notes}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 02 Treatment zones ── */}
      <div className="form-section">
        <div className="section-head" style={{ marginBottom:14 }}>
          <div className="section-title"><span className="section-num">02</span> Treatment zones</div>
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8, fontSize:11, fontFamily:"var(--font-mono)" }}>
            <span style={{ color:"var(--ink-3)" }}>{totalZoneArea.toLocaleString()} / {schemeArea.toLocaleString()} m²</span>
            {schemeArea > 0 && (
              <span style={{ padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:600, background: Math.abs(areaDiff)<=5?"var(--green-wash)":"var(--amber-wash)", color: Math.abs(areaDiff)<=5?"var(--green)":"var(--amber)" }}>
                {areaDiff===0 ? "✓ balanced" : areaDiff>0 ? `+${areaDiff} over` : `${Math.abs(areaDiff)} m² remaining`}
              </span>
            )}
          </div>
        </div>

        {zones.map((zone, idx) => {
          const rec = getRec(zone.depth_mm);
          return (
            <div key={zone.id} style={{ border:"1px solid var(--line)", borderRadius:"var(--radius)", marginBottom:10, overflow:"hidden" }}>
              {/* Zone header */}
              <div style={{ background:"var(--bg-sunken)", padding:"8px 14px", display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid var(--line)" }}>
                <span className="section-num" style={{ fontSize:10, minWidth:26, textAlign:"center" }}>{`A${idx+1}`}</span>
                <input value={zone.zone} onChange={e => updZone(zone.id, {zone:e.target.value})} placeholder="Zone description — e.g. Main carriageway" style={{ flex:1, border:"none", background:"transparent", fontWeight:500, fontSize:13, outline:"none", color:"var(--ink)" }} />
                {zones.length > 1 && <button className="btn ghost sm" onClick={() => rmZone(zone.id)}><Icon.X /></button>}
              </div>
              {/* Zone body: two columns */}
              <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:0 }}>
                {/* Left: inputs */}
                <div style={{ padding:"14px", borderRight:"1px solid var(--line)", display:"flex", flexDirection:"column", gap:12 }}>
                  <div className="field"><label>Area (m²)</label><input type="number" className="mono" value={zone.area_m2} onChange={e => updZone(zone.id, {area_m2:+e.target.value})} /></div>
                  <div className="field"><label>Depth (mm)</label><input type="number" className="mono" value={zone.depth_mm} onChange={e => updZone(zone.id, {depth_mm:+e.target.value})} /></div>
                </div>
                {/* Right: recommendation + override + apply */}
                <div style={{ padding:"14px", display:"flex", flexDirection:"column", gap:10 }}>
                  <div className="treatment-rec" style={{ margin:0 }}>
                    <span className="label">Recommended treatment</span>
                    <div style={{ fontSize:14, fontWeight:700, marginBottom:3 }}>{rec.material}</div>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--slate)", marginBottom:5 }}>{rec.depthNote}</div>
                    <div style={{ fontSize:11, color:"var(--ink-2)", lineHeight:1.6, borderTop:"1px solid var(--accent)", paddingTop:8, marginTop:6 }}>{rec.notes}</div>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                    <select value={zone.treatment_type} onChange={e => updZone(zone.id, {treatment_type:e.target.value})} style={{ flex:1, minWidth:180 }}>
                      <option value="">— Use recommended —</option>
                      {TREATMENTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {zone.treatment_type === 'Other' && (
                      <input type="text" placeholder="Describe custom treatment"
                        value={zone.custom_description || ''}
                        onChange={e => updZone(zone.id, {custom_description:e.target.value})}
                        style={{flex:2,minWidth:200}} />
                    )}
                    <button className="btn sm primary" onClick={() => applyZone(zone)}>
                      {idx===0 ? "Accept & apply to workbook" : "Apply to workbook"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <button className="btn sm" onClick={addZone} style={{ marginTop:4 }}>
          <Icon.Plus /> Add treatment zone
        </button>
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

const FRONT_STATUS_COLORS = { design:"#3b82f6", review:"#f59e0b", ready:"#22c55e", works:"#6366f1", archived:"#9ca3af" };

const FrontSheetDoc = ({ scheme }) => {
  const docsGen = scheme.docs_generated || {};
  const statusLabels = { design:"In Design", review:"In Review", ready:"Ready to Issue", works:"On Site", archived:"Archived" };
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
        {[["Status",statusLabels[scheme.status]||scheme.status||'—'],["Treatment",scheme.treatment_type||'—'],["Area",`${(+scheme.area_m2||0).toLocaleString()} m²`],["Works Period",scheme.date_start&&scheme.date_finish?`${scheme.date_start} → ${scheme.date_finish}`:scheme.date_start||'—']].map(([l,v])=>(
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

// ─── Doc Preview (thumbnail per document type) ────────────────────────────────

const DocPreview = ({ docKey, scheme }) => {
  if(docKey==="front") return (
    <div>
      <div style={{background:'#1a3a5c',color:'white',fontSize:4,padding:'2px 3px',fontWeight:700,marginBottom:2}}>DUNDEE CITY COUNCIL · RMP</div>
      <div style={{fontWeight:700,fontSize:6,margin:'3px 0'}}>{scheme.road_name}</div>
      <div style={{fontSize:4,color:'#666',marginBottom:3}}>Project {scheme.project_number} · {scheme.financial_year}</div>
      <div style={{height:12,background:'#3b82f6',margin:'3px 0',borderRadius:1,display:'flex',alignItems:'center',paddingLeft:3}}>
        <span style={{fontSize:3,color:'white',fontWeight:700}}>{(STATUS_LABELS[scheme.status]||scheme.status||'').toUpperCase()}</span>
      </div>
      <div style={{fontSize:4,marginTop:3}}>Area: {(+scheme.area_m2||0).toLocaleString()} m²<br/>{scheme.date_start} → {scheme.date_finish}</div>
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
      const c=E.buildBoQLines(scheme.boq,scheme);
      breakdown=c.groups.map(g=>({l:`Series ${g.num}`,v:E.fmtGBP(g.subtotal)}));
      if(c.totalIncVat) breakdown.push({l:'Total inc VAT',v:E.fmtGBP(c.totalIncVat),bold:true});
    }
    if(!breakdown.length) breakdown=[{l:'(not generated yet)',v:'—'}];
    return <div><div style={{fontWeight:700,fontSize:6}}>BILL OF QUANTITIES</div><div style={{fontSize:4,marginBottom:3}}>{scheme.road_name} · {scheme.project_number}</div>{breakdown.map((b,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:4,borderBottom:"1px solid #eee",padding:"1px 0",fontWeight:b.bold?700:400}}><span>{b.l}</span><span>{b.v}</span></div>)}</div>;
  }
  return <div style={{color:"#aaa",fontSize:5,textAlign:"center",paddingTop:20}}>[{docKey.toUpperCase()}]<br/>Manual upload required</div>;
};

// ─── Pack Tab ─────────────────────────────────────────────────────────────────

const PackTab = ({ scheme, onGenerate, onPreview, onTabSwitch }) => {
  const { updateScheme } = React.useContext(window.SchemeContext);
  const docsGen = scheme.docs_generated || {};
  const packReady = window.PACK_DOCS.filter(d => docsGen[d.key]).length;
  const packTotal = window.PACK_DOCS.length;
  const [generatingFront, setGeneratingFront] = React.useState(false);

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
              <div className="doc-status">
                <span className={"pill "+(done?"ready":"review")}>{done?"ready":"pending"}</span>
                {isWorking ? (
                  <button className="btn sm ghost" style={{marginLeft:"auto"}} disabled={isGenerating}
                    onClick={() => handleWorkingClick(d)}>
                    {workingLabel(d)} {!isGenerating && <Icon.Arrow />}
                  </button>
                ) : (
                  <label style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,fontSize:11,cursor:"pointer",userSelect:"none",color:"var(--ink-3)"}}>
                    <input type="checkbox" checked={done} onChange={()=>toggleManual(d.key)} style={{width:"auto"}} />
                    Received
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{marginTop:20,padding:"14px 18px",background:"var(--bg-elev)",border:"1px solid var(--line)",borderRadius:"var(--radius-sm)",fontSize:12,color:"var(--ink-2)"}}>
        <strong>Connected templates:</strong> Front Sheet, RSR, PCI / CPP, and Resident Letter are live — click the action button to download and mark as ready. Manual docs (drawings, TM, utilities) can be marked received via the checkbox.
      </div>
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
