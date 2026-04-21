// ─── BoQTab.jsx ───────────────────────────────────────────────────────────────
// Bill of Quantities tab — v2 (full 1,700-item catalogue).
//
// Composition:
//   <BoQTab>
//     <BoQSummary />         — modernised top strip (header, cost bar, cards, totals)
//     <QuickInputRail />     — fast-path form (auto-populates common lines)
//     <BoQLedger />          — grouped priced lines with per-line controls
//     <CatalogueDrawer />    — searchable picker over every catalogue item
//
// State lives in scheme.boq and is persisted by SchemeContext.
// Depends on: window.BOQ_ENGINE, window.BOQ_RATES_FULL, window.boqFullSearch,
//             window.SchemeContext, window.Icon, window.BoQSummary.
// ─────────────────────────────────────────────────────────────────────────────

const E   = window.BOQ_ENGINE;
const MAT = E.MATERIALS;

// ── Small presentational helpers (used across sub-components) ────────────────

const BQSectionLabel = ({ n, label }) => (
  <div style={{
    fontSize:10, fontWeight:700, textTransform:'uppercase',
    letterSpacing:'0.08em', color:'var(--ink-3)',
    padding:'14px 0 6px', borderTop:'1px solid var(--line)', marginTop:12,
  }}>
    <span className="section-num" style={{fontSize:9,marginRight:6,verticalAlign:'middle'}}>{n}</span>{label}
  </div>
);

const BQField = ({ label, children }) => (
  <div style={{marginBottom:9}}>
    <div style={{fontSize:11,fontWeight:500,color:'var(--ink-2)',marginBottom:3}}>{label}</div>
    {children}
  </div>
);

const BQToggle = ({ value, onChange, label }) => (
  <label style={{
    display:'flex',alignItems:'center',gap:6,fontSize:11,cursor:'pointer',
    userSelect:'none',color:'var(--ink-2)',marginBottom:7,
  }}>
    <input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked)}
      style={{accentColor:'var(--accent)',width:14,height:14,flexShrink:0}} />
    {label}
  </label>
);

const BQNum = ({ value, onChange, label, unit, min=0, step=1 }) => (
  <BQField label={label}>
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <input type="number" className="mono" min={min} step={step} value={value}
        onChange={e=>onChange(+e.target.value)}
        style={{width:84,fontSize:12}} />
      {unit && <span style={{fontSize:11,color:'var(--ink-3)'}}>{unit}</span>}
    </div>
  </BQField>
);

const BQSelect = ({ value, onChange, label, options }) => (
  <BQField label={label}>
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{width:'100%',fontSize:12}}>
      {options.map(o => <option key={o.tag||o.value} value={o.tag||o.value}>{o.label}</option>)}
    </select>
  </BQField>
);

