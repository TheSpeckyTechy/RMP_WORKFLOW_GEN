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

const AppInner = () => {
  const [view, setView] = React.useState("dashboard");
  const [openScheme, setOpenScheme] = React.useState(null);
  const [filter, setFilter] = React.useState("all");
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

  React.useEffect(() => { if (view !== "dashboard") setFilter(view); }, [view]);

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
          <div className="searchbar"><Icon.Search /><input placeholder="Jump to scheme, ward, address…" /></div>
          <button className="btn ghost sm"><Icon.Bell /></button>
        </header>
        <div className="content">
          {openScheme ? (
            <SchemeDetail schemeId={openScheme} onBack={() => setOpenScheme(null)} onGenerate={setGenerating} onPreview={(scheme, docKey) => setPreviewing({ scheme, docKey })} />
          ) : (
            <Dashboard onOpen={setOpenScheme} filter={filter} setFilter={setFilter} />
          )}
        </div>
      </div>
      {generating && <GenerateModal scheme={generating} onClose={() => setGenerating(null)} />}
      {previewing?.docKey === "rsr" && <RSRModal scheme={previewing.scheme} onClose={() => setPreviewing(null)} />}
      {previewing?.docKey === "pci" && <PCIModal scheme={previewing.scheme} onClose={() => setPreviewing(null)} />}
      {previewing?.docKey === "letter" && <LetterModal scheme={previewing.scheme} onClose={() => setPreviewing(null)} />}
      {tweaksOn && <Tweaks tweaks={tweaks} setTweaks={setTweaks} />}
    </div>
  );
};

const App = () => (
  <SchemeProvider>
    <AppInner />
  </SchemeProvider>
);

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
