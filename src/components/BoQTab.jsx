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

// Master-linked wrapper. Two states:
//   - Linked (default): renders a read-only pill showing the Master-derived
//     value + an "Override" micro-button that unlocks the underlying input.
//   - Overridden: renders the input (children) with an orange dot, a badge,
//     and a "Re-link to Master" micro-button.
// `renderDisplay` formats the derived value for the linked state (lookup
// friendly-labels for tags etc.). If omitted, JSON.stringify of the raw
// value is used.
const LinkedField = ({ label, overridden, derivedValue, renderDisplay, onOverride, onRelink, children }) => {
  if (!overridden) {
    const display = renderDisplay ? renderDisplay(derivedValue) :
      (derivedValue === true ? 'Yes' : derivedValue === false ? 'No' :
       derivedValue == null || derivedValue === '' ? '—' : String(derivedValue));
    return (
      <div style={{marginBottom:9}}>
        <div style={{fontSize:11,fontWeight:500,color:'var(--ink-2)',marginBottom:3}}>{label}</div>
        <div className="boq-linked" title="Pulled from the Master Workbook">
          <div>
            <span className="val mono">{display}</span>
            <span className="src"> · 🔗 Master</span>
          </div>
          <button className="unlink" onClick={onOverride} title="Override this field in the BoQ only">
            Override
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="boq-overridden" style={{marginBottom:9,paddingLeft:10,marginLeft:-4}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:3}}>
        <div style={{fontSize:11,fontWeight:500,color:'var(--ink-2)'}}>
          {label}
          <span style={{fontSize:9,fontFamily:'var(--font-mono)',marginLeft:6,color:'#b45309',textTransform:'uppercase',letterSpacing:'0.05em'}}>
            overridden
          </span>
        </div>
        <button className="relink" onClick={onRelink} title="Discard the override and follow the Master">
          ↩ Re-link
        </button>
      </div>
      {children}
    </div>
  );
};

// Compact "Area (m²)" override input. Shows the carriageway_area default as
// placeholder so designers see what blank means. null/''/0 → use default.
const BQAreaOverride = ({ value, onChange, defaultArea }) => (
  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:9,marginTop:-2}}>
    <span style={{fontSize:10,color:'var(--ink-3)',width:84,flexShrink:0}}>Area override</span>
    <input
      type="number" className="mono" min="0" step="1"
      value={value ?? ''}
      placeholder={(+defaultArea > 0 ? (+defaultArea).toLocaleString() : '—')}
      onChange={e => {
        const raw = e.target.value;
        onChange(raw === '' ? null : +raw);
      }}
      style={{width:72,fontSize:11,padding:'2px 6px'}}
    />
    <span style={{fontSize:10,color:'var(--ink-3)'}}>m²</span>
  </div>
);

// Editable (depth, area) list for milling. `entries` is always an array;
// defaults to a single row. Delete icon hidden when only one row remains.
const BQMillingList = ({ entries, onChange, defaultArea }) => {
  const list = (entries && entries.length) ? entries : [{ depth: 40, area: null }];
  const update = (i, patch) => onChange(list.map((e, idx) => idx === i ? { ...e, ...patch } : e));
  const add    = ()        => onChange([...list, { depth: 40, area: null }]);
  const remove = (i)       => onChange(list.filter((_, idx) => idx !== i));

  return (
    <div style={{
      background:'var(--bg)', border:'1px solid var(--line)',
      borderRadius:'var(--radius-sm)', padding:'6px 8px', marginBottom:9, marginTop:-2,
    }}>
      {list.map((e, i) => (
        <div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom: i===list.length-1 ? 6 : 4}}>
          <select value={E.snapMillingDepth(e.depth)} onChange={ev=>update(i,{depth:+ev.target.value})}
            style={{fontSize:11,padding:'1px 4px',flex:'0 0 70px'}}>
            {MAT.MILLING_DEPTHS.map(d => <option key={d} value={d}>{d}mm</option>)}
          </select>
          <input
            type="number" className="mono" min="0" step="1"
            value={e.area ?? ''}
            placeholder={(+defaultArea > 0 ? (+defaultArea).toLocaleString() : '—')}
            onChange={ev => update(i, { area: ev.target.value === '' ? null : +ev.target.value })}
            style={{width:66,fontSize:11,padding:'1px 4px'}}
          />
          <span style={{fontSize:10,color:'var(--ink-3)'}}>m²</span>
          {list.length > 1 && (
            <button onClick={()=>remove(i)} title="Remove"
              style={{marginLeft:'auto',background:'transparent',border:'none',color:'var(--red)',cursor:'pointer',padding:'0 4px',fontSize:13,lineHeight:1}}>✕</button>
          )}
        </div>
      ))}
      <button onClick={add} className="btn ghost sm"
        style={{fontSize:10,padding:'2px 6px',width:'100%',justifyContent:'center',color:'var(--accent)'}}>
        + Add milling depth
      </button>
    </div>
  );
};

