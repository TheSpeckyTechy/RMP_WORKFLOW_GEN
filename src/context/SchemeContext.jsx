// ─── SchemeContext.jsx ────────────────────────────────────────────────────────
// React context that gives every component access to the full schemes array
// while keeping each project's data fully isolated.
//
// Persistence: localStorage write-through (fast local cache) + optional
// GitHub Contents API sync (schemes.json in a private repo).
//
// Exports (via window): SchemeContext, SchemeProvider
// Depends on: React, window.SCHEMES (from store.jsx)
// ─────────────────────────────────────────────────────────────────────────────

window.SchemeContext = React.createContext(null);

const LS_PREFIX = 'rmp_scheme_';
const LS_IDS    = 'rmp_scheme_ids';

// ── GitHub Contents API helpers ──────────────────────────────────────────────
const GH_PAT_KEY  = 'rmp_gh_pat';
const GH_REPO_KEY = 'rmp_gh_repo';
const GH_SHA_KEY  = 'rmp_gh_sha';
const GH_FILE     = 'schemes.json';

const ghLsGet = (key) => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
const ghLsSet = (key, val) => { try { localStorage.setItem(key, val); } catch {} };

async function ghFetch(pat, repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${GH_FILE}`, {
    headers: { Authorization: `token ${pat}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (res.status === 404) return { schemes: null, sha: null };
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${res.statusText}`);
  const data = await res.json();
  const schemes = JSON.parse(atob(data.content.replace(/\n/g, '')));
  return { schemes, sha: data.sha };
}

async function ghPush(pat, repo, schemes, sha) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(schemes, null, 2))));
  const body = { message: 'rmp: sync schemes', content, ...(sha ? { sha } : {}) };
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${GH_FILE}`, {
    method: 'PUT',
    headers: { Authorization: `token ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub push ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return data.content.sha;
}

const lsGet = (id) => {
  try { const v = localStorage.getItem(LS_PREFIX + id); return v ? JSON.parse(v) : null; }
  catch { return null; }
};
const lsSet = (id, scheme) => {
  try { localStorage.setItem(LS_PREFIX + id, JSON.stringify(scheme)); } catch {}
};
const lsGetIds = () => {
  try { const v = localStorage.getItem(LS_IDS); return v ? JSON.parse(v) : []; }
  catch { return []; }
};
const lsSetIds = (ids) => {
  try { localStorage.setItem(LS_IDS, JSON.stringify(ids)); } catch {}
};

const initSchemes = () => {
  // Start from the default seed data, merging any saved overrides
  const base = window.SCHEMES.map(s => {
    const saved = lsGet(s.id);
    return saved ? { ...s, ...saved } : s;
  });

  // Append any user-created schemes not in the seed (stored in rmp_scheme_ids)
  const defaultIds = new Set(window.SCHEMES.map(s => s.id));
  const extraIds = lsGetIds().filter(id => !defaultIds.has(id));
  const extras = extraIds.map(id => lsGet(id)).filter(Boolean);

  return [...extras, ...base];
};

const SchemeProvider = ({ children }) => {
  const [schemes, setSchemes] = React.useState(initSchemes);
  const [syncStatus, setSyncStatus] = React.useState(
    () => ghLsGet(GH_PAT_KEY) ? 'loading' : 'off'
  );

  const pushTimer       = React.useRef(null);
  const latestSchemes   = React.useRef(schemes);
  const currentSha      = React.useRef(ghLsGet(GH_SHA_KEY));
  const hasMounted      = React.useRef(false);
  const skipNextGHPush  = React.useRef(false);

  // On mount: load from GitHub if configured
  React.useEffect(() => {
    const pat  = ghLsGet(GH_PAT_KEY);
    const repo = ghLsGet(GH_REPO_KEY);
    if (!pat || !repo) { hasMounted.current = true; return; }

    ghFetch(pat, repo).then(({ schemes: remote, sha }) => {
      if (remote) {
        skipNextGHPush.current = true;
        setSchemes(remote);
        remote.forEach(s => lsSet(s.id, s));
        currentSha.current = sha;
        ghLsSet(GH_SHA_KEY, sha);
      }
      setSyncStatus('synced');
    }).catch(() => {
      setSyncStatus('error');
    }).finally(() => {
      hasMounted.current = true;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced push to GitHub on every scheme change
  React.useEffect(() => {
    latestSchemes.current = schemes;
    if (!hasMounted.current) return;
    if (skipNextGHPush.current) { skipNextGHPush.current = false; return; }

    const pat  = ghLsGet(GH_PAT_KEY);
    const repo = ghLsGet(GH_REPO_KEY);
    if (!pat || !repo) return;

    setSyncStatus('syncing');
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      try {
        const newSha = await ghPush(pat, repo, latestSchemes.current, currentSha.current);
        currentSha.current = newSha;
        ghLsSet(GH_SHA_KEY, newSha);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    }, 2000);
  }, [schemes]); // eslint-disable-line react-hooks/exhaustive-deps

  const getScheme = (id) => schemes.find(s => s.id === id);

  const updateScheme = (id, updates) => {
    setSchemes(prev => prev.map(s => {
      if (s.id !== id) return s;
      const merged = { ...s, ...updates };
      lsSet(id, merged);
      return merged;
    }));
  };

  const addScheme = (scheme) => {
    lsSet(scheme.id, scheme);
    const defaultIds = new Set(window.SCHEMES.map(s => s.id));
    if (!defaultIds.has(scheme.id)) {
      const current = lsGetIds();
      if (!current.includes(scheme.id)) lsSetIds([scheme.id, ...current]);
    }
    setSchemes(prev => [scheme, ...prev]);
  };

  const deleteScheme = (id) => {
    try { localStorage.removeItem(LS_PREFIX + id); } catch {}
    const extraIds = lsGetIds().filter(i => i !== id);
    lsSetIds(extraIds);
    setSchemes(prev => prev.filter(s => s.id !== id));
  };

  const resetAllSchemes = () => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX));
      keys.forEach(k => localStorage.removeItem(k));
      localStorage.removeItem(LS_IDS);
    } catch {}
    window.location.reload();
  };

  const connectGitHub = async (pat, repo) => {
    ghLsSet(GH_PAT_KEY, pat);
    ghLsSet(GH_REPO_KEY, repo);
    setSyncStatus('loading');
    try {
      const { schemes: remote, sha } = await ghFetch(pat, repo);
      if (remote) {
        skipNextGHPush.current = true;
        setSchemes(remote);
        remote.forEach(s => lsSet(s.id, s));
        currentSha.current = sha;
        ghLsSet(GH_SHA_KEY, sha);
      } else {
        // File doesn't exist yet — push current schemes to create it
        const newSha = await ghPush(pat, repo, latestSchemes.current, null);
        currentSha.current = newSha;
        ghLsSet(GH_SHA_KEY, newSha);
      }
      setSyncStatus('synced');
    } catch (err) {
      setSyncStatus('error');
      throw err;
    }
  };

  const disconnectGitHub = () => {
    try {
      localStorage.removeItem(GH_PAT_KEY);
      localStorage.removeItem(GH_REPO_KEY);
      localStorage.removeItem(GH_SHA_KEY);
    } catch {}
    currentSha.current = '';
    clearTimeout(pushTimer.current);
    setSyncStatus('off');
  };

  return (
    <window.SchemeContext.Provider value={{
      schemes, getScheme, updateScheme, addScheme, deleteScheme, resetAllSchemes,
      syncStatus, connectGitHub, disconnectGitHub,
    }}>
      {children}
    </window.SchemeContext.Provider>
  );
};

window.SchemeProvider = SchemeProvider;
