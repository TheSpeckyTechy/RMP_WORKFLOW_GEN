// ─── BoQTab.jsx ───────────────────────────────────────────────────────────────
// Bill of Quantities tab — pricing, custom lines, totals, export.
//
// Quantities are NOT edited here — they come from scheme.design{} via the
// Treatment Designer tab. Auto-lines are derived from the current Designer
// state at render time, so any zone / ironwork / kerb / lining / TM edit
// flows straight through to the ledger without an extra "regenerate" step.
// User-added custom lines (via the catalogue drawer) remain freely editable
// — they're stored in boq.custom_lines and rendered below the auto lines.
//
// Composition:
//   <BoQTab>
//     <BoQSummary />         — header, cost bar, series cards, totals
//     <BoQLedger />          — grouped priced lines with per-line controls
//     <CatalogueDrawer />    — searchable picker over every catalogue item
//
// State lives in scheme.boq and is persisted by SchemeContext.
// Depends on: window.BOQ_ENGINE, window.BOQ_RATES_FULL, window.boqFullSearch,
//             window.SchemeContext, window.Icon, window.BoQSummary.
// ─────────────────────────────────────────────────────────────────────────────

const E = window.BOQ_ENGINE;

// ── LedgerRow ────────────────────────────────────────────────────────────────
// One priced line with inline controls: qty edit, A/B/C band override,
// overflow menu (up / down / duplicate / delete).
//
// Soft-warning rules (returned as a list of human-readable strings):
//   - quantity ≤ 0: line is in the BoQ but contributes £0 to the total.
//   - blank/whitespace unit: rate × qty can't compute a meaningful subtotal.
// `line.missing` (catalogue mismatch) is a hard error and is rendered with
// the existing red treatment instead.
const lineWarnings = (line) => {
  const w = [];
  if (!(+line.qty > 0)) w.push('Quantity is zero — line won’t contribute to the total.');
  if (!String(line.unit || '').trim()) w.push('Unit missing — subtotal can’t be computed.');
  return w;
};

