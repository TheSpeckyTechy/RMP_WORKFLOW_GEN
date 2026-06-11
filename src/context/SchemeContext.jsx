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

// ── Backend mode ─────────────────────────────────────────────────────────
// 'supabase' — third-party Postgres, default for backward compat.
// 'fs'       — File System Access API. Stores each scheme as a JSON file
//              in a user-picked OneDrive folder. Zero IT setup; data stays
//              on the work laptop + DCC's OneDrive tenant. Desktop Edge /
//              Chrome / Opera only (no Firefox, no Safari, no mobile).
//              See SETUP_FS.md for usage.
const BACKEND_MODE = 'fs';   // 'supabase' | 'fs'

// ── Supabase backend ─────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://humgbvwpxkhgfznnvhrn.supabase.co';
const SUPABASE_ANON = 'sb_publishable_0mH4xC8eTp_HZaMmzBb8tQ_zMqXgm1o';

// Created lazily so 'fs' mode neither depends on nor loads the Supabase CDN
// script (index.html no longer includes it). To re-enable the Supabase
// backend: restore the script tag in index.html and set BACKEND_MODE above.
let _sbClient = null;
const sb = () => {
  if (!_sbClient) {
    if (!window.supabase) {
      throw new Error('Supabase library not loaded — re-add the supabase-js script tag in index.html to use BACKEND_MODE="supabase".');
    }
    _sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  }
  return _sbClient;
};

// ── File System Access backend ───────────────────────────────────────────
// Stores each scheme as a {id}.json file in a folder the user picks once.
// Handle cached in IndexedDB so it survives refreshes. Point at a
// OneDrive-synced folder and every save round-trips to DCC's OneDrive
// cloud automatically. No app registration, no Azure AD, no anon key.

const FS_DB_NAME    = 'rmp_fs_v1';
const FS_STORE      = 'handles';
const FS_HANDLE_KEY = 'data_dir';

const fsOpenDb = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(FS_DB_NAME, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(FS_STORE);
  req.onerror   = () => reject(req.error);
  req.onsuccess = () => resolve(req.result);
});

const fsIdbGet = async (key) => {
  const db = await fsOpenDb();
  return new Promise((resolve, reject) => {
    const get = db.transaction(FS_STORE, 'readonly').objectStore(FS_STORE).get(key);
    get.onsuccess = () => resolve(get.result);
    get.onerror   = () => reject(get.error);
  });
};

const fsIdbSet = async (key, value) => {
  const db = await fsOpenDb();
  return new Promise((resolve, reject) => {
    const put = db.transaction(FS_STORE, 'readwrite').objectStore(FS_STORE).put(value, key);
    put.onsuccess = () => resolve();
    put.onerror   = () => reject(put.error);
  });
};

const fsIdbDelete = async (key) => {
  const db = await fsOpenDb();
  return new Promise((resolve, reject) => {
    const del = db.transaction(FS_STORE, 'readwrite').objectStore(FS_STORE).delete(key);
    del.onsuccess = () => resolve();
    del.onerror   = () => reject(del.error);
  });
};

let _fsDir = null;

// Must run from a user gesture (button click) — browsers refuse
// showDirectoryPicker outside one.
const fsPickFolder = async () => {
  if (!window.showDirectoryPicker) {
    throw new Error('File System Access API not available in this browser. Use Edge or Chrome on desktop.');
  }
  const handle = await window.showDirectoryPicker({
    id: 'rmp-data', mode: 'readwrite', startIn: 'documents',
  });
  await fsIdbSet(FS_HANDLE_KEY, handle);
  _fsDir = handle;
  return handle;
};

