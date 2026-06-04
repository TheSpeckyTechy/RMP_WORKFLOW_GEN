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
          ["Area",window.schemeArea(scheme).toLocaleString()+" m²"],["Treatment",window.schemeTreatment(scheme)||"—"],
          ["Ward",scheme.ward||"—"],["TM type",window.schemeTM(scheme).type||"—"]].map(([label,val])=>(
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
  const { getScheme, updateScheme, deleteScheme, provisionSchemeFolder, backendMode } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);
  const [tab, setTab] = React.useState("workbook");
  const [showSketch, setShowSketch] = React.useState(false);
  const isMobile = window.useIsMobile ? window.useIsMobile() : React.useMemo(()=>window.innerWidth<=768,[]);
  const [mobileExpanded, setMobileExpanded] = React.useState(false);
  const workbookFieldCount = window.WORKBOOK_SCHEMA.flatMap(s=>s.fields).filter(f=>f.type!=="subheader"&&f.type!=="zone-label").length;
  const tabs = [
    { k:"workbook", l:"Master Workbook", badge: String(workbookFieldCount) },
    { k:"treatment", l:"Designer" },
    ...(scheme.scheme_type === 'Surface Dressing' ? [{ k:"sd_design", l:"SD Design" }] : []),
    { k:"ward", l:"Ward & Copies" },
    { k:"location", l:"Location" },
    { k:"utilities", l:"Utilities", badge: String(window.UTILITIES.length) },
    { k:"boq", l:"Bill of Quantities" },
    { k:"letters", l:"Letters", badge: String((scheme.recipients||[]).length) },
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
            {window.schemeTreatment(scheme) && <><span>·</span><span>{window.schemeTreatment(scheme)}</span></>}
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
        <div className="scheme-actions" style={{display:"flex",gap:8}}>
          {scheme.sketch_pdf && <button className="btn ghost" onClick={()=>setShowSketch(true)} title="View pre-design sketch">📄 View sketch</button>}
          {backendMode === 'fs' && (
            <button className="btn ghost" title={`Create project folder: ${window.schemeFolderName ? window.schemeFolderName(scheme) : ''}`}
              onClick={async () => {
                const { error, folderName } = await provisionSchemeFolder(schemeId);
                if (error) {
                  window.Toast?.show({ kind:'error', msg: `Folder creation failed: ${error.message}` });
                } else {
                  window.Toast?.show({ kind:'success', msg: `Folder created: ${folderName}` });
                }
              }}>
              📁 Create folder
            </button>
          )}
          <button className="btn" onClick={()=>{ if(tab==="workbook"&&window.__workbookExport){ window.__workbookExport(); } else { setTab("workbook"); } }}><Icon.Download /> Export workbook</button>
          <button className="btn accent" onClick={()=>onGenerate(scheme)}><Icon.Wand /> Generate pack <span className="kbd">⌘G</span></button>
          {onDuplicate && <button className="btn ghost sm" title="Duplicate scheme" aria-label="Duplicate scheme" onClick={()=>onDuplicate(scheme)}><Icon.Copy /></button>}
          <button className="btn ghost sm" title="Delete scheme" aria-label="Delete scheme" style={{color:"var(--red)"}} onClick={async()=>{
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
        // Drift between Master Workbook area and the Designer's zone
        // totals. Previously this only fired when BOTH sides were
        // non-zero, which missed the case where the Designer has zones
        // adding up to 1,500 m² but the Master area is still 0 — the
        // BoQ silently prices off the zone path while the user sees a
        // 0 m² header. Fire whenever either side has a real value.
        const zoneTotal = zones.reduce((s, z) => s + (+z.area_m2 || 0), 0);
        const masterArea = window.schemeArea(scheme);
        const eitherNonZero = zoneTotal > 0.5 || masterArea > 0.5;
        // Reusable "snap Master to zone-total" action for the drift
        // warnings. The Designer's zones are usually the source of
        // truth (drawn from real measurements); the Master area is the
        // summary that needs to follow. Keeps this one-click instead
        // of forcing the user to navigate to the Workbook.
        const syncAction = (target) => ({
          label: `Sync Master to ${target.toLocaleString()} m²`,
          onClick: () => updateScheme(schemeId, { carriageway_area_m2: target }),
        });
        if (eitherNonZero) {
          if (masterArea < 0.5 && zoneTotal > 0.5) {
            zoneFlags.push({
              msg: `Master Workbook area is 0 m² but Designer zones sum to ${zoneTotal.toLocaleString()} m² — ` +
                   `set Carriageway Area in the Workbook so the figures match.`,
              action: syncAction(zoneTotal),
            });
          } else if (zoneTotal < 0.5 && masterArea > 0.5 && zones.length === 0) {
            // Don't fire when there simply aren't any zones yet — that's
            // the normal pre-design state, not a drift.
          } else {
            const diff = zoneTotal - masterArea;
            if (Math.abs(diff) > 0.5) {
              zoneFlags.push({
                msg: `Treatment zones sum to ${zoneTotal.toLocaleString()} m² but scheme area is ${masterArea.toLocaleString()} m² ` +
                     `(${diff > 0 ? '+' : ''}${diff.toLocaleString()} m² ${diff > 0 ? 'over' : 'under'})`,
                action: syncAction(zoneTotal),
              });
            }
          }
        }
        // Date sanity: finish before start. The BoQ engine silently
        // clamps the working-day count to Math.max(1, days) so a
        // backwards date range looks like a 1-day scheme without any
        // visible warning. Parse the DD/MM/YYYY strings the app uses
        // and surface a flag if the order is wrong.
        const parseDdMmYyyy = (txt) => {
          const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(txt || '').trim());
          if (!m) return null;
          return new Date(+m[3], +m[2] - 1, +m[1]);
        };
        const ds = parseDdMmYyyy(scheme.date_start);
        const df = parseDdMmYyyy(scheme.date_finish);
        if (ds && df && df.getTime() < ds.getTime()) {
          zoneFlags.push({
            msg: `Finish date (${scheme.date_finish}) is before start date (${scheme.date_start}) — ` +
                 `BoQ working-day count will fall back to 1 day until the order is corrected.`,
          });
        }
        // Persisted scheme.flags are plain strings; normalise to the
        // structured shape so the render loop can treat them uniformly.
        const persistedFlags = persisted.map(f => typeof f === 'string' ? { msg: f } : f);
        const flags = [...persistedFlags, ...zoneFlags];
        if (!flags.length) return null;
        return (
          <div style={{background:"var(--amber-wash)",border:"1px solid var(--amber)",padding:"10px 14px",borderRadius:"var(--radius-sm)",marginBottom:20,display:"flex",gap:10,alignItems:"flex-start",fontSize:13}}>
            <span style={{color:"var(--amber)",paddingTop:2}}><Icon.Alert /></span>
            <div style={{flex:1,minWidth:0}}>
              <strong>Inconsistencies detected</strong>
              <ul style={{margin:"4px 0 0",paddingLeft:16}}>
                {flags.map((f,i) => (
                  <li key={i} style={{color:"var(--ink-2)",marginBottom:f.action?6:0}}>
                    {f.msg}
                    {f.action && (
                      <button className="btn sm" style={{marginLeft:8,verticalAlign:"middle"}} onClick={f.action.onClick}>
                        {f.action.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })()}
      <div className="tabs">
        {tabs.map(t=><div key={t.k} className={"tab "+(tab===t.k?"active":"")} onClick={()=>setTab(t.k)}>{t.l}{t.badge&&<span className="badge">{t.badge}</span>}</div>)}
      </div>
      <div key={tab} className="tab-panel">
        {tab==="workbook"&&<MasterWorkbook schemeId={schemeId} />}
        {tab==="treatment"&&<window.TreatmentDesigner schemeId={schemeId} />}
        {tab==="sd_design"&&<window.SurfaceDressingDesigner schemeId={schemeId} />}
        {tab==="ward"&&<WardTab schemeId={schemeId} />}
        {tab==="location"&&<LocationTab schemeId={schemeId} />}
        {tab==="utilities"&&<UtilitiesTab scheme={scheme} />}
        {tab==="boq"&&<BoQTab schemeId={schemeId} onOpenDesigner={()=>setTab("treatment")} />}
        {tab==="letters"&&<LettersTab scheme={scheme} onPreview={onPreview} />}
        {tab==="pack"&&<PackTab scheme={scheme} onGenerate={onGenerate} onPreview={onPreview} onTabSwitch={setTab} />}
      </div>
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

// ─── Location Tab ─────────────────────────────────────────────────────────────
// Map pin per scheme. Leaflet + CARTO Positron tiles are fetched the first
// time this tab opens, never on the initial app load — see loadLeaflet().
// Coordinates persist as scheme.lat / scheme.lng via updateScheme.

const DUNDEE_CENTRE = [56.462, -2.971];
const LEAFLET_VERSION = "1.9.4";

// Parse an OSGB grid reference into (easting, northing) in metres.
// Accepts: "NO 40708 30644", "NO4070830644", "N04070830644" (0 typed for O),
// and raw "340708 730644" easting-northing pairs.
const parseGridRef = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.toUpperCase().replace(/\s+/g, "");

  // Raw easting+northing: 10–14 digits, split in half. Accept 5+5 or 6+6.
  if (/^\d{10,14}$/.test(s) && s.length % 2 === 0) {
    const half = s.length / 2;
    const E = parseInt(s.slice(0, half), 10);
    const N = parseInt(s.slice(half), 10);
    if (E >= 0 && E <= 700000 && N >= 0 && N <= 1300000) return { E, N };
    return null;
  }

  // Letter-prefixed: 2 letters then even number of digits. Treat a leading
  // "letter+0" as "letter+O" since users frequently type 0 for the O in NO/SO.
  let m = s.match(/^([A-HJ-Z])([A-HJ-Z]|0)(\d+)$/);
  if (!m) return null;
  const l1ch = m[1];
  const l2ch = m[2] === "0" ? "O" : m[2];
  const digits = m[3];
  if (digits.length % 2 !== 0 || digits.length < 2 || digits.length > 10) return null;

  let l1 = l1ch.charCodeAt(0) - 65;
  let l2 = l2ch.charCodeAt(0) - 65;
  if (l1 > 7) l1--;
  if (l2 > 7) l2--;
  const e100km = ((l1 - 2) % 5 + 5) % 5 * 5 + (l2 % 5);
  const n100km = (19 - Math.floor(l1 / 5) * 5) - Math.floor(l2 / 5);
  if (e100km < 0 || e100km > 6 || n100km < 0 || n100km > 12) return null;

  const half = digits.length / 2;
  const ePart = digits.slice(0, half).padEnd(5, "0").slice(0, 5);
  const nPart = digits.slice(half).padEnd(5, "0").slice(0, 5);
  const E = e100km * 100000 + parseInt(ePart, 10);
  const N = n100km * 100000 + parseInt(nPart, 10);
  return { E, N };
};

// OSGB36 easting/northing → WGS84 lat/lng. Inverse Transverse Mercator on the
// Airy 1830 ellipsoid, then a Helmert transformation onto WGS84. Accurate to
// ~5 m, which is well below the resolution of a 10-figure grid reference.
const osgbToWgs84 = (E, N) => {
  const a = 6377563.396, b = 6356256.909;
  const F0 = 0.9996012717;
  const lat0 = 49 * Math.PI / 180;
  const lon0 = -2 * Math.PI / 180;
  const N0 = -100000, E0 = 400000;
  const e2 = 1 - (b * b) / (a * a);
  const nP = (a - b) / (a + b), n2 = nP * nP, n3 = nP * nP * nP;

  let lat = lat0, M = 0;
  for (let i = 0; i < 20; i++) {
    lat = (N - N0 - M) / (a * F0) + lat;
    const Ma = (1 + nP + 5 / 4 * n2 + 5 / 4 * n3) * (lat - lat0);
    const Mb = (3 * nP + 3 * nP * nP + 21 / 8 * n3) * Math.sin(lat - lat0) * Math.cos(lat + lat0);
    const Mc = (15 / 8 * n2 + 15 / 8 * n3) * Math.sin(2 * (lat - lat0)) * Math.cos(2 * (lat + lat0));
    const Md = 35 / 24 * n3 * Math.sin(3 * (lat - lat0)) * Math.cos(3 * (lat + lat0));
    M = b * F0 * (Ma - Mb + Mc - Md);
    if (Math.abs(N - N0 - M) < 1e-5) break;
  }

  const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
  const nu = a * F0 / Math.sqrt(1 - e2 * sinLat * sinLat);
  const rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sinLat * sinLat, 1.5);
  const eta2 = nu / rho - 1;
  const tanLat = Math.tan(lat);
  const t2 = tanLat * tanLat, t4 = t2 * t2, t6 = t4 * t2;
  const secLat = 1 / cosLat;
  const nu3 = nu * nu * nu, nu5 = nu3 * nu * nu, nu7 = nu5 * nu * nu;
  const VII = tanLat / (2 * rho * nu);
  const VIII = tanLat / (24 * rho * nu3) * (5 + 3 * t2 + eta2 - 9 * t2 * eta2);
  const IX = tanLat / (720 * rho * nu5) * (61 + 90 * t2 + 45 * t4);
  const X = secLat / nu;
  const XI = secLat / (6 * nu3) * (nu / rho + 2 * t2);
  const XII = secLat / (120 * nu5) * (5 + 28 * t2 + 24 * t4);
  const XIIA = secLat / (5040 * nu7) * (61 + 662 * t2 + 1320 * t4 + 720 * t6);

  const dE = E - E0;
  const phi = lat - VII * dE * dE + VIII * Math.pow(dE, 4) - IX * Math.pow(dE, 6);
  const lam = lon0 + X * dE - XI * Math.pow(dE, 3) + XII * Math.pow(dE, 5) - XIIA * Math.pow(dE, 7);

  // Cartesian on Airy 1830
  const sp = Math.sin(phi), cp = Math.cos(phi);
  const sl = Math.sin(lam), cl = Math.cos(lam);
  const nuA = a / Math.sqrt(1 - e2 * sp * sp);
  const x = nuA * cp * cl;
  const y = nuA * cp * sl;
  const z = (1 - e2) * nuA * sp;

  // Helmert OSGB36 → WGS84 (OS published parameters, signs per Chris Veness)
  const tx = 446.448, ty = -125.157, tz = 542.060;
  const s1 = 20.4894e-6 + 1;
  const rx = (0.1502 / 3600) * Math.PI / 180;
  const ry = (0.2470 / 3600) * Math.PI / 180;
  const rz = (0.8421 / 3600) * Math.PI / 180;
  const x2 = tx + s1 * x - rz * y + ry * z;
  const y2 = ty + rz * x + s1 * y - rx * z;
  const z2 = tz - ry * x + rx * y + s1 * z;

  // Cartesian → lat/lng on WGS84
  const aW = 6378137, bW = 6356752.314245;
  const e2W = 1 - (bW * bW) / (aW * aW);
  const p = Math.sqrt(x2 * x2 + y2 * y2);
  let phi2 = Math.atan2(z2, p * (1 - e2W));
  for (let i = 0; i < 10; i++) {
    const sp2 = Math.sin(phi2);
    const nuW = aW / Math.sqrt(1 - e2W * sp2 * sp2);
    const newPhi = Math.atan2(z2 + e2W * nuW * sp2, p);
    if (Math.abs(newPhi - phi2) < 1e-12) { phi2 = newPhi; break; }
    phi2 = newPhi;
  }
  const lam2 = Math.atan2(y2, x2);
  return { lat: phi2 * 180 / Math.PI, lng: lam2 * 180 / Math.PI };
};

const gridRefToLatLng = (raw) => {
  const en = parseGridRef(raw);
  if (!en) return null;
  const { lat, lng } = osgbToWgs84(en.E, en.N);
  return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
};

// WGS84 lat/lng → OSGB36 easting/northing. Inverse of osgbToWgs84: cartesian,
// inverse Helmert, then forward Transverse Mercator on Airy 1830.
const wgs84ToOsgb = (latDeg, lngDeg) => {
  const lat = latDeg * Math.PI / 180;
  const lng = lngDeg * Math.PI / 180;
  const aW = 6378137, bW = 6356752.314245;
  const e2W = 1 - (bW * bW) / (aW * aW);
  const sp = Math.sin(lat), cp = Math.cos(lat);
  const sl = Math.sin(lng), cl = Math.cos(lng);
  const nuW = aW / Math.sqrt(1 - e2W * sp * sp);
  const x = nuW * cp * cl;
  const y = nuW * cp * sl;
  const z = (1 - e2W) * nuW * sp;

  // Helmert WGS84 → OSGB36 (parameters negated from the reverse direction)
  const tx = -446.448, ty = 125.157, tz = -542.060;
  const s1 = -20.4894e-6 + 1;
  const rx = (-0.1502 / 3600) * Math.PI / 180;
  const ry = (-0.2470 / 3600) * Math.PI / 180;
  const rz = (-0.8421 / 3600) * Math.PI / 180;
  const x2 = tx + s1 * x - rz * y + ry * z;
  const y2 = ty + rz * x + s1 * y - rx * z;
  const z2 = tz - ry * x + rx * y + s1 * z;

  const a = 6377563.396, b = 6356256.909;
  const e2 = 1 - (b * b) / (a * a);
  const p = Math.sqrt(x2 * x2 + y2 * y2);
  let phi = Math.atan2(z2, p * (1 - e2));
  for (let i = 0; i < 10; i++) {
    const sphi = Math.sin(phi);
    const nuA = a / Math.sqrt(1 - e2 * sphi * sphi);
    const newPhi = Math.atan2(z2 + e2 * nuA * sphi, p);
    if (Math.abs(newPhi - phi) < 1e-12) { phi = newPhi; break; }
    phi = newPhi;
  }
  const lam = Math.atan2(y2, x2);

  // Forward Transverse Mercator on Airy 1830 → National Grid easting/northing
  const F0 = 0.9996012717;
  const lat0 = 49 * Math.PI / 180;
  const lon0 = -2 * Math.PI / 180;
  const N0 = -100000, E0 = 400000;
  const nP = (a - b) / (a + b), n2 = nP * nP, n3 = nP * nP * nP;

  const sinLat = Math.sin(phi), cosLat = Math.cos(phi);
  const nu = a * F0 / Math.sqrt(1 - e2 * sinLat * sinLat);
  const rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sinLat * sinLat, 1.5);
  const eta2 = nu / rho - 1;
  const tanLat = Math.tan(phi);
  const t2 = tanLat * tanLat, t4 = t2 * t2;
  const cos3 = cosLat * cosLat * cosLat, cos5 = cos3 * cosLat * cosLat;

  const Ma = (1 + nP + 5 / 4 * n2 + 5 / 4 * n3) * (phi - lat0);
  const Mb = (3 * nP + 3 * nP * nP + 21 / 8 * n3) * Math.sin(phi - lat0) * Math.cos(phi + lat0);
  const Mc = (15 / 8 * n2 + 15 / 8 * n3) * Math.sin(2 * (phi - lat0)) * Math.cos(2 * (phi + lat0));
  const Md = 35 / 24 * n3 * Math.sin(3 * (phi - lat0)) * Math.cos(3 * (phi + lat0));
  const M = b * F0 * (Ma - Mb + Mc - Md);

  const I = M + N0;
  const II = nu / 2 * sinLat * cosLat;
  const III = nu / 24 * sinLat * cos3 * (5 - t2 + 9 * eta2);
  const IIIA = nu / 720 * sinLat * cos5 * (61 - 58 * t2 + t4);
  const IV = nu * cosLat;
  const V = nu / 6 * cos3 * (nu / rho - t2);
  const VI = nu / 120 * cos5 * (5 - 18 * t2 + t4 + 14 * eta2 - 58 * t2 * eta2);

  const dLon = lam - lon0;
  const dLon2 = dLon * dLon;
  const N = I + II * dLon2 + III * Math.pow(dLon, 4) + IIIA * Math.pow(dLon, 6);
  const E = E0 + IV * dLon + V * dLon * dLon2 + VI * Math.pow(dLon, 5);
  return { E, N };
};

// Format OSGB easting/northing as a 10-figure letter-prefixed grid reference
// like "NO 40708 30644". Returns null for locations outside the British grid.
const formatGridRef = (E, N) => {
  const e100km = Math.floor(E / 100000);
  const n100km = Math.floor(N / 100000);
  if (e100km < 0 || e100km > 6 || n100km < 0 || n100km > 12) return null;
  let l1 = (19 - n100km) - (19 - n100km) % 5 + Math.floor((e100km + 10) / 5);
  let l2 = ((19 - n100km) * 5) % 25 + e100km % 5;
  if (l1 > 7) l1++;
  if (l2 > 7) l2++;
  const letters = String.fromCharCode(l1 + 65) + String.fromCharCode(l2 + 65);
  const eStr = Math.round(E % 100000).toString().padStart(5, "0");
  const nStr = Math.round(N % 100000).toString().padStart(5, "0");
  return `${letters} ${eStr} ${nStr}`;
};

const latLngToGridRef = (lat, lng) => {
  const { E, N } = wgs84ToOsgb(lat, lng);
  return formatGridRef(E, N);
};

let leafletPromise = null;
const loadLeaflet = () => {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
    js.onload = () => resolve(window.L);
    js.onerror = () => { leafletPromise = null; reject(new Error("Failed to load Leaflet")); };
    document.head.appendChild(js);
  });
  return leafletPromise;
};

const LocationTab = ({ schemeId }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const markerRef = React.useRef(null);
  const [status, setStatus] = React.useState("loading");

  const hasPin = scheme.lat != null && scheme.lng != null;
  const gridLatLng = React.useMemo(() => gridRefToLatLng(scheme.grid_ref), [scheme.grid_ref]);

  React.useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current) return;

      const initialPin = hasPin ? { lat: scheme.lat, lng: scheme.lng } : gridLatLng;
      const start = initialPin ? [initialPin.lat, initialPin.lng] : DUNDEE_CENTRE;
      const map = L.map(containerRef.current, { zoomControl: true }).setView(start, initialPin ? 17 : 13);
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
      }).addTo(map);

      const icon = L.icon({
        iconUrl:       `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/images/marker-icon.png`,
        iconRetinaUrl: `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/images/marker-icon-2x.png`,
        shadowUrl:     `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/images/marker-shadow.png`,
        iconSize:    [25, 41],
        iconAnchor:  [12, 41],
        popupAnchor: [1, -34],
        shadowSize:  [41, 41],
      });

      const saveFromMarker = (lat, lng) => {
        const round = (v) => +v.toFixed(6);
        const gridRef = latLngToGridRef(lat, lng);
        const updates = { lat: round(lat), lng: round(lng) };
        if (gridRef) updates.grid_ref = gridRef;
        updateScheme(schemeId, updates);
      };

      const placeMarker = (latlng) => {
        if (markerRef.current) {
          markerRef.current.setLatLng(latlng);
        } else {
          const m = L.marker(latlng, { icon, draggable: true }).addTo(map);
          m.on("dragend", () => {
            const p = m.getLatLng();
            saveFromMarker(p.lat, p.lng);
          });
          markerRef.current = m;
        }
      };

      const pinNeverSet = scheme.lat === undefined && scheme.lng === undefined;
      if (hasPin) {
        placeMarker([scheme.lat, scheme.lng]);
      } else if (gridLatLng && pinNeverSet) {
        placeMarker([gridLatLng.lat, gridLatLng.lng]);
        updateScheme(schemeId, { lat: gridLatLng.lat, lng: gridLatLng.lng });
      }

      map.on("click", (e) => {
        placeMarker(e.latlng);
        saveFromMarker(e.latlng.lat, e.latlng.lng);
      });

      setStatus("ready");
    }).catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
    };
  }, [schemeId]);

  const clearPin = () => {
    if (markerRef.current && mapRef.current) {
      mapRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
      mapRef.current.setView(DUNDEE_CENTRE, 13);
    }
    updateScheme(schemeId, { lat: null, lng: null });
  };

  return (
    <div className="form-section">
      <div className="section-head">
        <div className="section-title"><span className="section-num">L</span> Scheme location</div>
        <span className="mono" style={{fontSize:11,color:"var(--ink-3)"}}>
          {hasPin ? (scheme.grid_ref || `${scheme.lat.toFixed(5)}, ${scheme.lng.toFixed(5)}`) : "No pin set"}
        </span>
      </div>
      <p style={{fontSize:12,color:"var(--ink-3)",margin:"0 0 12px"}}>
        Click anywhere on the map to drop a pin, or drag the pin to fine-tune — the Master Workbook's Grid Reference field stays in sync automatically. If a Grid Reference is already set on this scheme, the pin appears there the first time you open this tab.
      </p>
      <div style={{position:"relative",borderRadius:8,overflow:"hidden",border:"1px solid var(--line)"}}>
        <div ref={containerRef} style={{height:480,width:"100%",background:"#eef1f4"}} />
        {status === "loading" && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.6)",fontSize:12,color:"var(--ink-3)"}}>
            Loading map…
          </div>
        )}
        {status === "error" && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.9)",fontSize:12,color:"var(--red)"}}>
            Map failed to load. Check your connection and try again.
          </div>
        )}
      </div>
      <div style={{display:"flex",gap:8,marginTop:12,alignItems:"center",flexWrap:"wrap"}}>
        {gridLatLng && (
          <button
            className="btn ghost sm"
            title={`Plot pin from grid reference ${scheme.grid_ref}`}
            onClick={() => {
              if (!mapRef.current || !window.L) return;
              const L = window.L;
              const ll = [gridLatLng.lat, gridLatLng.lng];
              if (markerRef.current) {
                markerRef.current.setLatLng(ll);
              } else {
                const icon = L.icon({
                  iconUrl:       `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/images/marker-icon.png`,
                  iconRetinaUrl: `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/images/marker-icon-2x.png`,
                  shadowUrl:     `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/images/marker-shadow.png`,
                  iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34], shadowSize:[41,41],
                });
                const m = L.marker(ll, { icon, draggable: true }).addTo(mapRef.current);
                m.on("dragend", () => {
                  const p = m.getLatLng();
                  const gridRef = latLngToGridRef(p.lat, p.lng);
                  const updates = { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) };
                  if (gridRef) updates.grid_ref = gridRef;
                  updateScheme(schemeId, updates);
                });
                markerRef.current = m;
              }
              mapRef.current.setView(ll, 17);
              updateScheme(schemeId, { lat: gridLatLng.lat, lng: gridLatLng.lng });
            }}
          >Use grid reference</button>
        )}
        <button className="btn ghost sm" onClick={clearPin} disabled={!hasPin}>Clear pin</button>
        {scheme.grid_ref && !gridLatLng && (
          <span style={{fontSize:11,color:"var(--ink-3)"}}>Grid reference "{scheme.grid_ref}" couldn't be parsed.</span>
        )}
      </div>
    </div>
  );
};