// ── QuickInputRail ───────────────────────────────────────────────────────────
// Left-rail form. Reads/writes boq.quick_inputs. Calls onApply() to regenerate
// the auto-line set; user-added lines are preserved by the caller.
const QuickInputRail = ({ inputs, onChange, onApply, dirty }) => {
  const set = (k, v) => onChange({ ...inputs, [k]: v });

  const bandLabel = React.useMemo(() => {
    const a = +inputs.carriageway_area || 0;
    if (a === 0)   return '';
    if (a < 500)   return 'Band A (<500 m²)';
    if (a < 5000)  return 'Band B (500–5000 m²)';
    return 'Band C (>5000 m²)';
  }, [inputs.carriageway_area]);

  return (
    <div className="boq-rail" style={{
      background:'var(--bg-elev)', border:'1px solid var(--line)',
      borderRadius:'var(--radius)', padding:'0 16px 20px',
      overflowY:'auto', maxHeight:'calc(100vh - 260px)',
    }}>

      <div style={{
        position:'sticky', top:0, background:'var(--bg-elev)',
        padding:'12px 0 10px', borderBottom:'1px solid var(--line)',
        marginBottom:4, zIndex:2,
      }}>
        <div style={{fontSize:12,fontWeight:700,color:'var(--ink)',marginBottom:6}}>Quick Input</div>
        <button className={"btn sm " + (dirty ? "accent" : "")} onClick={onApply}
          style={{width:'100%',justifyContent:'center'}}>
          {dirty ? 'Regenerate auto-lines' : 'Regenerated ✓'}
        </button>
        <div style={{fontSize:10,color:'var(--ink-3)',marginTop:6,lineHeight:1.4}}>
          Rebuilds auto-populated lines from this form. User-added lines from the
          catalogue are preserved.
        </div>
      </div>

      {/* 01 Carriageway */}
      <BQSectionLabel n="01" label="Carriageway Treatment" />
      <BQNum value={inputs.carriageway_area} onChange={v=>set('carriageway_area',v)} label="Area (m²)" unit="m²" />
      {bandLabel && (
        <div style={{fontSize:10,color:'var(--accent)',fontFamily:'var(--font-mono)',marginBottom:8,marginTop:-4}}>
          {bandLabel}
        </div>
      )}
      <BQSelect value={inputs.surface_tag} onChange={v=>set('surface_tag',v)} label="Surface course" options={MAT.SURFACE_OPTIONS} />
      <BQToggle value={inputs.include_milling} onChange={v=>set('include_milling',v)} label="Include milling" />
      {inputs.include_milling && (
        <BQField label="Milling depth (mm)">
          <select value={E.snapMillingDepth(inputs.milling_depth)} onChange={e=>set('milling_depth',+e.target.value)}
            style={{width:'100%',fontSize:12}}>
            {MAT.MILLING_DEPTHS.map(d => <option key={d} value={d}>{d}mm</option>)}
          </select>
        </BQField>
      )}
      <BQToggle value={inputs.include_tack} onChange={v=>set('include_tack',v)} label="Include tack coat" />

      {/* 02 Layer build-up */}
      <BQSectionLabel n="02" label="Layer Build-Up" />
      <BQToggle value={inputs.include_binder} onChange={v=>set('include_binder',v)} label="Binder course" />
      {inputs.include_binder && (
        <BQSelect value={inputs.binder_tag} onChange={v=>set('binder_tag',v)} label="Binder type" options={MAT.BINDER_OPTIONS} />
      )}
      <BQToggle value={inputs.include_base} onChange={v=>set('include_base',v)} label="Base course" />
      {inputs.include_base && (
        <BQSelect value={inputs.base_tag} onChange={v=>set('base_tag',v)} label="Base type" options={MAT.BASE_OPTIONS} />
      )}
      <BQToggle value={inputs.include_subbase} onChange={v=>set('include_subbase',v)} label="Granular sub-base (Type 1)" />
      {inputs.include_subbase && (
        <BQNum value={inputs.subbase_depth} onChange={v=>set('subbase_depth',v)} label="Sub-base depth (mm)" unit="mm" />
      )}

      {/* 03 TM */}
      <BQSectionLabel n="03" label="Traffic Management" />
      <BQField label="TM type">
        <select value={inputs.tm_type} onChange={e=>set('tm_type',e.target.value)} style={{width:'100%',fontSize:12}}>
          <option value="full_closure">Full road closure (Type 1)</option>
          <option value="portable_signals">Portable traffic signals</option>
          <option value="stop_go">Stop/Go boards</option>
          <option value="footway_works">Works on footways only</option>
          <option value="none">None</option>
        </select>
      </BQField>
      <BQNum value={inputs.duration_days} onChange={v=>set('duration_days',v)} label="Duration (working days)" unit="days" min={1} />
      {inputs.tm_type === 'full_closure' && (
        <BQToggle value={inputs.include_diversion} onChange={v=>set('include_diversion',v)} label="Include diversion route" />
      )}

      {/* 04 Ironwork */}
      <BQSectionLabel n="04" label="Ironwork (Accommodation Works)" />
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 10px'}}>
        <BQNum value={inputs.iw_sw_cway}  onChange={v=>set('iw_sw_cway',v)}  label="SW — C'way"  unit="No" />
        <BQNum value={inputs.iw_sw_fw}    onChange={v=>set('iw_sw_fw',v)}    label="SW — F'way"  unit="No" />
        <BQNum value={inputs.iw_sse_cway} onChange={v=>set('iw_sse_cway',v)} label="SSE — C'way" unit="No" />
        <BQNum value={inputs.iw_sse_fw}   onChange={v=>set('iw_sse_fw',v)}   label="SSE — F'way" unit="No" />
        <BQNum value={inputs.iw_bt_cway}  onChange={v=>set('iw_bt_cway',v)}  label="BT — C'way"  unit="No" />
        <BQNum value={inputs.iw_bt_fw}    onChange={v=>set('iw_bt_fw',v)}    label="BT — F'way"  unit="No" />
      </div>

      {/* 05 Footways & Kerbs */}
      <BQSectionLabel n="05" label="Footways & Kerbs" />
      <BQNum value={inputs.footway_area} onChange={v=>set('footway_area',v)} label="Footway area (m²)" unit="m²" />
      {+inputs.footway_area > 0 && (
        <>
          <BQSelect value={inputs.fw_surface_tag} onChange={v=>set('fw_surface_tag',v)} label="Footway surface" options={MAT.FOOTWAY_SURFACE_OPTIONS} />
          <BQToggle value={inputs.include_fw_subbase} onChange={v=>set('include_fw_subbase',v)} label="Include footway sub-base (150mm)" />
        </>
      )}
      <BQNum value={inputs.kerb_length} onChange={v=>set('kerb_length',v)} label="Kerb length (m)" unit="m" />
      {+inputs.kerb_length > 0 && (
        <BQSelect value={inputs.kerb_type} onChange={v=>set('kerb_type',v)} label="Kerb type" options={MAT.KERB_OPTIONS} />
      )}

      {/* 06 Road markings */}
      <BQSectionLabel n="06" label="Road Markings" />
      <BQToggle value={inputs.include_markings} onChange={v=>set('include_markings',v)} label="Solid area markings (m²)" />
      {inputs.include_markings && (
        <BQNum value={inputs.markings_area} onChange={v=>set('markings_area',v)} label="Markings area (m²)" unit="m²" />
      )}
      <BQToggle value={inputs.include_line_marks} onChange={v=>set('include_line_marks',v)} label="Line markings 100mm (m)" />
      {inputs.include_line_marks && (
        <BQNum value={inputs.line_marks_m} onChange={v=>set('line_marks_m',v)} label="Total line length (m)" unit="m" />
      )}
    </div>
  );
};

