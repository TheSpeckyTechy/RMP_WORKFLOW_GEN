// ─── BoQSummary.jsx ──────────────────────────────────────────────────────────
// Modernised visual summary strip for the BoQ tab. Sections (top → bottom):
//   1. Project header card
//   2. Cost breakdown bar (SVG stacked)
//   3. Series cards grid (click a card to expand its line list)
//   4. Grand total adjustment ladder (subtotal → additions → BERR → PWP → VAT → total)
//   5. Rates & adjustments footer (small-print context)
//
// Also renders a settings popover for the BERR / VAT / % Additions controls,
// since those live visibly next to the totals they affect.
//
// Exports: window.BoQSummary
// Depends on: window.BOQ_ENGINE, window.Icon
// ─────────────────────────────────────────────────────────────────────────────

const _E = window.BOQ_ENGINE;

// 12-entry series palette derived around the app accent. Keeps colour-vision
// friendliness in mind (rotates hue + slight chroma variation).
const SERIES_COLOUR = {
  100:  '#c65d2e',   // accent-warm
  200:  '#7a5a3a',
  300:  '#2e7a8a',
  400:  '#4a6fa5',
  500:  '#5b5ea8',   // drainage — indigo
  600:  '#3d7a5c',
  700:  '#b85c1a',   // pavements — deep orange (hero)
  1100: '#8a6a2a',
  1200: '#4a8a3d',
  2700: '#6b4a8a',
  3000: '#3d8a6d',
  6400: '#8a3d5c',
};

const colourFor = (n) => SERIES_COLOUR[n] || '#7a7a7a';

// ── Project header ───────────────────────────────────────────────────────────
const OverridesPanel = ({ scheme, boq, onRelink, onPushToMaster, onClose }) => {
  const derived = _E.deriveQuickInputsFromScheme(scheme);
  const stored  = boq.quick_inputs || {};
  const [toast, setToast] = React.useState('');
  const fmt = (v) => v === true ? 'Yes' : v === false ? 'No'
              : v == null || v === '' ? '—'
              : typeof v === 'number' ? v.toLocaleString() : String(v);
  const pushable = (key) => _E.schemePatchForOverride
    ? _E.schemePatchForOverride(key, stored[key], scheme) !== null
    : false;
  const handlePush = (key, value) => {
    onPushToMaster && onPushToMaster(key, value);
    setToast('Pushed to Master ✓');
    setTimeout(() => setToast(''), 2200);
  };
  const rows = _E.LINKED_FIELDS
    .filter(f => boq.overrides && boq.overrides[f.key])
    .map(f => ({ key: f.key, label: f.label, unit: f.unit, master: derived[f.key], boq: stored[f.key] }));

  return (
    <div className="boq-settings-pop" onClick={e=>e.stopPropagation()} style={{minWidth:380}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:600}}>Overrides — {rows.length} field{rows.length===1?'':'s'}</div>
        <button className="btn ghost sm" onClick={onClose} title="Close">✕</button>
      </div>
      <div style={{fontSize:11,color:'var(--ink-3)',lineHeight:1.5,marginBottom:10}}>
        Each field below is diverging from the Master Workbook. Click Re-link
        to discard the BoQ value and follow the Master again.
      </div>
      {toast && (
        <div style={{fontSize:11,color:'var(--green)',fontWeight:600,padding:'4px 0 8px',textAlign:'center'}}>{toast}</div>
      )}
      {rows.length === 0 && (
        <div style={{fontSize:11,color:'var(--ink-3)',textAlign:'center',padding:'18px 0'}}>No overrides. Every linked field follows the Master.</div>
      )}
      {rows.map(r => (
        <div key={r.key} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:6,padding:'8px 0',borderTop:'1px solid var(--line)',alignItems:'center'}}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:11,fontWeight:600,color:'var(--ink)'}}>{r.label}</div>
            <div style={{fontSize:10,color:'var(--ink-3)',fontFamily:'var(--font-mono)',marginTop:2}}>
              Master: <span style={{color:'var(--ink-2)'}}>{fmt(r.master)}</span>
              <span style={{margin:'0 6px'}}>·</span>
              BoQ: <span style={{color:'var(--amber)',fontWeight:600}}>{fmt(r.boq)}</span>
              {r.unit && <span style={{color:'var(--ink-3)'}}> {r.unit}</span>}
            </div>
          </div>
          <div style={{display:'flex',gap:4,flexShrink:0}}>
            <button className="btn ghost sm"
              style={{fontSize:10,padding:'2px 8px',color: pushable(r.key) ? 'var(--ink-2)' : 'var(--ink-3)',opacity: pushable(r.key) ? 1 : 0.45,cursor: pushable(r.key) ? 'pointer' : 'not-allowed'}}
              title={pushable(r.key) ? "Push this BoQ value up to the Master Workbook and clear the override" : "Cannot push — this field has no Master equivalent"}
              disabled={!pushable(r.key)}
              onClick={() => pushable(r.key) && handlePush(r.key, r.boq)}>
              ↑ Push to Master
            </button>
            <button className="btn ghost sm" style={{fontSize:10,padding:'2px 8px',color:'var(--accent)'}}
              onClick={() => onRelink && onRelink(r.key)}>↩ Re-link</button>
          </div>
        </div>
      ))}
    </div>
  );
};

