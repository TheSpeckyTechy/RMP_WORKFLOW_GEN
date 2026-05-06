// ─── SchemeContext.jsx ────────────────────────────────────────────────────────
// React context providing scheme data to all components.
//
// Persistence: localStorage (instant local cache) + Supabase (cross-device sync).
// Every write goes to localStorage immediately and upserts to Supabase async.
// On mount the latest data is fetched from Supabase and merged into state.
//
// Exports (via window): SchemeContext, SchemeProvider
// Depends on: React, window.supabase (Supabase JS v2 UMD), window.SCHEMES
// ─────────────────────────────────────────────────────────────────────────────

window.SchemeContext = React.createContext(null);

const SUPABASE_URL  = 'https://humgbvwpxkhgfznnvhrn.supabase.co';
const SUPABASE_ANON = 'sb_publishable_0mH4xC8eTp_HZaMmzBb8tQ_zMqXgm1o';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── localStorage helpers ─────────────────────────────────────────────────────
const LS_PREFIX = 'rmp_scheme_';
const LS_IDS    = 'rmp_scheme_ids';

const lsGet    = (id)  => { try { const v = localStorage.getItem(LS_PREFIX + id); return v ? JSON.parse(v) : null; } catch { return null; } };
const lsSet    = (id, s) => { try { localStorage.setItem(LS_PREFIX + id, JSON.stringify(s)); } catch {} };
const lsGetIds = ()    => { try { const v = localStorage.getItem(LS_IDS); return v ? JSON.parse(v) : []; } catch { return []; } };
const lsSetIds = (ids) => { try { localStorage.setItem(LS_IDS, JSON.stringify(ids)); } catch {} };

// Silent migration: ensure every scheme loaded from storage has a .boq that
// matches the current shape — per-layer areas, milling_entries, and
// Master-linked override flags. Persists on the first updateScheme call.
const withBoq = (s) => {
  if (!s) return s;
  if (!s.boq) return { ...s, boq: window.defaultBoq() };

  let boq = s.boq;
  const qi = boq.quick_inputs || {};

  // ── 1. Per-layer area / milling_entries (shipped in earlier PR) ──
  if (!qi.milling_entries) {
    boq = {
      ...boq,
      quick_inputs: {
        ...qi,
        milling_entries: [{ depth: +qi.milling_depth || 40, area: null }],
        surface_area: qi.surface_area ?? null,
        binder_area:  qi.binder_area  ?? null,
        base_area:    qi.base_area    ?? null,
        subbase_area: qi.subbase_area ?? null,
        tack_area:    qi.tack_area    ?? null,
      },
    };
  }

  // ── 1b. New ironwork fields introduced in PR D2 (gas + gully) — default
  //       to 0 so the rail can render them for legacy rows.
  const qi2 = boq.quick_inputs || {};
  if (!('iw_gas_cway' in qi2) || !('iw_gas_fw' in qi2) || !('iw_gully_cway' in qi2)) {
    boq = {
      ...boq,
      quick_inputs: {
        ...qi2,
        iw_gas_cway:   +qi2.iw_gas_cway   || 0,
        iw_gas_fw:     +qi2.iw_gas_fw     || 0,
        iw_gully_cway: +qi2.iw_gully_cway || 0,
      },
    };
  }

  // ── 1c. Series 6400 uplift entries (night, Sat, Sun, Dundee area) — added
  //       so existing schemes pick up the new BoQ-tab toggles. Each entry is
  //       inserted only if absent, so user edits to existing toggles aren't
  //       overwritten on subsequent loads.
  const adds = (boq.settings && boq.settings.percentAdditions) || {};
  const newAdds = {
    night_uplift:    { enabled: false, pct: 0.20, label: 'Night-shift uplift (Series 6400/003)' },
    saturday_uplift: { enabled: false, pct: 0.20, label: 'Saturday uplift (Series 6400/004)' },
    sunday_uplift:   { enabled: false, pct: 0.20, label: 'Sunday uplift (Series 6400/005)' },
    dundee_area:     { enabled: false, pct: 0.03, label: 'Dundee City Council area (Series 6400/011)' },
  };
  const missing = Object.keys(newAdds).filter(k => !adds[k]);
  if (missing.length) {
    const merged = { ...adds };
    for (const k of missing) merged[k] = newAdds[k];
    boq = {
      ...boq,
      settings: { ...(boq.settings || {}), percentAdditions: merged },
    };
  }

  // ── 2. Master-linked overrides. Compare each stored value against the
  //     value the Master would produce now. If they match, the field can
  //     cleanly follow the Master; if they differ, preserve the BoQ value
  //     by flagging it as overridden.
  if (!boq.overrides) {
    const E = window.BOQ_ENGINE;
    const overrides = {};
    if (E && E.deriveQuickInputsFromScheme && E.LINKED_FIELDS) {
      const derived = E.deriveQuickInputsFromScheme(s);
      const stored  = boq.quick_inputs || {};
      for (const { key } of E.LINKED_FIELDS) {
        if (!(key in stored)) continue;
        if (stored[key] !== derived[key]) overrides[key] = true;
      }
    }
    boq = { ...boq, overrides };
  }

  return boq === s.boq ? s : { ...s, boq };
};

