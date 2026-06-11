// ─── TreatmentDesigner.jsx ────────────────────────────────────────────────────
// Single source of truth for everything that ends up in the BoQ: surface
// zones, ironworks, kerbs, lining, traffic management. Writes scheme.design.*
// directly. The first user edit flips design.touched=true, which freezes the
// persisted shape against the SchemeContext legacy → design back-fill that
// runs on every load for older schemes that predate this model.
//
// Exports (via window): TreatmentDesigner
// Depends on: React, window.SchemeContext, window.BOQ_ENGINE, window.Icon
// ─────────────────────────────────────────────────────────────────────────────

// Surface options shown in zone dropdowns. Strings match the human-readable
// values matchSurfaceTag() in the BoQ engine recognises, so a zone's surface
// drives its BoQ pricing without any extra translation.
const TD_SURFACE_OPTIONS = [
  // HRA
  'HRA 30/14F surf 40/60',
  'HRA 35/14F surf 40/60',
  'HRA 55/10F surf 40/60',
  // SMA
  'SMA 10 surf 40/60',
  'SMA 6 surf 100/150',
  // AC
  'AC14 close surf 40/60',
  'AC14 HBC surf 40/60',
  'AC10 close surf 40/60',
  'AC10 HBC surf 40/60',
  'AC10 Taycoat 100/150',
  'AC6 dense 100/150',
  'AC14 close binder 40/60',
  // Preventive
  'Micro-asphalt',
  'Surface dressing 10mm intermediate',
  'Surface dressing 10mm premium',
  'Surface dressing 6mm intermediate',
  'Other',
];

const TD_KERB_TYPES = [
  'K1 half-batter — laid',
  'K1 half-batter — raised',
  'K2 transition — laid',
  'K2 transition — raised',
  'K3 bullnose — laid',
  'HB2 dropper kerb',
  'Combined drainage kerb',
];

const TD_LINING_TYPES = [
  { label: 'Continuous white line 100mm', unit: 'm' },
  { label: 'Continuous white line 150mm', unit: 'm' },
  { label: 'Broken white line 100mm',     unit: 'm' },
  { label: 'Hatched markings / chevrons', unit: 'm²' },
  { label: 'Stop / give-way markings',    unit: 'm²' },
  { label: 'Yellow box / keep clear',     unit: 'm²' },
  { label: 'Symbols (cycle / bus / arrow)', unit: 'm²' },
];

const TD_TM_TYPES = [
  'Full road closure',
  'Partial Road Closure',
  'Lane Closure',
  'Two-way lights',
  'Stop/Go boards',
  'Give & Take',
  'Full Closure + Diversion',
];

// Catalogue-driven material lists. Pulled from the BoQ engine so the
// dropdown options always match what the engine knows how to price; a
// missing window.BOQ_ENGINE during early script load falls through to
// empty arrays (the dropdown still renders, just with no options).
const TD_BINDER_OPTIONS  = (window.BOQ_ENGINE?.MATERIALS?.BINDER_OPTIONS)  || [];
const TD_BASE_OPTIONS    = (window.BOQ_ENGINE?.MATERIALS?.BASE_OPTIONS)    || [];
const TD_FOOTWAY_OPTIONS = (window.BOQ_ENGINE?.MATERIALS?.FOOTWAY_SURFACE_OPTIONS) || [];

// Default materials match the BoQ engine's pre-Designer fallbacks, so a
// scheme that's never touched the dropdown produces the same lines it did
// before per-zone material selection landed.
const TD_DEFAULT_BINDER_TAG = 'bin_hra5020_60';
const TD_DEFAULT_BASE_TAG   = 'base_ac32d_100';

// Hook returning a writeDesign(patch) that merges the patch into
// scheme.design with touched=true and persists it via updateScheme.
const useDesignWriter = (schemeId) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  return React.useCallback((patch) => {
    const scheme = getScheme(schemeId);
    const current = scheme.design || window.defaultDesign();
    const nextDesign = { ...current, ...patch, touched: true };
    updateScheme(schemeId, { design: nextDesign });
  }, [schemeId, getScheme, updateScheme]);
};

