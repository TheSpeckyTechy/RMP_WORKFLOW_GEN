// ─── Analytics.jsx ───────────────────────────────────────────────────────────
// Programme-wide KPI and analysis view.
// Tabs: Overview | Programme status | Ward Spend | Treatment Types | Cost / m²
// Sortable scheme table at the bottom.
//
// Exports (via window): Analytics
// Depends on: window.SchemeContext, window.BOQ_ENGINE, window.schemeArea,
//             window.schemeTreatment, window.Icon, window.Chart, window.useCounter
// ─────────────────────────────────────────────────────────────────────────────

const _AE = window.BOQ_ENGINE;

// ── Colour maps ───────────────────────────────────────────────────────────────
const STATUS_ORDER  = ['design','review','ready','works','constructed','archived'];
const STATUS_COLOUR = { design:'#3b82f6', review:'#f59e0b', ready:'#10b981', works:'#8b5cf6', constructed:'#1a7a3a', archived:'#9ca3af' };
const STATUS_LABEL  = { design:'Design', review:'Review', ready:'Ready', works:'Works', constructed:'Constructed', archived:'Archived' };

const TREATMENT_PALETTE = ['#c46a2c','#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#84cc16','#f97316','#a855f7'];
const _tColourMap = {};
let   _tColourIdx = 0;
const tColour = (t) => { if (!_tColourMap[t]) _tColourMap[t] = TREATMENT_PALETTE[_tColourIdx++ % TREATMENT_PALETTE.length]; return _tColourMap[t]; };

// ── Per-scheme metric derivation ─────────────────────────────────────────────
const deriveMetrics = (scheme) => {
  const boq       = scheme.boq || window.defaultBoq();
  const effective = _AE.effectiveQuickInputs(scheme, boq);
  const autoLines = _AE.regenAutoLines(effective);
  const userLines = (boq.custom_lines || []).filter(l => !l.auto);
  const computed  = _AE.buildBoQLines({ ...boq, custom_lines: [...autoLines, ...userLines], quick_inputs: effective }, scheme);
  const area      = window.schemeArea(scheme) || 0;
  const treatment = window.schemeTreatment(scheme) || 'Not set';
  tColour(treatment);
  const docsGenerated = scheme.docs_generated || {};
  return {
    id:          scheme.id,
    ref:         scheme.project_number || scheme.id,
    name:        scheme.road_name || 'Untitled',
    status:      scheme.status || 'design',
    ward:        scheme.ward_selected || 'Unassigned',
    treatment,
    area,
    subtotal:    computed.subtotal,
    totalIncVat: computed.totalIncVat,
    costPerM2:   area > 0 && computed.subtotal > 0 ? computed.subtotal / area : null,
    packDone:    (window.PACK_DOCS || []).filter(d => !!docsGenerated[d.key]).length,
    packKeys:    Object.keys(docsGenerated).length,
    docsGenerated,
  };
};

// ── Small shared components ───────────────────────────────────────────────────
const KPICard = ({ label, value, sub, accent }) => (
  <div className="stat" style={accent ? { borderTop: `3px solid ${accent}` } : {}}>
    <div className="stat-label">{label}</div>
    <div className="stat-value" style={{ fontSize: 22 }}>{value}</div>
    {sub && <div className="stat-meta">{sub}</div>}
  </div>
);

const BarRow = ({ label, value, max, formatted, colour, sub }) => {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'180px 1fr 110px', gap:10, alignItems:'center', padding:'5px 0' }}>
      <div style={{ fontSize:12, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={label}>{label}</div>
      <div style={{ height:18, background:'var(--bg-sunken)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background: colour || 'var(--accent)', borderRadius:3, transition:'width 0.4s ease' }} />
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:12, fontWeight:600, fontFamily:'var(--font-mono)' }}>{formatted}</div>
        {sub && <div style={{ fontSize:10, color:'var(--ink-3)', fontFamily:'var(--font-mono)' }}>{sub}</div>}
      </div>
    </div>
  );
};

const Panel = ({ title, children }) => (
  <div style={{ background:'var(--bg)', border:'1px solid var(--line)', borderRadius:'var(--radius)', padding:'16px 20px' }}>
    {title && <div style={{ fontSize:12, fontWeight:600, marginBottom:14, paddingBottom:10, borderBottom:'1px solid var(--line)' }}>{title}</div>}
    {children}
  </div>
);

