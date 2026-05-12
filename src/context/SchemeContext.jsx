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

// ── Pending-write queue ─────────────────────────────────────────────────────
// Failed Supabase upserts go here so they survive refreshes and get
// retried on next mount, on next successful sync, or when the browser
// reports `online` after an offline stretch. Each entry is the full
// scheme `data` keyed by id; the latest write for an id supersedes any
// older queued entry (we never want to replay a stale edit on top of a
// fresh one).
const SBQ_KEY = 'rmp_sb_queue_v1';
const sbqGet     = () => { try { return JSON.parse(localStorage.getItem(SBQ_KEY) || '[]'); } catch { return []; } };
const sbqSet     = (q) => { try { localStorage.setItem(SBQ_KEY, JSON.stringify(q)); } catch {} };
const sbqEnqueue = (id, data) => {
  const dedup = sbqGet().filter(item => item.id !== id);
  dedup.push({ id, data, queuedAt: Date.now() });
  sbqSet(dedup);
};
const sbqRemove  = (id) => sbqSet(sbqGet().filter(item => item.id !== id));

// Build the Treatment Designer model (scheme.design) from the legacy fields
// it replaces — treatments[] for zones, iron_* for ironworks, kerb_length
// for kerbs, tm_* for traffic management. Used by withDesign during the
// silent migration; also called when a fresh scheme has no design{} yet.
//
// Per-zone includes_binder / includes_base / includes_subbase flags match
// the depth heuristic the BoQ engine used pre-Phase-3 (zone deeper than
// surface_depth → needs binder; deeper than surface+binder → needs base /
// subbase) so migrated schemes produce byte-identical BoQ output.
const deriveDesignFromLegacy = (s) => {
  const surfaceCourseDepth = +s.surface_depth_mm || 40;
  const binderCourseDepth  = +s.binder_depth_mm  || 60;
  const masterHasSubbase   = +s.subbase_depth_mm > 0;

  return {
    zones: (s.treatments || []).map((t, i) => {
      const total = +t.depth_mm || surfaceCourseDepth;
      return {
        id:               t.id || (1000 + i + 1),
        label:            t.zone || '',
        surface:          t.treatment_type || s.treatment_type || '',
        area_m2:          +t.area_m2 || 0,
        depth_mm:         total,
        milling_depth_mm: total,
        includes_binder:  total > surfaceCourseDepth,
        includes_base:    total > (surfaceCourseDepth + binderCourseDepth),
        includes_subbase: masterHasSubbase && total > (surfaceCourseDepth + binderCourseDepth),
        binder_depth_mm:  +s.binder_depth_mm || 0,
        base_depth_mm:    0,
        subbase_depth_mm: +s.subbase_depth_mm || 0,
      };
    }),
    ironworks: {
      cway:  { mh: +s.iron_mh||0, water: +s.iron_water||0, bt: +s.iron_bt||0, gas: +s.iron_gas||0, gullies: +s.iron_gullies||0 },
      fway:  { mh: 0, water: 0, bt: 0, gas: 0 },
      raise: { mh: 0, water: 0, bt: 0, gas: 0, gullies: 0 },
    },
    kerbs:  +s.kerb_length > 0 ? [{ id: 1, type: 'K1 half-batter — laid', length_m: +s.kerb_length }] : [],
    lining: [],
    tm: {
      type:          s.tm_type || '',
      hours:         s.tm_hours || '',
      phases:        +s.tm_phases || 1,
      diversion_by:  s.tm_diversion_by || '',
      compound:      s.tm_compound || '',
      duration_days: null,
    },
  };
};

// Silent migration: rename the pre-Phase-1 area_m2 field into the explicit
// carriageway_area_m2 / footway_area_m2 split, and back-fill scheme.design
// from legacy treatment / ironwork / kerb / TM fields. Persists on the first
// updateScheme call.
const withDesign = (s) => {
  if (!s) return s;
  let next = s;

  // 1. area_m2 → carriageway_area_m2 / footway_area_m2. The legacy field is
  //    left in place so any unmigrated readers keep working through Phase 1.
  const hasNewArea = next.carriageway_area_m2 != null || next.footway_area_m2 != null;
  if (next.area_m2 != null && !hasNewArea) {
    const isFootway = next.scheme_type === 'Footway';
    next = {
      ...next,
      carriageway_area_m2: isFootway ? 0 : (+next.area_m2 || 0),
      footway_area_m2:     isFootway ? (+next.area_m2 || 0) : 0,
    };
  }

  // 2. design{} back-fill. The Phase-2 designer flips design.touched=true on
  //    first user edit, which freezes the persisted shape. Until then we
  //    re-derive from legacy on every load so the mirror stays current as
  //    designers edit treatments[] / iron_* / tm_* via the legacy UI.
  if (!next.design || !next.design.touched) {
    next = { ...next, design: { ...deriveDesignFromLegacy(next), touched: false } };
  }

  return next;
};

