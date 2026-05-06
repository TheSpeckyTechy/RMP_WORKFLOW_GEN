const APP_VERSION = '2.0.0';

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

const PACK_SECTIONS = [
  { key: 'front',    label: 'Front Sheet',                  auto: true,  packKey: null },
  { key: 'pci',      label: 'PCI / CPP',                    auto: true,  packKey: null },
  { key: 'rsr',      label: 'Road Space Request',           auto: true,  packKey: null },
  { key: 'boq',      label: 'Bill of Quantities',           auto: false, packKey: 'boq' },
  { key: 'drawings', label: 'Resurfacing & Ironwork Plans', auto: false, packKey: 'drawings' },
  { key: 'tm',       label: 'Traffic Management Plans',     auto: false, packKey: 'tm' },
  { key: 'utilities',label: 'Utility Searches Pack',        auto: false, packKey: 'utilities' },
];

// Convert a base64 data URL to an ArrayBuffer (used to decode stored PDFs)
function dataUrlToBuffer(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const GenerateModal = ({ scheme, onClose }) => {
  // status per section: 'pending' | 'active' | 'done' | 'skipped' | 'error'
  const initSteps = () => PACK_SECTIONS.map(s => ({ ...s, status: 'pending', note: '' }));
  const [steps, setSteps] = React.useState(initSteps);
  const [finished, setFinished] = React.useState(false);
  const [packError, setPackError] = React.useState('');
  const [included, setIncluded] = React.useState([]);
  const [skipped, setSkipped] = React.useState([]);

  const markStep = (key, status, note = '') =>
    setSteps(prev => prev.map(s => s.key === key ? { ...s, status, note } : s));

  React.useEffect(() => {
    (async () => {
      if (!window.PDFLib) {
        setPackError('pdf-lib not loaded — refresh the page and try again.');
        setFinished(true);
        return;
      }
      const { PDFDocument } = window.PDFLib;
      const merged = await PDFDocument.create();
      const inc = [], skip = [];

      for (const section of PACK_SECTIONS) {
        markStep(section.key, 'active');
        await new Promise(r => setTimeout(r, 30)); // allow React to paint

        try {
          let buf = null;

          if (section.key === 'front' && window.__getFrontPdfBuffer) {
            buf = await window.__getFrontPdfBuffer(scheme);
          } else if (section.key === 'pci' && window.__getPCIPdfBuffer) {
            buf = await window.__getPCIPdfBuffer(scheme);
          } else if (section.key === 'rsr' && window.__getRSRPdfBuffer) {
            buf = await window.__getRSRPdfBuffer(scheme);
          } else if (section.packKey) {
            const pf = scheme[`pack_file_${section.packKey}`];
            if (pf && pf.data) buf = dataUrlToBuffer(pf.data);
          }

          if (buf) {
            const src   = await PDFDocument.load(buf, { ignoreEncryption: true });
            const pages = await merged.copyPages(src, src.getPageIndices());
            pages.forEach(p => merged.addPage(p));
            inc.push(section.label);
            markStep(section.key, 'done', `${src.getPageCount()} page${src.getPageCount() !== 1 ? 's' : ''}`);
          } else {
            const reason = section.auto ? 'render failed' : 'no PDF uploaded';
            skip.push(section.label);
            markStep(section.key, 'skipped', reason);
          }
        } catch (e) {
          console.warn(`Pack compile — ${section.label}:`, e);
          skip.push(section.label);
          markStep(section.key, 'error', e.message.slice(0, 60));
        }
      }

      setIncluded(inc);
      setSkipped(skip);

      if (inc.length === 0) {
        setPackError('No pages could be generated — check browser console for details.');
        setFinished(true);
        return;
      }

      try {
        const bytes = await merged.save();
        const blob  = new Blob([bytes], { type: 'application/pdf' });
        const a     = document.createElement('a');
        a.href      = URL.createObjectURL(blob);
        a.download  = `Pack_${scheme.project_number}_${(scheme.road_name || '').replace(/\s+/g, '_')}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
        window.dispatchEvent(new CustomEvent('rmp-download', {
          detail: { label: `Compiled Pack — ${scheme.road_name}`, ref: scheme.project_number },
        }));
      } catch (e) {
        setPackError('PDF save failed: ' + e.message);
      }

      setFinished(true);
    })();
  }, []); // eslint-disable-line

  const statusIcon = (status) => {
    if (status === 'done')    return <span style={{color:'var(--green)',fontWeight:700}}>✓</span>;
    if (status === 'skipped') return <span style={{color:'var(--ink-3)'}}>–</span>;
    if (status === 'error')   return <span style={{color:'var(--red)'}}>✕</span>;
    if (status === 'active')  return <span className="spinner" style={{width:12,height:12,display:'inline-block'}} />;
    return <span style={{color:'var(--ink-3)',fontSize:11}}>{PACK_SECTIONS.findIndex(s=>s.key===steps.find(x=>x.key===steps[0]?.key)?.key)}</span>;
  };

  return (
    <div className="modal-backdrop" onClick={finished ? onClose : undefined}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Compiling handover pack</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
              {scheme.project_number} · {scheme.road_name}
            </div>
          </div>
          {finished && <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>}
        </div>

        <div className="modal-body">
          <div className="gen-timeline">
            {steps.map((s, i) => (
              <div key={s.key} className={"gen-step " + (s.status === 'done' ? "done" : s.status === 'active' ? "active" : "")}>
                <div className="gen-step-icon">
                  {s.status === 'done'    ? <Icon.Check /> :
                   s.status === 'active'  ? <div className="spinner" style={{width:10,height:10}} /> :
                   s.status === 'error'   ? '✕' :
                   s.status === 'skipped' ? '–' : i + 1}
                </div>
                <div style={{flex:1}}>{s.label}</div>
                <div className="gen-step-meta" style={{
                  color: s.status === 'error' ? 'var(--red)' : s.status === 'skipped' ? 'var(--ink-3)' : undefined,
                }}>
                  {s.note || (s.status === 'pending' ? '…' : s.auto ? 'rendering' : 'checking upload')}
                </div>
              </div>
            ))}
          </div>

          {!finished && (
            <div style={{ padding: "12px 14px", background: "var(--accent-wash)", borderRadius: "var(--radius-sm)", marginTop: 10, display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: "pulse 1s ease-in-out infinite", flexShrink: 0 }} />
              Rendering documents — this may take 10–20 seconds…
            </div>
          )}

          {finished && packError && (
            <div style={{ padding: "14px 16px", background: "var(--red-wash,#fef2f2)", border: "1px solid var(--red)", borderRadius: "var(--radius-sm)", marginTop: 10, fontSize: 12, color: "var(--red)" }}>
              <strong>Error:</strong> {packError}
            </div>
          )}

          {finished && !packError && (
            <div style={{ padding: "14px 16px", background: "var(--green-wash)", border: "1px solid var(--green)", borderRadius: "var(--radius-sm)", marginTop: 10, fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: "var(--green)", marginBottom: 4 }}>
                ✓ Pack_<span style={{fontFamily:'var(--font-mono)'}}>{scheme.project_number}</span>_{(scheme.road_name||'').replace(/\s+/g,'_')}.pdf downloaded
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: skipped.length ? 6 : 0 }}>
                {included.length} section{included.length !== 1 ? 's' : ''} compiled: {included.join(', ')}.
              </div>
              {skipped.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  Skipped (no PDF uploaded): {skipped.join(', ')}. Upload via Pack tab → card → Upload PDF.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <div style={{ fontSize: 11, color: "var(--ink-3)", flex: 1 }}>
            Individual source files (DOCX / XLSX) — download from Pack tab document cards.
          </div>
          <button className="btn primary" onClick={onClose} disabled={!finished}>
            {finished ? 'Done' : 'Working…'}
          </button>
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
  const [userPrefs, setUserPrefs] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('rmp_user_prefs')) || {}; } catch { return {}; }
  });
  const [editingUser, setEditingUser] = React.useState(false);
  const userName = userPrefs.name || 'Jake McAllister';
  const userRole = userPrefs.role || 'Designer';
  const userOrg  = userPrefs.org  || 'Dundee City Council';
  const initials = userName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'JM';
  const saveUserPrefs = (patch) => {
    const next = { ...userPrefs, ...patch };
    setUserPrefs(next);
    localStorage.setItem('rmp_user_prefs', JSON.stringify(next));
  };
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
            {!editingUser ? (
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div className="user-avatar" style={{width:44,height:44,fontSize:16,borderRadius:"50%",background:"var(--accent)",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,flexShrink:0}}>{initials}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14}}>{userName}</div>
                  <div style={{fontSize:12,color:"var(--ink-3)"}}>{userRole} · Road Maintenance Partnership</div>
                  <div style={{fontSize:11,color:"var(--ink-3)",fontFamily:"var(--font-mono)",marginTop:2}}>{userOrg}</div>
                </div>
                <button className="btn ghost sm" onClick={()=>setEditingUser(true)}>Edit</button>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <div className="user-avatar" style={{width:44,height:44,fontSize:16,borderRadius:"50%",background:"var(--accent)",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,flexShrink:0}}>{initials}</div>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
                    <input type="text" placeholder="Full name" value={userPrefs.name||''} onChange={e=>saveUserPrefs({name:e.target.value})} style={{fontSize:13}} />
                    <div style={{display:"flex",gap:6}}>
                      <input type="text" placeholder="Role (e.g. Designer)" value={userPrefs.role||''} onChange={e=>saveUserPrefs({role:e.target.value})} style={{fontSize:12,flex:1}} />
                      <input type="text" placeholder="Organisation" value={userPrefs.org||''} onChange={e=>saveUserPrefs({org:e.target.value})} style={{fontSize:12,flex:1}} />
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",justifyContent:"flex-end"}}>
                  <button className="btn sm accent" onClick={()=>setEditingUser(false)}>Save</button>
                </div>
              </div>
            )}
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
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"var(--ink-3)"}}>Version</span><span className="mono">{APP_VERSION}</span></div>
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

const NewSchemeModal = ({ onClose, onCreate, initialValues }) => {
  const { schemes } = React.useContext(window.SchemeContext);
  const [form, setForm] = React.useState(() => ({
    road_name: "", project_number: "", scheme_type: "Carriageway",
    financial_year: "2026/27", ward_num: 1, status: "design",
    ...(initialValues || {}),
    project_number: "", // always blank — must choose a new unique ref
  }));
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
          <div style={{fontWeight:600,fontSize:15}}>{initialValues ? 'Duplicate Scheme' : 'New Scheme'}</div>
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
            {error && <div className="inline-error" style={{fontSize:12,color:"var(--red)",fontFamily:"var(--font-mono)",padding:"6px 10px",borderRadius:"var(--radius-sm)"}}>{error}</div>}
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
  const { addScheme, syncStatus, getScheme } = React.useContext(window.SchemeContext);
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
  const [duplicateSource, setDuplicateSource] = React.useState(null);
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
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                        <div style={{color:"var(--ink)",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.label}</div>
                        {n.fn && window[n.fn] && (
                          <button className="btn ghost sm" title="Re-download" style={{fontSize:11,padding:"1px 6px",flexShrink:0}}
                            onClick={()=>{ const s=n.schemeId&&getScheme(n.schemeId); if(s&&window[n.fn]) window[n.fn](s); }}>↻</button>
                        )}
                      </div>
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
            <SchemeDetail schemeId={openScheme} onBack={() => setOpenScheme(null)} onGenerate={setGenerating} onPreview={(scheme, docKey) => setPreviewing({ scheme, docKey })}
              onDuplicate={(scheme) => { setDuplicateSource({ road_name: scheme.road_name, scheme_type: scheme.scheme_type, financial_year: scheme.financial_year, ward_num: scheme.ward_num, status: 'design' }); setNewSchemeOpen(true); }} />
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
      {newSchemeOpen && <NewSchemeModal onClose={()=>{ setNewSchemeOpen(false); setDuplicateSource(null); }} initialValues={duplicateSource} onCreate={s=>{ addScheme(s); setNewSchemeOpen(false); setDuplicateSource(null); setView("dashboard"); setFilter("all"); setSearch(""); setOpenScheme(s.id); }} />}
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