// ── Date helpers ──────────────────────────────────────────────────────────────
const parseDMY = (s) => {
  if (!s) return null;
  const [d, m, y] = s.split('/').map(Number);
  if (!y) return null;
  return new Date(y, m - 1, d).getTime();
};

const parseMonth = (dmy) => {
  if (!dmy) return -1;
  const p = dmy.split('/');
  if (p.length !== 3) return -1;
  return ((+p[1] - 1) - 3 + 12) % 12; // Apr=0 … Mar=11
};

// ── Chart colour helpers (dark-mode-aware) ────────────────────────────────────
// Read from CSS custom properties so charts remain legible in both themes.
const _cv = (name, fallback) => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
};
const chartBorderColor  = () => _cv('--bg',    '#ffffff');
const chartLabelColor   = () => _cv('--ink-2', '#444');
const chartMutedColor   = () => _cv('--ink-3', '#888');
const chartGridColor    = () => _cv('--line',   '#e4e4e4');

// ── Chart.js: Status doughnut ─────────────────────────────────────────────────
const StatusDonut = ({ schemes }) => {
  const canvasRef = React.useRef();
  const chartRef  = React.useRef();
  // Serialize only the status counts so the effect only fires when data changes,
  // not when the schemes array reference changes (e.g. during animation ticks).
  const countsKey = React.useMemo(() => {
    const counts = STATUS_ORDER.map(s => schemes.filter(x => x.status === s).length);
    return JSON.stringify(counts);
  }, [schemes]);
  React.useEffect(() => {
    if (!window.Chart || !canvasRef.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const counts = JSON.parse(countsKey);
    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels: STATUS_ORDER.map(s => STATUS_LABEL[s] || s),
        datasets: [{ data: counts, backgroundColor: STATUS_ORDER.map(s => STATUS_COLOUR[s]), borderWidth: 2, borderColor: chartBorderColor() }],
      },
      options: {
        cutout: '68%',
        animation: { animateRotate: true, duration: 900 },
        plugins: {
          legend: { position: 'right', labels: { font: { family: 'Inter', size: 12 }, padding: 14, color: chartLabelColor() } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} scheme${ctx.raw !== 1 ? 's' : ''}` } },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [countsKey]);
  return <canvas ref={canvasRef} style={{ maxHeight: 220 }} />;
};

// ── Chart.js: Monthly workload bar ────────────────────────────────────────────
const WorkloadChart = ({ schemes }) => {
  const canvasRef = React.useRef();
  const chartRef  = React.useRef();
  // Serialize only starts/finishes counts so the effect only fires on actual data changes.
  const dataKey = React.useMemo(() => {
    const starts   = Array(12).fill(0);
    const finishes = Array(12).fill(0);
    schemes.forEach(s => {
      const sm = parseMonth(s.date_start);
      const fm = parseMonth(s.date_finish);
      if (sm >= 0) starts[sm]++;
      if (fm >= 0) finishes[fm]++;
    });
    return JSON.stringify({ starts, finishes });
  }, [schemes]);
  React.useEffect(() => {
    if (!window.Chart || !canvasRef.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const months = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
    const { starts, finishes } = JSON.parse(dataKey);
    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          { label: 'Starting', data: starts,   backgroundColor: '#3b82f6cc', borderRadius: 4, borderSkipped: false },
          { label: 'Finishing', data: finishes, backgroundColor: '#10b981cc', borderRadius: 4, borderSkipped: false },
        ],
      },
      options: {
        animation: { duration: 800 },
        plugins: { legend: { position: 'top', labels: { font: { family: 'Inter', size: 11 }, padding: 12, color: chartLabelColor() } } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Inter', size: 10 }, color: chartMutedColor() }, grid: { color: chartGridColor() } },
          x: { ticks: { font: { family: 'Inter', size: 10 }, color: chartMutedColor() }, grid: { display: false } },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [dataKey]);
  return <canvas ref={canvasRef} style={{ maxHeight: 220 }} />;
};

// ── Chart.js: Horizontal bar (replaces BarRow in ward/treatment/cost tabs) ────
const HorizBarChart = ({ labels, values, colours, formatTooltip }) => {
  const canvasRef = React.useRef();
  const chartRef  = React.useRef();
  // Stable key: only rebuild the chart when the displayed data genuinely changes.
  const dataKey = JSON.stringify({ labels, values, colours });
  const h = Math.max(180, labels.length * 34);
  React.useEffect(() => {
    if (!window.Chart || !canvasRef.current || !labels.length) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const { labels: l, values: v, colours: c } = JSON.parse(dataKey);
    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: l,
        datasets: [{ data: v, backgroundColor: c || '#c46a2c', borderRadius: 4, borderSkipped: false }],
      },
      options: {
        indexAxis: 'y',
        animation: { duration: 700 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: formatTooltip || (ctx => ` ${ctx.raw}`) } },
        },
        scales: {
          x: { beginAtZero: true, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: chartMutedColor() }, grid: { color: chartGridColor() } },
          y: { ticks: { font: { family: 'Inter', size: 11 }, color: chartLabelColor() }, grid: { display: false } },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [dataKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={canvasRef} style={{ height: h, maxHeight: h }} />;
};

// ── CSS Gantt timeline ────────────────────────────────────────────────────────
const GANTT_START  = new Date(2026, 3, 1).getTime();
const GANTT_END    = new Date(2027, 3, 1).getTime();
const GANTT_SPAN   = GANTT_END - GANTT_START;
const GANTT_MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
const TYPE_COLOUR  = { 'Carriageway':'#3b82f6', 'Footway':'#10b981', 'Surface Dressing':'#f59e0b' };
const ganttColour  = (s) => TYPE_COLOUR[s.scheme_type] || tColour(window.schemeTreatment(s) || 'other');

const ProgrammeGantt = ({ schemes }) => {
  const dated   = [...schemes].filter(s => s.date_start).sort((a, b) => parseDMY(a.date_start) - parseDMY(b.date_start));
  const undated = schemes.filter(s => !s.date_start);
  const todayPct = ((Date.now() - GANTT_START) / GANTT_SPAN) * 100;
  const showToday = todayPct >= 0 && todayPct <= 100;

  return (
    <div className="gantt-section">
      <div className="gantt-section-title">Programme timeline · Apr 2026 → Mar 2027</div>
      <div className="gantt-outer">
        <div className="gantt-header" style={{ height: 18, minWidth: 600, position: 'relative' }}>
          {GANTT_MONTHS.map((m, i) => (
            <div key={m} className="gantt-month-label" style={{ left: `${(i / 12) * 100}%` }}>{m}</div>
          ))}
        </div>
        {dated.map((s, idx) => {
          const startMs  = parseDMY(s.date_start);
          const finishMs = parseDMY(s.date_finish);
          const leftPct  = ((startMs - GANTT_START) / GANTT_SPAN) * 100;
          const rightPct = finishMs ? ((finishMs - GANTT_START) / GANTT_SPAN) * 100 : leftPct + 1;
          const widthPct = Math.max(0.5, rightPct - leftPct);
          const clampL   = Math.max(0, Math.min(99, leftPct));
          const colour   = ganttColour(s);
          const inRange  = startMs >= GANTT_START - 86400000 * 90 && startMs <= GANTT_END + 86400000 * 90;
          const delay    = `${Math.min(idx * 12, 400)}ms`;
          return (
            <div key={s.id} className="gantt-row">
              <div className="gantt-label" title={s.road_name}>{s.road_name || s.project_number}</div>
              <div className="gantt-track">
                <div className="gantt-track-bg" />
                {showToday && <div className="gantt-today-line" style={{ left: `${todayPct}%` }} />}
                {inRange ? (
                  <div
                    className="gantt-bar"
                    style={{ left: `${clampL}%`, width: `${Math.min(widthPct, 100 - clampL)}%`, background: colour, animationDelay: delay }}
                    title={`${s.road_name} · ${s.date_start}${s.date_finish ? ' → ' + s.date_finish : ''}`}
                  >
                    {widthPct > 5 ? (s.project_number || '') : ''}
                  </div>
                ) : (
                  <div className="gantt-dot" style={{ left: '1%', background: colour, animationDelay: delay }}
                    title={`${s.road_name} (${s.date_start})`} />
                )}
              </div>
            </div>
          );
        })}
        {undated.length > 0 && (
          <div className="gantt-undated-label">{undated.length} scheme{undated.length !== 1 ? 's' : ''} without a start date</div>
        )}
      </div>
    </div>
  );
};

// ── Tab: Programme overview ───────────────────────────────────────────────────
const DOC_TYPE_LABELS = {
  boq:'Bill of Quantities', rsr:'Road Space Request', pci:'PCI Condition Survey',
  letter:'Covering Letter', pack:'Handover Pack', tc_boq:'TC BoQ Export', workbook:'Master Workbook',
};

const APP_MINS_PER_DOC    = 12;
const MANUAL_MINS_PER_DOC = 45;

const Tick  = () => <span style={{ color:'#10b981', flexShrink:0, marginTop:1, fontWeight:700 }}>✓</span>;
const Cross = () => <span style={{ color:'#ef4444', flexShrink:0, marginTop:1, fontWeight:700 }}>✕</span>;

const CompareRow = ({ icon, text }) => (
  <div style={{ fontSize:12, display:'flex', gap:8, color:'var(--ink-2)', lineHeight:1.5 }}>
    {icon}<span>{text}</span>
  </div>
);

const OverviewTab = ({ metrics, schemes }) => {
  const useCounter = window.useCounter || ((v) => v);

  const totalDocs       = metrics.reduce((s, m) => s + m.packDone, 0);
  const schemesWithDocs = metrics.filter(m => m.packDone > 0).length;
  const fullyDoc        = metrics.filter(m => m.packDone >= (window.PACK_DOCS || []).length).length;
  const completePct     = metrics.length > 0 ? Math.round((fullyDoc / metrics.length) * 100) : 0;
  const appHoursRaw     = totalDocs * APP_MINS_PER_DOC / 60;
  const manualHoursRaw  = totalDocs * MANUAL_MINS_PER_DOC / 60;

  const animDocs      = useCounter(totalDocs);
  const animComplete  = useCounter(completePct);
  const animAppX10    = useCounter(Math.round(appHoursRaw * 10));
  const animManualX10 = useCounter(Math.round(manualHoursRaw * 10));

  const docTypeCounts = {};
  metrics.forEach(m => { Object.entries(m.docsGenerated).forEach(([k, v]) => { if (v) docTypeCounts[k] = (docTypeCounts[k] || 0) + 1; }); });

  return (
    <div style={{ display:'grid', gap:16 }}>
      {/* Hero KPIs with animated counters */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
        <div className="stat" style={{ borderTop:'3px solid #10b981' }}>
          <div className="stat-label">Documents generated</div>
          <div className="stat-value">{animDocs}</div>
          <div className="stat-meta">across {schemesWithDocs} scheme{schemesWithDocs !== 1 ? 's' : ''}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Comprehensively documented</div>
          <div className="stat-value">{animComplete}<span className="unit">%</span></div>
          <div className="stat-meta">{fullyDoc} of {metrics.length} schemes, 4+ docs</div>
        </div>
        <div className="stat" style={{ borderTop:'3px solid var(--accent)' }}>
          <div className="stat-label">Time in app</div>
          <div className="stat-value">{(animAppX10 / 10).toFixed(1)}<span className="unit">h</span></div>
          <div className="stat-meta">~12 min per document</div>
        </div>
        <div className="stat">
          <div className="stat-label">Manual equivalent</div>
          <div className="stat-value">{(animManualX10 / 10).toFixed(1)}<span className="unit">h</span></div>
          <div className="stat-meta">ad-hoc, inconsistent approach</div>
        </div>
      </div>

      {/* Two-column chart row: status donut + monthly workload */}
      <div className="overview-charts-row">
        <Panel title="Scheme status breakdown">
          <StatusDonut schemes={schemes} />
        </Panel>
        <Panel title="Monthly programme workload">
          <WorkloadChart schemes={schemes} />
        </Panel>
      </div>

      {/* Programme Gantt timeline */}
      <Panel>
        <ProgrammeGantt schemes={schemes} />
      </Panel>

      {/* Quality narrative callout — collapsible to save space in day-to-day use */}
      <details className="quality-callout-details">
        <summary>
          <span>Quality improvement case</span>
          <span style={{ fontSize:10, fontWeight:400, opacity:0.7, textTransform:'none', letterSpacing:0 }}>click to expand</span>
        </summary>
        <div className="quality-callout-body">
          <div style={{ fontSize:13, lineHeight:1.7, color:'var(--ink-2)' }}>
            Documentation across this programme that traditionally required approximately{' '}
            <strong style={{ color:'var(--ink)' }}>{manualHoursRaw.toFixed(1)} hours</strong> of ad-hoc individual effort — with variable quality
            and missing details — has been completed systematically in approximately{' '}
            <strong style={{ color:'var(--ink)' }}>{appHoursRaw.toFixed(1)} hours</strong> using RMP Design Studio. Every scheme now follows the
            same standardised template, ensuring consistent, auditable, publication-ready outputs
            regardless of workload pressure or the individual producing them.
            That represents a <strong style={{ color:'var(--ink)' }}>4× improvement in documentation thoroughness</strong> for the same time investment.
          </div>
        </div>
      </details>

      {/* Before / After comparison */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Panel title="Without RMP Design Studio">
          <div style={{ display:'grid', gap:10 }}>
            {[
              'Documentation varies between team members in format and completeness',
              'BoQ rates manually looked up — prone to error and inconsistency',
              'RSR and letters drafted individually for each scheme',
              'No programme-wide view of spend, treatments, or quality',
              'Handover quality depends entirely on individual effort and time available',
            ].map((t, i) => <CompareRow key={i} icon={<Cross />} text={t} />)}
          </div>
        </Panel>
        <Panel title="With RMP Design Studio">
          <div style={{ display:'grid', gap:10 }}>
            {[
              'Every scheme follows the same standardised documentation workflow',
              'BoQ auto-generated from agreed JMCA rates — consistent and auditable',
              'RSR, PCI summary, letters and packs produced in minutes per scheme',
              'Programme-wide analysis visible at a glance — spend, treatments, quality',
              'Consistent handover quality regardless of who creates the scheme',
            ].map((t, i) => <CompareRow key={i} icon={<Tick />} text={t} />)}
          </div>
        </Panel>
      </div>

      {/* Standardised processes */}
      <Panel title="Processes now systematically completed on every scheme">
        <div style={{ display:'grid', gap:0 }}>
          {[
            { label:'Bill of Quantities',   desc:'Automated pricing from treatment type and area data — consistent rates, no manual spreadsheet errors or omissions.' },
            { label:'Road Space Request',   desc:'Structured site details, traffic management and plant requirements — ready to submit to the Traffic Management team.' },
            { label:'PCI Condition Survey', desc:'Standardised condition reporting with photographic evidence and defect scoring — consistent evidence base for all schemes.' },
            { label:'Covering Letter',      desc:'Professional correspondence generated directly from scheme data — no drafting from scratch for every scheme.' },
            { label:'Handover Pack',        desc:'Complete project documentation compiled into a single PDF — BoQ, RSR, condition survey and correspondence in one place.' },
          ].map((item, i) => (
            <div key={item.label} style={{ display:'grid', gridTemplateColumns:'195px 1fr', gap:14, padding:'10px 0', borderBottom: i < 4 ? '1px solid var(--line)' : 'none', alignItems:'start' }}>
              <div style={{ fontSize:12, fontWeight:600, display:'flex', alignItems:'flex-start', gap:6, color:'var(--ink-1)' }}>
                <Tick />{item.label}
              </div>
              <div style={{ fontSize:12, color:'var(--ink-2)', lineHeight:1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

// ── Tab: Programme status ─────────────────────────────────────────────────────
const StatusTab = ({ metrics }) => {
  const counts = Object.fromEntries(STATUS_ORDER.map(s => [s, 0]));
  metrics.forEach(m => { counts[m.status] = (counts[m.status] || 0) + 1; });

  const packSchemes = metrics.filter(m => m.packDone > 0).sort((a, b) => b.packDone - a.packDone);
  const maxPack     = packSchemes[0]?.packDone || 1;

  return (
    <div style={{ display:'grid', gap:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:10 }}>
        {STATUS_ORDER.map(s => (
          <div key={s} style={{ textAlign:'center', padding:'18px 10px', background:'var(--bg)', border:'1px solid var(--line)', borderRadius:'var(--radius)', borderTop:`3px solid ${STATUS_COLOUR[s]}` }}>
            <div style={{ fontSize:32, fontWeight:700, color:STATUS_COLOUR[s], lineHeight:1 }}>{counts[s]}</div>
            <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:4 }}>{STATUS_LABEL[s]}</div>
          </div>
        ))}
      </div>
      <Panel title="Documents generated per scheme">
        {packSchemes.length === 0
          ? <div style={{ color:'var(--ink-3)', fontSize:12 }}>No documents generated yet.</div>
          : packSchemes.map(m => (
            <BarRow key={m.id} label={m.name} value={m.packDone} max={maxPack}
              formatted={`${m.packDone} doc${m.packDone === 1 ? '' : 's'}`}
              colour={STATUS_COLOUR[m.status]} sub={m.ref} />
          ))
        }
      </Panel>
    </div>
  );
};

// ── Tab: Ward spend ───────────────────────────────────────────────────────────
const WardTab = ({ metrics }) => {
  const wardMap = {};
  metrics.forEach(m => {
    if (!wardMap[m.ward]) wardMap[m.ward] = { label: m.ward, spend: 0, area: 0, count: 0 };
    wardMap[m.ward].spend += m.subtotal;
    wardMap[m.ward].area  += m.area;
    wardMap[m.ward].count += 1;
  });
  const wards = Object.values(wardMap).sort((a, b) => b.spend - a.spend);
  if (wards.length === 0) {
    return <Panel title="Committed spend by ward (ex VAT)"><div style={{ color:'var(--ink-3)', fontSize:12 }}>No ward data yet.</div></Panel>;
  }
  return (
    <Panel title="Committed spend by ward (ex VAT)">
      <HorizBarChart
        labels={wards.map(w => `${w.label} (${w.count})`)}
        values={wards.map(w => Math.round(w.spend))}
        colours={wards.map(() => '#c46a2c')}
        formatTooltip={ctx => ` ${_AE.fmtGBP(ctx.raw)}`}
      />
    </Panel>
  );
};

// ── Tab: Treatment types ──────────────────────────────────────────────────────
const TreatmentTab = ({ metrics }) => {
  const tMap = {};
  metrics.forEach(m => {
    if (!tMap[m.treatment]) tMap[m.treatment] = { label: m.treatment, count: 0, area: 0, spend: 0 };
    tMap[m.treatment].count += 1;
    tMap[m.treatment].area  += m.area;
    tMap[m.treatment].spend += m.subtotal;
  });
  const treatments     = Object.values(tMap).sort((a, b) => b.count - a.count);
  const spendTreats    = [...treatments].filter(t => t.spend > 0).sort((a, b) => b.spend - a.spend);

  return (
    <div style={{ display:'grid', gap:16 }}>
      <Panel title="Schemes by treatment type">
        <HorizBarChart
          labels={treatments.map(t => t.label)}
          values={treatments.map(t => t.count)}
          colours={treatments.map(t => tColour(t.label))}
          formatTooltip={ctx => {
            const t = treatments[ctx.dataIndex];
            return t ? ` ${ctx.raw} scheme${ctx.raw !== 1 ? 's' : ''} · ${t.area.toLocaleString()} m²` : ` ${ctx.raw}`;
          }}
        />
      </Panel>
      {spendTreats.length > 0 && (
        <Panel title="Committed spend by treatment (ex VAT)">
          <HorizBarChart
            labels={spendTreats.map(t => t.label)}
            values={spendTreats.map(t => Math.round(t.spend))}
            colours={spendTreats.map(t => tColour(t.label))}
            formatTooltip={ctx => ` ${_AE.fmtGBP(ctx.raw)}`}
          />
        </Panel>
      )}
    </div>
  );
};

// ── Tab: Cost / m² ────────────────────────────────────────────────────────────
const CostPerM2Tab = ({ metrics }) => {
  const priced = metrics.filter(m => m.costPerM2 !== null).sort((a, b) => b.costPerM2 - a.costPerM2);
  if (priced.length === 0) {
    return <Panel title="Cost / m² by scheme"><div style={{ color:'var(--ink-3)', fontSize:12 }}>No priced schemes with area data yet.</div></Panel>;
  }
  return (
    <Panel title="Cost / m² by scheme (ex VAT, sorted high → low)">
      <HorizBarChart
        labels={priced.map(m => m.name)}
        values={priced.map(m => Math.round(m.costPerM2))}
        colours={priced.map(m => tColour(m.treatment))}
        formatTooltip={ctx => {
          const m = priced[ctx.dataIndex];
          return m ? ` £${ctx.raw}/m² · ${m.ref} · ${m.treatment}` : ` £${ctx.raw}/m²`;
        }}
      />
    </Panel>
  );
};

// ── Sortable scheme table ─────────────────────────────────────────────────────
const SchemeTable = ({ metrics }) => {
  const [sortKey, setSortKey] = React.useState('name');
  const [sortDir, setSortDir] = React.useState(1);

  const toggle = (k) => { if (sortKey === k) setSortDir(d => -d); else { setSortKey(k); setSortDir(1); } };

  const sorted = [...metrics].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    return av < bv ? -sortDir : av > bv ? sortDir : 0;
  });

  const TH = ({ k, right, children }) => (
    <div onClick={() => toggle(k)} style={{
      fontSize:10, textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:700,
      color: sortKey === k ? 'var(--accent)' : 'var(--ink-3)',
      cursor:'pointer', userSelect:'none', textAlign: right ? 'right' : 'left',
      display:'flex', alignItems:'center', gap:3, justifyContent: right ? 'flex-end' : 'flex-start',
    }}>
      {children}{sortKey === k && <span style={{ fontSize:9 }}>{sortDir > 0 ? '↑' : '↓'}</span>}
    </div>
  );

  const COLS = '80px 1fr 140px 120px 80px 110px 80px 90px';

  return (
    <div style={{ background:'var(--bg)', border:'1px solid var(--line)', borderRadius:'var(--radius)', overflow:'hidden', marginTop:20 }}>
      <div style={{ display:'grid', gridTemplateColumns:COLS, padding:'8px 14px', background:'var(--bg-sunken)', borderBottom:'2px solid var(--line)', gap:10 }}>
        <TH k="ref">Ref</TH>
        <TH k="name">Road</TH>
        <TH k="ward">Ward</TH>
        <TH k="treatment">Treatment</TH>
        <TH k="area" right>Area m²</TH>
        <TH k="subtotal" right>Cost ex VAT</TH>
        <TH k="costPerM2" right>£/m²</TH>
        <TH k="status">Status</TH>
      </div>
      {sorted.map((m, i) => (
        <div key={m.id} style={{
          display:'grid', gridTemplateColumns:COLS, padding:'7px 14px', gap:10,
          background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg-elev)',
          borderBottom:'1px solid var(--line)', fontSize:12, alignItems:'center',
        }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)' }}>{m.ref}</div>
          <div style={{ fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</div>
          <div style={{ fontSize:11, color:'var(--ink-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.ward}</div>
          <div style={{ fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            <span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background:tColour(m.treatment), marginRight:5, flexShrink:0 }} />
            {m.treatment}
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:11, textAlign:'right' }}>{m.area > 0 ? m.area.toLocaleString() : '—'}</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:11, textAlign:'right' }}>{m.subtotal > 0 ? _AE.fmtGBP(m.subtotal) : '—'}</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:11, textAlign:'right' }}>{m.costPerM2 ? `£${Math.round(m.costPerM2)}` : '—'}</div>
          <div>
            <span className="pill" style={{ background: STATUS_COLOUR[m.status] + '22', color: STATUS_COLOUR[m.status], fontSize:10 }}>
              {STATUS_LABEL[m.status] || m.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Analytics (top-level export) ──────────────────────────────────────────────
const Analytics = ({ designerView, setDesignerView }) => {
  const { schemes } = React.useContext(window.SchemeContext);
  const [activeTab, setActiveTab] = React.useState('overview');
  const useCounter = window.useCounter || ((v) => v);

  const designers = (window.DESIGNERS||[]).filter(d => d.id !== 'new');
  const activeDesigner = designerView ? designers.find(d => d.id === designerView) : null;
  // Memoize viewSchemes so its array identity only changes when the underlying
  // schemes data or the filter actually changes — not on every parent re-render
  // triggered by useCounter animation ticks.
  const viewSchemes = React.useMemo(
    () => designerView ? schemes.filter(s => s.assigned_designer_id === designerView) : schemes,
    [schemes, designerView]
  );

  const metrics = React.useMemo(() => viewSchemes.map(deriveMetrics), [viewSchemes]);

  const totals = React.useMemo(() => {
    const priced   = metrics.filter(m => m.subtotal > 0);
    const withArea = metrics.filter(m => m.costPerM2 !== null);
    return {
      totalSpend:   metrics.reduce((s, m) => s + m.totalIncVat, 0),
      totalSpendEx: metrics.reduce((s, m) => s + m.subtotal, 0),
      totalArea:    metrics.reduce((s, m) => s + m.area, 0),
      avgCostPerM2: withArea.length > 0 ? withArea.reduce((s, m) => s + m.costPerM2, 0) / withArea.length : 0,
      pricedCount:  priced.length,
      total:        metrics.length,
    };
  }, [metrics]);

  const animSpend   = useCounter(Math.round(totals.totalSpend));
  const animSpendEx = useCounter(Math.round(totals.totalSpendEx));
  const animArea    = useCounter(Math.round(totals.totalArea));
  const animCostM2  = useCounter(Math.round(totals.avgCostPerM2));
  const animTotal   = useCounter(totals.total);

  const TABS = [
    { key:'overview',   label:'Programme overview' },
    { key:'status',     label:'Programme status'   },
    { key:'ward',       label:'Ward spend'          },
    { key:'treatment',  label:'Treatment types'     },
    { key:'cost_m2',    label:'Cost / m²'           },
  ];

  return (
    <div>
      <div className="designer-selector">
        <button className={"designer-chip all" + (!designerView ? " active" : "")} onClick={() => setDesignerView && setDesignerView(null)}>Everyone</button>
        {designers.map(d => (
          <button key={d.id} className={"designer-chip" + (designerView === d.id ? " active" : "")}
            style={designerView === d.id ? { borderColor: d.colour } : {}}
            onClick={() => setDesignerView && setDesignerView(designerView === d.id ? null : d.id)}>
            <span className="designer-chip-avatar" style={{ background: d.colour }}>{d.initials}</span>
            {d.name.split(' ')[0]}
          </button>
        ))}
      </div>
      <div className="page-head">
        <div>
          <div className="page-title">{activeDesigner ? `${activeDesigner.name.split(' ')[0]}'s Analysis` : 'Analysis'}</div>
          <div className="page-sub">{totals.total} scheme{totals.total === 1 ? '' : 's'} · {activeDesigner ? `${activeDesigner.name}'s workload` : 'programme snapshot'}</div>
        </div>
      </div>

      <div className="stats" style={{ marginBottom:24 }}>
        <KPICard label="Total programme cost" value={_AE.fmtGBP(animSpend)}
          sub={`inc. VAT · ex VAT ${_AE.fmtGBP(animSpendEx)}`} accent="var(--accent)" />
        <KPICard label="Avg cost / m²"
          value={totals.avgCostPerM2 > 0 ? `£${animCostM2}/m²` : '—'}
          sub={totals.pricedCount > 0 ? `${totals.pricedCount} priced scheme${totals.pricedCount === 1 ? '' : 's'}` : 'No priced schemes yet'} />
        <KPICard label="Total area"
          value={`${animArea.toLocaleString()} m²`}
          sub="carriageway + footway" />
        <KPICard label="Schemes"
          value={animTotal}
          sub={`${totals.pricedCount} priced · ${totals.total - totals.pricedCount} unpriced`} />
      </div>

      <div className="tabs" style={{ marginBottom:16 }}>
        {TABS.map(t => (
          <button type="button" key={t.key} className={"tab" + (activeTab === t.key ? " active" : "")}
            onClick={() => setActiveTab(t.key)}
            style={{ background:'none', border:'none', cursor:'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview'   && <OverviewTab   metrics={metrics} schemes={viewSchemes} />}
      {activeTab === 'status'     && <StatusTab     metrics={metrics} />}
      {activeTab === 'ward'       && <WardTab        metrics={metrics} />}
      {activeTab === 'treatment'  && <TreatmentTab   metrics={metrics} />}
      {activeTab === 'cost_m2'    && <CostPerM2Tab   metrics={metrics} />}

      <SchemeTable metrics={metrics} />
    </div>
  );
};

window.Analytics = Analytics;