// ── Live preview bar ─────────────────────────────────────────────────────────
// Mini stat strip at the top of the Designer — same calculation as
// MasterPreviewBar but mounted here so designers see BoQ totals refresh as
// they edit. Catches the "wrong surface tag" silent default early.
const TDPreviewBar = ({ scheme }) => {
  const E = window.BOQ_ENGINE;
  const computed = React.useMemo(() => {
    if (!E) return null;
    const boq = scheme.boq || (window.defaultBoq ? window.defaultBoq() : { quick_inputs: {}, custom_lines: [], settings: {}, overrides: {} });
    const effective = E.effectiveQuickInputs(scheme, boq);
    const autoLines = E.regenAutoLines(effective);
    const userLines = (boq.custom_lines || []).filter(l => !l.auto);
    const merged    = { ...boq, quick_inputs: effective, custom_lines: [...autoLines, ...userLines] };
    return E.buildBoQLines(merged, scheme);
  }, [scheme]);

  if (!computed) return null;

  const total    = +computed.totalIncVat || 0;
  const cwArea   = window.schemeArea(scheme);
  const perM2    = cwArea > 0 ? total / cwArea : 0;
  const dominant = (computed.groups || []).slice().sort((a, b) => (+b.subtotal || 0) - (+a.subtotal || 0))[0];

  const Stat = ({ label, value, sub }) => (
    <div className="mwb-preview-stat">
      <div className="mwb-preview-label">{label}</div>
      <div className="mwb-preview-value mono">{value}</div>
      {sub && <div className="mwb-preview-sub">{sub}</div>}
    </div>
  );

  return (
    <div className="mwb-preview" title="Live BoQ projection — refreshes as you edit the design.">
      <Stat label="BoQ Total" value={E.fmtGBP(total)} />
      <Stat label="£ per m²" value={cwArea > 0 ? E.fmtGBP(perM2) : '—'} sub={cwArea > 0 ? `${cwArea.toLocaleString()} m²` : 'no scheme area'} />
      <Stat label="Lines" value={String((computed.lines || []).length)} sub={`${(computed.groups || []).length} series`} />
      <div className="mwb-preview-stat mwb-preview-dominant">
        <div className="mwb-preview-label">Dominant series</div>
        <div className="mwb-preview-value">
          {dominant ? <span><span className="mono" style={{color:'var(--ink-3)',marginRight:6}}>S{dominant.num}</span>{dominant.title}</span> : <span style={{color:'var(--ink-3)'}}>—</span>}
        </div>
      </div>
    </div>
  );
};