// Resolve the cached handle; re-requests permission if the browser
// cleared the grant. Throws 'no_folder_chosen' / 'permission_denied'
// so the caller can prompt the user via a folder-picker button.
const fsResolveFolder = async () => {
  if (_fsDir) {
    const p = await _fsDir.queryPermission({ mode: 'readwrite' });
    if (p === 'granted') return _fsDir;
  }
  const stored = await fsIdbGet(FS_HANDLE_KEY);
  if (!stored) throw new Error('no_folder_chosen');
  const perm = await stored.queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    // requestPermission throws a SecurityError when called without a user
    // gesture (e.g. the mount-time fetch on a fresh session). That's the
    // normal "show the reconnect button" state, not a hard sync error.
    let req;
    try {
      req = await stored.requestPermission({ mode: 'readwrite' });
    } catch {
      throw new Error('permission_denied');
    }
    if (req !== 'granted') throw new Error('permission_denied');
  }
  _fsDir = stored;
  return stored;
};

const fsDeleteOnce = async (id) => {
  try {
    const dir = await fsResolveFolder();
    try {
      await dir.removeEntry(`${id}.json`);
    } catch (e) {
      // File not found is fine — nothing to delete.
      if (e.name !== 'NotFoundError') throw e;
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
};

const fsUpsertOnce = async (id, data) => {
  try {
    const dir = await fsResolveFolder();
    const stamped = { ...data, updated_at: data.updated_at || new Date().toISOString() };
    const fileHandle = await dir.getFileHandle(`${id}.json`, { create: true });
    let writable;
    try {
      writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(stamped, null, 2));
      await writable.close();
    } catch (e) {
      if (writable) await writable.abort().catch(() => {});
      throw e;
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
};

const fsFetchAll = async () => {
  try {
    const dir = await fsResolveFolder();
    const rows = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'file' || !name.endsWith('.json')) continue;
      const file = await handle.getFile();
      try {
        const data = JSON.parse(await file.text());
        rows.push({
          id: data.id || name.replace(/\.json$/, ''),
          data,
          updated_at: data.updated_at || new Date(file.lastModified).toISOString(),
        });
      } catch { /* skip corrupt JSON */ }
    }
    return { data: rows, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
};

// Single dispatchers — switch on BACKEND_MODE so SchemeProvider doesn't
// have to know which backend it's talking to.
const backendUpsertOnce = (id, data) =>
  BACKEND_MODE === 'fs'
    ? fsUpsertOnce(id, data)
    : sbUpsertOnce(id, data);

const backendDeleteOnce = (id) =>
  BACKEND_MODE === 'fs'
    ? fsDeleteOnce(id)
    : sb().from('schemes').delete().eq('id', id).then(r => r);

const backendFetchAll = () =>
  BACKEND_MODE === 'fs'
    ? fsFetchAll()
    : sb().from('schemes').select('id, data, updated_at').then(r => r);

// ── Folder structure provisioning ────────────────────────────────────────────
// Defines the subfolder tree to create inside each scheme's project folder.
// Each entry is a path from the scheme root — ['Drawings','Approved','Contract']
// creates Drawings/Approved/Contract/. Idempotent: existing folders are untouched.
const SCHEME_FOLDER_TREE = [
  ['CDM'],
  ['Contract'],
  ['Design & Reports'],
  ['Drawings', 'Approved', 'As-Built'],
  ['Drawings', 'Approved', 'Building Warrant & Planning'],
  ['Drawings', 'Approved', 'Contract'],
  ['Drawings', 'Approved', 'Feasibility & Costing'],
  ['Drawings', 'Approved', 'Superseded'],
  ['Drawings', 'Approved', 'Tender'],
  ['Drawings', 'Draft'],
  ['Drawings', 'Received'],
  ['H&S File'],
  ['Minutes'],
  ['Photographs'],
  ['Project Admin'],
  ['Site Investigations'],
];

// Canonical folder name for a scheme: "R6020 - Mid Craigie Road"
// or just the road name when no project number is assigned yet.
const schemeFolderName = (scheme) => {
  const sanitise = (s) => s.replace(/[/\\:*?"<>|]/g, '-').trim();
  const ref  = sanitise((scheme.project_number || '').trim());
  const name = sanitise((scheme.road_name || scheme.id || '').trim());
  return ref ? `${ref} - ${name}` : name;
};
window.schemeFolderName = schemeFolderName;

// Copy the pre-design sketch PDF (bundled in /templates/) into the scheme's
// Drawings/Approved/ folder. Best-effort: a missing file or fetch failure
// must never break the folder-provisioning step.
const fsSavePredesignSketch = async (schemeDir, scheme) => {
  if (!scheme.sketch_pdf) return;
  try {
    const res = await fetch(`templates/${encodeURIComponent(scheme.sketch_pdf)}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const drawings = await schemeDir.getDirectoryHandle('Drawings', { create: true });
    const approved = await drawings.getDirectoryHandle('Approved', { create: true });
    const fileHandle = await approved.getFileHandle(scheme.sketch_pdf.replace(/[/\\]/g, '_'), { create: true });
    const writable   = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch { /* sketch is optional — never block folder provisioning */ }
};

const fsProvisionSchemeFolder = async (scheme) => {
  const dir        = await fsResolveFolder();
  const folderName = schemeFolderName(scheme);
  const schemeDir  = await dir.getDirectoryHandle(folderName, { create: true });
  for (const pathParts of SCHEME_FOLDER_TREE) {
    let node = schemeDir;
    for (const part of pathParts) {
      node = await node.getDirectoryHandle(part, { create: true });
    }
  }
  await fsSavePredesignSketch(schemeDir, scheme);
  return schemeDir;
};

// Saves any file directly into a scheme's project subfolder via the FS API.
// subfolderParts: e.g. ['Contract'] or ['Drawings', 'Draft'].
// data: ArrayBuffer | Uint8Array | Blob.
// versioned: if true and the file already exists, the existing copy is archived
//   as {base}_R{n}.{ext} in a Superseded/ subfolder before the new file is written.
// Returns true on success, false if folder not connected or write fails.
const fsSaveToProjectFolder = async (scheme, subfolderParts, filename, data, { versioned = false } = {}) => {
  try {
    // Sanitise filename — strip chars illegal on Windows/OneDrive.
    // dot > 0 (not >= 0) avoids an empty base for dotfiles like ".hidden".
    const safeFilename = filename.replace(/[/\\:*?"<>|]/g, '_').trim() || 'file';

    const root = await fsResolveFolder();
    const folderName = schemeFolderName(scheme);
    let dir = await root.getDirectoryHandle(folderName, { create: true });
    for (const part of subfolderParts) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }

    // Normalise to Blob — the FS writable accepts Blob universally whereas
    // plain Array (xlsx-js-style type:'array'), Uint8Array (pdf-lib) and
    // other typed views can behave inconsistently across browser versions.
    const blob = data instanceof Blob ? data : new Blob([data]);

    if (versioned) {
      try {
        const existingHandle = await dir.getFileHandle(safeFilename);
        const existingBuf    = await (await existingHandle.getFile()).arrayBuffer();
        const revDir = await dir.getDirectoryHandle('Superseded', { create: true });
        const dot  = safeFilename.lastIndexOf('.');
        const base = dot > 0 ? safeFilename.slice(0, dot) : safeFilename;
        const ext  = dot > 0 ? safeFilename.slice(dot)    : '';
        let rev = 1;
        const MAX_REVS = 999;
        while (rev <= MAX_REVS) {
          try { await revDir.getFileHandle(`${base}_R${rev}${ext}`); rev++; }
          catch (re) { if (re.name === 'NotFoundError') break; throw re; }
        }
        const revFh = await revDir.getFileHandle(`${base}_R${rev}${ext}`, { create: true });
        let revW;
        try {
          revW = await revFh.createWritable();
          await revW.write(new Blob([existingBuf]));
          await revW.close();
        } catch (e) {
          if (revW) await revW.abort().catch(() => {});
          throw e;
        }
      } catch (e) { if (e.name !== 'NotFoundError') throw e; }
    }

    const fh = await dir.getFileHandle(safeFilename, { create: true });
    let w;
    try {
      w = await fh.createWritable();
      await w.write(blob);
      await w.close();
    } catch (e) {
      if (w) await w.abort().catch(() => {});
      throw e;
    }
    return true;
  } catch (e) {
    // Surface the real error in the console so failures are diagnosable.
    console.warn('[fsSaveToProjectFolder] failed:', filename, e?.message || e);
    return false;
  }
};
window.fsSaveToProjectFolder = fsSaveToProjectFolder;

// Converts a base64 data URL to an ArrayBuffer for FS writes.
const dataUrlToArrayBuffer = (dataUrl) => {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

// Upload-folder map: pack docKey → OneDrive subfolder path.
// Covers every pack document — used for both new uploads and the sync function.
const PACK_FOLDER_MAP = {
  front:     ['Project Admin'],
  pci:       ['CDM'],
  rsr:       ['Project Admin'],
  boq:       ['Contract'],
  drawings:  ['Drawings', 'Draft'],
  tm:        ['Drawings', 'Received'],
  utilities: ['CDM'],
};
window.PACK_FOLDER_MAP = PACK_FOLDER_MAP;

// Syncs all uploaded pack files stored in the scheme to their OneDrive subfolders.
// Covers both multi-file uploads (pack_files_*) and single-file overrides (pack_file_*).
// Uses versioned saves so existing files are archived as _R1, _R2… before overwriting.
// Returns { saved, failed, total }.
const syncProjectFilesToFolder = async (scheme) => {
  let saved = 0, failed = 0;
  for (const [key, folder] of Object.entries(PACK_FOLDER_MAP)) {
    // Multi-file uploads: drawings, TM plans, utility searches
    const multiFiles = scheme[`pack_files_${key}`] || [];
    for (const f of multiFiles) {
      if (!f.data) { failed++; continue; }
      try {
        const buf = dataUrlToArrayBuffer(f.data);
        const ok  = await fsSaveToProjectFolder(scheme, folder, f.name, buf, { versioned: true });
        ok ? saved++ : failed++;
      } catch { failed++; }
    }
    // Single-file override upload: PCI, RSR, BoQ, Front Sheet, etc.
    const single = scheme[`pack_file_${key}`];
    if (single?.data) {
      try {
        const buf = dataUrlToArrayBuffer(single.data);
        const ok  = await fsSaveToProjectFolder(scheme, folder, single.name, buf, { versioned: true });
        ok ? saved++ : failed++;
      } catch { failed++; }
    }
  }
  return { saved, failed, total: saved + failed };
};
window.syncProjectFilesToFolder = syncProjectFilesToFolder;

// ── localStorage helpers ─────────────────────────────────────────────────────
const LS_PREFIX = 'rmp_scheme_';
const LS_IDS    = 'rmp_scheme_ids';

const lsGet    = (id)  => { try { const v = localStorage.getItem(LS_PREFIX + id); return v ? JSON.parse(v) : null; } catch { return null; } };
const lsGetIds = ()    => { try { const v = localStorage.getItem(LS_IDS); return v ? JSON.parse(v) : []; } catch { return []; } };
const lsSetIds = (ids) => { try { localStorage.setItem(LS_IDS, JSON.stringify(ids)); } catch {} };

// Delete tombstones: { id: deletedAtISO }. Without these, deleting one of the
// seed schemes from window.SCHEMES only lasts until the next reload, because
// initSchemes() unconditionally re-seeds the whole register. A backend row
// (or seed) with updated_at NEWER than the tombstone wins — that's a scheme
// genuinely re-created elsewhere — and clears the tombstone.
const LS_DELETED = 'rmp_deleted_ids_v1';
const lsGetDeleted = () => { try { const v = localStorage.getItem(LS_DELETED); return v ? JSON.parse(v) : {}; } catch { return {}; } };
const lsSetDeleted = (m) => { try { localStorage.setItem(LS_DELETED, JSON.stringify(m)); } catch {} };
const tombstoneAdd    = (id) => lsSetDeleted({ ...lsGetDeleted(), [id]: new Date().toISOString() });
const tombstoneClear  = (id) => { const m = lsGetDeleted(); if (id in m) { delete m[id]; lsSetDeleted(m); } };
// True when `updatedAt` proves the record is newer than its tombstone.
const tombstoneBeaten = (id, updatedAt) => {
  const t = lsGetDeleted()[id];
  return !!(t && updatedAt && Date.parse(updatedAt) > Date.parse(t));
};

// localStorage writes can fail two ways: quota exhaustion (a couple of
// big base64 PDFs in pack_files_* push past the 5MB per-origin limit)
// or private-browsing sandboxes that throw on every setItem. Both used
// to be silently swallowed by a bare catch{} — the user saw an edit
// "save" and then disappear on refresh.
// lsSet now returns a flag indicating success so callers can surface
// the failure via a toast and a sync-error state.
const APPROX_QUOTA_BYTES = 4 * 1024 * 1024;   // ~4MB; soft warning before the 5MB hard limit
const lsSet = (id, s) => {
  try {
    const json = JSON.stringify(s);
    localStorage.setItem(LS_PREFIX + id, json);
    // Soft warning when a single scheme JSON approaches the per-origin
    // quota. Common cause: too many base64 PDFs in pack_files_*.
    if (json.length > APPROX_QUOTA_BYTES && window.Toast) {
      window.Toast.show({
        kind: 'info',
        msg: `Scheme ${id} is ${Math.round(json.length / 1024 / 1024 * 10) / 10} MB — close to the browser storage limit. Consider trimming uploaded PDFs.`,
        duration: 8000,
      });
    }
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[SchemeContext] lsSet failed:', id, e);
    if (window.Toast) {
      window.Toast.show({
        kind: 'error',
        msg: `Couldn't save ${id} locally — browser storage may be full. Older drafts and uploaded PDFs are the most likely culprit.`,
        duration: 10000,
      });
    }
    return false;
  }
};

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

  // 0. scheme_type default. Several downstream consumers assume the
  //    field is populated (PCIPreview falls back to "Carriageway" at
  //    its callsite; the area-migration below branches on === 'Footway').
  //    Defaulting here means every loaded scheme presents a consistent
  //    shape regardless of whether the seed/legacy row carried it.
  if (next.scheme_type == null || next.scheme_type === '') {
    next = { ...next, scheme_type: 'Carriageway' };
  }

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
  const deleted = lsGetDeleted();
  const base = window.SCHEMES
    .filter(s => !deleted[s.id])
    .map(s => { const saved = lsGet(s.id); return migrate(saved ? { ...s, ...saved } : s); });
  const defaultIds = new Set(window.SCHEMES.map(s => s.id));
  const extras = lsGetIds()
    .filter(id => !defaultIds.has(id) && !deleted[id])
    .map(id => lsGet(id)).filter(Boolean).map(migrate);
  return [...extras, ...base];
};

// ── Supabase helpers ─────────────────────────────────────────────────────────
const sbUpsertOnce = async (id, data) => {
  // Use the embedded data.updated_at so the row column and the data field
  // stay in sync — on the next fetch we compare the row column against
  // localStorage's data.updated_at to resolve which side is newer.
  const updatedAt = data.updated_at || new Date().toISOString();
  return sb().from('schemes').upsert({ id, data, updated_at: updatedAt });
};

const sbUpsertFn = async (id, data, onStatus, onSuccess) => {
  onStatus('syncing');
  const { error } = await backendUpsertOnce(id, data);
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
    const { error } = await backendUpsertOnce(item.id, item.data);
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
  const [folderName, setFolderName] = React.useState(null);
  const [lastSnapshot, setLastSnapshot] = React.useState(null);
  const latestSchemes = React.useRef(schemes);

  React.useEffect(() => { latestSchemes.current = schemes; }, [schemes]);

  // Seed folderName from the cached IndexedDB handle so the Settings panel
  // shows the folder name even before the first fsFetchAll resolves.
  React.useEffect(() => {
    if (BACKEND_MODE !== 'fs') return;
    fsIdbGet(FS_HANDLE_KEY).then(h => { if (h) setFolderName(h.name); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // On mount: fetch from Supabase and merge into state. Per-scheme,
  // compare embedded data.updated_at against the local copy and keep
  // whichever is newer — this protects against the race where a user
  // edits locally, refreshes before the async sbUpsert lands, and the
  // GET returns the pre-edit server value. Without this guard, the
  // remote spread { ...local, ...remote } silently clobbers the
  // in-flight local edit.
  React.useEffect(() => {
    backendFetchAll().then(({ data: rows, error }) => {
      if (error) {
        // 'fs' mode: no folder picked yet (or permission cleared on tab
        // restore) → not an error, just a first-run state the UI handles
        // by surfacing a "Choose data folder" button.
        const msg = String(error.message || error);
        if (BACKEND_MODE === 'fs' && /no_folder_chosen|permission_denied/.test(msg)) {
          setSyncStatus('folder-required');
        } else {
          setSyncStatus('error');
        }
        return;
      }
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
          const extras = rows
            .filter(r => !localIds.has(r.id) && r.data)
            // Locally-deleted schemes stay deleted unless the backend copy
            // is newer than the tombstone (re-created on another device).
            .filter(r => {
              const dels = lsGetDeleted();
              if (!dels[r.id]) return true;
              if (tombstoneBeaten(r.id, r.updated_at)) { tombstoneClear(r.id); return true; }
              return false;
            })
            .map(r => migrate(r.data));
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
      if (BACKEND_MODE === 'fs' && _fsDir) setFolderName(_fsDir.name);
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
    // docs_generated patches come from long async handlers that spread a
    // render-time snapshot; merging key-wise against the live copy stops two
    // concurrent generations/uploads silently reverting each other's flags.
    if (updates.docs_generated && current.docs_generated) {
      merged.docs_generated = { ...current.docs_generated, ...updates.docs_generated };
    }
    const ok = lsSet(id, merged);
    setSchemes(prev => prev.map(s => s.id === id ? merged : s));
    if (!ok) setSyncStatus('error');
    sbUpsertFn(id, merged, setSyncStatus, () => setLastSynced(new Date()));
  };

  const addScheme = (scheme) => {
    // Stamp updated_at at creation so the last-write-wins merge in the
    // mount-effect Supabase fetch (line ~207) can see the local copy as
    // newer than any pre-existing remote row. Without this, a network
    // race on first sync could let a stale Supabase value overwrite a
    // freshly-created scheme.
    const stamped = { ...scheme, updated_at: scheme.updated_at || new Date().toISOString() };
    const ok = lsSet(stamped.id, stamped);
    if (!ok) setSyncStatus('error');
    tombstoneClear(stamped.id); // re-creating a previously deleted id revives it
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
    // Tombstone so seed schemes (always re-seeded by initSchemes) and any
    // backend copy this device can't reach don't resurrect on reload.
    tombstoneAdd(id);
    setSchemes(prev => prev.filter(s => s.id !== id));
    setSyncStatus('syncing');
    backendDeleteOnce(id)
      .then(({ error }) => setSyncStatus(error ? 'error' : 'synced'));
  };

  const resetAllSchemes = () => {
    try {
      Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX)).forEach(k => localStorage.removeItem(k));
      localStorage.removeItem(LS_IDS);
      localStorage.removeItem(LS_DELETED);
    } catch {}
    window.location.reload();
  };

  const forgetDataFolder = async () => {
    await fsIdbDelete(FS_HANDLE_KEY).catch(() => {});
    _fsDir = null;
    setFolderName(null);
    setSyncStatus('folder-required');
  };

  const createSnapshot = async () => {
    if (BACKEND_MODE !== 'fs') return;
    try {
      const dir = await fsResolveFolder();
      const backupsDir = await dir.getDirectoryHandle('_backups', { create: true });
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const snapName = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const snapDir = await backupsDir.getDirectoryHandle(snapName, { create: true });
      for (const s of latestSchemes.current) {
        const fh = await snapDir.getFileHandle(`${s.id}.json`, { create: true });
        const w = await fh.createWritable();
        await w.write(JSON.stringify(s, null, 2));
        await w.close();
      }
      // Prune — keep only the 10 most recent snapshots
      const names = [];
      for await (const [name, handle] of backupsDir.entries()) {
        if (handle.kind === 'directory') names.push(name);
      }
      names.sort();
      for (const name of names.slice(0, Math.max(0, names.length - 10))) {
        await backupsDir.removeEntry(name, { recursive: true }).catch(() => {});
      }
      setLastSnapshot(new Date());
    } catch {
      // Silent — autosave should never surface an error to the user
    }
  };

  // Autosave snapshot every 10 minutes while a folder is connected
  React.useEffect(() => {
    if (BACKEND_MODE !== 'fs') return;
    const id = setInterval(() => createSnapshot(), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const syncAllToFolder = async () => {
    if (BACKEND_MODE !== 'fs') return;
    setSyncStatus('syncing');
    for (const s of latestSchemes.current) {
      const { error } = await backendUpsertOnce(s.id, s);
      if (error) { setSyncStatus('error'); return; }
    }
    setSyncStatus('synced');
    setLastSynced(new Date());
    await createSnapshot();
  };

  return (
    <window.SchemeContext.Provider value={{
      schemes, getScheme, updateScheme, addScheme, deleteScheme, resetAllSchemes,
      syncStatus, lastSynced,
      backendMode: BACKEND_MODE,
      folderName, forgetDataFolder, syncAllToFolder, createSnapshot, lastSnapshot,
      // Provision the standard folder structure for one scheme.
      provisionSchemeFolder: async (id) => {
        const scheme = latestSchemes.current.find(s => s.id === id);
        if (!scheme) return { error: new Error('Scheme not found') };
        try {
          await fsProvisionSchemeFolder(scheme);
          return { error: null, folderName: schemeFolderName(scheme) };
        } catch (e) {
          return { error: e instanceof Error ? e : new Error(String(e)) };
        }
      },
      // Provision folders for every scheme (or a filtered subset by id array).
      provisionAllFolders: async (onProgress, filterIds) => {
        const all = latestSchemes.current;
        const list = filterIds ? all.filter(s => filterIds.includes(s.id)) : all;
        let done = 0;
        for (const scheme of list) {
          try { await fsProvisionSchemeFolder(scheme); } catch { /* skip on error */ }
          done++;
          onProgress?.(done, list.length);
        }
        return done;
      },
      // Folder-picker for the 'fs' backend. Wired up from a topbar
      // button when syncStatus === 'folder-required'.
      pickDataFolder: async () => {
        try {
          await fsPickFolder();
          if (_fsDir) setFolderName(_fsDir.name);
          setSyncStatus('syncing');
          const { data: rows, error } = await backendFetchAll();
          if (error) { setSyncStatus('error'); return false; }
          if (rows && rows.length > 0) {
            const remoteMap = Object.fromEntries(rows.map(r => [r.id, { data: r.data, updated_at: r.updated_at }]));
            setSchemes(prev => {
              const localIds = new Set(prev.map(s => s.id));
              const updated = prev.map(s => {
                const remote = remoteMap[s.id];
                if (!remote) return s;
                const localTs  = s.updated_at ? Date.parse(s.updated_at) : 0;
                const remoteTs = remote.updated_at ? Date.parse(remote.updated_at) : 0;
                if (localTs >= remoteTs && localTs > 0) return s;
                return migrate({ ...s, ...remote.data });
              });
              // Schemes that exist in the picked folder but not in local
              // state — same extras handling as the mount-time fetch.
              // (Previously dropped here, so a folder full of schemes from
              // another machine appeared empty until a manual refresh.)
              const extras = rows
                .filter(r => !localIds.has(r.id) && r.data)
                .filter(r => {
                  const dels = lsGetDeleted();
                  if (!dels[r.id]) return true;
                  if (tombstoneBeaten(r.id, r.updated_at)) { tombstoneClear(r.id); return true; }
                  return false;
                })
                .map(r => migrate(r.data));
              return extras.length ? [...extras, ...updated] : updated;
            });
          }
          setSyncStatus('synced');
          setLastSynced(new Date());
          // Drain any writes queued while the folder was unset.
          sbDrainQueue(setSyncStatus, () => setLastSynced(new Date()));
          return true;
        } catch (e) {
          if (window.Toast) window.Toast.show({ kind:'error', msg: String(e.message || e), duration: 8000 });
          setSyncStatus('folder-required');
          return false;
        }
      },
    }}>
      {children}
    </window.SchemeContext.Provider>
  );
};

window.SchemeProvider = SchemeProvider;