const ProjectHeader = ({ scheme, boq, computed, onDownload, downloading, onDownloadTC, downloadingTC, onRelink, onPushToMaster }) => {
  const [panelOpen, setPanelOpen] = React.useState(false);
  const workingDays = (() => {
    if (!scheme.date_start || !scheme.date_finish) return null;
    const p = s => { const [d,m,y]=(s||'').split('/'); return new Date(+y,+m-1,+d); };
    const a = p(scheme.date_start), b = p(scheme.date_finish);
    if (isNaN(a) || isNaN(b)) return null;
    return Math.max(1, Math.round((b-a)/86400000 * 5/7));
  })();
  const overrideCount = Object.keys((boq && boq.overrides) || {}).length;

  return (
    <div className="boq-header" style={{position:'relative'}}>
      <div>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
          <span className="section-num">{scheme.project_number || '—'}</span>
          <div style={{fontSize:18,fontWeight:700,lineHeight:1.2}}>{scheme.road_name || 'Untitled scheme'}</div>
        </div>
        <div style={{fontSize:12,color:'var(--ink-3)',display:'flex',flexWrap:'wrap',gap:'6px 10px',alignItems:'center'}}>
          {scheme.scheme_extent && <span>{scheme.scheme_extent}</span>}
          {scheme.ward_selected && <><span>·</span><span>Ward {scheme.ward_num}: {scheme.ward_selected}</span></>}
          {scheme.area_m2 > 0 && <><span>·</span><span className="mono">{(+scheme.area_m2).toLocaleString()} m²</span></>}
          {scheme.date_start && <><span>·</span><span className="mono">{scheme.date_start}{scheme.date_finish ? ` → ${scheme.date_finish}` : ''}</span></>}
          {workingDays && <><span>·</span><span className="mono">{workingDays} wd</span></>}
          {scheme.treatment_type && <><span>·</span><span>{scheme.treatment_type === 'Other' ? (scheme.treatment_description || 'Other') : scheme.treatment_type}</span></>}
        </div>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        {overrideCount > 0 && (
          <button className="boq-override-chip" onClick={()=>setPanelOpen(o=>!o)}
            title="Show overridden fields and re-link to Master">
            ⚠ {overrideCount} override{overrideCount===1?'':'s'}
          </button>
        )}
        <div style={{textAlign:'right',marginRight:4}}>
          <div style={{fontSize:10,color:'var(--ink-3)',textTransform:'uppercase',letterSpacing:'0.07em'}}>Total inc VAT</div>
          <div className="mono" style={{fontSize:20,fontWeight:700,letterSpacing:'-0.02em'}}>{_E.fmtGBP(computed.totalIncVat)}</div>
        </div>
        <button className="btn" onClick={onDownloadTC} disabled={downloadingTC || !computed.lines?.length}
          title="Download TC JMCA Bill of Quantities with scheme quantities filled in">
          <Icon.Download /> {downloadingTC ? 'Generating…' : 'Download TC BoQ'}
        </button>
        <button className="btn accent" onClick={onDownload} disabled={downloading || !computed.groups.length}>
          <Icon.Download /> {downloading ? 'Generating…' : 'Download .xlsx'}
        </button>
      </div>
      {panelOpen && boq && (
        <OverridesPanel scheme={scheme} boq={boq} onRelink={onRelink}
          onPushToMaster={onPushToMaster} onClose={()=>setPanelOpen(false)} />
      )}
    </div>
  );
};