// Silent migration: every loaded scheme gets the current boq shape — a
// default for any persisted scheme missing one, back-filled Series 6400
// uplift entries for older schemes, and stripped auto-lines (those are
// derived live from the Designer state now and don't belong on disk).
const withBoq = (s) => {
  if (!s) return s;
  if (!s.boq) return { ...s, boq: window.defaultBoq() };

  let boq = s.boq;

  // Series 6400 uplift entries (night, Sat, Sun, Dundee area) — back-filled
  // for older schemes whose settings.percentAdditions predates them. Each
  // entry only inserts if absent so any user edits to existing toggles
  // survive subsequent loads.
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

  // Strip auto-lines from any pre-derivation persisted state. They were
  // stored alongside user-added (custom) lines until auto-lines became
  // a render-time derivation; leaving them on disk would bloat
  // localStorage / Supabase rows over time. boq.touched is also obsolete.
  const lines = boq.custom_lines || [];
  const userOnly = lines.filter(l => !l.auto);
  if (userOnly.length !== lines.length || 'touched' in boq) {
    const next = { ...boq, custom_lines: userOnly };
    delete next.touched;
    boq = next;
  }

  return boq === s.boq ? s : { ...s, boq };
};

// withDesign renames legacy area_m2 → carriageway/footway_area_m2 and
// back-fills design{}; withBoq normalises the boq shape. Independent passes
// composed left-to-right.
const migrate = (s) => withBoq(withDesign(s));

const initSchemes = () => {
  const base = window.SCHEMES.map(s => { const saved = lsGet(s.id); return migrate(saved ? { ...s, ...saved } : s); });
  const defaultIds = new Set(window.SCHEMES.map(s => s.id));
  const extras = lsGetIds().filter(id => !defaultIds.has(id)).map(id => lsGet(id)).filter(Boolean).map(migrate);
  return [...extras, ...base];
};

// ── Supabase helpers ─────────────────────────────────────────────────────────
const sbUpsertOnce = async (id, data) => {
  // Use the embedded data.updated_at so the row column and the data field
  // stay in sync — on the next fetch we compare the row column against
  // localStorage's data.updated_at to resolve which side is newer.
  const updatedAt = data.updated_at || new Date().toISOString();
  return sb.from('schemes').upsert({ id, data, updated_at: updatedAt });
};

const sbUpsertFn = async (id, data, onStatus, onSuccess) => {
  onStatus('syncing');
  const { error } = await sbUpsertOnce(id, data);
  if (error) {
    // Network/permission failure — queue for retry so the edit isn't lost
    // if the user refreshes before connectivity returns.
    sbqEnqueue(id, data);
    onStatus('error');
  } else {
    // Success — drop any older queued entry for this id (this write
    // supersedes whatever was waiting) and report synced.
    sbqRemove(id);
    onStatus('synced');
    onSuccess?.();
  }
};

// Drain pending writes in FIFO order. Stops on first failure so the
// failed item stays at the head of the queue and any later writes
// queued behind it don't get reordered. Called from the provider's
// mount-effect (after the initial Supabase fetch) and on the browser's
// `online` event so post-reconnect recovery is automatic.
const sbDrainQueue = async (onStatus, onSynced) => {
  let queue = sbqGet();
  if (queue.length === 0) return;
  onStatus('syncing');
  // Sort FIFO so the oldest queued edit retries first.
  queue.sort((a, b) => a.queuedAt - b.queuedAt);
  for (const item of queue) {
    const { error } = await sbUpsertOnce(item.id, item.data);
    if (error) { onStatus('error'); return; }
    sbqRemove(item.id);
  }
  onStatus('synced');
  onSynced?.();
};

