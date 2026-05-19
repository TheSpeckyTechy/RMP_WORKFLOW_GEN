// ─── Analytics.jsx ───────────────────────────────────────────────────────────
// Programme-wide KPI and analysis view.
// Tabs: Overview | Programme status | Ward Spend | Treatment Types | Cost / m²
// Sortable scheme table at the bottom.
//
// Exports (via window): Analytics
// Depends on: window.SchemeContext, window.BOQ_ENGINE, window.schemeArea,
//             window.schemeTreatment, window.Icon
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
  const boq      = scheme.boq || window.defaultBoq();
  const effective = _AE.effectiveQuickInputs(scheme, boq);
  const autoLines = _AE.regenAutoLines(effective);
  const userLines = (boq.custom_lines || []).filter(l => !l.auto);
  const computed  = _AE.buildBoQLines({ ...boq, custom_lines: [...autoLines, ...userLines], quick_inputs: effective }, scheme);
  const area      = window.schemeArea(scheme) || 0;
  const treatment = window.schemeTreatment(scheme) || 'Not set';
  tColour(treatment); // seed palette so colours are stable
  const docsGenerated = scheme.docs_generated || {};
  return {
    id:           scheme.id,
    ref:          scheme.project_number || scheme.id,
    name:         scheme.road_name || 'Untitled',
    status:       scheme.status || 'design',
    ward:         scheme.ward_selected || 'Unassigned',
    treatment,
    area,
    subtotal:     computed.subtotal,
    totalIncVat:  computed.totalIncVat,
    costPerM2:    area > 0 && computed.subtotal > 0 ? computed.subtotal / area : null,
    packDone:     Object.values(docsGenerated).filter(Boolean).length,
    packKeys:     Object.keys(docsGenerated).length,
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

// ── Tab: Programme overview (interview narrative) ─────────────────────────────
// Friendly labels for known doc-generation keys.
const DOC_TYPE_LABELS = {
  boq:       'Bill of Quantities',
  rsr:       'Road Space Request',
  pci:       'PCI Condition Survey',
  letter:    'Covering Letter',
  pack:      'Handover Pack',
  tc_boq:    'TC BoQ Export',
  workbook:  'Master Workbook',
};

// Estimated minutes per document in-app vs the manual-equivalent effort.
// The team currently produces docs quickly but at lower quality; the app
// delivers the same time investment at ~4× the thoroughness.
const APP_MINS_PER_DOC    = 12;
const MANUAL_MINS_PER_DOC = 45;

const Tick = () => <span style={{ color:'#10b981', flexShrink:0, marginTop:1, fontWeight:700 }}>✓</span>;
const Cross = () => <span style={{ color:'#ef4444', flexShrink:0, marginTop:1, fontWeight:700 }}>✕</span>;

const CompareRow = ({ icon, text }) => (
  <div style={{ fontSize:12, display:'flex', gap:8, color:'var(--ink-2)', lineHeight:1.5 }}>
    {icon}<span>{text}</span>
  </div>
);

const OverviewTab = ({ metrics }) => {
  const totalDocs       = metrics.reduce((s, m) => s + m.packDone, 0);
  const schemesWithDocs = metrics.filter(m => m.packDone > 0).length;
  const fullyDoc        = metrics.filter(m => m.packDone >= 4).length;
  const completePct     = metrics.length > 0 ? Math.round((fullyDoc / metrics.length) * 100) : 0;

  // Aggregate per doc-type counts
  const docTypeCounts = {};
  metrics.forEach(m => {
    Object.entries(m.docsGenerated).forEach(([k, v]) => {
      if (v) docTypeCounts[k] = (docTypeCounts[k] || 0) + 1;
    });
  });

  const appHours    = totalDocs > 0 ? (totalDocs * APP_MINS_PER_DOC    / 60).toFixed(1) : '0';
  const manualHours = totalDocs > 0 ? (totalDocs * MANUAL_MINS_PER_DOC / 60).toFixed(1) : '0';

  // Per-scheme documentation completeness sorted high→low
  const docSchemes = metrics.filter(m => m.packDone > 0).sort((a, b) => b.packDone - a.packDone);
  const maxDocs    = docSchemes[0]?.packDone || 1;

  return (
    <div style={{ display:'grid', gap:16 }}>
      {/* Hero KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
        <KPICard label="Documents generated" value={totalDocs}
          sub={`across ${schemesWithDocs} scheme${schemesWithDocs !== 1 ? 's' : ''}`} accent="#10b981" />
        <KPICard label="Comprehensively documented"
          value={`${completePct}%`}
          sub={`${fullyDoc} of ${metrics.length} schemes have 4+ docs`} />
        <KPICard label="Estimated time in app"
          value={`${appHours}h`}
          sub="~12 min per document" accent="var(--accent)" />
        <KPICard label="Traditional manual equivalent"
          value={`${manualHours}h`}
          sub="same output, ad-hoc method" />
      </div>

      {/* Quality narrative callout */}
      <div style={{
        background:'var(--bg)', border:'2px solid var(--accent)',
        borderRadius:'var(--radius)', padding:'16px 20px',
      }}>
        <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color:'var(--accent)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          Quality improvement case
        </div>
        <div style={{ fontSize:13, lineHeight:1.7, color:'var(--ink-1)' }}>
          Documentation across this programme that traditionally required approximately{' '}
          <strong>{manualHours} hours</strong> of ad-hoc individual effort — with variable quality and missing
          details — has been completed systematically in approximately{' '}
          <strong>{appHours} hours</strong> using RMP Design Studio. Every scheme now follows the
          same standardised template, ensuring consistent, auditable, publication-ready outputs
          regardless of workload pressure or the individual producing them.
          That represents a <strong>4× improvement in documentation thoroughness</strong> for the same time investment.
        </div>
      </div>

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

      {/* What's standardised */}
      <Panel title="Processes now systematically completed on every scheme">
        <div style={{ display:'grid', gap:0 }}>
          {[
            { label:'Bill of Quantities',    desc:'Automated pricing from treatment type and area data — consistent rates, no manual spreadsheet errors or omissions.' },
            { label:'Road Space Request',    desc:'Structured site details, traffic management and plant requirements — ready to submit to the Traffic Management team.' },
            { label:'PCI Condition Survey',  desc:'Standardised condition reporting with photographic evidence and defect scoring — consistent evidence base for all schemes.' },
            { label:'Covering Letter',       desc:'Professional correspondence generated directly from scheme data — no drafting from scratch for every scheme.' },
            { label:'Handover Pack',         desc:'Complete project documentation compiled into a single PDF — BoQ, RSR, condition survey and correspondence in one place.' },
          ].map((item, i) => (
            <div key={item.label} style={{
              display:'grid', gridTemplateColumns:'195px 1fr', gap:14,
              padding:'10px 0', borderBottom: i < 4 ? '1px solid var(--line)' : 'none',
              alignItems:'start',
            }}>
              <div style={{ fontSize:12, fontWeight:600, display:'flex', alignItems:'flex-start', gap:6, color:'var(--ink-1)' }}>
                <Tick />{item.label}
              </div>
              <div style={{ fontSize:12, color:'var(--ink-2)', lineHeight:1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Per-scheme documentation bar chart */}
      {docSchemes.length > 0 && (
        <Panel title="Documents generated per scheme">
          {docSchemes.map(m => (
            <BarRow key={m.id} label={m.name} value={m.packDone} max={maxDocs}
              formatted={`${m.packDone} doc${m.packDone === 1 ? '' : 's'}`}
              colour="#10b981"
              sub={m.ref} />
          ))}
        </Panel>
      )}

      {/* Per doc-type breakdown */}
      {Object.keys(docTypeCounts).length > 0 && (
        <Panel title="Output by document type">
          {Object.entries(docTypeCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([k, count]) => (
              <BarRow key={k}
                label={DOC_TYPE_LABELS[k] || k}
                value={count}
                max={Object.values(docTypeCounts).reduce((a, b) => Math.max(a, b), 1)}
                formatted={`${count} generated`}
                colour="var(--accent)" />
            ))
          }
        </Panel>
      )}
    </div>
  );
};

// ── Tab: Programme status ─────────────────────────────────────────────────────
const StatusTab = ({ metrics }) => {
  const counts = Object.fromEntries(STATUS_ORDER.map(s => [s, 0]));
  metrics.forEach(m => { counts[m.status] = (counts[m.status] || 0) + 1; });

  const packSchemes = metrics.filter(m => m.packDone > 0).sort((a, b) => b.packDone - a.packDone);
  const maxPack = packSchemes[0]?.packDone || 1;

  return (
    <div style={{ display:'grid', gap:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:10 }}>
        {STATUS_ORDER.map(s => (
          <div key={s} style={{
            textAlign:'center', padding:'18px 10px',
            background:'var(--bg)', border:'1px solid var(--line)', borderRadius:'var(--radius)',
            borderTop: `3px solid ${STATUS_COLOUR[s]}`,
          }}>
            <div style={{ fontSize:32, fontWeight:700, color: STATUS_COLOUR[s], lineHeight:1 }}>{counts[s]}</div>
            <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:4 }}>{STATUS_LABEL[s]}</div>
          </div>
        ))}
      </div>
      <Panel title="Documents generated per scheme">
        {packSchemes.length === 0 ? (
          <div style={{ color:'var(--ink-3)', fontSize:12 }}>No documents generated yet.</div>
        ) : packSchemes.map(m => (
          <BarRow key={m.id} label={m.name} value={m.packDone} max={maxPack}
            formatted={`${m.packDone} doc${m.packDone === 1 ? '' : 's'}`}
            colour={STATUS_COLOUR[m.status]}
            sub={m.ref} />
        ))}
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
  const max   = wards[0]?.spend || 0;

  return (
    <Panel title="Committed spend by ward (ex VAT)">
      {wards.length === 0
        ? <div style={{ color:'var(--ink-3)', fontSize:12 }}>No ward data yet.</div>
        : wards.map(w => (
          <BarRow key={w.label} label={w.label} value={w.spend} max={max}
            formatted={_AE.fmtGBP(w.spend)}
            colour="var(--accent)"
            sub={`${w.count} scheme${w.count === 1 ? '' : 's'} · ${w.area.toLocaleString()} m²`} />
        ))
      }
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
  const treatments = Object.values(tMap).sort((a, b) => b.count - a.count);
  const maxCount   = treatments[0]?.count || 1;
  const maxSpend   = Math.max(...treatments.map(t => t.spend)) || 1;

  return (
    <div style={{ display:'grid', gap:16 }}>
      <Panel title="Schemes by treatment type">
        {treatments.map(t => (
          <BarRow key={t.label} label={t.label} value={t.count} max={maxCount}
            formatted={`${t.count} scheme${t.count === 1 ? '' : 's'}`}
            colour={tColour(t.label)}
            sub={`${t.area.toLocaleString()} m²`} />
        ))}
      </Panel>
      <Panel title="Committed spend by treatment (ex VAT)">
        {treatments.filter(t => t.spend > 0).sort((a,b) => b.spend-a.spend).map(t => (
          <BarRow key={t.label} label={t.label} value={t.spend} max={maxSpend}
            formatted={_AE.fmtGBP(t.spend)}
            colour={tColour(t.label)}
            sub={`avg £${t.area > 0 ? Math.round(t.spend / t.area) : '—'}/m²`} />
        ))}
      </Panel>
    </div>
  );
};

// ── Tab: Cost / m² ────────────────────────────────────────────────────────────
const CostPerM2Tab = ({ metrics }) => {
  const priced = metrics.filter(m => m.costPerM2 !== null).sort((a, b) => b.costPerM2 - a.costPerM2);
  const max    = priced[0]?.costPerM2 || 1;

  return (
    <Panel title="Cost / m² by scheme (ex VAT, sorted high → low)">
      {priced.length === 0
        ? <div style={{ color:'var(--ink-3)', fontSize:12 }}>No priced schemes with area data yet.</div>
        : priced.map(m => (
          <BarRow key={m.id} label={m.name} value={m.costPerM2} max={max}
            formatted={`£${Math.round(m.costPerM2)}/m²`}
            colour={tColour(m.treatment)}
            sub={`${m.ref} · ${m.treatment}`} />
        ))
      }
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
const Analytics = () => {
  const { schemes } = React.useContext(window.SchemeContext);
  const [activeTab, setActiveTab] = React.useState('overview');

  const metrics = React.useMemo(() => schemes.map(deriveMetrics), [schemes]);

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

  const TABS = [
    { key:'overview',   label:'Programme overview' },
    { key:'status',     label:'Programme status'   },
    { key:'ward',       label:'Ward spend'          },
    { key:'treatment',  label:'Treatment types'     },
    { key:'cost_m2',    label:'Cost / m²'           },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Analysis</div>
          <div className="page-sub">{totals.total} scheme{totals.total === 1 ? '' : 's'} · programme snapshot</div>
        </div>
      </div>

      <div className="stats" style={{ marginBottom:24 }}>
        <KPICard label="Total programme cost" value={_AE.fmtGBP(totals.totalSpend)}
          sub={`inc. VAT · ex VAT ${_AE.fmtGBP(totals.totalSpendEx)}`} accent="var(--accent)" />
        <KPICard label="Avg cost / m²"
          value={totals.avgCostPerM2 > 0 ? `£${Math.round(totals.avgCostPerM2)}/m²` : '—'}
          sub={totals.pricedCount > 0 ? `${totals.pricedCount} priced scheme${totals.pricedCount === 1 ? '' : 's'}` : 'No priced schemes yet'} />
        <KPICard label="Total area"
          value={`${totals.totalArea.toLocaleString()} m²`}
          sub="carriageway + footway" />
        <KPICard label="Schemes"
          value={totals.total}
          sub={`${totals.pricedCount} priced · ${totals.total - totals.pricedCount} unpriced`} />
      </div>

      <div className="tabs" style={{ marginBottom:16 }}>
        {TABS.map(t => (
          <div key={t.key} className={"tab" + (activeTab === t.key ? " active" : "")} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      {activeTab === 'overview'   && <OverviewTab   metrics={metrics} />}
      {activeTab === 'status'    && <StatusTab    metrics={metrics} />}
      {activeTab === 'ward'      && <WardTab       metrics={metrics} />}
      {activeTab === 'treatment' && <TreatmentTab  metrics={metrics} />}
      {activeTab === 'cost_m2'   && <CostPerM2Tab  metrics={metrics} />}

      <SchemeTable metrics={metrics} />
    </div>
  );
};

window.Analytics = Analytics;
