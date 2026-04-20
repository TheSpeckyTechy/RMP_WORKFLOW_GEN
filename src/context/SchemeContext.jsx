// ─── SchemeContext.jsx ────────────────────────────────────────────────────────
// React context that gives every component access to the full schemes array
// while keeping each project's data fully isolated.
//
// Usage anywhere in the tree:
//   const { schemes, getScheme, updateScheme } = React.useContext(window.SchemeContext);
//   updateScheme("R5008", { treatment_type: "HRA 30/14F surf 40/60" });
//   // ↑ only modifies R5008; all other schemes are untouched
//
// Exports (via window): SchemeContext, SchemeProvider
// Depends on: React, window.SCHEMES (from store.jsx)
// ─────────────────────────────────────────────────────────────────────────────

window.SchemeContext = React.createContext(null);

const SchemeProvider = ({ children }) => {
  const [schemes, setSchemes] = React.useState(window.SCHEMES);

  const getScheme = (id) => schemes.find(s => s.id === id);

  const updateScheme = (id, updates) => {
    setSchemes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addScheme = (scheme) => {
    setSchemes(prev => [scheme, ...prev]);
  };

  return (
    <window.SchemeContext.Provider value={{ schemes, getScheme, updateScheme, addScheme }}>
      {children}
    </window.SchemeContext.Provider>
  );
};

window.SchemeProvider = SchemeProvider;