const initSchemes = () => {
  const base = window.SCHEMES.map(s => { const saved = lsGet(s.id); return withBoq(saved ? { ...s, ...saved } : s); });
  const defaultIds = new Set(window.SCHEMES.map(s => s.id));
  const extras = lsGetIds().filter(id => !defaultIds.has(id)).map(id => lsGet(id)).filter(Boolean).map(withBoq);
  return [...extras, ...base];
};

// Keep scheme.treatments[] and the zone_a1-a5_* Master-mirror fields in sync
// as a single source of truth. Called from updateScheme before the write.
//
// Rules:
//   - If `updates` includes `treatments`, it wins — rebuild zone_a1-5 from it.
//   - Else if `updates` includes any zone_aN_* field, rebuild treatments from
//     the resulting 5 slots.
//   - Otherwise return updates unchanged.
//
// This means a Master Workbook edit to zone_a1_area_m2 flows into
// scheme.treatments automatically, and a Treatment-tab zone edit refreshes
// the mirror. The engine's deriveQuickInputsFromScheme reads treatments[],
// so downstream BoQ auto-lines pick up the change on the next render.
const ZONE_FIELD_RE = /^zone_a[1-5]_(description|area_m2|depth_mm|treatment)$/;

function syncZoneMirror(current, updates) {
  const touchesTreatments = Object.prototype.hasOwnProperty.call(updates, 'treatments');
  const touchesZoneField  = Object.keys(updates).some(k => ZONE_FIELD_RE.test(k));
  if (!touchesTreatments && !touchesZoneField) return updates;

  const merged = { ...current, ...updates };
  let zones;

  if (touchesTreatments) {
    zones = Array.isArray(merged.treatments) ? merged.treatments : [];
  } else {
    // Reconstruct from the 5 slots, preserving ids from existing treatments[]
    // so per-zone identity survives Master-side edits.
    const existing = Array.isArray(current.treatments) ? current.treatments : [];
    zones = [];
    for (let i = 1; i <= 5; i++) {
      const desc      = merged[`zone_a${i}_description`];
      const area      = +merged[`zone_a${i}_area_m2`]  || 0;
      const depth     = +merged[`zone_a${i}_depth_mm`] || 0;
      const treatment = merged[`zone_a${i}_treatment`];
      const hasData   = (desc && String(desc).trim()) || area > 0 || depth > 0 || (treatment && String(treatment).trim());
      if (!hasData) continue;
      const prev = existing[i - 1] || {};
      zones.push({
        id:             prev.id || (1000 + i),
        zone:           desc || prev.zone || '',
        area_m2:        area,
        depth_mm:       depth || prev.depth_mm || 40,
        treatment_type: treatment || prev.treatment_type || '',
      });
    }
  }

  // Rebuild the Master-side mirror so both shapes always reflect `zones`.
  const patched = { ...updates, treatments: zones };
  for (let i = 1; i <= 5; i++) {
    const z = zones[i - 1];
    patched[`zone_a${i}_description`] = z ? (z.zone || '')           : '';
    patched[`zone_a${i}_area_m2`]     = z ? (+z.area_m2 || 0)        : 0;
    patched[`zone_a${i}_depth_mm`]    = z ? (+z.depth_mm || 0)       : 0;
    patched[`zone_a${i}_treatment`]   = z ? (z.treatment_type || '') : '';
  }
  return patched;
}

