// ─── Dashboard.jsx ─────────────────────────────────────────────────────────
// Main overview page: stats strip, status filter chips, schemes data table.
// Reads all schemes from SchemeContext — no direct data imports.
//
// Props:
//   onOpen     (fn)     — called with schemeId when a table row is clicked
//   filter     (string) — active status filter key
//   setFilter  (fn)     — updates the active filter
//
// Exports (via window): Dashboard
// Depends on: React, window.SchemeContext, window.Icon,
//             window.fmtGBP, window.STATUS_LABELS, window.WARDS
// ─────────────────────────────────────────────────────────────────────────────

const COMPLETENESS_FIELDS = ['scheme_extent','grid_ref','date_start','date_finish','contractor','treatment_type','prepared_by'];
const schemeScore = (s) => {
  const filled = COMPLETENESS_FIELDS.filter(k => s[k] && String(s[k]).trim() !== '').length;
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
};

const exportRegister = (list) => {
  const XLSX = window.XLSX;
  const headers = ["Project No.", "Road Name", "Ward", "Treatment", "Area (m²)", "Tender (£)", "Status", "Start", "Finish"];
  const rows = list.map(s => [
    s.project_number||"", s.road_name||"",
    s.ward_selected||"", s.treatment_type||"",
    window.schemeArea(s), +s.tender_total||0,
    window.STATUS_LABELS[s.status]||s.status,
    s.date_start||"", s.date_finish||"",
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [12,28,18,24,10,12,12,12,12].map(w=>({wch:w}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Schemes");
  XLSX.writeFile(wb, `RMP_Register_${new Date().toISOString().slice(0,10)}.xlsx`);
};

const parseStartDate = (s) => {
  if (!s) return Infinity;
  const parts = s.split('/');
  if (parts.length !== 3) return Infinity;
  return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
};

const isUrgentScheme = (s) => {
  const ms = parseStartDate(s.date_start);
  if (!isFinite(ms)) return false;
  const now = Date.now();
  return ms > now && ms - now <= 42 * 24 * 60 * 60 * 1000;
};

const Dashboard = ({ onOpen, onNew, filter, setFilter, search }) => {
  const { schemes, resetAllSchemes, updateScheme } = React.useContext(window.SchemeContext);
  const handleReset = async () => {
    const ask = window.confirmDialog || ((o) => Promise.resolve(window.confirm(o.body || o.title)));
    const ok = await ask({
      title: 'Reset the whole automation?',
      body: 'This clears all local scheme edits and reloads the app with the default schemes. Cross-device data in Supabase is not affected.',
      confirmLabel: 'Reset',
      danger: true,
    });
    if (ok) {
      resetAllSchemes();
      if (window.Toast) window.Toast.show({ kind: 'info', msg: 'Automation reset to defaults.' });
    }
  };
  const statusFiltered = filter === "all" ? schemes.filter(s => s.status !== 'constructed') : schemes.filter(s => s.status === filter);
  const list = (search
    ? statusFiltered.filter(s => {
        const q = search.toLowerCase();
        return (s.project_number||"").toLowerCase().includes(q) ||
               (s.road_name||"").toLowerCase().includes(q) ||
               (s.ward_selected||"").toLowerCase().includes(q) ||
               (s.scheme_extent||"").toLowerCase().includes(q) ||
               (s.treatment_type||"").toLowerCase().includes(q);
      })
    : statusFiltered).slice().sort((a, b) => {
      const ua = isUrgentScheme(a), ub = isUrgentScheme(b);
      if (ua !== ub) return ua ? -1 : 1;
      return parseStartDate(a.date_start) - parseStartDate(b.date_start);
    });
  const activeSchemes = schemes.filter(s => s.status !== "archived" && s.status !== "constructed");
  const totals = {
    live: activeSchemes.length,
    urgent: activeSchemes.filter(s => isUrgentScheme(s)).length,
    tender: activeSchemes.reduce((a,s) => a + (+s.tender_total||0), 0),
    m2: activeSchemes.reduce((a,s) => a + (window.schemeArea(s)), 0),
    ready: activeSchemes.filter(s => s.packProgress === s.packTotal).length,
  };
  const filters = [
    { k: "all", l: "All" },{ k: "design", l: "In design" },{ k: "review", l: "In review" },
    { k: "ready", l: "Ready" },{ k: "works", l: "On site" },{ k: "constructed", l: "Constructed" },{ k: "archived", l: "Archived" },
  ];
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Schemes</h1>
          <p className="page-sub">Your RMP design workload — from survey to handover pack, in one place.</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn ghost" onClick={handleReset} title="Clear all local scheme data and reload">↺ Reset automation</button>
          <button className="btn" onClick={()=>exportRegister(list)}><Icon.Download /> Export register</button>
          <button className="btn accent" onClick={onNew}><Icon.Plus /> New scheme <span className="kbd">N</span></button>
        </div>
      </div>
      <div className="stats">
        <div className="stat"><div className="stat-label">Live schemes</div><div className="stat-value">{totals.live}</div><div className="stat-meta">FY 2025/26 + 2026/27</div></div>
        <div className="stat"><div className="stat-label">Starts within 6 weeks</div><div className="stat-value" style={totals.urgent>0?{color:'var(--amber)'}:{}}>{totals.urgent}</div><div className="stat-meta">{totals.urgent>0?'⚡ Action required':'All future schemes have time'}</div></div>
        <div className="stat"><div className="stat-label">Total area</div><div className="stat-value">{totals.m2.toLocaleString()}<span className="unit">m²</span></div><div className="stat-meta">across {totals.live} roads</div></div>
        <div className="stat"><div className="stat-label">Packs ready to issue</div><div className="stat-value">{totals.ready}<span className="unit">/ {totals.live}</span></div><div className="stat-meta">auto-generated from workbook</div></div>
      </div>
      <div className="filters">
        {filters.map(f => <button key={f.k} className={"chip "+(filter===f.k?"active":"")} onClick={()=>setFilter(f.k)}>{f.l}</button>)}
        <div style={{ marginLeft:"auto", fontSize:12, color:"var(--ink-3)", fontFamily:"var(--font-mono)" }}>{search ? `${list.length} result${list.length!==1?"s":""} for "${search}"` : `${list.length} of ${schemes.length}`}</div>
      </div>
      <div className="table-wrap">
        <table className="schemes">
          <thead><tr><th>Ref</th><th>Scheme</th><th>Start</th><th>Ward</th><th>Treatment</th><th>Area</th><th>Tender</th><th>Pack</th><th>Complete</th><th>Status</th><th style={{width:30}}></th></tr></thead>
          <tbody>
            {list.map(s => {
              const ward = window.WARDS.find(w => w.num === s.ward_num);
              const pct = (s.packProgress / s.packTotal) * 100;
              const score = schemeScore(s);
              const scoreColor = score === 100 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red,#c0392b)';
              const urgent = isUrgentScheme(s);
              return (
                <tr key={s.id} onClick={() => onOpen(s.id)} style={urgent ? {background:'var(--amber-wash)'} : {}}>
                  <td><span className="row-ref mono">{s.project_number}</span>{s.flags&&s.flags.length>0&&<span style={{marginLeft:6,color:"var(--amber)",display:"inline-flex",verticalAlign:"middle"}}><Icon.Alert /></span>}</td>
                  <td>
                    <div className="row-name">{s.road_name}{urgent && <span className="urgent-chip">⚡ Urgent</span>}</div>
                    <div className="row-sub">{s.scheme_extent}</div>
                  </td>
                  <td className="mono" style={{fontSize:11,whiteSpace:'nowrap'}}>{s.date_start||'—'}</td>
                  <td><span className="mono" style={{fontSize:11,color:"var(--ink-3)"}}>W{ward?.num}</span> <span style={{fontSize:12}}>{ward?.name}</span></td>
                  <td style={{fontSize:12,color:"var(--ink-2)"}}>{s.treatment_type}<div className="row-sub">{s.total_depth_mm}mm · {s.scheme_type}</div></td>
                  <td className="mono" style={{fontSize:12}}>{window.schemeArea(s).toLocaleString()} m²</td>
                  <td className="mono" style={{fontSize:12}}>{fmtGBP(+s.tender_total||0)}</td>
                  <td><div className="pack-bar"><div className="pack-bar-track"><div className={"pack-bar-fill "+(pct===100?"full":"")} style={{width:pct+"%"}}></div></div><div className="pack-bar-count">{s.packProgress}/{s.packTotal}</div></div></td>
                  <td><span className="mono" style={{fontSize:12,fontWeight:600,color:scoreColor}}>{score}%</span></td>
                  <td><span className={"pill "+s.status}>{STATUS_LABELS[s.status]}</span></td>
                  <td style={{color:"var(--ink-3)",display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end"}}>
                    {s.status !== 'constructed' && (
                      <button
                        className="btn-construct"
                        title="Mark as Constructed"
                        onClick={e => { e.stopPropagation(); updateScheme(s.id, { status: 'constructed' }); }}
                      >✓</button>
                    )}
                    <Icon.Arrow />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

window.Dashboard = Dashboard;
