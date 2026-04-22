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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[RMP ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',gap:16,padding:32,fontFamily:'system-ui',textAlign:'center'}}>
          <div style={{fontSize:32}}>⚠</div>
          <div style={{fontWeight:700,fontSize:18}}>Something went wrong</div>
          <div style={{fontSize:13,color:'var(--ink-2,#666)',maxWidth:480,lineHeight:1.6}}>
            An unexpected error occurred. Your data is safe — it is stored in localStorage and Supabase.
          </div>
          <div style={{fontFamily:'monospace',fontSize:11,color:'#c00',background:'#fff0f0',padding:'8px 14px',borderRadius:6,maxWidth:560,wordBreak:'break-word'}}>
            {this.state.error?.message}
          </div>
          <button
            style={{marginTop:8,padding:'10px 22px',background:'var(--accent,#c6572c)',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontSize:14,fontWeight:600}}
            onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
          <button
            style={{padding:'8px 18px',background:'transparent',border:'1px solid var(--line,#ccc)',borderRadius:6,cursor:'pointer',fontSize:13}}
            onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const GenerateModal = ({ scheme, onClose }) => {
  const [step, setStep] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [exported, setExported] = React.useState(false);
  const [failures, setFailures] = React.useState([]);
  const steps = [
    { l: "Reading Master Workbook", meta: "45 named ranges" },
    { l: "Validating inputs", meta: "0 errors" },
    { l: "Looking up ward councillors", meta: `W${scheme.ward_num}` },
    { l: "Populating PCI / CPP", meta: "DOCX" },
    { l: "Populating Road Space Request Form", meta: "DOCX" },
    { l: "Building Master Workbook export", meta: "XLSX" },
  ];
  React.useEffect(() => {
    if (step >= steps.length) { setDone(true); return; }
    const t = setTimeout(() => setStep(s => s + 1), step === 0 ? 400 : 320);
    return () => clearTimeout(t);
  }, [step]);
  React.useEffect(() => {
    if (!done) return;
    setExporting(true);
    (async () => {
      const errs = [];
      try { if (window.__downloadRSR) await window.__downloadRSR(scheme); } catch (e) { errs.push('RSR DOCX'); console.error('RSR DOCX failed', e); }
      try { if (window.__downloadRSRPdf) await window.__downloadRSRPdf(scheme); } catch (e) { errs.push('RSR PDF'); console.error('RSR PDF failed', e); }
      try { if (window.__downloadPCI) await window.__downloadPCI(scheme); } catch (e) { errs.push('PCI DOCX'); console.error('PCI DOCX failed', e); }
      try { if (window.__downloadPCIPdf) await window.__downloadPCIPdf(scheme); } catch (e) { errs.push('PCI PDF'); console.error('PCI PDF failed', e); }
      try { if (window.__workbookExport) window.__workbookExport(); } catch (e) { errs.push('Master Workbook'); console.error('Master Workbook failed', e); }
      setFailures(errs);
      setExporting(false);
      setExported(true);
    })();
  }, [done]);
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
          {done && !exported && (
            <div style={{ padding: "16px 18px", background: "var(--accent-wash)", borderRadius: "var(--radius-sm)", marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--amber)", display: "inline-block", animation: "pulse 1s ease-in-out infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "var(--ink-2)" }}>Downloading documents…</span>
            </div>
          )}
          {exported && (
            <div style={{ padding: "16px 18px", background: failures.length ? "var(--amber-wash)" : "var(--green-wash)", border: `1px solid ${failures.length ? "var(--amber)" : "var(--green)"}`, borderRadius: "var(--radius-sm)", marginTop: 8 }}>
              <div style={{ fontWeight: 600, color: failures.length ? "var(--amber)" : "var(--green)", marginBottom: 4, fontSize: 14 }}>
                {failures.length ? `⚠ ${5 - failures.length}/5 files downloaded` : "✓ 5 files downloaded"}
              </div>
              {failures.length > 0 && (
                <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 6 }}>Failed: {failures.join(', ')} — check the browser console for details.</div>
              )}
              <div style={{ fontSize: 12, color: "var(--ink-2)" }}>RSR (.docx + .pdf), PCI/CPP (.docx + .pdf), and Master Workbook (.xlsx) saved to your downloads folder. Open the <strong>Pack</strong> tab to generate resident letters.</div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

const SyncDot = ({ status }) => {
  const cfg = {
    loading: { color: 'var(--amber)',       label: 'Connecting to Supabase…' },
    syncing: { color: 'var(--amber)',       label: 'Syncing…' },
    synced:  { color: 'var(--green)',       label: 'Synced' },
    error:   { color: 'var(--red,#c0392b)', label: 'Sync error' },
  };
  const { color, label } = cfg[status] || cfg.off;
  return (
    <span
      title={label}
      style={{
        width: 8, height: 8, borderRadius: '50%', background: color,
        display: 'inline-block', flexShrink: 0,
        animation: (status === 'loading' || status === 'syncing') ? 'pulse 1s ease-in-out infinite' : 'none',
      }}
    />
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

const relativeTime = (date) => {
  if (!date) return null;
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 10)  return 'just now';
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const SettingsView = ({ tweaks, setTweaks, darkMode, setDarkMode }) => {
  const { resetAllSchemes, syncStatus, lastSynced } = React.useContext(window.SchemeContext);
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    if (!lastSynced || syncStatus !== 'synced') return;
    const t = setInterval(forceUpdate, 30000);
    return () => clearInterval(t);
  }, [lastSynced, syncStatus]);
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
            <div className="settings-row">
              <div className="settings-row-label">Theme</div>
              <div className="tweak-seg">
                {["Light","Dark"].map(t => (
                  <button key={t} className={(t==="Dark")===darkMode?"active":""} onClick={()=>setDarkMode(t==="Dark")}>{t}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="settings-section">
          <div className="settings-section-title">Storage</div>
          <div className="settings-card">
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <SyncDot status={syncStatus} />
              <div>
                <div style={{fontSize:13,fontWeight:500}}>Supabase · Workload</div>
                <div style={{fontSize:11,color:"var(--ink-3)",marginTop:2}}>
                  {syncStatus==='synced' && `All changes synced · West EU (Ireland)${lastSynced ? ' · ' + relativeTime(lastSynced) : ''}`}
                  {syncStatus==='syncing' && 'Syncing…'}
                  {syncStatus==='loading' && 'Connecting…'}
                  {syncStatus==='error' && <span style={{color:"var(--red)"}}>Sync error — check console</span>}
                </div>
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
        <div className="settings-section">
          <div className="settings-section-title">Data</div>
          <div className="settings-card">
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Reset scheme data</div>
                <div style={{fontSize:11,color:"var(--ink-3)",marginTop:2}}>Clears all saved edits and reloads the original seed data. Cannot be undone.</div>
              </div>
              <button className="btn sm" style={{borderColor:"var(--red)",color:"var(--red)",flexShrink:0}}
                onClick={()=>{ if(confirm("Reset all scheme data to defaults? This cannot be undone.")) resetAllSchemes(); }}>
                Reset data
              </button>
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
  const { addScheme, syncStatus } = React.useContext(window.SchemeContext);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState([]);
  const notifRef = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => setNotifications(n => [e.detail, ...n].slice(0, 10));
    window.addEventListener('rmp-download', handler);
    return () => window.removeEventListener('rmp-download', handler);
  }, []);

  React.useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);
  const [view, setView] = React.useState("dashboard");
  const [openScheme, setOpenScheme] = React.useState(null);
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [newSchemeOpen, setNewSchemeOpen] = React.useState(false);
  const [generating, setGenerating] = React.useState(null);
  const [previewing, setPreviewing] = React.useState(null);
  const [tweaksOn, setTweaksOn] = React.useState(false);
  const [tweaks, setTweaks] = React.useState({ density: "Comfortable", aesthetic: "Technical", accent: "Orange" });
  const [darkMode, setDarkMode] = React.useState(() => localStorage.getItem('rmp_dark_mode') === '1');

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('rmp_dark_mode', darkMode ? '1' : '0');
  }, [darkMode]);

  React.useEffect(() => {
    document.body.classList.toggle("dense", tweaks.density === "Dense");
    document.body.classList.toggle("soft", tweaks.aesthetic === "Soft");
    document.body.classList.toggle("mono-aesthetic", tweaks.aesthetic === "Mono");
    const root = document.documentElement.style;
    const washL = darkMode ? 0.22 : 0.96;
    const inkL  = darkMode ? 0.72 : 0.32;
    if (tweaks.accent === "Blue") { root.setProperty("--accent","oklch(0.52 0.14 240)"); root.setProperty("--accent-ink",`oklch(${inkL} 0.12 240)`); root.setProperty("--accent-wash",`oklch(${washL} 0.04 240)`); }
    else if (tweaks.accent === "Green") { root.setProperty("--accent","oklch(0.52 0.14 150)"); root.setProperty("--accent-ink",`oklch(${inkL} 0.12 150)`); root.setProperty("--accent-wash",`oklch(${washL} 0.04 150)`); }
    else { root.setProperty("--accent","oklch(0.62 0.16 45)"); root.setProperty("--accent-ink",`oklch(${inkL} 0.12 45)`); root.setProperty("--accent-wash",`oklch(${washL} 0.04 45)`); }
  }, [tweaks, darkMode]);

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
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <Sidebar view={view} onView={(v) => { setView(v); setOpenScheme(null); setMenuOpen(false); }} open={menuOpen} />
      <div className="main">
        <header className="topbar">
          <button className="btn ghost sm menu-toggle" onClick={() => setMenuOpen(o => !o)} style={{padding:"4px 8px",fontSize:18,lineHeight:1}}>☰</button>
          <div className="crumbs">
            <span>Workspace</span><span className="sep">/</span>
            {openScheme ? (
              <><span style={{ cursor:"pointer" }} onClick={() => setOpenScheme(null)}>Schemes</span><span className="sep">/</span><span className="current mono">{openScheme}</span></>
            ) : (
              <span className="current">Schemes</span>
            )}
          </div>
          <div className="searchbar"><Icon.Search /><input placeholder="Jump to scheme, ward, address…" value={search} onChange={e=>{ setSearch(e.target.value); if(e.target.value){ setView("dashboard"); setOpenScheme(null); } }} /></div>
          <SyncDot status={syncStatus} />
          <div style={{position:"relative"}} ref={notifRef}>
            <button className="btn ghost sm" style={{position:"relative"}} onClick={()=>setNotifOpen(o=>!o)}>
              <Icon.Bell />
              {notifications.length > 0 && <span style={{position:"absolute",top:3,right:3,width:7,height:7,borderRadius:"50%",background:"var(--accent)",display:"block"}} />}
            </button>
            {notifOpen && (
              <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:"var(--radius)",boxShadow:"0 4px 20px rgba(0,0,0,0.12)",width:270,zIndex:300}}>
                <div style={{padding:"10px 14px 6px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:"var(--ink-3)",borderBottom:"1px solid var(--line)"}}>Downloads this session</div>
                {notifications.length === 0
                  ? <div style={{padding:"12px 14px",fontSize:12,color:"var(--ink-3)"}}>No downloads yet</div>
                  : notifications.map((n, i) => (
                    <div key={i} style={{padding:"8px 14px",borderBottom:"1px solid var(--line)",fontSize:12}}>
                      <div style={{color:"var(--ink)"}}>{n.label}</div>
                      <div style={{color:"var(--ink-3)",fontFamily:"var(--font-mono)",fontSize:10,marginTop:2}}>{n.ref}</div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </header>
        <div className="content">
          {openScheme ? (
            <SchemeDetail schemeId={openScheme} onBack={() => setOpenScheme(null)} onGenerate={setGenerating} onPreview={(scheme, docKey) => setPreviewing({ scheme, docKey })} />
          ) : view === "settings" ? (
            <SettingsView tweaks={tweaks} setTweaks={setTweaks} darkMode={darkMode} setDarkMode={setDarkMode} />
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
    <ErrorBoundary>
      <SchemeProvider>
        <AppInner />
      </SchemeProvider>
    </ErrorBoundary>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
