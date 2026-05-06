// ─── CommandPalette.jsx ─────────────────────────────────────────────────────
// Cmd/Ctrl+K palette: fuzzy-search schemes + global actions.
//
// Mounts a single <CommandPaletteHost /> at app top-level. It registers the
// `mod+k` shortcut on mount, and renders a ModalShell when open.
//
// Action providers can be registered via window.CommandPalette.register(...)
// (e.g. AppInner registers theme toggle, new scheme, etc.).
// ─────────────────────────────────────────────────────────────────────────────

const _actions = []; // { id, label, sub, group, icon, run }

const fuzzyScore = (q, text) => {
  if (!q) return 1;
  const t = (text || '').toLowerCase();
  if (t.includes(q)) return 100 - t.indexOf(q);
  // light fuzzy: chars-in-order
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) if (t[i] === q[qi]) qi++;
  return qi === q.length ? 1 : 0;
};

const CommandPaletteHost = ({ onOpenScheme, onSetView }) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef(null);
  const ctx = React.useContext(window.SchemeContext);
  const schemes = (ctx && ctx.schemes) || [];

  React.useEffect(() => {
    if (!window.Shortcuts) return;
    window.Shortcuts.register('mod+k', () => setOpen(o => !o), {
      label: 'Open command palette', group: 'Navigation', allowInEditable: true,
    });
    window.CommandPalette = {
      open: () => setOpen(true),
      close: () => setOpen(false),
      register: (a) => { if (a && a.id) _actions.push(a); },
      unregister: (id) => { const i = _actions.findIndex(a => a.id === id); if (i >= 0) _actions.splice(i, 1); },
    };
    return () => {
      window.Shortcuts && window.Shortcuts.unregister('mod+k');
      delete window.CommandPalette;
    };
  }, []);

  React.useEffect(() => {
    if (open) { setQuery(''); setActive(0); setTimeout(() => inputRef.current && inputRef.current.focus(), 10); }
  }, [open]);

  const q = query.trim().toLowerCase();
  const schemeResults = React.useMemo(() => {
    const list = schemes.map(s => {
      const txt = `${s.project_number || ''} ${s.road_name || ''} ${s.scheme_extent || ''} ${s.ward_selected || ''}`;
      const score = fuzzyScore(q, txt);
      return { s, score };
    }).filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    return list.map(r => r.s);
  }, [q, schemes]);

  const actionResults = React.useMemo(() => {
    return _actions
      .map(a => ({ a, score: fuzzyScore(q, `${a.label} ${a.sub || ''} ${a.group || ''}`) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(r => r.a);
  }, [q, open]);

  const allItems = React.useMemo(() => {
    const items = [];
    actionResults.forEach(a => items.push({ kind: 'action', data: a }));
    schemeResults.forEach(s => items.push({ kind: 'scheme', data: s }));
    return items;
  }, [actionResults, schemeResults]);

  React.useEffect(() => { setActive(0); }, [query]);

  const run = (item) => {
    setOpen(false);
    if (!item) return;
    if (item.kind === 'scheme') { onOpenScheme && onOpenScheme(item.data.id); return; }
    if (item.kind === 'action') { try { item.data.run(); } catch (e) { console.error('[Palette]', e); } }
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, Math.max(0, allItems.length - 1))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(allItems[active]); }
  };

  if (!open) return null;
  const isMac = /Mac|iPad|iPhone/i.test(navigator.platform || '');
  return (
    <window.ModalShell onClose={() => setOpen(false)} ariaLabel="Command palette" className="cmdk-modal">
      <div className="cmdk-input-wrap">
        <span className="cmdk-input-icon"><window.Icon.Search /></span>
        <input
          ref={inputRef}
          className="cmdk-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to scheme, run an action…"
          aria-label="Command palette search"
        />
      </div>
      <div className="cmdk-results">
        {allItems.length === 0 ? (
          <div className="cmdk-empty">No matches for "{query}"</div>
        ) : (
          <>
            {actionResults.length > 0 && (
              <div className="cmdk-section">
                <div className="cmdk-section-title">Actions</div>
                {actionResults.map((a, i) => {
                  const idx = i;
                  return (
                    <button
                      key={'a' + a.id}
                      className={'cmdk-item' + (active === idx ? ' cmdk-active' : '')}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => run({ kind: 'action', data: a })}
                    >
                      {a.icon ? <span className="cmdk-item-icon">{a.icon}</span> : null}
                      <span className="cmdk-item-main">
                        <span className="cmdk-item-title">{a.label}</span>
                        {a.sub && <span className="cmdk-item-sub">{a.sub}</span>}
                      </span>
                      {a.group && <span className="cmdk-item-hint">{a.group}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {schemeResults.length > 0 && (
              <div className="cmdk-section">
                <div className="cmdk-section-title">Schemes</div>
                {schemeResults.map((s, i) => {
                  const idx = actionResults.length + i;
                  const ward = window.WARDS && window.WARDS.find(w => w.num === s.ward_num);
                  return (
                    <button
                      key={'s' + s.id}
                      className={'cmdk-item' + (active === idx ? ' cmdk-active' : '')}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => run({ kind: 'scheme', data: s })}
                    >
                      <span className="cmdk-item-icon"><window.Icon.Folder /></span>
                      <span className="cmdk-item-main">
                        <span className="cmdk-item-title">{s.road_name || s.scheme_extent || s.project_number}</span>
                        <span className="cmdk-item-sub">{s.project_number}{ward ? ` · ${ward.name}` : ''}{s.scheme_extent ? ` · ${s.scheme_extent}` : ''}</span>
                      </span>
                      <span className="cmdk-item-hint">↵</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <div className="cmdk-foot">
        <span className="cmdk-foot-keys">
          <span><span className="shortcut-key">↑</span><span className="shortcut-key">↓</span> navigate</span>
          <span><span className="shortcut-key">↵</span> select</span>
          <span><span className="shortcut-key">esc</span> close</span>
        </span>
        <span>{isMac ? '⌘' : 'Ctrl'}+K</span>
      </div>
    </window.ModalShell>
  );
};

window.CommandPaletteHost = CommandPaletteHost;