const LedgerRow = ({ line, alt, onEdit, onDelete, onMove, onDuplicate }) => {
  const [editing, setEditing] = React.useState(false);
  const [draftQty, setDraftQty] = React.useState(line.qty);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const warnings = line.missing ? [] : lineWarnings(line);
  const hasWarning = warnings.length > 0;
  // Auto-lines are derived from the Designer state every render; their
  // qty / band can't be persisted here because they'd be regenerated away.
  // Render them read-only so the UI doesn't promise editability that
  // silently no-ops. Custom (user-added via catalogue) lines stay editable.
  const isAuto = !!line.auto;

  React.useEffect(() => { setDraftQty(line.qty); }, [line.qty]);

  const commitQty = () => {
    const v = +draftQty;
    if (!isNaN(v) && v !== line.qty) onEdit({ qty: v });
    setEditing(false);
  };

  const setBand = (b) => onEdit({ bandOverride: b });

  return (
    <div
      className={"boq-row boq-ledger-row" + (alt ? " alt" : "") + (line.missing ? " missing" : (hasWarning ? " warn" : ""))}
      style={{
        background: line.missing ? 'var(--red-wash)' : (hasWarning ? 'var(--amber-wash)' : (alt ? 'var(--bg-sunken)' : 'var(--bg)')),
      }}
    >
      <div className="mono" style={{fontSize:10,color:'var(--ink-3)',paddingTop:1}}>{line.id}</div>
      <div style={{paddingRight:8,lineHeight:1.35,fontSize:11,minWidth:0,overflow:'hidden',textOverflow:'ellipsis'}}>
        {hasWarning && (
          <span
            title={warnings.join('\n')}
            aria-label={warnings.join(' ')}
            style={{
              display:'inline-block', marginRight:6, color:'var(--amber)',
              fontSize:11, lineHeight:1, cursor:'help', verticalAlign:'middle',
            }}
          >⚠</span>
        )}
        {line.desc || <em style={{color:'var(--red)'}}>{line.missing ? 'Item not found in catalogue' : '(no description)'}</em>}
        {isAuto && <span title="Derived from the Treatment Designer — edit there to change the quantity." style={{
          marginLeft:6, fontSize:9, color:'var(--ink-3)', fontFamily:'var(--font-mono)',
          background:'var(--bg-sunken)', padding:'1px 4px', borderRadius:3, verticalAlign:'middle',
        }}>auto</span>}
      </div>
      <div style={{textAlign:'right'}}>
        {isAuto ? (
          <span className="mono" style={{fontSize:11,padding:'2px 4px',color:'var(--ink-2)'}}
            title="Quantity comes from the Designer. Open the Designer tab to change it.">
            {E.fmtQty(line.qty, line.unit)}
          </span>
        ) : editing ? (
          <input
            type="number" inputMode="decimal" className="mono" step="0.01" min="0" autoFocus
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
        {isAuto ? (
          <span className="mono" style={{fontSize:10,color:'var(--ink-3)'}}
            title={`Rate band applied: ${line.bandApplied || '—'}`}>
            {line.bandApplied || '—'}
          </span>
        ) : (
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
        )}
      </div>
      <div className="mono" style={{textAlign:'right',fontSize:11,fontWeight:500}}>{E.fmtGBP(line.total)}</div>
      <div style={{textAlign:'right',position:'relative'}}>
        {!isAuto && (
          <button className="btn ghost sm" style={{padding:'2px 6px',fontSize:12}}
            onClick={()=>setMenuOpen(o=>!o)} title="Row actions">⋯</button>
        )}
        {!isAuto && menuOpen && (
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
          Auto-lines generate from the <strong>Treatment Designer</strong>.
          Add catalogue items or custom lines below.
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
//
// `recent` is the per-scheme list of recently-picked catalogue items
// (snapshots — see addFromCatalogue in BoQTab). It is rendered as a "Recent"
// strip above the search results when the drawer is in its idle state
// (no query, no series filter, no unit filter), since most schemes draw from
// a small repeating set of items.
const CatalogueDrawer = ({ open, onClose, onPick, recent = [] }) => {
  const [query, setQuery] = React.useState('');
  const [seriesFilter, setSeriesFilter] = React.useState(null);
  const [unitFilter, setUnitFilter] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const debounceRef = React.useRef(null);
  const inputRef    = React.useRef(null);
  const idle = !query && !seriesFilter && !unitFilter;

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 210);
    return () => clearTimeout(t);
  }, [open]);

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
            ref={inputRef}
            type="text" placeholder="Search 1,700+ items by description or ID…"
            value={query} onChange={e=>setQuery(e.target.value)}
            style={{width:'100%',fontSize:12,padding:'8px 10px',
                    border:'1px solid var(--line)',borderRadius:4,marginBottom:10}}
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
          {idle && recent.length > 0 && (
            <>
              <div style={{
                padding:'8px 16px 4px', fontSize:10, fontWeight:700,
                textTransform:'uppercase', letterSpacing:'0.08em',
                color:'var(--ink-3)', background:'var(--bg-sunken)',
                borderBottom:'1px solid var(--line)',
              }}>Recent · {recent.length}</div>
              {recent.map(it => (
                <div key={'recent_' + (it.seriesKey || '') + '_' + it.id}
                  className="boq-search-result" onClick={() => onPick(it)}>
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
              <div style={{
                padding:'8px 16px 4px', fontSize:10, fontWeight:700,
                textTransform:'uppercase', letterSpacing:'0.08em',
                color:'var(--ink-3)', background:'var(--bg-sunken)',
                borderTop:'1px solid var(--line)', borderBottom:'1px solid var(--line)',
              }}>All items · {results.length}</div>
            </>
          )}
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
const BoQTab = ({ schemeId, onOpenDesigner }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);
  const boq    = scheme.boq || window.defaultBoq();

  const commit = (patch) => updateScheme(schemeId, { boq: { ...boq, ...patch } });

  const [drawerOpen, setDrawerOpen]       = React.useState(false);
  const [downloading, setDownloading]     = React.useState(false);
  const [downloadingTC, setDownloadingTC] = React.useState(false);

  // Quick inputs are sourced entirely from scheme.design{} via the BoQ
  // engine's deriveQuickInputsFromScheme. No override layer — Designer is
  // the source of truth, custom lines live on top.
  const effective = React.useMemo(
    () => E.effectiveQuickInputs(scheme, boq),
    [scheme, boq]
  );

  // Auto-lines are derived from the current Designer state every render.
  // Persisting them would require a "regenerate" step on Designer changes;
  // by deriving on the fly we stay in sync with the Designer for free.
  // User-added (non-auto) lines live in boq.custom_lines and are still
  // freely editable inline.
  const userLines = React.useMemo(
    () => (boq.custom_lines || []).filter(l => !l.auto),
    [boq.custom_lines]
  );

  const computed = React.useMemo(() => {
    const autoLines = E.regenAutoLines(effective);
    return E.buildBoQLines({ ...boq, custom_lines: [...autoLines, ...userLines], quick_inputs: effective }, scheme);
  }, [boq, effective, userLines, scheme]);

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
    // Track this pick at the head of recent_items so it pins to the top of
    // the catalogue drawer next time the user opens it. Stored as a snapshot
    // (not a live ref) so the strip is self-sufficient without re-querying
    // BOQ_RATES_FULL on every render.
    const key = (item.seriesKey || '') + '_' + item.id;
    const snapshot = {
      seriesKey: item.seriesKey, id: item.id, desc: item.desc, unit: item.unit,
      series: item.series, rateA: item.rateA, rateB: item.rateB, rateC: item.rateC,
    };
    const prior  = (boq.recent_items || []).filter(r => ((r.seriesKey || '') + '_' + r.id) !== key);
    const recent = [snapshot, ...prior].slice(0, 20);
    commit({ custom_lines: [...(boq.custom_lines||[]), newLine], recent_items: recent });
  };

  const handleSettings = (settings) => commit({ settings });

  const handleDownloadTC = async () => {
    if (!window.__downloadTCBoQ) { alert('TC BoQ module not loaded'); return; }
    setDownloadingTC(true);
    try {
      await window.__downloadTCBoQ(scheme, computed);
      updateScheme(schemeId, { docs_generated: { ...(scheme.docs_generated||{}), boq_tc: true } });
    } catch (e) {
      console.error(e);
      alert('Download failed: ' + e.message);
    } finally { setDownloadingTC(false); }
  };

  const handleDownload = async () => {
    if (!window.exportBoQXlsx) { alert('Export module not loaded'); return; }
    setDownloading(true);
    try {
      await window.exportBoQXlsx(scheme, { ...boq, quick_inputs: effective }, computed);
      updateScheme(schemeId, { docs_generated: { ...(scheme.docs_generated||{}), boq: true } });
    } catch (e) {
      console.error(e);
      alert('Download failed: ' + e.message);
    } finally { setDownloading(false); }
  };

  React.useEffect(() => {
    window.__downloadBoQ = handleDownload;
    return () => { window.__downloadBoQ = null; };
    // `handleDownload` is intentionally NOT in the dep array. It's
    // recreated on every render by closure, so listing it would
    // re-register window.__downloadBoQ on every keystroke. The deps
    // listed cover everything the captured handleDownload actually
    // reads (scheme, boq, computed) so the registered fn stays fresh.
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
          onDownloadTC={handleDownloadTC}
          downloadingTC={downloadingTC}
        />
      )}

      <div className="boq-designer-banner" style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
        background: 'var(--accent-wash)', border: '1px solid var(--accent)',
        borderRadius: 'var(--radius-sm)', margin: '12px 0',
        fontSize: 12, color: 'var(--accent-ink)',
      }}>
        <span style={{ flex: 1 }}>
          Auto-lines update live from the <strong>Treatment Designer</strong> —
          edit zones, ironworks, kerbs, lining or TM there to change them. Use
          this tab to add custom lines, adjust per-line bands on custom lines,
          and tune BoQ-level settings.
        </span>
        {onOpenDesigner && (
          <button className="btn sm" onClick={onOpenDesigner}>Open Designer →</button>
        )}
      </div>

      <BoQLedger
        computed={computed}
        onEditLine={editLine}
        onDeleteLine={deleteLine}
        onMoveLine={moveLine}
        onDuplicateLine={duplicateLine}
        onOpenCatalogue={() => setDrawerOpen(true)}
      />

      <CatalogueDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onPick={(item) => { addFromCatalogue(item); /* keep drawer open for batch add */ }}
        recent={boq.recent_items || []}
      />
    </div>
  );
};

window.BoQTab = BoQTab;

// Standalone BoQ export usable by GenerateModal without the tab being mounted.
window.__exportBoQForScheme = async function(scheme) {
  if (!window.exportBoQXlsx || !window.BOQ_ENGINE) throw new Error('BoQ engine not loaded');
  const E = window.BOQ_ENGINE;
  const boq = scheme.boq || (window.defaultBoq ? window.defaultBoq() : {});
  const effective = E.effectiveQuickInputs(scheme, boq);
  const computed  = E.buildBoQLines({ ...boq, quick_inputs: effective }, scheme);
  await window.exportBoQXlsx(scheme, { ...boq, quick_inputs: effective }, computed);
};