// ─── Utilities Tab ────────────────────────────────────────────────────────────

const UtilitiesTab = ({ scheme }) => {
  const { updateScheme } = React.useContext(window.SchemeContext);
  const today = new Date().toISOString().slice(0,10);
  const addMonths = (dateStr, n) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    // Clamp to the last day of the target month so e.g. Aug 31 + 3 = Nov 30, not Dec 1.
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return d.toISOString().slice(0, 10);
  };
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

const FrontSheetDoc = ({ scheme, contents }) => {
  const docsGen = scheme.docs_generated || {};
  const statusLabels = { design:"In Design", review:"In Review", ready:"Ready to Issue", works:"On Site", archived:"Archived", constructed:"Constructed" };
  const statusColor = FRONT_STATUS_COLORS[scheme.status] || "#6b7280";
  // Pack compile passes the contents listing — { name, page, pageCount }
  // entries — when it knows the real per-section page numbers. Standalone
  // previews (Pack tab card) render without contents and still see the
  // checklist fallback below.
  const hasContents = Array.isArray(contents) && contents.length > 0;
  // BoQ total — computed from the live engine on every render so the
  // figure on the front cover always matches the BoQ tab. Wrapped in a
  // try/catch because the front sheet renders during pack compile, and
  // any engine hiccup shouldn't take the cover page down.
  const boqTotal = (() => {
    try {
      const E = window.BOQ_ENGINE;
      if (!E) return 0;
      const boq = scheme.boq || (window.defaultBoq ? window.defaultBoq() : { quick_inputs: {}, custom_lines: [], settings: {}, overrides: {} });
      const effective = E.effectiveQuickInputs(scheme, boq);
      const autoLines = E.regenAutoLines(effective);
      const userLines = (boq.custom_lines || []).filter(l => !l.auto);
      const merged    = { ...boq, quick_inputs: effective, custom_lines: [...autoLines, ...userLines] };
      return +E.buildBoQLines(merged, scheme).totalIncVat || 0;
    } catch { return 0; }
  })();
  const teamRows = [
    ["Designer",      scheme.prepared_by],
    ["Reviewer",      scheme.reviewer_name],
    ["Approver",      scheme.approver_name],
    ["Client Officer",scheme.client_officer],
    ["Contractor",    scheme.contractor],
  ];
  const summaryRows = [
    ["Treatment",        window.schemeTreatment(scheme)],
    ["Scheme Type",      scheme.scheme_type],
    ["BoQ Total",        boqTotal > 0 ? (window.BOQ_ENGINE?.fmtGBP || (n=>'£'+n))(boqTotal) : null],
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
        {[["Status",statusLabels[scheme.status]||scheme.status||'—'],["Treatment",window.schemeTreatment(scheme)||'—'],["Area",`${window.schemeArea(scheme).toLocaleString()} m²`],["Works Period",scheme.date_start&&scheme.date_finish?`${scheme.date_start} → ${scheme.date_finish}`:scheme.date_start||'—']].map(([l,v])=>(
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
              <div style={{fontFamily:l==='BoQ Total'?'monospace':'inherit',fontWeight:v?500:400,color:v?'#111':'#bbb'}}>{v||'—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Contents — checklist-style grid with page ranges (pack compile)
          or generated-doc state (standalone preview). The compile path
          passes a `contents` array including a present:true/false flag
          and exact page numbers; standalone falls back to docs_generated. */}
      {hasContents ? (
        <div style={{padding:'0 40px 28px'}}>
          <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'#888',paddingBottom:6,borderBottom:'2px solid #1a3a5c',marginBottom:12}}>Contents</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
            {contents.map(c => {
              const range = !c.present ? '—'
                          : c.pageCount <= 1 ? `p. ${c.page}`
                          : `pp. ${c.page}–${c.page + c.pageCount - 1}`;
              return (
                <div key={c.key} style={{display:'flex',alignItems:'center',gap:8,fontSize:11,padding:'8px 12px',background:c.present?'#f0fdf4':'#f9fafb',borderRadius:5,border:`1px solid ${c.present?'#86efac':'#e5e7eb'}`}}>
                  <span style={{width:16,height:16,borderRadius:'50%',background:c.present?'#22c55e':'#d1d5db',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>{c.present?'✓':'○'}</span>
                  <span style={{flex:1,fontWeight:c.present?600:400,color:c.present?'#166534':'#9ca3af',lineHeight:1.2}}>{c.name}</span>
                  <span style={{fontFamily:'monospace',fontSize:10,color:c.present?'#166534':'#bbb',whiteSpace:'nowrap'}}>{range}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
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
      )}

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
  const root = ReactDOM.createRoot(container);
  try {
    root.render(React.createElement(FrontSheetDoc, { scheme }));
    await new Promise(r => setTimeout(r, 500));
    const filename = `Front_Sheet_${scheme.project_number}_${(scheme.road_name||'').replace(/\s+/g,'_')}.pdf`;
    const saved = window.fsSaveToProjectFolder
      ? await window.htmlToPdfBuffer(container.firstChild || container).then(buf =>
          window.fsSaveToProjectFolder(scheme, ['Project Admin'], filename, buf, { versioned: true }))
      : false;
    if (!saved) await window.htmlToPdf(container.firstChild || container, filename);
    else if (window.Toast) window.Toast.show({ kind: 'success', msg: `Front Sheet saved to ${window.schemeFolderName(scheme)}/Project Admin/`, duration: 4000 });
    window.dispatchEvent(new CustomEvent('rmp-download', {
      detail: { label: 'Front Sheet — ' + (scheme.road_name || 'scheme'), ref: scheme.project_number || '', fn: '__downloadFrontPdf', schemeId: scheme.id },
    }));
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

// Expose at file scope so GenerateModal can use it without PackTab being mounted.
window.__downloadFrontPdf = downloadFrontPdf;

window.__getFrontPdfBuffer = async (scheme, opts) => {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:white;';
  document.body.appendChild(container);
  const root = ReactDOM.createRoot(container);
  try {
    root.render(React.createElement(FrontSheetDoc, { scheme, contents: opts?.contents }));
    await new Promise(r => setTimeout(r, 500));
    return await window.htmlToPdfBuffer(container.firstChild || container);
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
};

window.FrontSheetDoc = FrontSheetDoc;

// ─── Drawing Processor integration ────────────────────────────────────────────
const sketchKey = (scheme) =>
  (scheme.road_name || '').split(/\s[—–-]\s/)[0].trim()
    .replace(/[^a-zA-Z0-9 ]/g, '').replace(/ +/g, '_');

const openDrawingProcessor = (scheme) => {
  const designer = (window.DESIGNERS || []).find(d => d.id === scheme.assigned_designer_id);
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = pad(today.getDate()) + '/' + pad(today.getMonth() + 1) + '/' + String(today.getFullYear()).slice(2);
  const params = new URLSearchParams({
    sketch: sketchKey(scheme),
    title: (scheme.road_name || '') + ' Resurfacing',
    ref:   scheme.project_number || '',
    drawn: designer?.initials || 'JMCA',
    date:  dateStr,
  });
  window.open('https://thespeckytechy.github.io/Quick-Designer-CW-FWs/?' + params, '_blank');
};

// ─── Pack file upload helpers ─────────────────────────────────────────────────

const readPDFasDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload  = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Failed to read file'));
  reader.readAsDataURL(file);
});

const PackFileModal = ({ packFile, docName, onClose }) => {
  const handleDownload = () => {
    // <a href={dataUrl} download> silently fails in Chrome for large files;
    // convert to a Blob URL instead.
    let url;
    try {
      const [meta, b64] = packFile.data.split(',');
      const mime = (meta.match(/:(.*?);/) || ['', 'application/pdf'])[1];
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mime });
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = packFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (e) {
      if (url) URL.revokeObjectURL(url);
      console.error('[PackFileModal] download failed:', e);
      if (window.Toast) window.Toast.show({ kind: 'error', msg: 'Download failed: ' + e.message, duration: 5000 });
    }
  };
  // Build a Blob URL for the preview iframe so Chrome doesn't blank large data URLs.
  const [iframeSrc, setIframeSrc] = React.useState('');
  React.useEffect(() => {
    let blobUrl;
    try {
      const [meta, b64] = packFile.data.split(',');
      const mime = (meta.match(/:(.*?);/) || ['', 'application/pdf'])[1];
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
      setIframeSrc(blobUrl);
    } catch { setIframeSrc(packFile.data); }
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [packFile.data]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sketch-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{fontWeight:600,fontSize:15}}>{docName} — {packFile.name}</div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button className="btn sm" onClick={handleDownload} title="Download file">
              <Icon.Download /> Download
            </button>
            <button className="btn ghost sm" aria-label="Close dialog" onClick={onClose}><Icon.X /></button>
          </div>
        </div>
        <div className="sketch-body">
          <iframe src={iframeSrc} title={docName} className="sketch-frame" />
        </div>
      </div>
    </div>
  );
};

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
      if(computed.totalIncVat) breakdown.push({l:'BoQ Total',v:E.fmtGBP(computed.totalIncVat),bold:true});
    }
    if(!breakdown.length) breakdown=[{l:'(not generated yet)',v:'—'}];
    return <div><div style={{fontWeight:700,fontSize:6}}>BILL OF QUANTITIES</div><div style={{fontSize:4,marginBottom:3}}>{scheme.road_name} · {scheme.project_number}</div>{breakdown.map((b,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:4,borderBottom:"1px solid #eee",padding:"1px 0",fontWeight:b.bold?700:400}}><span>{b.l}</span><span>{b.v}</span></div>)}</div>;
  }
  return <div style={{color:"#aaa",fontSize:5,textAlign:"center",paddingTop:20}}>[{docKey.toUpperCase()}]<br/>Upload PDF below</div>;
};

// ─── Letters Tab ──────────────────────────────────────────────────────────────
// Resident/business letters live here, separate from the pack. They're a
// mail-merge workflow (recipients × template) and never get bundled into
// the compiled PDF pack — keeping them in a dedicated tab clarifies the
// distinction and removes the "Site Letter ○" entry that used to appear
// on the pack's front-sheet contents listing.

const LettersTab = ({ scheme, onPreview }) => {
  const recipients = scheme.recipients || [];
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:15,fontWeight:600}}>Resident & business letters · {scheme.project_number} · {scheme.road_name}</div>
          <div style={{fontSize:12,color:"var(--ink-3)",fontFamily:"var(--font-mono)"}}>
            {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
            {recipients.length === 0 ? " — import from CAG to begin" : ""}
          </div>
        </div>
        <button className="btn accent" onClick={()=>onPreview(scheme, "letter")}>
          <Icon.Doc /> {recipients.length > 0 ? "Open letter editor" : "Add recipients"}
        </button>
      </div>
      <div className="form-section">
        <div className="section-head">
          <div className="section-title"><span className="section-num">L</span> Mail-merge workflow</div>
        </div>
        <div style={{fontSize:13,color:"var(--ink-2)",lineHeight:1.6,marginBottom:14}}>
          Letters are produced per-recipient by merging the address fields
          and scheme metadata into the DCC template. The editor lets you:
        </div>
        <ul style={{fontSize:13,color:"var(--ink-2)",lineHeight:1.8,paddingLeft:18,marginBottom:14}}>
          <li>Import recipient addresses from a CAG export</li>
          <li>Preview the rendered letter for any recipient</li>
          <li>Download a single DOCX or a multi-recipient PDF</li>
        </ul>
        <div style={{fontSize:12,color:"var(--ink-3)",padding:"10px 12px",background:"var(--accent-wash)",borderRadius:"var(--radius-sm)",border:"1px solid var(--accent)"}}>
          <strong>Note:</strong> letters are <strong>not bundled into the handover pack PDF</strong> —
          they're sent separately to residents/businesses before works begin.
        </div>
      </div>
    </div>
  );
};

// ─── Pack Tab ─────────────────────────────────────────────────────────────────

const PackTab = ({ scheme, onGenerate, onPreview, onTabSwitch }) => {
  const { updateScheme, backendMode } = React.useContext(window.SchemeContext);
  const docsGen = scheme.docs_generated || {};
  const packReady = window.PACK_DOCS.filter(d => docsGen[d.key]).length;
  const packTotal = window.PACK_DOCS.length;
  const [generatingFront, setGeneratingFront] = React.useState(false);
  const [viewingPackFile, setViewingPackFile] = React.useState(null);
  const [syncing, setSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState(null);

  const handleSyncToFolder = async () => {
    if (!window.syncProjectFilesToFolder) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await window.syncProjectFilesToFolder(scheme);
      setSyncResult(result);
      if (window.Toast) {
        const msg = result.total === 0
          ? 'No uploaded files to sync — upload drawings, TM plans, or utility searches first.'
          : result.failed > 0
            ? `Synced ${result.saved} file${result.saved !== 1 ? 's' : ''} · ${result.failed} failed`
            : `Synced ${result.saved} file${result.saved !== 1 ? 's' : ''} to ${window.schemeFolderName(scheme)}/`;
        window.Toast.show({ kind: result.failed > 0 ? 'error' : 'success', msg, duration: 6000 });
      }
    } catch (e) {
      if (window.Toast) window.Toast.show({ kind: 'error', msg: 'Sync failed: ' + e.message, duration: 6000 });
    } finally {
      setSyncing(false);
    }
  };

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

  // Maps pack docKey → OneDrive subfolder path for direct FS saves on upload.
  const UPLOAD_FOLDER_MAP = {
    drawings:  ['Drawings', 'Draft'],
    tm:        ['Drawings', 'Received'],
    utilities: ['CDM'],
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
        // Save directly to the project subfolder while the File object is still available.
        const folderPath = UPLOAD_FOLDER_MAP[docKey];
        if (folderPath && window.fsSaveToProjectFolder) {
          const buf = await file.arrayBuffer();
          window.fsSaveToProjectFolder(scheme, folderPath, file.name, buf, { versioned: true }).then(saved => {
            if (saved && window.Toast) {
              window.Toast.show({ kind: 'success', msg: `${file.name} saved to ${window.schemeFolderName(scheme)}/${folderPath.join('/')}/`, duration: 4000 });
            }
          }).catch(e => {
            if (window.Toast) window.Toast.show({ kind: 'error', msg: `Failed to save ${file.name} to folder: ${e.message}`, duration: 6000 });
          });
        }
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
      } catch (e) {
        console.error('[Pack] Front Sheet generation failed:', e);
        if (window.Toast) window.Toast.show({ kind: 'error', msg: 'Front Sheet generation failed: ' + e.message, duration: 6000 });
      } finally {
        setGeneratingFront(false);
      }
    };
    return () => { window.__downloadFront = null; };
    // Same pattern as BoQTab.jsx: we register a fresh closure on every
    // scheme / docsGen change, but the setState setter and updateScheme
    // identities are stable and don't need to live in the dep array.
  }, [scheme, docsGen]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          {backendMode === 'fs' && (
            <button className="btn ghost sm" onClick={handleSyncToFolder} disabled={syncing}
              title="Save all uploaded drawings, TM plans and utility searches to the project folder in OneDrive. Existing files are archived as _R1, _R2… revisions.">
              {syncing ? <><div className="spinner" style={{width:10,height:10}}/> Syncing…</> : <><Icon.Upload /> Sync to folder</>}
            </button>
          )}
          <button className="btn ghost sm" onClick={()=>openDrawingProcessor(scheme)}
            title="Open the Drawing Processor to produce 001 Treatment and 002 Ironwork drawings for this scheme">
            ✏ Drawing Processor
          </button>
          <button className="btn accent" onClick={()=>onGenerate(scheme)}><Icon.Wand /> Generate pack</button>
        </div>
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
          <button className="btn ghost sm" aria-label="Close dialog" onClick={onClose}><Icon.X /></button>
        </div>
      </div>
      <div className="sketch-body">
        <iframe src={`templates/${pdf}`} title={`Sketch — ${road}`} className="sketch-frame" />
      </div>
    </div>
  </div>
);

window.SchemeDetail = SchemeDetail;
window.loadLeaflet = loadLeaflet;
window.LEAFLET_VERSION = LEAFLET_VERSION;