// ── QuickInputRail ───────────────────────────────────────────────────────────
// Left-rail form. Reads/writes boq.quick_inputs. Calls onApply() to regenerate
// the auto-line set; user-added lines are preserved by the caller.
const QuickInputRail = ({ inputs, overrides, onChange, onOverride, onRelink, onApply, onApplyPreset, dirty }) => {
  const presets = E.PRESETS || [];
  // set(): for non-linked fields and for fields that are already overridden —
  // writes straight through to quick_inputs. For linked-but-not-yet-overridden
  // fields the Override button in LinkedField flips the flag first, so by the
  // time the input is rendered the field's override === true.
  const set = (k, v) => onChange({ ...inputs, [k]: v });
  const isOver = (k) => !!(overrides && overrides[k]);

  // Zones drive the pavement lines when the Treatment tab has populated them.
  const zonesActive = Array.isArray(inputs.surface_zones) && inputs.surface_zones.length > 0;

  // Lookup labels for display-only rendering of linked tag / enum values.
  const surfaceLabel = (tag) => (MAT.SURFACE_OPTIONS.find(o => o.tag === tag) || {}).label || tag || '—';
  const tmLabel      = (t)   => ({
    'full_closure': 'Full road closure',
    'portable_signals': 'Portable traffic signals',
    'stop_go': 'Stop/Go boards',
    'footway_works': 'Works on footways only',
    'none': 'None',
  })[t] || t || '—';

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
        {onApplyPreset && presets.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const k = e.target.value;
              e.target.value = '';
              if (!k) return;
              const preset = presets.find(p => p.key === k);
              const msg = `Apply preset "${preset?.label}"?\n\n${preset?.desc || ''}\n\nThis will overwrite your layer toggles + materials and regenerate auto-lines. Custom lines you've added are preserved.`;
              if (window.confirm(msg)) onApplyPreset(k);
            }}
            title="Pre-configure layer toggles + materials for a common treatment type."
            style={{width:'100%',fontSize:11,padding:'4px 6px',marginBottom:6}}
          >
            <option value="">⚡ Start from preset…</option>
            {presets.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        )}
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

      <LinkedField label="Default area (m²)" overridden={isOver('carriageway_area')}
        derivedValue={inputs.carriageway_area}
        renderDisplay={v => (+v || 0).toLocaleString() + ' m²'}
        onOverride={()=>onOverride('carriageway_area', inputs.carriageway_area)}
        onRelink={()=>onRelink('carriageway_area')}>
        <BQNum value={inputs.carriageway_area} onChange={v=>set('carriageway_area',v)} label="" unit="m²" />
      </LinkedField>
      <div style={{fontSize:10,color:'var(--ink-3)',marginBottom:6,marginTop:-4,lineHeight:1.3}}>
        Used by any layer that doesn't override it.
      </div>
      {bandLabel && (
        <div style={{fontSize:10,color:'var(--accent)',fontFamily:'var(--font-mono)',marginBottom:8}}>
          {bandLabel}
        </div>
      )}

      {zonesActive ? (
        <div className="boq-zones-banner" title="Treatment tab drives the surface + milling lines">
          <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--accent)',marginBottom:6}}>
            📐 Driven by {inputs.surface_zones.length} Treatment Zone{inputs.surface_zones.length === 1 ? '' : 's'}
          </div>
          {inputs.surface_zones.map((z, i) => (
            <div key={i} style={{fontSize:11,color:'var(--ink-2)',lineHeight:1.5,display:'flex',justifyContent:'space-between',gap:8}}>
              <span style={{minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                <span className="mono" style={{fontSize:10,color:'var(--ink-3)',marginRight:4}}>{z.zoneLabel || ('Zone ' + (i+1))}</span>
                {surfaceLabel(z.tag)}
              </span>
              <span className="mono" style={{fontSize:10,color:'var(--ink-3)',flexShrink:0}}>
                {(+z.area || 0).toLocaleString()} m² · {z.depth} mm
              </span>
            </div>
          ))}
          <div style={{fontSize:10,color:'var(--ink-3)',marginTop:8,fontStyle:'italic'}}>
            Edit materials and areas in the Treatment tab.
          </div>
        </div>
      ) : (
        <>
          <LinkedField label="Surface course" overridden={isOver('surface_tag')}
            derivedValue={inputs.surface_tag} renderDisplay={surfaceLabel}
            onOverride={()=>onOverride('surface_tag', inputs.surface_tag)}
            onRelink={()=>onRelink('surface_tag')}>
            <BQSelect value={inputs.surface_tag} onChange={v=>set('surface_tag',v)} label="" options={MAT.SURFACE_OPTIONS} />
          </LinkedField>
          <BQAreaOverride value={inputs.surface_area} onChange={v=>set('surface_area',v)} defaultArea={inputs.carriageway_area} />
        </>
      )}

      <BQToggle value={inputs.include_milling} onChange={v=>set('include_milling',v)} label="Include milling" />
      {inputs.include_milling && !zonesActive && (
        <BQMillingList
          entries={inputs.milling_entries || [{ depth: inputs.milling_depth || 40, area: null }]}
          onChange={v=>set('milling_entries',v)}
          defaultArea={inputs.carriageway_area}
        />
      )}

      <LinkedField label="Include tack coat" overridden={isOver('include_tack')}
        derivedValue={inputs.include_tack}
        onOverride={()=>onOverride('include_tack', inputs.include_tack)}
        onRelink={()=>onRelink('include_tack')}>
        <BQToggle value={inputs.include_tack} onChange={v=>set('include_tack',v)} label="Include tack coat" />
      </LinkedField>
      {inputs.include_tack && (
        <BQAreaOverride value={inputs.tack_area} onChange={v=>set('tack_area',v)} defaultArea={inputs.carriageway_area} />
      )}

      {/* 02 Layer build-up */}
      <BQSectionLabel n="02" label="Layer Build-Up" />
      <LinkedField label="Binder course" overridden={isOver('include_binder')}
        derivedValue={inputs.include_binder}
        onOverride={()=>onOverride('include_binder', inputs.include_binder)}
        onRelink={()=>onRelink('include_binder')}>
        <BQToggle value={inputs.include_binder} onChange={v=>set('include_binder',v)} label="Binder course" />
      </LinkedField>
      {inputs.include_binder && (
        <>
          <BQSelect value={inputs.binder_tag} onChange={v=>set('binder_tag',v)} label="Binder type" options={MAT.BINDER_OPTIONS} />
          <BQAreaOverride value={inputs.binder_area} onChange={v=>set('binder_area',v)} defaultArea={inputs.carriageway_area} />
        </>
      )}
      <LinkedField label="Base course" overridden={isOver('include_base')}
        derivedValue={inputs.include_base}
        onOverride={()=>onOverride('include_base', inputs.include_base)}
        onRelink={()=>onRelink('include_base')}>
        <BQToggle value={inputs.include_base} onChange={v=>set('include_base',v)} label="Base course" />
      </LinkedField>
      {inputs.include_base && (
        <>
          <BQSelect value={inputs.base_tag} onChange={v=>set('base_tag',v)} label="Base type" options={MAT.BASE_OPTIONS} />
          <BQAreaOverride value={inputs.base_area} onChange={v=>set('base_area',v)} defaultArea={inputs.carriageway_area} />
        </>
      )}
      <LinkedField label="Granular sub-base (Type 1)" overridden={isOver('include_subbase')}
        derivedValue={inputs.include_subbase}
        onOverride={()=>onOverride('include_subbase', inputs.include_subbase)}
        onRelink={()=>onRelink('include_subbase')}>
        <BQToggle value={inputs.include_subbase} onChange={v=>set('include_subbase',v)} label="Granular sub-base (Type 1)" />
      </LinkedField>
      {inputs.include_subbase && (
        <>
          <LinkedField label="Sub-base depth (mm)" overridden={isOver('subbase_depth')}
            derivedValue={inputs.subbase_depth} renderDisplay={v=>v+' mm'}
            onOverride={()=>onOverride('subbase_depth', inputs.subbase_depth)}
            onRelink={()=>onRelink('subbase_depth')}>
            <BQNum value={inputs.subbase_depth} onChange={v=>set('subbase_depth',v)} label="" unit="mm" />
          </LinkedField>
          <BQAreaOverride value={inputs.subbase_area} onChange={v=>set('subbase_area',v)} defaultArea={inputs.carriageway_area} />
        </>
      )}

      {/* 03 TM */}
      <BQSectionLabel n="03" label="Traffic Management" />
      <LinkedField label="TM type" overridden={isOver('tm_type')}
        derivedValue={inputs.tm_type} renderDisplay={tmLabel}
        onOverride={()=>onOverride('tm_type', inputs.tm_type)}
        onRelink={()=>onRelink('tm_type')}>
        <BQField label="">
          <select value={inputs.tm_type} onChange={e=>set('tm_type',e.target.value)} style={{width:'100%',fontSize:12}}>
            <option value="full_closure">Full road closure (Type 1)</option>
            <option value="portable_signals">Portable traffic signals</option>
            <option value="stop_go">Stop/Go boards</option>
            <option value="footway_works">Works on footways only</option>
            <option value="none">None</option>
          </select>
        </BQField>
      </LinkedField>
      <LinkedField label="Duration (working days)" overridden={isOver('duration_days')}
        derivedValue={inputs.duration_days} renderDisplay={v=>v+' days'}
        onOverride={()=>onOverride('duration_days', inputs.duration_days)}
        onRelink={()=>onRelink('duration_days')}>
        <BQNum value={inputs.duration_days} onChange={v=>set('duration_days',v)} label="" unit="days" min={1} />
      </LinkedField>
      {inputs.tm_type === 'full_closure' && (
        <LinkedField label="Include diversion route" overridden={isOver('include_diversion')}
          derivedValue={inputs.include_diversion}
          onOverride={()=>onOverride('include_diversion', inputs.include_diversion)}
          onRelink={()=>onRelink('include_diversion')}>
          <BQToggle value={inputs.include_diversion} onChange={v=>set('include_diversion',v)} label="Include diversion route" />
        </LinkedField>
      )}
      {inputs.tm_type === 'give_take' && (
        <div style={{
          fontSize:10, color:'var(--ink-2)', lineHeight:1.5,
          background:'var(--bg-sunken)', border:'1px dashed var(--line)',
          borderRadius:'var(--radius-sm)', padding:'8px 10px', marginBottom:9,
        }}>
          <strong style={{fontWeight:600}}>No TM lines emitted.</strong> Give &amp;
          Take is an informal passing-place method with no formal signage or
          dedicated traffic-control operatives. If the scheme still needs a
          small provisional sum for site supervision, add it manually from the
          catalogue.
        </div>
      )}
      {inputs.tm_type === 'partial_closure' && (
        <div style={{
          fontSize:10, color:'var(--ink-2)', lineHeight:1.5,
          background:'var(--bg-sunken)', border:'1px dashed var(--line)',
          borderRadius:'var(--radius-sm)', padding:'8px 10px', marginBottom:9,
        }}>
          Partial Road Closure currently uses the full-closure day rate as
          the nearest JMCA equivalent. If the running-lane maintenance on
          your scheme warrants a different rate, add the appropriate
          Series 100 line from the catalogue and adjust manually.
        </div>
      )}

      {/* 04 Ironwork */}
      <BQSectionLabel n="04" label="Ironwork (Accommodation Works)" />
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 10px'}}>
        <LinkedField label="SW — C'way" overridden={isOver('iw_sw_cway')}
          derivedValue={inputs.iw_sw_cway} renderDisplay={v=>(+v||0)+' No'}
          onOverride={()=>onOverride('iw_sw_cway', inputs.iw_sw_cway)}
          onRelink={()=>onRelink('iw_sw_cway')}>
          <BQNum value={inputs.iw_sw_cway} onChange={v=>set('iw_sw_cway',v)} label="" unit="No" />
        </LinkedField>
        <BQNum value={inputs.iw_sw_fw}    onChange={v=>set('iw_sw_fw',v)}    label="SW — F'way"  unit="No" />
        <BQNum value={inputs.iw_sse_cway} onChange={v=>set('iw_sse_cway',v)} label="SSE — C'way" unit="No" />
        <BQNum value={inputs.iw_sse_fw}   onChange={v=>set('iw_sse_fw',v)}   label="SSE — F'way" unit="No" />
        <LinkedField label="BT — C'way" overridden={isOver('iw_bt_cway')}
          derivedValue={inputs.iw_bt_cway} renderDisplay={v=>(+v||0)+' No'}
          onOverride={()=>onOverride('iw_bt_cway', inputs.iw_bt_cway)}
          onRelink={()=>onRelink('iw_bt_cway')}>
          <BQNum value={inputs.iw_bt_cway} onChange={v=>set('iw_bt_cway',v)} label="" unit="No" />
        </LinkedField>
        <BQNum value={inputs.iw_bt_fw}    onChange={v=>set('iw_bt_fw',v)}    label="BT — F'way"  unit="No" />
        <LinkedField label="Gas — C'way" overridden={isOver('iw_gas_cway')}
          derivedValue={inputs.iw_gas_cway} renderDisplay={v=>(+v||0)+' No'}
          onOverride={()=>onOverride('iw_gas_cway', inputs.iw_gas_cway)}
          onRelink={()=>onRelink('iw_gas_cway')}>
          <BQNum value={inputs.iw_gas_cway} onChange={v=>set('iw_gas_cway',v)} label="" unit="No" />
        </LinkedField>
        <BQNum value={inputs.iw_gas_fw}   onChange={v=>set('iw_gas_fw',v)}   label="Gas — F'way" unit="No" />
      </div>
      <LinkedField label="Gullies — reset (carriageway)" overridden={isOver('iw_gully_cway')}
        derivedValue={inputs.iw_gully_cway} renderDisplay={v=>(+v||0)+' No'}
        onOverride={()=>onOverride('iw_gully_cway', inputs.iw_gully_cway)}
        onRelink={()=>onRelink('iw_gully_cway')}>
        <BQNum value={inputs.iw_gully_cway} onChange={v=>set('iw_gully_cway',v)} label="" unit="No" />
      </LinkedField>

      {/* 05 Footways & Kerbs */}
      <BQSectionLabel n="05" label="Footways & Kerbs" />
      <LinkedField label="Footway area (m²)" overridden={isOver('footway_area')}
        derivedValue={inputs.footway_area} renderDisplay={v=>(+v||0).toLocaleString()+' m²'}
        onOverride={()=>onOverride('footway_area', inputs.footway_area)}
        onRelink={()=>onRelink('footway_area')}>
        <BQNum value={inputs.footway_area} onChange={v=>set('footway_area',v)} label="" unit="m²" />
      </LinkedField>
      {+inputs.footway_area > 0 && (
        <>
          <BQSelect value={inputs.fw_surface_tag} onChange={v=>set('fw_surface_tag',v)} label="Footway surface" options={MAT.FOOTWAY_SURFACE_OPTIONS} />
          <BQToggle value={inputs.include_fw_subbase} onChange={v=>set('include_fw_subbase',v)} label="Include footway sub-base (150mm)" />
        </>
      )}
      <LinkedField label="Kerb length (m)" overridden={isOver('kerb_length')}
        derivedValue={inputs.kerb_length} renderDisplay={v=>(+v||0)+' m'}
        onOverride={()=>onOverride('kerb_length', inputs.kerb_length)}
        onRelink={()=>onRelink('kerb_length')}>
        <BQNum value={inputs.kerb_length} onChange={v=>set('kerb_length',v)} label="" unit="m" />
      </LinkedField>
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

  React.useEffect(() => { setDraftQty(line.qty); }, [line.qty]);

  const commitQty = () => {
    const v = +draftQty;
    if (!isNaN(v) && v !== line.qty) onEdit({ qty: v });
    setEditing(false);
  };

  const setBand = (b) => onEdit({ bandOverride: b });

  return (
    <div
      className={"boq-row" + (alt ? " alt" : "") + (line.missing ? " missing" : (hasWarning ? " warn" : ""))}
      style={{
        display:'grid',
        gridTemplateColumns:'76px minmax(0,1fr) 96px 44px 76px 92px 34px',
        padding:'5px 10px', borderBottom:'1px solid var(--line)',
        background: line.missing ? 'var(--red-wash)' : (hasWarning ? 'var(--amber-wash)' : (alt ? 'var(--bg-sunken)' : 'var(--bg)')),
        alignItems:'center', position:'relative',
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
  const [loading, setLoading] = React.useState(false);
  const debounceRef = React.useRef(null);
  const idle = !query && !seriesFilter && !unitFilter;

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
const BoQTab = ({ schemeId }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);
  const boq    = scheme.boq || window.defaultBoq();

  const commit = (patch) => updateScheme(schemeId, { boq: { ...boq, ...patch } });

  const [quickDirty, setQuickDirty]     = React.useState(false);
  const [drawerOpen, setDrawerOpen]     = React.useState(false);
  const [downloading, setDownloading]   = React.useState(false);
  const [downloadingTC, setDownloadingTC] = React.useState(false);

  // Effective quick inputs = Master-derived values merged with user
  // overrides. This is the single shape the rail renders and the engine
  // prices against.
  const effective = React.useMemo(
    () => E.effectiveQuickInputs(scheme, boq),
    [scheme, boq]
  );

  // Seed auto-lines once per scheme (first time .boq.touched is false).
  // Runs against `effective` so the initial BoQ reflects whatever the
  // Master already says, without storing a copy of those values.
  React.useEffect(() => {
    if (boq.touched) return;
    const autoLines = E.regenAutoLines(effective);
    commit({ custom_lines: autoLines, touched: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemeId]);

  const computed = React.useMemo(
    () => E.buildBoQLines({ ...boq, quick_inputs: effective }, scheme),
    [boq, effective, scheme]
  );

  const handleApplyQuick = () => {
    const auto   = E.regenAutoLines(effective);
    const custom = (boq.custom_lines || []).filter(l => !l.auto);
    commit({ custom_lines: [...auto, ...custom] });
    setQuickDirty(false);
  };

  // One-click preset: patches quick_inputs to a treatment-shaped configuration
  // (e.g. "Inlay 50mm" — surface tag + 50mm milling + tack), marks the patched
  // fields as overridden so they don't snap back to Master values, and
  // regenerates auto-lines in the same commit. The user can still edit any
  // field afterwards via the rail.
  const handleApplyPreset = (presetKey) => {
    const preset = (E.PRESETS || []).find(p => p.key === presetKey);
    if (!preset) return;
    const { inputs: nextInputs, touched } = E.applyPreset(presetKey, effective);
    const linkedSet = new Set((E.LINKED_FIELDS || []).map(f => f.key));
    const overrides = { ...(boq.overrides || {}) };
    for (const k of touched) if (linkedSet.has(k)) overrides[k] = true;
    // Persist only the patched keys into quick_inputs so unrelated fields can
    // still follow the Master where they were doing so before.
    const quick_inputs = { ...(boq.quick_inputs || {}) };
    for (const k of touched) quick_inputs[k] = nextInputs[k];
    const auto   = E.regenAutoLines(nextInputs);
    const custom = (boq.custom_lines || []).filter(l => !l.auto);
    commit({ overrides, quick_inputs, custom_lines: [...auto, ...custom] });
    setQuickDirty(false);
  };

  // Called by the rail when a linked OR overridden field is edited. Always
  // writes to quick_inputs; the override flag is managed separately by
  // overrideField / relinkField.
  const handleQuickChange = (qi) => {
    commit({ quick_inputs: qi });
    setQuickDirty(true);
  };

  // Flip a linked field into an overridden field. The stored value seeds
  // from whatever the Master currently derives so the user's starting point
  // is never surprising.
  const overrideField = (key, currentValue) => {
    const overrides = { ...(boq.overrides || {}), [key]: true };
    const quick_inputs = { ...(boq.quick_inputs || {}), [key]: currentValue };
    commit({ overrides, quick_inputs });
    setQuickDirty(true);
  };

  // Drop the override for a field so it follows the Master again. The
  // stored value is removed so stale data can't re-emerge later.
  const relinkField = (key) => {
    const overrides = { ...(boq.overrides || {}) };
    delete overrides[key];
    const quick_inputs = { ...(boq.quick_inputs || {}) };
    delete quick_inputs[key];
    commit({ overrides, quick_inputs });
    setQuickDirty(true);
  };

  // Push an overridden BoQ value up to its Master field. Clears the
  // override flag afterwards so the field follows the Master again.
  const pushToMaster = (key, value) => {
    const patch = E.schemePatchForOverride(key, value, scheme);
    if (!patch) return;
    // Merge scheme patch + cleared override in a single updateScheme call so
    // the subsequent re-render sees a consistent state.
    const overrides = { ...(boq.overrides || {}) };
    delete overrides[key];
    const quick_inputs = { ...(boq.quick_inputs || {}) };
    delete quick_inputs[key];
    updateScheme(schemeId, {
      ...patch,
      boq: { ...boq, overrides, quick_inputs },
    });
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
      window.exportBoQXlsx(scheme, { ...boq, quick_inputs: effective }, computed);
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
          onDownloadTC={handleDownloadTC}
          downloadingTC={downloadingTC}
          onRelink={relinkField}
          onPushToMaster={pushToMaster}
        />
      )}

      <div className="boq-body">
        <QuickInputRail
          inputs={effective}
          overrides={boq.overrides || {}}
          dirty={quickDirty}
          onChange={handleQuickChange}
          onOverride={overrideField}
          onRelink={relinkField}
          onApply={handleApplyQuick}
          onApplyPreset={handleApplyPreset}
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
        recent={boq.recent_items || []}
      />
    </div>
  );
};

window.BoQTab = BoQTab;

// Standalone BoQ export usable by GenerateModal without the tab being mounted.
window.__exportBoQForScheme = function(scheme) {
  if (!window.exportBoQXlsx || !window.BOQ_ENGINE) throw new Error('BoQ engine not loaded');
  const E = window.BOQ_ENGINE;
  const boq = scheme.boq || (window.defaultBoq ? window.defaultBoq() : {});
  const effective = E.effectiveQuickInputs(scheme, boq);
  const computed  = E.buildBoQLines({ ...boq, quick_inputs: effective }, scheme);
  window.exportBoQXlsx(scheme, { ...boq, quick_inputs: effective }, computed);
};