window.QuickInputRail = QuickInputRail;

// ── LedgerRow ────────────────────────────────────────────────────────────────
// One priced line with inline controls: qty edit, A/B/C band override,
// overflow menu (up / down / duplicate / delete).
const LedgerRow = ({ line, alt, onEdit, onDelete, onMove, onDuplicate }) => {
  const [editing, setEditing] = React.useState(false);
  const [draftQty, setDraftQty] = React.useState(line.qty);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => { setDraftQty(line.qty); }, [line.qty]);

  const commitQty = () => {
    const v = +draftQty;
    if (!isNaN(v) && v !== line.qty) onEdit({ qty: v });
    setEditing(false);
  };

  const setBand = (b) => onEdit({ bandOverride: b });

  return (
    <div
      className={"boq-row" + (alt ? " alt" : "") + (line.missing ? " missing" : "")}
      style={{
        display:'grid',
        gridTemplateColumns:'76px minmax(0,1fr) 96px 44px 76px 92px 34px',
        padding:'5px 10px', borderBottom:'1px solid var(--line)',
        background: line.missing ? 'var(--red-wash)' : (alt ? 'var(--bg-sunken)' : 'var(--bg)'),
        alignItems:'center', position:'relative',
      }}
    >
      <div className="mono" style={{fontSize:10,color:'var(--ink-3)',paddingTop:1}}>{line.id}</div>
      <div style={{paddingRight:8,lineHeight:1.35,fontSize:11,minWidth:0,overflow:'hidden',textOverflow:'ellipsis'}}>
        {line.desc || <em style={{color:'var(--red)'}}>{line.missing ? 'Item not found in catalogue' : '(no description)'}</em>}
        {line.auto && <span style={{
          marginLeft:6, fontSize:9, color:'var(--ink-3)', fontFamily:'var(--font-mono)',
          background:'var(--bg-sunken)', padding:'1px 4px', borderRadius:3, verticalAlign:'middle',
        }}>auto</span>}
      </div>
      <div style={{textAlign:'right'}}>
        {editing ? (
          <input
            type="number" className="mono" step="0.01" min="0" autoFocus
            value={draftQty} onChange={e => setDraftQty(e.target.value)}
            onBlur={commitQty}
            onKeyDown={e => { if (e.key === 'Enter') commitQty(); if (e.key === 'Escape') { setDraftQty(line.qty); setEditing(false); } }}
            style={{width:80,fontSize:11,textAlign:'right',padding:'1px 4px'}}
          />
        ) : (
          <span className="mono" style={{fontSize:11,cursor:'pointer',padding:'2px 4px'}} onClick={()=>setEditing(true)}>
            {E.fmtQty(line.qty, line.unit)}
          </span>
        )}
      </div>
      <div style={{fontSize:11,color:'var(--ink-3)'}}>{line.unit}</div>
      <div style={{textAlign:'right'}}>
        <div className="boq-band-seg" title={`Rate band applied: ${line.bandApplied || '—'}`}>
          {['A','B','C'].map(b => (
            <button key={b}
              className={(line.bandOverride === b ? 'active' : '') + (line.bandApplied === b && !line.bandOverride ? ' hinted' : '')}
              onClick={() => setBand(line.bandOverride === b ? null : b)}
              title={line.bandOverride === b ? 'Override ' + b + ' (click to clear)' : 'Force Band ' + b}>
              {b}
            </button>
          ))}
        </div>
      </div>
      <div className="mono" style={{textAlign:'right',fontSize:11,fontWeight:500}}>{E.fmtGBP(line.total)}</div>
      <div style={{textAlign:'right',position:'relative'}}>
        <button className="btn ghost sm" style={{padding:'2px 6px',fontSize:12}}
          onClick={()=>setMenuOpen(o=>!o)} title="Row actions">⋯</button>
        {menuOpen && (
          <div onMouseLeave={()=>setMenuOpen(false)} style={{
            position:'absolute', right:0, top:'100%', zIndex:20,
            background:'var(--bg)', border:'1px solid var(--line)',
            borderRadius:4, boxShadow:'0 4px 12px rgba(0,0,0,0.08)',
            minWidth:140, padding:4, fontSize:11,
          }}>
            <button className="boq-menu-item" onClick={()=>{ onMove(-1); setMenuOpen(false); }}>↑ Move up</button>
            <button className="boq-menu-item" onClick={()=>{ onMove(1);  setMenuOpen(false); }}>↓ Move down</button>
            <button className="boq-menu-item" onClick={()=>{ onDuplicate(); setMenuOpen(false); }}>⎘ Duplicate</button>
            <button className="boq-menu-item danger" onClick={()=>{ onDelete(); setMenuOpen(false); }}>✕ Delete</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── BoQLedger ───────────────────────────────────────────────────────────────
// Grouped, priced line table. Receives the `computed` object from the engine.
const BoQLedger = ({ computed, onEditLine, onDeleteLine, onMoveLine, onDuplicateLine, onOpenCatalogue }) => {
  if (!computed.groups.length) {
    return (
      <div style={{
        padding:'48px 20px',textAlign:'center',color:'var(--ink-3)',fontSize:13,
        border:'1px dashed var(--line)',borderRadius:'var(--radius)',
      }}>
        <div style={{marginBottom:12}}>No BoQ lines yet.</div>
        <div style={{fontSize:12,marginBottom:16}}>
          Fill the Quick Input form on the left and hit <em>Regenerate auto-lines</em>,
          or add items from the full catalogue.
        </div>
        <button className="btn accent" onClick={onOpenCatalogue}>
          <Icon.Search /> Add from catalogue
        </button>
      </div>
    );
  }

  return (
    <div style={{border:'1px solid var(--line)',borderRadius:'var(--radius)',overflow:'hidden',fontSize:12,background:'var(--bg)'}}>
      {/* Column header */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'76px minmax(0,1fr) 96px 44px 76px 92px 34px',
        padding:'6px 10px', background:'var(--bg-sunken)',
        fontSize:10, fontWeight:700, textTransform:'uppercase',
        letterSpacing:'0.07em', color:'var(--ink-3)',
        borderBottom:'2px solid var(--line)',
      }}>
        <div>Item</div>
        <div>Description</div>
        <div style={{textAlign:'right'}}>Qty</div>
        <div>Unit</div>
        <div style={{textAlign:'right'}}>Band</div>
        <div style={{textAlign:'right'}}>Total</div>
        <div></div>
      </div>

      {computed.groups.map(g => (
        <div key={g.key}>
          {/* Series banner */}
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'5px 10px', background:'var(--accent)', color:'white',
            fontWeight:600, fontSize:11,
          }}>
            <span>Series {g.num} — {g.title}</span>
            <span style={{fontFamily:'var(--font-mono)',fontSize:10,opacity:0.9}}>
              {g.itemCount} items · {E.fmtGBP(g.subtotal)}
            </span>
          </div>

          {g.lines.map((line, i) => (
            <LedgerRow key={line.uid || (line.id+'-'+i)} line={line} alt={i%2===1}
              onEdit={patch => onEditLine(line.uid, patch)}
              onDelete={() => onDeleteLine(line.uid)}
              onMove={dir => onMoveLine(line.uid, dir)}
              onDuplicate={() => onDuplicateLine(line.uid)}
            />
          ))}

          <div style={{
            display:'grid',
            gridTemplateColumns:'minmax(0,1fr) 92px 34px',
            padding:'6px 10px', background:'var(--accent-wash)',
            borderBottom:'1px solid var(--line)', alignItems:'center',
          }}>
            <div style={{textAlign:'right',fontWeight:600,fontSize:11,color:'var(--accent-ink, var(--ink))',paddingRight:8}}>
              Series {g.num} Subtotal
            </div>
            <div className="mono" style={{textAlign:'right',fontWeight:700,fontSize:11}}>{E.fmtGBP(g.subtotal)}</div>
            <div></div>
          </div>
        </div>
      ))}

      {/* Action row */}
      <div style={{padding:'8px 10px',background:'var(--bg-sunken)',borderTop:'1px solid var(--line)'}}>
        <button className="btn sm" onClick={onOpenCatalogue}>
          <Icon.Search /> Add from catalogue ({(window.BOQ_SERIES_ORDER||[]).length} series available)
        </button>
      </div>
    </div>
  );
};

