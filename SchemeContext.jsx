window.SchemeContext = React.createContext(null);

const SchemeProvider = ({ children }) => {
  const [schemes, setSchemes] = React.useState(window.SCHEMES);

  const getScheme = (id) => schemes.find(s => s.id === id);

  const updateScheme = (id, updates) => {
    setSchemes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  return (
    <window.SchemeContext.Provider value={{ schemes, getScheme, updateScheme }}>
      {children}
    </window.SchemeContext.Provider>
  );
};

window.SchemeProvider = SchemeProvider;
