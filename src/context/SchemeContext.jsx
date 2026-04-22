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
    const merged = { ...current, ...updates };
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
