// ─── Shortcuts.jsx ──────────────────────────────────────────────────────────
// Global keyboard shortcut registrar + help overlay.
//
//   window.Shortcuts.register('n',     handler, { label, group })
//   window.Shortcuts.register('mod+k', handler, { label, group })   // mod = cmd/ctrl
//   window.Shortcuts.unregister('n')
//
// `?` (or `Shift+/`) opens the help overlay listing all registered shortcuts
// grouped by section. Bindings are ignored when an editable element is focused
// (input, textarea, contenteditable) — except mod+k which always runs.
//
// Mount <ShortcutsHost /> once at the top of the React tree.
// ─────────────────────────────────────────────────────────────────────────────

const isEditable = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
  if (el.isContentEditable) return true;
  return false;
};

const normalize = (binding) => {
  // 'mod+k' → { key: 'k', mod: true, shift: false, alt: false }
  // '?'     → { key: '?', mod: false, ... }
  const parts = String(binding).toLowerCase().split('+').map(s => s.trim());
  const out = { key: '', mod: false, shift: false, alt: false };
  parts.forEach(p => {
    if (p === 'mod' || p === 'cmd' || p === 'ctrl') out.mod = true;
    else if (p === 'shift') out.shift = true;
    else if (p === 'alt') out.alt = true;
    else out.key = p;
  });
  return out;
};

const matches = (e, b) => {
  const k = (e.key || '').toLowerCase();
  const mod = e.metaKey || e.ctrlKey;
  if (k !== b.key) return false;
  if (b.mod !== mod) return false;
  if (b.shift && !e.shiftKey) return false;
  // Allow shift to be ignored unless explicitly required
  if (!b.shift && b.key.length === 1 && /[a-z0-9]/.test(b.key) && e.shiftKey) return false;
  if (b.alt !== !!e.altKey) return false;
  return true;
};

const formatBinding = (b) => {
  const isMac = /Mac|iPad|iPhone/i.test(navigator.platform || '');
  const parts = [];
  if (b.mod) parts.push(isMac ? '⌘' : 'Ctrl');
  if (b.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (b.alt) parts.push(isMac ? '⌥' : 'Alt');
  parts.push(b.key === ' ' ? 'Space' : b.key.toUpperCase());
  return parts;
};

const _registry = new Map(); // binding string -> { binding, handler, label, group, allowInEditable }

// Create the registry object at module scope so callers that run before
// ShortcutsHost mounts (CommandPaletteHost effect, AppInner registration
// effects) can register immediately without checking window.Shortcuts first.
// openHelp is a stub until the host installs the real one.
window.Shortcuts = {
  register: (binding, handler, { label = '', group = 'General', allowInEditable = false } = {}) => {
    const b = normalize(binding);
    _registry.set(binding.toLowerCase(), { raw: binding.toLowerCase(), binding: b, handler, label, group, allowInEditable });
  },
  unregister: (binding) => {
    _registry.delete(String(binding).toLowerCase());
  },
  list: () => Array.from(_registry.values()),
  openHelp: () => { console.warn('[Shortcuts] openHelp called before ShortcutsHost mounted'); },
};

const ShortcutsHost = () => {
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [, force] = React.useReducer(x => x + 1, 0);

  React.useEffect(() => {
    // Upgrade the module-scope stub with the real implementations that can
    // trigger re-renders and open the help overlay.
    window.Shortcuts = {
      register: (binding, handler, { label = '', group = 'General', allowInEditable = false } = {}) => {
        const b = normalize(binding);
        _registry.set(binding.toLowerCase(), { raw: binding.toLowerCase(), binding: b, handler, label, group, allowInEditable });
        force();
      },
      unregister: (binding) => {
        _registry.delete(String(binding).toLowerCase());
        force();
      },
      list: () => Array.from(_registry.values()),
      openHelp: () => setHelpOpen(true),
    };
    // On unmount, restore a minimal stub so callers don't crash.
    return () => {
      window.Shortcuts = {
        register: () => {}, unregister: () => {}, list: () => [],
        openHelp: () => {},
      };
    };
  }, []);

  React.useEffect(() => {
    const onKey = (e) => {
      const editable = isEditable(document.activeElement);
      // Built-in: ? opens help (when not editing)
      if (!editable && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
        e.preventDefault(); setHelpOpen(true); return;
      }
      for (const entry of _registry.values()) {
        const b = entry.binding;
        if (!matches(e, b)) continue;
        if (editable && !entry.allowInEditable && !b.mod) continue;
        e.preventDefault();
        try { entry.handler(e); } catch (err) { console.error('[Shortcut]', entry.raw, err); }
        return;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!helpOpen) return null;
  const grouped = {};
  for (const entry of _registry.values()) {
    const g = entry.group || 'General';
    (grouped[g] = grouped[g] || []).push(entry);
  }
  // Add the always-on ? binding to the listing
  (grouped['Help'] = grouped['Help'] || []).push({
    raw: '?', binding: { key: '?' }, label: 'Show keyboard shortcuts', group: 'Help',
  });
  return (
    <window.ModalShell onClose={() => setHelpOpen(false)} ariaLabel="Keyboard shortcuts" className="shortcuts-modal">
      <div className="modal-head">
        <h3 style={{fontSize:14,fontWeight:600,margin:0}}>Keyboard shortcuts</h3>
        <button className="btn ghost sm" onClick={() => setHelpOpen(false)} aria-label="Close">✕</button>
      </div>
      <div className="modal-body">
        {Object.keys(grouped).map(g => (
          <div key={g} className="shortcuts-group">
            <div className="shortcuts-group-title">{g}</div>
            <div className="shortcuts-list">
              {grouped[g].map((entry, i) => (
                <div key={entry.raw + i} className="shortcut-row">
                  <span>{entry.label}</span>
                  <span className="shortcut-keys">
                    {formatBinding(entry.binding).map((p, idx) => (
                      <span key={idx} className="shortcut-key">{p}</span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </window.ModalShell>
  );
};

window.ShortcutsHost = ShortcutsHost;