// ── Supabase helpers ─────────────────────────────────────────────────────────
const sbUpsertFn = async (id, data, onStatus, onSuccess) => {
  onStatus('syncing');
  const { error } = await sb.from('schemes').upsert({ id, data, updated_at: new Date().toISOString() });
  if (error) { onStatus('error'); } else { onStatus('synced'); onSuccess?.(); }
};

const SchemeProvider = ({ children }) => {
  const [schemes, setSchemes]     = React.useState(initSchemes);
  const [syncStatus, setSyncStatus] = React.useState('loading');
  const [lastSynced, setLastSynced] = React.useState(null);
  const latestSchemes = React.useRef(schemes);

  React.useEffect(() => { latestSchemes.current = schemes; }, [schemes]);

  // On mount: fetch from Supabase and merge into state
  React.useEffect(() => {
    sb.from('schemes').select('id, data').then(({ data: rows, error }) => {
      if (error) { setSyncStatus('error'); return; }
      if (rows && rows.length > 0) {
        const remoteMap = Object.fromEntries(rows.map(r => [r.id, r.data]));
        setSchemes(prev => {
          const localIds = new Set(prev.map(s => s.id));
          const updated  = prev.map(s => remoteMap[s.id] ? withBoq({ ...s, ...remoteMap[s.id] }) : s);
          const extras   = rows.filter(r => !localIds.has(r.id) && r.data).map(r => withBoq(r.data));
          return extras.length ? [...extras, ...updated] : updated;
        });
      }
      setSyncStatus('synced');
      setLastSynced(new Date());
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getScheme = (id) => schemes.find(s => s.id === id);

  const updateScheme = (id, updates) => {
    const current = latestSchemes.current.find(s => s.id === id);
    if (!current) return;
    const normalised = syncZoneMirror(current, updates);
    const merged = { ...current, ...normalised };
    lsSet(id, merged);
    setSchemes(prev => prev.map(s => s.id === id ? merged : s));
    sbUpsertFn(id, merged, setSyncStatus, () => setLastSynced(new Date()));
  };

  const addScheme = (scheme) => {
    lsSet(scheme.id, scheme);
    const defaultIds = new Set(window.SCHEMES.map(s => s.id));
    if (!defaultIds.has(scheme.id)) {
      const current = lsGetIds();
      if (!current.includes(scheme.id)) lsSetIds([scheme.id, ...current]);
    }
    setSchemes(prev => [scheme, ...prev]);
    sbUpsertFn(scheme.id, scheme, setSyncStatus, () => setLastSynced(new Date()));
  };

  const deleteScheme = (id) => {
    try { localStorage.removeItem(LS_PREFIX + id); } catch {}
    lsSetIds(lsGetIds().filter(i => i !== id));
    setSchemes(prev => prev.filter(s => s.id !== id));
    setSyncStatus('syncing');
    sb.from('schemes').delete().eq('id', id)
      .then(({ error }) => setSyncStatus(error ? 'error' : 'synced'));
  };

  const resetAllSchemes = () => {
    try {
      Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX)).forEach(k => localStorage.removeItem(k));
      localStorage.removeItem(LS_IDS);
    } catch {}
    window.location.reload();
  };

  return (
    <window.SchemeContext.Provider value={{ schemes, getScheme, updateScheme, addScheme, deleteScheme, resetAllSchemes, syncStatus, lastSynced }}>
      {children}
    </window.SchemeContext.Provider>
  );
};

window.SchemeProvider = SchemeProvider;
