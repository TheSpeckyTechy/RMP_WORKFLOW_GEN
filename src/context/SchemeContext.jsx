// ─── SchemeContext.jsx ────────────────────────────────────────────────────────
// React context that gives every component access to the full schemes array
// while keeping each project's data fully isolated.
//
// Usage anywhere in the tree:
//   const { schemes, getScheme, updateScheme } = React.useContext(window.SchemeContext);
//   updateScheme("R5008", { treatment_type: "HRA 30/14F surf 40/60" });
//   // ↑ only modifies R5008; all other schemes are untouched
//
// Persistence: every updateScheme/addScheme write-through to localStorage so
// edits survive page refresh. Keys: rmp_scheme_<id>, rmp_scheme_ids (extras).
//
// Exports (via window): SchemeContext, SchemeProvider
// Depends on: React, window.SCHEMES (from store.jsx)
// ─────────────────────────────────────────────────────────────────────────────

window.SchemeContext = React.createContext(null);

const LS_PREFIX = 'rmp_scheme_';
const LS_IDS    = 'rmp_scheme_ids';

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
    // Track extra IDs (not in default seed) so they survive refresh
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

  return (
    <window.SchemeContext.Provider value={{ schemes, getScheme, updateScheme, addScheme, deleteScheme, resetAllSchemes }}>
      {children}
    </window.SchemeContext.Provider>
  );
};

window.SchemeProvider = SchemeProvider;
