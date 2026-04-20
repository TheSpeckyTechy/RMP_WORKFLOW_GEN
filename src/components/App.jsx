// ─── App.jsx ───────────────────────────────────────────────────────────────────
// Root of the React application. Loaded last — all other scripts must be
// defined before this one (see load order in RMP Design Studio.html).
//
// Component tree:
//   App
//   └─ SchemeProvider        (per-project state isolation via SchemeContext)
//      └─ AppInner
//         ├─ Sidebar             (left nav: Schemes / Settings)
//         ├─ header.topbar       (breadcrumbs + search bar)
//         ├─ Dashboard           (all-schemes overview)    ─┬ shown
//         ├─ SchemeDetail        (per-scheme tabbed view)  ─┘ one at a time
//         └─ Modals (zero or one open at a time)
//            ├─ GenerateModal     (animated pack-generation timeline)
//            ├─ RSRModal          (Road Space Request preview)
//            ├─ PCIModal          (PCI/CPP document preview)
//            └─ LetterModal       (resident/business letter preview)
//
// Also defined here:
//   GenerateModal — step-through animation of the pack generation process
//   Tweaks        — design-mode density / aesthetic / accent controls
//
// Exports: none (calls ReactDOM.createRoot directly)
// Depends on: React, ReactDOM, window.SchemeProvider, window.Sidebar,
//             window.Dashboard, window.SchemeDetail,
//             window.RSRModal, window.PCIModal, window.LetterModal, window.Icon
// ─────────────────────────────────────────────────────────────────────────────