// ── Cost breakdown bar ───────────────────────────────────────────────────────
const CostBreakdownBar = ({ groups, subtotal }) => {
  if (!subtotal || !groups.length) {
    return (
      <div style={{
        padding:'20px 12px',fontSize:11,color:'var(--ink-3)',textAlign:'center',
        background:'var(--bg-sunken)',border:'1px dashed var(--line)',
        borderRadius:'var(--radius-sm)',margin:'12px 0',
      }}>
        Add priced items to see the cost breakdown.
      </div>
    );
  }

  return (
    <div style={{margin:'12px 0 18px'}}>
      <svg viewBox="0 0 1000 40" preserveAspectRatio="none"
        style={{width:'100%',height:40,borderRadius:'var(--radius-sm)',overflow:'hidden',display:'block'}}>
        {(() => {
          let x = 0;
          return groups.map(g => {
            const w = (g.subtotal / subtotal) * 1000;
            const rect = (
              <g key={g.num}>
                <rect x={x} y={0} width={w} height={40} fill={colourFor(g.num)}>
                  <title>{`Series ${g.num} · ${g.title} · ${_E.fmtGBP(g.subtotal)} (${((g.subtotal/subtotal)*100).toFixed(1)}%)`}</title>
                </rect>
                {w > 60 && (
                  <text x={x + w/2} y={24} textAnchor="middle" fill="white"
                    fontSize={11} fontWeight={600} fontFamily="var(--font-mono)">
                    {g.num}
                  </text>
                )}
              </g>
            );
            x += w;
            return rect;
          });
        })()}
      </svg>
      <div style={{display:'flex',flexWrap:'wrap',gap:'6px 14px',marginTop:10}}>
        {groups.map(g => (
          <div key={g.num} style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}>
            <span style={{width:10,height:10,background:colourFor(g.num),borderRadius:2,flexShrink:0}} />
            <span style={{color:'var(--ink-2)'}}>{g.num} · {g.title}</span>
            <span className="mono" style={{color:'var(--ink-3)'}}>
              {_E.fmtGBP(g.subtotal)} ({((g.subtotal/subtotal)*100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Series cards ─────────────────────────────────────────────────────────────
const SeriesCard = ({ group, subtotal }) => {
  const [open, setOpen] = React.useState(false);
  const pct = subtotal ? (group.subtotal / subtotal) * 100 : 0;
  return (
    <div className="boq-series-card" onClick={() => setOpen(o => !o)}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
        <div>
          <span className="num" style={{background:colourFor(group.num)}}>{group.num}</span>
          <span style={{marginLeft:8,fontSize:11,color:'var(--ink-3)',fontFamily:'var(--font-mono)'}}>
            {group.itemCount} item{group.itemCount===1?'':'s'}
          </span>
        </div>
        <div className="boq-card-chev" style={{transform: open ? 'rotate(90deg)' : 'none'}}>›</div>
      </div>
      <div style={{fontSize:12,fontWeight:600,color:'var(--ink)',margin:'6px 0 2px',lineHeight:1.2}}>
        {group.title}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}>
        <span className="total" style={{color:colourFor(group.num)}}>{_E.fmtGBP(group.subtotal)}</span>
        <span className="pct">{pct.toFixed(1)}%</span>
      </div>
      {open && (
        <div onClick={e=>e.stopPropagation()} style={{
          marginTop:10, paddingTop:10, borderTop:'1px solid var(--line)',
          maxHeight:220, overflowY:'auto', fontSize:11,
        }}>
          {group.lines.map(l => (
            <div key={l.uid || l.id} style={{display:'grid',gridTemplateColumns:'60px 1fr auto',gap:6,padding:'3px 0',borderBottom:'1px dashed var(--line)'}}>
              <div className="mono" style={{color:'var(--ink-3)',fontSize:10}}>{l.id}</div>
              <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.desc}</div>
              <div className="mono" style={{fontSize:10}}>{_E.fmtGBP(l.total)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SeriesCardGrid = ({ groups, subtotal }) => {
  if (!groups.length) return null;
  return (
    <div className="boq-series-grid">
      {groups.map(g => <SeriesCard key={g.num} group={g} subtotal={subtotal} />)}
    </div>
  );
};

// ── Settings popover (BERR / VAT / % additions) ──────────────────────────────
const SettingsPopover = ({ boq, onClose, onSettingsChange }) => {
  const s = boq.settings || {};
  const set = (patch) => onSettingsChange({ ...s, ...patch });
  const setPctAdd = (key, patch) => set({
    percentAdditions: { ...(s.percentAdditions || {}), [key]: { ...(s.percentAdditions?.[key] || {}), ...patch } }
  });

  const BERR_PRESETS = [
    { label: 'May 2022 (base)', value: 1.000 },
    { label: 'Q1 2024',         value: 1.042 },
    { label: 'Q2 2024',         value: 1.056 },
    { label: 'Q3 2024',         value: 1.063 },
    { label: 'Q4 2024',         value: 1.069 },
    { label: 'Q1 2025',         value: 1.071 },
    { label: 'Q2 2025',         value: 1.074 },
    { label: 'Q3 2025',         value: 1.076 },
    { label: 'Q4 2025',         value: 1.078 },
  ];

  return (
    <div className="boq-settings-pop" onClick={e=>e.stopPropagation()}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:600}}>BoQ Adjustments</div>
        <button className="btn ghost sm" onClick={onClose} title="Close">✕</button>
      </div>

      <div style={{marginBottom:14}}>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,cursor:'pointer',marginBottom:6}}>
          <input type="checkbox" checked={!!s.useBERR} onChange={e=>set({useBERR:e.target.checked})}
            style={{accentColor:'var(--accent)'}} />
          Apply BERR price index
        </label>
        {s.useBERR && (
          <div style={{display:'flex',gap:6,marginLeft:20}}>
            <select value={s.berrIndex} onChange={e=>{
              const v = +e.target.value;
              const preset = BERR_PRESETS.find(p => p.value === v);
              set({ berrIndex: v, berrDate: preset ? preset.label : s.berrDate });
            }} style={{fontSize:11,flex:1}}>
              {BERR_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label} · ×{p.value.toFixed(3)}</option>)}
            </select>
            <input type="number" step="0.001" min="0.5" max="2" className="mono"
              value={s.berrIndex} onChange={e=>set({berrIndex:+e.target.value,berrDate:'Custom'})}
              style={{width:70,fontSize:11}} />
          </div>
        )}
      </div>

      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:600,color:'var(--ink-2)',marginBottom:6}}>Percentage Additions</div>
        {Object.entries(s.percentAdditions || {}).map(([key, add]) => (
          <div key={key} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
            <input type="checkbox" checked={!!add.enabled} onChange={e=>setPctAdd(key,{enabled:e.target.checked})}
              style={{accentColor:'var(--accent)',flexShrink:0}} />
            <span style={{fontSize:11,flex:1}}>{add.label || key}</span>
            <input type="number" step="0.01" min="0" className="mono"
              value={(+add.pct * 100).toFixed(2).replace(/\.?0+$/,'')}
              onChange={e=>setPctAdd(key,{pct:(+e.target.value)/100})}
              style={{width:60,fontSize:11,textAlign:'right'}} />
            <span style={{fontSize:11,color:'var(--ink-3)',width:10}}>%</span>
          </div>
        ))}
      </div>

      <div style={{marginBottom:4}}>
        <div style={{fontSize:11,fontWeight:600,color:'var(--ink-2)',marginBottom:6}}>VAT Rate</div>
        <div style={{display:'flex',gap:4}}>
          {[0, 0.05, 0.20].map(v => (
            <button key={v}
              className={"btn ghost sm" + (+s.vatRate === v ? " active" : "")}
              onClick={() => set({vatRate: v})}
              style={{fontSize:11, padding:'3px 8px',
                background: +s.vatRate === v ? 'var(--accent)' : undefined,
                color:      +s.vatRate === v ? 'white' : undefined,
              }}>
              {(v*100).toFixed(0)}%
            </button>
          ))}
        </div>
      </div>

      <div style={{marginTop:14,paddingTop:10,borderTop:'1px solid var(--line)'}}>
        <div style={{fontSize:11,fontWeight:600,color:'var(--ink-2)',marginBottom:6}}>Force Area Band</div>
        <div style={{display:'flex',gap:4}}>
          {[null,'A','B','C'].map(b => (
            <button key={b || 'auto'}
              onClick={()=>set({areaBandOverride:b})}
              className={"btn ghost sm"}
              style={{fontSize:11,padding:'3px 8px',
                background: s.areaBandOverride === b ? 'var(--accent)' : undefined,
                color:      s.areaBandOverride === b ? 'white' : undefined,
              }}>
              {b || 'Auto'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Grand total panel (the adjustment ladder) ────────────────────────────────
const GrandTotalPanel = ({ computed, boq, onSettingsChange }) => {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const showAdjustments = computed.adjustments.length > 0 || computed.useBERR;
  return (
    <div className="boq-grand-total" style={{position:'relative'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'0.1em',opacity:0.8}}>Totals</div>
        <button className="btn ghost sm" style={{color:'white',opacity:0.85,padding:'2px 8px',fontSize:11}}
          onClick={()=>setSettingsOpen(o=>!o)}>
          {settingsOpen ? '✕ Close' : '⚙ Adjustments'}
        </button>
      </div>

      <div className="row"><span>Subtotal (ex-VAT)</span><span className="mono">{_E.fmtGBP(computed.subtotal)}</span></div>

      {computed.adjustments.map(a => (
        <div key={a.key} className="row">
          <span>+ {a.label} <span style={{opacity:0.6}}>({_E.fmtPct(a.pct)})</span></span>
          <span className="mono">{_E.fmtGBP(a.amount)}</span>
        </div>
      ))}

      {computed.useBERR && (
        <div className="row">
          <span>BERR adjustment <span style={{opacity:0.6}}>({computed.berrDate} · ×{computed.berrIndex.toFixed(3)})</span></span>
          <span className="mono">{(computed.berrAdjustmentAmt >= 0 ? '+ ' : '− ') + _E.fmtGBP(Math.abs(computed.berrAdjustmentAmt)).replace('£','£')}</span>
        </div>
      )}

      {showAdjustments && (
        <div className="row" style={{borderTop:'1px solid rgba(255,255,255,0.2)',paddingTop:6,marginTop:4,opacity:0.85}}>
          <span>PWP (Works value)</span>
          <span className="mono">{_E.fmtGBP(computed.pwp)}</span>
        </div>
      )}

      {computed.vatRate > 0 && (
        <div className="row">
          <span>+ VAT ({(computed.vatRate*100).toFixed(0)}%)</span>
          <span className="mono">{_E.fmtGBP(computed.vat)}</span>
        </div>
      )}

      <div className="row final">
        <span>TOTAL {computed.vatRate > 0 ? 'incl. VAT' : 'ex-VAT'}</span>
        <span className="mono">{_E.fmtGBP(computed.totalIncVat)}</span>
      </div>

      {settingsOpen && <SettingsPopover boq={boq} onClose={()=>setSettingsOpen(false)} onSettingsChange={onSettingsChange} />}
    </div>
  );
};

// ── Rates & Adjustments footer ───────────────────────────────────────────────
const RatesFooter = ({ computed, boq }) => {
  const bits = [];
  if (computed.areaBandOverride) bits.push(`Area band forced to ${computed.areaBandOverride}`);
  else if (computed.groups.length) bits.push(`Bands auto-picked from each item's measurement`);
  if (computed.useBERR) bits.push(`BERR ${computed.berrDate} ×${computed.berrIndex.toFixed(3)}`);
  const adds = computed.adjustments.map(a => `${a.label} ${_E.fmtPct(a.pct)}`).join(', ');
  if (adds) bits.push(`Additions: ${adds}`);
  bits.push('Rates: Tayside Contracts JMCA schedule');

  return (
    <div className="boq-rates-footer">
      {bits.join(' · ')}
    </div>
  );
};

// ── BoQSummary (top-level, exported) ─────────────────────────────────────────
const BoQSummary = ({ scheme, boq, computed, onSettingsChange, onDownload, downloading, onDownloadTC, downloadingTC, onRelink, onPushToMaster }) => {
  return (
    <div className="boq-summary">
      <ProjectHeader scheme={scheme} boq={boq} computed={computed} onDownload={onDownload} downloading={downloading} onDownloadTC={onDownloadTC} downloadingTC={downloadingTC} onRelink={onRelink} onPushToMaster={onPushToMaster} />
      {computed.hasCustomTreatment && (
        <div className="boq-custom-notice">
          <strong>Custom treatment</strong> — surface course items not auto-generated.
          Add Series 700 or custom items manually using the controls below.
        </div>
      )}
      <CostBreakdownBar groups={computed.groups} subtotal={computed.subtotal} />
      <SeriesCardGrid groups={computed.groups} subtotal={computed.subtotal} />
      <GrandTotalPanel computed={computed} boq={boq} onSettingsChange={onSettingsChange} />
      <RatesFooter computed={computed} boq={boq} />
    </div>
  );
};

window.BoQSummary = BoQSummary;
