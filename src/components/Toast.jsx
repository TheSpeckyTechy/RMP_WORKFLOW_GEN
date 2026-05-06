// ─── Toast.jsx ──────────────────────────────────────────────────────────────
// Transient notification bus. Use:
//   window.Toast.show({ kind: 'success'|'error'|'info', msg, action?, duration? })
//   - action: { label, onClick }   (optional inline action button)
//   - duration: ms (default 4000; set 0 for sticky)
// Auto-dismiss after duration; pause on hover; click ✕ to dismiss.
// Mount <ToastHost /> once at the top of the React tree.
// ─────────────────────────────────────────────────────────────────────────────

const ToastHost = () => {
  const [toasts, setToasts] = React.useState([]);
  const idRef = React.useRef(0);
  const timersRef = React.useRef(new Map());

  const remove = React.useCallback((id) => {
    const t = timersRef.current.get(id);
    if (t) { clearTimeout(t); timersRef.current.delete(id); }
    setToasts(ts => ts.map(x => x.id === id ? { ...x, leaving: true } : x));
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 200);
  }, []);

  const start = React.useCallback((id, duration) => {
    if (!duration) return;
    const t = setTimeout(() => remove(id), duration);
    timersRef.current.set(id, t);
  }, [remove]);

  const pause = React.useCallback((id) => {
    const t = timersRef.current.get(id);
    if (t) { clearTimeout(t); timersRef.current.delete(id); }
  }, []);

  React.useEffect(() => {
    window.Toast = {
      show: ({ kind = 'info', msg, action, duration = 4000 } = {}) => {
        if (!msg) return;
        const id = ++idRef.current;
        setToasts(ts => [...ts, { id, kind, msg, action, duration }].slice(-4));
        start(id, duration);
        return id;
      },
      dismiss: (id) => remove(id),
    };
    return () => { delete window.Toast; };
  }, [start, remove]);

  if (toasts.length === 0) return null;
  return ReactDOM.createPortal(
    <div className="toast-stack" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast--${t.kind}` + (t.leaving ? ' toast--leaving' : '')}
          onMouseEnter={() => pause(t.id)}
          onMouseLeave={() => start(t.id, t.duration)}
        >
          <span className="toast-dot" aria-hidden="true" />
          <span className="toast-msg">{t.msg}</span>
          {t.action && (
            <button
              className="toast-action"
              onClick={() => { try { t.action.onClick && t.action.onClick(); } finally { remove(t.id); } }}
            >{t.action.label}</button>
          )}
          <button className="toast-close" aria-label="Dismiss notification" onClick={() => remove(t.id)}>×</button>
        </div>
      ))}
    </div>,
    document.body
  );
};

window.ToastHost = ToastHost;