const GenerateModal = ({ scheme, onClose }) => {
  const [step, setStep] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const steps = [
    { l: "Reading Master Workbook", meta: "45 named ranges" },
    { l: "Validating inputs", meta: "0 errors" },
    { l: "Looking up ward councillors", meta: `W${scheme.ward_num}` },
    { l: "Populating Front Sheet", meta: "DOCX" },
    { l: "Populating PCI / CPP", meta: "DOCX" },
    { l: "Populating Road Space Request Form", meta: "DOCX" },
    { l: "Populating Resident Letter", meta: "DOCX" },
    { l: "Building BoQ summary", meta: "XLSX" },
    { l: "Collating utility searches", meta: "PDF" },
    { l: "Saving to OneDrive · Projects (AI)", meta: "Complete" },
  ];
  React.useEffect(() => {
    if (step >= steps.length) { setDone(true); return; }
    const t = setTimeout(() => setStep(s => s + 1), step === 0 ? 400 : 280);
    return () => clearTimeout(t);
  }, [step]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Generating handover pack</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{scheme.project_number} · {scheme.road_name}</div>
          </div>
          <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>
        </div>
        <div className="modal-body">
          <div className="gen-timeline">
            {steps.map((s, i) => (
              <div key={i} className={"gen-step " + (i < step ? "done" : i === step ? "active" : "")}>
                <div className="gen-step-icon">{i < step ? <Icon.Check /> : i + 1}</div>
                <div>{s.l}</div>
                <div className="gen-step-meta">{s.meta}</div>
              </div>
            ))}
          </div>
          {done && (
            <div style={{ padding: "16px 18px", background: "var(--green-wash)", border: "1px solid var(--green)", borderRadius: "var(--radius-sm)", marginTop: 8 }}>
              <div style={{ fontWeight: 600, color: "var(--green)", marginBottom: 4, fontSize: 14 }}>✓ Pack generated</div>
              <div style={{ fontSize: 12, color: "var(--ink-2)" }}>8 documents written to <span className="mono">OneDrive · Projects (AI) · {scheme.project_number} {scheme.road_name}/</span></div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", marginTop: 8 }}>Estimated time saved: 2h 15m vs manual copy-paste</div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" disabled={!done}><Icon.Folder /> Open folder</button>
        </div>
      </div>
    </div>
  );
};

const Tweaks = ({ tweaks, setTweaks }) => (
  <div className="tweaks-panel">
    <div className="tweaks-head"><span>Tweaks</span><span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>design controls</span></div>
    <div className="tweaks-body">
      {[["Density",["Comfortable","Dense"]],["Aesthetic",["Technical","Soft","Mono"]]].map(([label,opts]) => (
        <div key={label} className="tweak">
          <div className="tweak-label">{label}</div>
          <div className="tweak-seg">
            {opts.map(v => <button key={v} className={tweaks[label.toLowerCase()]===v?"active":""} onClick={()=>setTweaks({...tweaks,[label.toLowerCase()]:v})}>{v}</button>)}
          </div>
        </div>
      ))}
      <div className="tweak">
        <div className="tweak-label">Accent</div>
        <div className="tweak-seg">
          {[{v:"Orange",c:"oklch(0.62 0.16 45)"},{v:"Blue",c:"oklch(0.52 0.14 240)"},{v:"Green",c:"oklch(0.52 0.14 150)"}].map(o => (
            <button key={o.v} className={tweaks.accent===o.v?"active":""} onClick={()=>setTweaks({...tweaks,accent:o.v})}>{o.v}</button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const SettingsView = ({ tweaks, setTweaks }) => {
  const accents = [
    { v: "Orange", c: "oklch(0.62 0.16 45)" },
    { v: "Blue",   c: "oklch(0.52 0.14 240)" },
    { v: "Green",  c: "oklch(0.52 0.14 150)" },
  ];
  return (
    <div className="settings-view">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">App preferences and display options.</p>
        </div>
      </div>
      <div className="settings-sections">
        <div className="settings-section">
          <div className="settings-section-title">User</div>
          <div className="settings-card">
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div className="user-avatar" style={{width:44,height:44,fontSize:16,borderRadius:"50%",background:"var(--accent)",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,flexShrink:0}}>JM</div>
              <div>
                <div style={{fontWeight:600,fontSize:14}}>Jake McAllister</div>
                <div style={{fontSize:12,color:"var(--ink-3)"}}>Designer · Road Maintenance Partnership</div>
                <div style={{fontSize:11,color:"var(--ink-3)",fontFamily:"var(--font-mono)",marginTop:2}}>Dundee City Council</div>
              </div>
            </div>
          </div>
        </div>
        <div className="settings-section">
          <div className="settings-section-title">Display</div>
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-label">Density</div>
              <div className="tweak-seg">
                {["Comfortable","Dense"].map(v => (
                  <button key={v} className={tweaks.density===v?"active":""} onClick={()=>setTweaks({...tweaks,density:v})}>{v}</button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-label">Aesthetic</div>
              <div className="tweak-seg">
                {["Technical","Soft","Mono"].map(v => (
                  <button key={v} className={tweaks.aesthetic===v?"active":""} onClick={()=>setTweaks({...tweaks,aesthetic:v})}>{v}</button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-label">Accent colour</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {accents.map(a => (
                  <button key={a.v} onClick={()=>setTweaks({...tweaks,accent:a.v})}
                    style={{width:28,height:28,borderRadius:"50%",background:a.c,border:tweaks.accent===a.v?"3px solid var(--ink-1)":"3px solid transparent",cursor:"pointer",flexShrink:0}}
                    title={a.v} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="settings-section">
          <div className="settings-section-title">About</div>
          <div className="settings-card">
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"var(--ink-3)"}}>Application</span><span className="mono">RMP Design Studio</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"var(--ink-3)"}}>Version</span><span className="mono">2.0.0</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"var(--ink-3)"}}>Client</span><span className="mono">Dundee City Council</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"var(--ink-3)"}}>Templates</span><span className="mono">RSR · PCI/CPP · Letter · Workbook</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FINANCIAL_YEARS = ["2025/26","2026/27","2027/28","2028/29"];
const SCHEME_TYPES = ["Carriageway","Footway","Junction","Cycleway"];
const SCHEME_STATUSES = [
  { k:"design", l:"In design" },{ k:"review", l:"In review" },
  { k:"ready",  l:"Ready" },    { k:"works",  l:"On site" },
];

const NewSchemeModal = ({ onClose, onCreate }) => {
  const { schemes } = React.useContext(window.SchemeContext);
  const [form, setForm] = React.useState({
    road_name: "", project_number: "", scheme_type: "Carriageway",
    financial_year: "2026/27", ward_num: 1, status: "design",
  });
  const [error, setError] = React.useState("");
  const nameRef = React.useRef(null);

  React.useEffect(() => { nameRef.current?.focus(); }, []);

  const set = (k, v) => { setForm(f => ({...f, [k]: v})); setError(""); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.road_name.trim()) { setError("Road name is required."); return; }
    if (!form.project_number.trim()) { setError("Project number is required."); return; }
    if (schemes.find(s => s.id === form.project_number.trim())) {
      setError(`Project number "${form.project_number.trim()}" already exists.`); return;
    }
    const ward = window.WARDS.find(w => w.num === form.ward_num);
    const id = form.project_number.trim();
    const newScheme = window.baseScheme({
      id,
      road_name: form.road_name.trim(),
      project_number: id,
      scheme_type: form.scheme_type,
      financial_year: form.financial_year,
      ward_num: form.ward_num,
      ward_selected: ward ? `Ward ${ward.num} — ${ward.name}` : "",
      status: form.status,
    });
    onCreate(newScheme);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{width:480}}>
        <div className="modal-head">
          <div style={{fontWeight:600,fontSize:15}}>New Scheme</div>
          <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{display:"flex",flexDirection:"column",gap:14}}>
            <div className="field">
              <label>Road Name <span style={{color:"var(--red)"}}>*</span></label>
              <input ref={nameRef} type="text" placeholder="e.g. Lochee Road" value={form.road_name} onChange={e=>set("road_name",e.target.value)} />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div className="field">
                <label>Project Number <span style={{color:"var(--red)"}}>*</span></label>
                <input type="text" placeholder="e.g. R5042" value={form.project_number} onChange={e=>set("project_number",e.target.value)} className="mono" />
              </div>
              <div className="field">
                <label>Financial Year</label>
                <select value={form.financial_year} onChange={e=>set("financial_year",e.target.value)}>
                  {FINANCIAL_YEARS.map(y=><option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div className="field">
                <label>Scheme Type</label>
                <select value={form.scheme_type} onChange={e=>set("scheme_type",e.target.value)}>
                  {SCHEME_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Initial Status</label>
                <select value={form.status} onChange={e=>set("status",e.target.value)}>
                  {SCHEME_STATUSES.map(s=><option key={s.k} value={s.k}>{s.l}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Ward</label>
              <div className="ward-picker" style={{marginBottom:0}}>
                {window.WARDS.map(w=>(
                  <button key={w.num} type="button"
                    className={"ward-btn "+(form.ward_num===w.num?"active":"")}
                    onClick={()=>set("ward_num",w.num)}>
                    <span className="ward-num">W{w.num}</span>
                    <span className="ward-name">{w.name}</span>
                  </button>
                ))}
              </div>
            </div>
            {error && <div style={{fontSize:12,color:"var(--red)",fontFamily:"var(--font-mono)",background:"#fff0f0",padding:"6px 10px",borderRadius:"var(--radius-sm)",border:"1px solid #fca5a5"}}>{error}</div>}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn accent"><Icon.Plus /> Create scheme</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AppInner = () => {
  const { addScheme } = React.useContext(window.SchemeContext);
  const [view, setView] = React.useState("dashboard");
  const [openScheme, setOpenScheme] = React.useState(null);
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [newSchemeOpen, setNewSchemeOpen] = React.useState(false);
  const [generating, setGenerating] = React.useState(null);
  const [previewing, setPreviewing] = React.useState(null);
  const [tweaksOn, setTweaksOn] = React.useState(false);
  const [tweaks, setTweaks] = React.useState({ density: "Comfortable", aesthetic: "Technical", accent: "Orange" });

  React.useEffect(() => {
    document.body.classList.toggle("dense", tweaks.density === "Dense");
    document.body.classList.toggle("soft", tweaks.aesthetic === "Soft");
    document.body.classList.toggle("mono-aesthetic", tweaks.aesthetic === "Mono");
    const root = document.documentElement.style;
    if (tweaks.accent === "Blue") { root.setProperty("--accent","oklch(0.52 0.14 240)"); root.setProperty("--accent-ink","oklch(0.32 0.12 240)"); root.setProperty("--accent-wash","oklch(0.96 0.03 240)"); }
    else if (tweaks.accent === "Green") { root.setProperty("--accent","oklch(0.52 0.14 150)"); root.setProperty("--accent-ink","oklch(0.32 0.12 150)"); root.setProperty("--accent-wash","oklch(0.96 0.03 150)"); }
    else { root.setProperty("--accent","oklch(0.62 0.16 45)"); root.setProperty("--accent-ink","oklch(0.32 0.12 45)"); root.setProperty("--accent-wash","oklch(0.96 0.03 45)"); }
  }, [tweaks]);

  React.useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweaksOn(true);
      else if (e.data?.type === "__deactivate_edit_mode") setTweaksOn(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  const STATUS_FILTER_KEYS = ["design","review","ready","works","archived"];
  React.useEffect(() => { if (STATUS_FILTER_KEYS.includes(view)) setFilter(view); }, [view]);

  React.useEffect(() => {
    const handler = (e) => {
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey &&
          !["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName)) {
        setNewSchemeOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="app">
      <Sidebar view={view} onView={(v) => { setView(v); setOpenScheme(null); }} />
      <div className="main">
        <header className="topbar">
          <div className="crumbs">
            <span>Workspace</span><span className="sep">/</span>
            {openScheme ? (
              <><span style={{ cursor:"pointer" }} onClick={() => setOpenScheme(null)}>Schemes</span><span className="sep">/</span><span className="current mono">{openScheme}</span></>
            ) : (
              <span className="current">Schemes</span>
            )}
          </div>
          <div className="searchbar"><Icon.Search /><input placeholder="Jump to scheme, ward, address…" value={search} onChange={e=>{ setSearch(e.target.value); if(e.target.value){ setView("dashboard"); setOpenScheme(null); } }} /></div>
          <button className="btn ghost sm"><Icon.Bell /></button>
        </header>
        <div className="content">
          {openScheme ? (
            <SchemeDetail schemeId={openScheme} onBack={() => setOpenScheme(null)} onGenerate={setGenerating} onPreview={(scheme, docKey) => setPreviewing({ scheme, docKey })} />
          ) : view === "settings" ? (
            <SettingsView tweaks={tweaks} setTweaks={setTweaks} />
          ) : (
            <Dashboard onOpen={id=>{ setOpenScheme(id); setSearch(""); }} onNew={()=>setNewSchemeOpen(true)} filter={filter} setFilter={setFilter} search={search} />
          )}
        </div>
      </div>
      {generating && <GenerateModal scheme={generating} onClose={() => setGenerating(null)} />}
      {previewing?.docKey === "rsr" && <RSRModal scheme={previewing.scheme} onClose={() => setPreviewing(null)} />}
      {previewing?.docKey === "pci" && <PCIModal schemeId={previewing.scheme.id} onClose={() => setPreviewing(null)} />}
      {previewing?.docKey === "letter" && <LetterModal scheme={previewing.scheme} onClose={() => setPreviewing(null)} />}
      {newSchemeOpen && <NewSchemeModal onClose={()=>setNewSchemeOpen(false)} onCreate={s=>{ addScheme(s); setNewSchemeOpen(false); setView("dashboard"); setFilter("all"); setSearch(""); setOpenScheme(s.id); }} />}
      {tweaksOn && <Tweaks tweaks={tweaks} setTweaks={setTweaks} />}
    </div>
  );
};

const INACTIVITY_MS = 5 * 60 * 1000;

const App = () => {
  const [authed, setAuthed]     = React.useState(sessionStorage.getItem("rmp_authed") === "1");
  const [lockReason, setLockReason] = React.useState(null);

  React.useEffect(() => {
    if (!authed) return;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        sessionStorage.removeItem("rmp_authed");
        setLockReason("inactivity");
        setAuthed(false);
      }, INACTIVITY_MS);
    };
    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(ev => window.removeEventListener(ev, reset));
    };
  }, [authed]);

  if (!authed) return <PasswordGate onAuth={() => { setLockReason(null); setAuthed(true); }} reason={lockReason} />;
  return (
    <SchemeProvider>
      <AppInner />
    </SchemeProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