window.BoQLedger = BoQLedger;

// ── CatalogueDrawer ──────────────────────────────────────────────────────────
// Right-side slide-in overlay. Live-searches window.BOQ_RATES_FULL.
const CatalogueDrawer = ({ open, onClose, onPick }) => {
  const [query, setQuery] = React.useState('');
  const [seriesFilter, setSeriesFilter] = React.useState(null);
  const [unitFilter, setUnitFilter] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const debounceRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const r = window.boqFullSearch(query, {
        series: seriesFilter || undefined,
        unit:   unitFilter   || undefined,
      });
      setResults(r);
      setLoading(false);
    }, 110);
    return () => clearTimeout(debounceRef.current);
  }, [open, query, seriesFilter, unitFilter]);

  const UNIT_OPTIONS = ['m','m²','m³','No','Item','Day','Ha','%','Tonne','Lin.m','no','m2','m3'];
  const SERIES = window.BOQ_SERIES_ORDER || [100,200,300,400,500,600,700,1100,1200,2700,3000,6400];
  const SERIES_TITLES = Object.fromEntries(
    Object.entries(window.BOQ_RATES_FULL || {}).map(([k, s]) => [parseInt(k.slice(1)), s.title])
  );

  return (
    <>
      {open && <div className="boq-drawer-scrim" onClick={onClose} />}
      <div className={"boq-catalogue-drawer" + (open ? " open" : "")}>
        <div style={{padding:'14px 16px 10px',borderBottom:'1px solid var(--line)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontWeight:600,fontSize:14}}>Add from Catalogue</div>
            <button className="btn ghost sm" onClick={onClose} title="Close">✕</button>
          </div>
          <input
            type="text" placeholder="Search 1,700+ items by description or ID…"
            value={query} onChange={e=>setQuery(e.target.value)}
            style={{width:'100%',fontSize:12,padding:'8px 10px',
                    border:'1px solid var(--line)',borderRadius:4,marginBottom:10}}
            autoFocus
          />
          <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
            <button
              onClick={()=>setSeriesFilter(null)}
              className={"boq-chip" + (!seriesFilter ? " active" : "")}>All series</button>
            {SERIES.map(n => (
              <button key={n} onClick={()=>setSeriesFilter(seriesFilter===n?null:n)}
                className={"boq-chip" + (seriesFilter===n ? " active" : "")}
                title={SERIES_TITLES[n] || ''}>
                {n}
              </button>
            ))}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <label style={{fontSize:11,color:'var(--ink-3)'}}>Unit:</label>
            <select value={unitFilter} onChange={e=>setUnitFilter(e.target.value)}
              style={{fontSize:11,padding:'2px 6px'}}>
              <option value="">Any</option>
              {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <div style={{marginLeft:'auto',fontSize:11,color:'var(--ink-3)',fontFamily:'var(--font-mono)'}}>
              {loading ? '…' : `${results.length} hit${results.length===1?'':'s'}`}
            </div>
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto',minHeight:0}}>
          {results.map(it => (
            <div key={it.seriesKey + '_' + it.id} className="boq-search-result"
              onClick={() => onPick(it)}>
              <div className="mono" style={{fontSize:10,color:'var(--ink-3)'}}>{it.id}</div>
              <div style={{minWidth:0,overflow:'hidden'}}>
                <div style={{fontSize:11,lineHeight:1.3}}>{it.desc}</div>
                <div style={{fontSize:9,color:'var(--ink-3)',fontFamily:'var(--font-mono)',marginTop:2}}>
                  S{it.series} · {it.unit} · A £{(+it.rateA||0).toFixed(2)} / B £{(+it.rateB||0).toFixed(2)} / C £{(+it.rateC||0).toFixed(2)}
                </div>
              </div>
              <div style={{textAlign:'right',fontSize:18,color:'var(--accent)'}}>+</div>
            </div>
          ))}
          {!loading && results.length === 0 && (
            <div style={{padding:'40px 20px',textAlign:'center',color:'var(--ink-3)',fontSize:12}}>
              No matches. Try different terms or clear filters.
            </div>
          )}
          {results.length >= 250 && (
            <div style={{padding:'12px 16px',textAlign:'center',fontSize:11,color:'var(--ink-3)',fontStyle:'italic',borderTop:'1px solid var(--line)'}}>
              Showing first 250 — refine your search for more specific results.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ── Top-level BoQTab ─────────────────────────────────────────────────────────
const BoQTab = ({ schemeId }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);
  const boq    = scheme.boq || window.defaultBoq();

  const commit = (patch) => updateScheme(schemeId, { boq: { ...boq, ...patch } });

  const [quickDirty, setQuickDirty]   = React.useState(false);
  const [drawerOpen, setDrawerOpen]   = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);

  // One-shot: if this scheme has never generated auto-lines, seed them from
  // the scheme's existing fields (area, tm, ironwork, kerbs).
  React.useEffect(() => {
    if (boq.touched) return;
    const seededInputs = {
      ...boq.quick_inputs,
      carriageway_area: (+scheme.area_m2)     || boq.quick_inputs.carriageway_area,
      surface_tag:      E.matchSurfaceTag(scheme.treatment_type),
      include_binder:   !!(+scheme.binder_depth_mm > 0),
      milling_depth:    E.snapMillingDepth(+scheme.surface_depth_mm || 40),
      tm_type:          boq.quick_inputs.tm_type || 'full_closure',
      duration_days:    (() => {
        if (!scheme.date_start || !scheme.date_finish) return boq.quick_inputs.duration_days;
        const p = s => { const [d,m,y]=(s||'').split('/'); return new Date(+y,+m-1,+d); };
        const a = p(scheme.date_start), b = p(scheme.date_finish);
        if (isNaN(a) || isNaN(b)) return boq.quick_inputs.duration_days;
        return Math.max(1, Math.round((b-a)/86400000 * 5/7));
      })(),
      kerb_length: (+scheme.kerb_length) || 0,
      iw_sw_cway:  (+scheme.iron_mh)    || 0,
    };
    const autoLines = E.regenAutoLines(seededInputs);
    commit({ quick_inputs: seededInputs, custom_lines: autoLines, touched: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemeId]);

  const computed = React.useMemo(() => E.buildBoQLines(boq, scheme), [boq, scheme]);

  const handleApplyQuick = () => {
    const auto = E.regenAutoLines(boq.quick_inputs);
    const custom = (boq.custom_lines || []).filter(l => !l.auto);
    commit({ custom_lines: [...auto, ...custom] });
    setQuickDirty(false);
  };

  const handleQuickChange = (qi) => {
    commit({ quick_inputs: qi });
    setQuickDirty(true);
  };

  const editLine = (uid, patch) => {
    commit({ custom_lines: boq.custom_lines.map(l => l.uid === uid ? { ...l, ...patch } : l) });
  };
  const deleteLine = (uid) => {
    commit({ custom_lines: boq.custom_lines.filter(l => l.uid !== uid) });
  };
  const duplicateLine = (uid) => {
    const idx = boq.custom_lines.findIndex(l => l.uid === uid);
    if (idx < 0) return;
    const clone = { ...boq.custom_lines[idx], uid: E.uid(), auto: false };
    const next  = [...boq.custom_lines];
    next.splice(idx + 1, 0, clone);
    commit({ custom_lines: next });
  };
  const moveLine = (uid, dir) => {
    const lines = [...boq.custom_lines];
    const idx = lines.findIndex(l => l.uid === uid);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= lines.length) return;
    [lines[idx], lines[j]] = [lines[j], lines[idx]];
    commit({ custom_lines: lines });
  };
  const addFromCatalogue = (item) => {
    const newLine = {
      uid:  E.uid(),
      id:   item.id,
      desc: item.desc,
      unit: item.unit,
      qty:  0,
      bandOverride: null,
      series: item.series || E.seriesOf(item.id),
      auto: false,
    };
    commit({ custom_lines: [...(boq.custom_lines||[]), newLine] });
  };

  const handleSettings = (settings) => commit({ settings });

  const handleDownload = async () => {
    if (!window.exportBoQXlsx) { alert('Export module not loaded'); return; }
    setDownloading(true);
    try {
      window.exportBoQXlsx(scheme, boq, computed);
      updateScheme(schemeId, { docs_generated: { ...(scheme.docs_generated||{}), boq: true } });
    } catch (e) {
      console.error(e);
      alert('Download failed: ' + e.message);
    } finally { setDownloading(false); }
  };

  React.useEffect(() => {
    window.__downloadBoQ = handleDownload;
    return () => { window.__downloadBoQ = null; };
  }, [scheme, boq, computed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="boq-root">
      {window.BoQSummary && (
        <window.BoQSummary
          scheme={scheme}
          boq={boq}
          computed={computed}
          onSettingsChange={handleSettings}
          onDownload={handleDownload}
          downloading={downloading}
        />
      )}

      <div className="boq-body">
        <QuickInputRail
          inputs={boq.quick_inputs}
          dirty={quickDirty}
          onChange={handleQuickChange}
          onApply={handleApplyQuick}
        />
        <div style={{minWidth:0}}>
          <BoQLedger
            computed={computed}
            onEditLine={editLine}
            onDeleteLine={deleteLine}
            onMoveLine={moveLine}
            onDuplicateLine={duplicateLine}
            onOpenCatalogue={() => setDrawerOpen(true)}
          />
        </div>
      </div>

      <CatalogueDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onPick={(item) => { addFromCatalogue(item); /* keep drawer open for batch add */ }}
      />
    </div>
  );
};

window.BoQTab = BoQTab;