// ── Surface zones panel ──────────────────────────────────────────────────────
const TDZonesPanel = ({ scheme, write }) => {
  const design = scheme.design || window.defaultDesign();
  const zones  = design.zones || [];

  const setZones = (nextZones) => write({ zones: nextZones });
  const updZone  = (id, patch) => setZones(zones.map(z => z.id === id ? { ...z, ...patch } : z));
  const addZone  = () => setZones([...zones, {
    id: Date.now(),
    label: '',
    surface: '',
    area_m2: 0,
    depth_mm: 40,
    milling_depth_mm: 40,
    includes_binder: false,
    includes_base: false,
    includes_subbase: false,
    binder_depth_mm: 60,
    base_depth_mm: 100,
    subbase_depth_mm: 150,
    binder_tag: TD_DEFAULT_BINDER_TAG,
    base_tag:   TD_DEFAULT_BASE_TAG,
  }]);
  const rmZone = (id) => setZones(zones.filter(z => z.id !== id));

  const totalArea = zones.reduce((s, z) => s + (+z.area_m2 || 0), 0);
  // Compare carriageway zones against carriageway area only; footway is
  // tracked separately by TDFootwayPanel with its own footway_area_m2 field.
  const masterArea = +(scheme.carriageway_area_m2 || 0);
  const diff = totalArea - masterArea;
  const balanced = masterArea > 0 && Math.abs(diff) <= 5;

  return (
    <div className="form-section" style={{ marginBottom: 16 }}>
      <div className="section-head" style={{ marginBottom: 14 }}>
        <div className="section-title"><span className="section-num">02</span> Surface zones</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--ink-3)' }}>{totalArea.toLocaleString()} / {masterArea.toLocaleString()} m²</span>
          {masterArea > 0 && (
            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
              background: balanced ? 'var(--green-wash)' : 'var(--amber-wash)',
              color:      balanced ? 'var(--green)'      : 'var(--amber)' }}>
              {diff === 0 ? '✓ balanced' : diff > 0 ? `+${diff.toLocaleString()} over` : `${Math.abs(diff).toLocaleString()} m² remaining`}
            </span>
          )}
        </div>
      </div>

      {zones.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12, border: '1px dashed var(--line)', borderRadius: 'var(--radius)' }}>
          No zones yet. Add at least one to drive the BoQ surface lines.
        </div>
      )}

      {zones.map((zone, idx) => (
        <div key={zone.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', marginBottom: 10, overflow: 'hidden' }}>
          <div style={{ background: 'var(--bg-sunken)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)' }}>
            <span className="section-num" style={{ fontSize: 10, minWidth: 26, textAlign: 'center' }}>A{idx + 1}</span>
            <input
              value={zone.label}
              onChange={e => updZone(zone.id, { label: e.target.value })}
              placeholder="Zone description — e.g. Main carriageway / Junction patch"
              style={{ flex: 1, border: 'none', background: 'transparent', fontWeight: 500, fontSize: 13, outline: 'none', color: 'var(--ink)' }}
            />
            <button className="btn ghost sm" onClick={() => rmZone(zone.id)} title="Remove zone"><window.Icon.X /></button>
          </div>

          <div className="td-zones-grid" style={{ padding: 14 }}>
            <div className="field">
              <label>Surface treatment</label>
              <select value={zone.surface} onChange={e => updZone(zone.id, { surface: e.target.value })}>
                <option value="">— select —</option>
                {TD_SURFACE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Area (m²)</label>
              <input type="number" inputMode="decimal" className="mono" value={zone.area_m2}
                onChange={e => updZone(zone.id, { area_m2: +e.target.value || 0 })} />
            </div>
            <div className="field">
              <label>Total depth (mm)</label>
              <input type="number" inputMode="decimal" className="mono" value={zone.depth_mm}
                onChange={e => updZone(zone.id, { depth_mm: +e.target.value || 0 })} />
            </div>
            <div className="field">
              <label>Milling depth (mm)</label>
              <input type="number" inputMode="decimal" className="mono" value={zone.milling_depth_mm}
                onChange={e => updZone(zone.id, { milling_depth_mm: +e.target.value || 0 })} />
            </div>

            <div style={{ gridColumn: '1 / -1', paddingTop: 8, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Binder course — toggle + material picker + depth */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer', minWidth: 110 }}>
                  <input type="checkbox" checked={!!zone.includes_binder}
                    onChange={e => updZone(zone.id, { includes_binder: e.target.checked })} />
                  Binder course
                </label>
                {zone.includes_binder && (
                  <>
                    <select value={zone.binder_tag || TD_DEFAULT_BINDER_TAG}
                      onChange={e => updZone(zone.id, { binder_tag: e.target.value })}
                      style={{ flex: 1, fontSize: 11, maxWidth: 280 }}>
                      {TD_BINDER_OPTIONS.map(o => <option key={o.tag} value={o.tag}>{o.label}</option>)}
                    </select>
                    <input type="number" inputMode="decimal" className="mono td-num-narrow" placeholder="depth mm" style={{ fontSize: 11 }}
                      value={zone.binder_depth_mm}
                      onChange={e => updZone(zone.id, { binder_depth_mm: +e.target.value || 0 })} />
                  </>
                )}
              </div>

              {/* Base course — toggle + material picker + depth */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer', minWidth: 110 }}>
                  <input type="checkbox" checked={!!zone.includes_base}
                    onChange={e => updZone(zone.id, { includes_base: e.target.checked })} />
                  Base course
                </label>
                {zone.includes_base && (
                  <>
                    <select value={zone.base_tag || TD_DEFAULT_BASE_TAG}
                      onChange={e => updZone(zone.id, { base_tag: e.target.value })}
                      style={{ flex: 1, fontSize: 11, maxWidth: 280 }}>
                      {TD_BASE_OPTIONS.map(o => <option key={o.tag} value={o.tag}>{o.label}</option>)}
                    </select>
                    <input type="number" inputMode="decimal" className="mono td-num-narrow" placeholder="depth mm" style={{ fontSize: 11 }}
                      value={zone.base_depth_mm}
                      onChange={e => updZone(zone.id, { base_depth_mm: +e.target.value || 0 })} />
                  </>
                )}
              </div>

              {/* Sub-base — only one catalogue material exists today, so no
                  picker; just toggle + depth. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer', minWidth: 110 }}>
                  <input type="checkbox" checked={!!zone.includes_subbase}
                    onChange={e => updZone(zone.id, { includes_subbase: e.target.checked })} />
                  Sub-base
                </label>
                {zone.includes_subbase && (
                  <input type="number" inputMode="decimal" className="mono td-num-narrow" placeholder="depth mm" style={{ fontSize: 11 }}
                    value={zone.subbase_depth_mm}
                    onChange={e => updZone(zone.id, { subbase_depth_mm: +e.target.value || 0 })} />
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      <button className="btn sm" onClick={addZone} style={{ marginTop: 4 }}>
        <window.Icon.Plus /> Add zone
      </button>
    </div>
  );
};

// ── Footway panel ────────────────────────────────────────────────────────────
// Single-area scheme-wide footway treatment. The carriageway zones panel
// can't represent footway works (no per-zone surface kind), and footway
// designs in practice are uniform across the area, so a single material
// picker + sub-base toggle is the right ergonomic.
const TDFootwayPanel = ({ scheme, write }) => {
  const design = scheme.design || window.defaultDesign();
  const fw     = design.footway || { surface_tag: '', include_subbase: false };
  const fwArea = +scheme.footway_area_m2 || 0;

  // Hide entirely when there's no footway area on the scheme — keeps the
  // Designer compact for carriageway-only schemes (the majority).
  if (fwArea <= 0) return null;

  const setFw = (patch) => write({ footway: { ...fw, ...patch } });

  return (
    <div className="form-section" style={{ marginBottom: 16 }}>
      <div className="section-head" style={{ marginBottom: 14 }}>
        <div className="section-title"><span className="section-num">03</span> Footway surfacing</div>
        <div style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>
          {fwArea.toLocaleString()} m² scheme footway
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'end' }}>
        <div className="field">
          <label>Surface treatment</label>
          <select value={fw.surface_tag || ''}
            onChange={e => setFw({ surface_tag: e.target.value })}>
            <option value="">— select —</option>
            {TD_FOOTWAY_OPTIONS.map(o => <option key={o.tag} value={o.tag}>{o.label}</option>)}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer', whiteSpace: 'nowrap', paddingBottom: 8 }}>
          <input type="checkbox" checked={!!fw.include_subbase}
            onChange={e => setFw({ include_subbase: e.target.checked })} />
          Include sub-base
        </label>
      </div>
    </div>
  );
};

// ── Ironworks panel — hoisted sub-components ────────────────────────────────
// Counter and Block are hoisted to module scope so React sees stable component
// identities across re-renders. Declaring them inside TDIronworksPanel's body
// would create new function references on every render, causing React to
// unmount/remount the inputs on each keystroke and drop focus.

const TDIWCounter = ({ iw, section, k, label, setSection }) => (
  <div className="field">
    <label>{label}</label>
    <input type="number" inputMode="decimal" className="mono" min="0" value={iw[section]?.[k] || 0}
      onChange={e => setSection(section, { [k]: Math.max(0, +e.target.value || 0) })} />
  </div>
);

const TDIWBlock = ({ iw, section, title, fields, setSection }) => (
  <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 14 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{title}</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
      {fields.map(([k, label]) => <TDIWCounter key={k} iw={iw} section={section} k={k} label={label} setSection={setSection} />)}
    </div>
  </div>
);

// ── Ironworks panel ──────────────────────────────────────────────────────────
const TDIronworksPanel = ({ scheme, write }) => {
  const design = scheme.design || window.defaultDesign();
  const iw = design.ironworks || { cway: {}, fway: {}, raise: {} };

  const setSection = (section, patch) =>
    write({ ironworks: { ...iw, [section]: { ...iw[section], ...patch } } });

  return (
    <div className="form-section" style={{ marginBottom: 16 }}>
      <div className="section-head" style={{ marginBottom: 14 }}>
        <div className="section-title"><span className="section-num">04</span> Ironworks</div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>Number of items to reset / replace per surface</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <TDIWBlock iw={iw} section="cway" title="Carriageway — reset to new level"
          fields={[['mh','Manholes'],['water','Water'],['bt','BT'],['gas','Gas'],['gullies','Gullies']]} setSection={setSection} />
        <TDIWBlock iw={iw} section="fway" title="Footway — reset to new level"
          fields={[['mh','Manholes'],['water','Water'],['bt','BT'],['gas','Gas']]} setSection={setSection} />
        <TDIWBlock iw={iw} section="raise" title="Raise / replace (any surface)"
          fields={[['mh','Manholes'],['water','Water'],['bt','BT'],['gas','Gas'],['gullies','Gullies']]} setSection={setSection} />
      </div>
    </div>
  );
};

// ── Kerbs panel ──────────────────────────────────────────────────────────────
const TDKerbsPanel = ({ scheme, write }) => {
  const design = scheme.design || window.defaultDesign();
  const kerbs  = design.kerbs || [];

  const setKerbs = (next) => write({ kerbs: next });
  const updKerb  = (id, patch) => setKerbs(kerbs.map(k => k.id === id ? { ...k, ...patch } : k));
  const addKerb  = () => setKerbs([...kerbs, { id: Date.now(), type: 'K1 half-batter — laid', length_m: 0 }]);
  const rmKerb   = (id) => setKerbs(kerbs.filter(k => k.id !== id));

  const total = kerbs.reduce((s, k) => s + (+k.length_m || 0), 0);

  return (
    <div className="form-section" style={{ marginBottom: 16 }}>
      <div className="section-head" style={{ marginBottom: 14 }}>
        <div className="section-title"><span className="section-num">05</span> Kerbs</div>
        <div style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{total.toLocaleString()} m total</div>
      </div>

      {kerbs.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12, border: '1px dashed var(--line)', borderRadius: 'var(--radius)', marginBottom: 10 }}>
          No kerb works. Add a row if any kerb laying or raising is required.
        </div>
      )}

      {kerbs.map(k => (
        <div key={k.id} className="td-kerb-row" style={{ gap: 8, alignItems: 'end', marginBottom: 8 }}>
          <div className="field">
            <label>Kerb type</label>
            <select value={k.type} onChange={e => updKerb(k.id, { type: e.target.value })}>
              {TD_KERB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Length (m)</label>
            <input type="number" inputMode="decimal" className="mono" min="0" value={k.length_m}
              onChange={e => updKerb(k.id, { length_m: Math.max(0, +e.target.value || 0) })} />
          </div>
          <button className="btn ghost sm" onClick={() => rmKerb(k.id)} title="Remove kerb row" style={{ marginBottom: 2 }}><window.Icon.X /></button>
        </div>
      ))}

      <button className="btn sm" onClick={addKerb} style={{ marginTop: 4 }}>
        <window.Icon.Plus /> Add kerb row
      </button>
    </div>
  );
};

// ── Lining panel ─────────────────────────────────────────────────────────────
const TDLiningPanel = ({ scheme, write }) => {
  const design = scheme.design || window.defaultDesign();
  const lining = design.lining || [];

  const setLining = (next) => write({ lining: next });
  const updRow = (id, patch) => setLining(lining.map(r => r.id === id ? { ...r, ...patch } : r));
  const addRow = () => setLining([...lining, { id: Date.now(), type: TD_LINING_TYPES[0].label, unit: TD_LINING_TYPES[0].unit, quantity: 0 }]);
  const rmRow  = (id) => setLining(lining.filter(r => r.id !== id));

  const totalM   = lining.filter(r => r.unit === 'm').reduce((s, r) => s + (+r.quantity || 0), 0);
  const totalM2  = lining.filter(r => r.unit === 'm²').reduce((s, r) => s + (+r.quantity || 0), 0);

  return (
    <div className="form-section" style={{ marginBottom: 16 }}>
      <div className="section-head" style={{ marginBottom: 14 }}>
        <div className="section-title"><span className="section-num">06</span> Lining &amp; markings</div>
        <div style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>
          {totalM > 0 && <span>{totalM.toLocaleString()} m</span>}
          {totalM > 0 && totalM2 > 0 && <span style={{ margin: '0 6px' }}>·</span>}
          {totalM2 > 0 && <span>{totalM2.toLocaleString()} m²</span>}
          {totalM === 0 && totalM2 === 0 && <span>no lining</span>}
        </div>
      </div>

      {lining.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12, border: '1px dashed var(--line)', borderRadius: 'var(--radius)', marginBottom: 10 }}>
          No road markings. Add a row to drive the Series 1200 BoQ lines.
        </div>
      )}

      {lining.map(r => {
        const preset = TD_LINING_TYPES.find(t => t.label === r.type);
        return (
          <div key={r.id} className="td-lining-row" style={{ gap: 8, alignItems: 'end', marginBottom: 8 }}>
            <div className="field">
              <label>Marking type</label>
              <select value={r.type} onChange={e => {
                const next = TD_LINING_TYPES.find(t => t.label === e.target.value);
                updRow(r.id, { type: e.target.value, unit: next?.unit || r.unit });
              }}>
                {TD_LINING_TYPES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Quantity</label>
              <input type="number" inputMode="decimal" className="mono" min="0" value={r.quantity}
                onChange={e => updRow(r.id, { quantity: Math.max(0, +e.target.value || 0) })} />
            </div>
            <div className="field">
              <label>Unit</label>
              <select value={r.unit} onChange={e => updRow(r.id, { unit: e.target.value })} disabled={!!preset}>
                <option value="m">m</option>
                <option value="m²">m²</option>
              </select>
            </div>
            <button className="btn ghost sm" onClick={() => rmRow(r.id)} title="Remove row" style={{ marginBottom: 2 }}><window.Icon.X /></button>
          </div>
        );
      })}

      <button className="btn sm" onClick={addRow} style={{ marginTop: 4 }}>
        <window.Icon.Plus /> Add marking
      </button>
    </div>
  );
};

// ── Traffic Management panel ─────────────────────────────────────────────────
const TDTMPanel = ({ scheme, write }) => {
  const design = scheme.design || window.defaultDesign();
  const tm = design.tm || {};

  const setTm = (patch) => write({ tm: { ...tm, ...patch } });

  return (
    <div className="form-section" style={{ marginBottom: 16 }}>
      <div className="section-head" style={{ marginBottom: 14 }}>
        <div className="section-title"><span className="section-num">07</span> Traffic management</div>
      </div>

      <div className="td-tm-grid" style={{ gap: 14 }}>
        <div className="field">
          <label>TM type</label>
          <select value={tm.type || ''} onChange={e => setTm({ type: e.target.value })}>
            <option value="">— select —</option>
            {TD_TM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Working hours</label>
          <input type="text" value={tm.hours || ''} placeholder="e.g. 08:00-15:30"
            onChange={e => setTm({ hours: e.target.value })} />
        </div>
        <div className="field">
          <label>Phases</label>
          <input type="number" inputMode="numeric" className="mono" min="1" value={tm.phases || 1}
            onChange={e => setTm({ phases: Math.max(1, +e.target.value || 1) })} />
        </div>
        <div className="field">
          <label>Duration (working days)</label>
          <input type="number" inputMode="numeric" className="mono" min="0" value={tm.duration_days ?? ''} placeholder="auto from dates"
            onChange={e => setTm({ duration_days: e.target.value === '' ? null : Math.max(0, +e.target.value || 0) })} />
        </div>
        <div className="field">
          <label>Diversion route by</label>
          <input type="text" value={tm.diversion_by || ''}
            onChange={e => setTm({ diversion_by: e.target.value })} />
        </div>
        <div className="field">
          <label>Plant compound location</label>
          <input type="text" value={tm.compound || ''}
            onChange={e => setTm({ compound: e.target.value })} />
        </div>
      </div>
    </div>
  );
};

// ── Site conditions — hoisted sub-component ──────────────────────────────────
// FactorGroup is hoisted here (outside TDSiteConditions) for the same reason
// TDIWCounter/TDIWBlock are hoisted: stable component identity avoids remounts.
// It receives mx and setMx as props rather than closing over them.

const TDFactorGroup = ({ factors, mx, setMx }) => (
  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px 16px' }}>
    {factors.map(f => (
      <div key={f.key}>
        <div style={{ fontSize:11, fontWeight:500, color:'var(--ink-2)', marginBottom:6 }}>{f.label}</div>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {f.opts.map(([label]) => {
            const active = mx[f.key] === label;
            return <button key={label} onClick={() => setMx(f.key, label)} style={{
              padding:'4px 10px', fontSize:11, borderRadius:'var(--radius-sm)',
              border: active?'1px solid var(--accent)':'1px solid var(--line)',
              background: active?'var(--accent-wash)':'var(--bg)',
              color: active?'var(--accent-ink)':'var(--ink-2)',
              cursor:'pointer', fontWeight: active?600:400, transition:'all 0.1s' }}>{label}</button>;
          })}
        </div>
      </div>
    ))}
  </div>
);

// ── Site conditions / recommendation engine ──────────────────────────────────
// Kept from the old Treatment tab — it's a per-scheme matrix that suggests a
// surface treatment based on traffic + condition factors. Independent of the
// design{} model; writes to scheme.matrix as before.
const TDSiteConditions = ({ schemeId, scheme }) => {
  const { updateScheme } = React.useContext(window.SchemeContext);
  const TRAFFIC_FACTORS = [
    { key:'traffic',   label:'Traffic level',     opts:[['Light',0],['Moderate',2],['Heavy',4],['Very Heavy',6]] },
    { key:'bus_stops', label:'Bus stops',          opts:[['None',0],['1–2',2],['3+',4]] },
    { key:'junctions', label:'Junctions present',  opts:[['None',0],['Minor',1],['Major',2]] },
    { key:'turning',   label:'Vehicle turning',    opts:[['None',0],['Occasional',1],['Frequent',2]] },
    { key:'parking',   label:'Parking bays',       opts:[['No',0],['Yes',1]] },
  ];
  const SURFACE_FACTORS = [
    { key:'condition', label:'Surface condition',     opts:[['Good',0],['Fair',1],['Poor',2],['Very Poor',3]] },
    { key:'cracking',  label:'Cracking',              opts:[['None',0],['Edge / linear',1],['Block',2],['Alligator',3]] },
    { key:'rutting',   label:'Rutting / deformation', opts:[['None',0],['< 5mm',1],['5–15mm',2],['> 15mm',3]] },
  ];
  const ALL_FACTORS = [...TRAFFIC_FACTORS, ...SURFACE_FACTORS];
  const MAX_SCORE = 24;
  const DEFAULT_MX = { traffic:'Moderate', bus_stops:'None', junctions:'None', turning:'None', parking:'No', condition:'Good', cracking:'None', rutting:'None' };
  const mx    = { ...DEFAULT_MX, ...(scheme.matrix || {}) };
  const setMx = (key, val) => updateScheme(schemeId, { matrix: { ...mx, [key]: val } });
  const score = ALL_FACTORS.reduce((acc, f) => { const o = f.opts.find(([l]) => l === mx[f.key]); return acc + (o ? o[1] : 0); }, 0);

  const getRec = () => {
    if (score <= 3)  return { category:'Low',         material:'Micro-asphalt' };
    if (score <= 7)  return { category:'Low',         material:'AC10 Taycoat 100/150' };
    if (score <= 11) return { category:'Medium',      material:'AC14 close binder 40/60' };
    if (score <= 16) return { category:'Medium-High', material:'HRA 30/14F surf 40/60' };
    return                  { category:'High',        material:'HRA 55/10F surf 40/60' };
  };
  const rec = getRec();
  const scoreColor = score <= 7 ? 'var(--green)' : score <= 16 ? 'var(--accent)' : 'var(--red)';
  const scorePct   = Math.min(100, Math.round((score / MAX_SCORE) * 100));

  return (
    <div className="form-section" style={{ marginBottom: 16 }}>
      <div className="section-head"><div className="section-title"><span className="section-num">01</span> Site conditions</div></div>
      <div className="td-site-conditions" style={{ gap:24, alignItems:'start' }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Traffic &amp; Use</div>
          <TDFactorGroup factors={TRAFFIC_FACTORS} mx={mx} setMx={setMx} />
          <div style={{ margin:'14px 0 8px', borderTop:'1px solid var(--line)' }} />
          <div style={{ fontSize:10, fontWeight:700, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Surface Condition</div>
          <TDFactorGroup factors={SURFACE_FACTORS} mx={mx} setMx={setMx} />
        </div>
        <div style={{ background:'var(--bg-sunken)', borderRadius:'var(--radius)', padding:14, display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:11 }}>
              <span style={{ color:'var(--ink-3)' }}>Weighted score</span>
              <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:scoreColor }}>{score} / {MAX_SCORE}</span>
            </div>
            <div style={{ height:6, background:'var(--line)', borderRadius:3, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${scorePct}%`, background:scoreColor, borderRadius:3, transition:'width 0.35s' }} />
            </div>
          </div>
          <div style={{ borderTop:'1px solid var(--line)', paddingTop:10 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Suggested material</div>
            <div style={{ fontSize:13, fontWeight:700 }}>{rec.material}</div>
            <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{rec.category} category</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Top-level component ──────────────────────────────────────────────────────
const TreatmentDesigner = ({ schemeId }) => {
  const { getScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);
  const write  = useDesignWriter(schemeId);

  if (!scheme) return null;

  return (
    <div style={{ maxWidth: 980 }}>
      <TDPreviewBar scheme={scheme} />
      <TDSiteConditions schemeId={schemeId} scheme={scheme} />
      <TDZonesPanel     scheme={scheme} write={write} />
      <TDFootwayPanel   scheme={scheme} write={write} />
      <TDIronworksPanel scheme={scheme} write={write} />
      <TDKerbsPanel     scheme={scheme} write={write} />
      <TDLiningPanel    scheme={scheme} write={write} />
      <TDTMPanel        scheme={scheme} write={write} />
    </div>
  );
};

window.TreatmentDesigner = TreatmentDesigner;
