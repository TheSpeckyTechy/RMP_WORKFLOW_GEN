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
  // timersRef: id -> { timer, startedAt, remaining }
  const timersRef = React.useRef(new Map());
  // leaveTimersRef: tracks the 200ms leave-animation timeout per id
  const leaveTimersRef = React.useRef(new Map());

  // Clear all timers on unmount so nothing fires into a dead component.
  React.useEffect(() => {
    return () => {
      timersRef.current.forEach(({ timer }) => clearTimeout(timer));
      leaveTimersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  const remove = React.useCallback((id) => {
    // Cancel the auto-dismiss timer if still running.
    const entry = timersRef.current.get(id);
    if (entry) { clearTimeout(entry.timer); timersRef.current.delete(id); }
    setToasts(ts => ts.map(x => x.id === id ? { ...x, leaving: true } : x));
    const lt = setTimeout(() => {
      setToasts(ts => ts.filter(x => x.id !== id));
      leaveTimersRef.current.delete(id);
    }, 200);
    leaveTimersRef.current.set(id, lt);
  }, []);

  const start = React.useCallback((id, remaining) => {
    if (!remaining) return;
    const timer = setTimeout(() => remove(id), remaining);
    timersRef.current.set(id, { timer, startedAt: Date.now(), remaining });
  }, [remove]);

  const pause = React.useCallback((id) => {
    const entry = timersRef.current.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    // Store remaining time so hover-resume uses the exact time left.
    const elapsed = Date.now() - entry.startedAt;
    const remaining = Math.max(0, entry.remaining - elapsed);
    timersRef.current.set(id, { timer: null, startedAt: entry.startedAt, remaining });
  }, []);

  const resume = React.useCallback((id) => {
    const entry = timersRef.current.get(id);
    if (!entry || entry.timer) return; // not paused or already running
    start(id, entry.remaining);
  }, [start]);

  React.useEffect(() => {
    window.Toast = {
      show: ({ kind = 'info', msg, action, duration = 4000 } = {}) => {
        if (!msg) return;
        const id = ++idRef.current;
        setToasts(ts => {
          const next = [...ts, { id, kind, msg, action, duration }].slice(-4);
          // Clear timers for any toasts that were evicted by .slice(-4).
          const kept = new Set(next.map(t => t.id));
          ts.forEach(t => {
            if (!kept.has(t.id)) {
              const e = timersRef.current.get(t.id);
              if (e) { clearTimeout(e.timer); timersRef.current.delete(t.id); }
              const lt = leaveTimersRef.current.get(t.id);
              if (lt) { clearTimeout(lt); leaveTimersRef.current.delete(t.id); }
            }
          });
          return next;
        });
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
          onMouseLeave={() => resume(t.id)}
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