const SchemeProvider = ({ children }) => {
  const [schemes, setSchemes]     = React.useState(initSchemes);
  const [syncStatus, setSyncStatus] = React.useState('loading');
  const [lastSynced, setLastSynced] = React.useState(null);
  const latestSchemes = React.useRef(schemes);

  React.useEffect(() => { latestSchemes.current = schemes; }, [schemes]);

  // On mount: fetch from Supabase and merge into state. Per-scheme,
  // compare embedded data.updated_at against the local copy and keep
  // whichever is newer — this protects against the race where a user
  // edits locally, refreshes before the async sbUpsert lands, and the
  // GET returns the pre-edit server value. Without this guard, the
  // remote spread { ...local, ...remote } silently clobbers the
  // in-flight local edit.
  React.useEffect(() => {
    sb.from('schemes').select('id, data, updated_at').then(({ data: rows, error }) => {
      if (error) { setSyncStatus('error'); return; }
      if (rows && rows.length > 0) {
        const remoteMap = Object.fromEntries(rows.map(r => [r.id, { data: r.data, updated_at: r.updated_at }]));
        // Track schemes where remote genuinely overwrote a locally-edited
        // copy (localTs > 0) — i.e. the user had real unsaved edits on
        // this device that just got replaced by a newer version from
        // somewhere else. Pure hydration (localTs = 0) is NOT a conflict.
        const conflictLosses = [];
        setSchemes(prev => {
          const localIds = new Set(prev.map(s => s.id));
          const updated  = prev.map(s => {
            const remote = remoteMap[s.id];
            if (!remote) return s;
            const localTs  = s.updated_at         ? Date.parse(s.updated_at)         : 0;
            const remoteTs = remote.updated_at    ? Date.parse(remote.updated_at)    : 0;
            // Local wins on tie so a freshly-typed edit (still being
            // upserted) doesn't get rolled back by the older server value.
            if (localTs >= remoteTs && localTs > 0) return s;
            if (localTs > 0 && remoteTs > localTs) {
              conflictLosses.push({ id: s.id, road_name: s.road_name || s.id });
            }
            return migrate({ ...s, ...remote.data });
          });
          const extras = rows.filter(r => !localIds.has(r.id) && r.data).map(r => migrate(r.data));
          return extras.length ? [...extras, ...updated] : updated;
        });
        if (conflictLosses.length > 0 && window.Toast) {
          const sample = conflictLosses.slice(0, 3).map(c => c.road_name).join(', ');
          const more   = conflictLosses.length > 3 ? ` and ${conflictLosses.length - 3} more` : '';
          window.Toast.show({
            kind: 'info',
            msg: `A newer version of ${sample}${more} from another device replaced your changes.`,
            duration: 8000,
          });
        }
      }
      setSyncStatus('synced');
      setLastSynced(new Date());
      // Drain any writes that were queued while offline / Supabase was
      // down. Runs after the initial fetch so we don't race the two.
      sbDrainQueue(setSyncStatus, () => setLastSynced(new Date()));
    });
    // Re-drain whenever the browser regains connectivity. Covers the
    // common "user edited while on the train, app refreshed once they
    // were back on wifi" case without requiring a manual action.
    const onOnline = () => sbDrainQueue(setSyncStatus, () => setLastSynced(new Date()));
    window.addEventListener('online', onOnline);
    // Fetch from Supabase exactly once on provider mount; per-scheme
    // updates after that flow through updateScheme(). Setters are
    // stable identities so they don't need to appear in the dep array.
    return () => window.removeEventListener('online', onOnline);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getScheme = (id) => schemes.find(s => s.id === id);

  const updateScheme = (id, updates) => {
    const current = latestSchemes.current.find(s => s.id === id);
    if (!current) return;
    // Stamp updated_at on every edit so the next Supabase fetch can tell
    // whether the local copy is newer than what came back from the server.
    const merged = { ...current, ...updates, updated_at: new Date().toISOString() };
    lsSet(id, merged);
    setSchemes(prev => prev.map(s => s.id === id ? merged : s));
    sbUpsertFn(id, merged, setSyncStatus, () => setLastSynced(new Date()));
  };

  const addScheme = (scheme) => {
    // Stamp updated_at at creation so the last-write-wins merge in the
    // mount-effect Supabase fetch (line ~207) can see the local copy as
    // newer than any pre-existing remote row. Without this, a network
    // race on first sync could let a stale Supabase value overwrite a
    // freshly-created scheme.
    const stamped = { ...scheme, updated_at: scheme.updated_at || new Date().toISOString() };
    lsSet(stamped.id, stamped);
    const defaultIds = new Set(window.SCHEMES.map(s => s.id));
    if (!defaultIds.has(stamped.id)) {
      const current = lsGetIds();
      if (!current.includes(stamped.id)) lsSetIds([stamped.id, ...current]);
    }
    setSchemes(prev => [stamped, ...prev]);
    sbUpsertFn(stamped.id, stamped, setSyncStatus, () => setLastSynced(new Date()));
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
