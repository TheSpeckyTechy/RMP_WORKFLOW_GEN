// ─── ConfirmDialog.jsx ──────────────────────────────────────────────────────
// Promise-based replacement for the native confirm() dialog. Uses ModalShell
// so it inherits Escape, focus trap and return-focus.
//
//   const ok = await window.confirmDialog({ title, body, confirmLabel, cancelLabel, danger });
//
// Mount <ConfirmDialogHost /> once at the top of the React tree. It listens
// for confirmDialog() calls and renders the dialog itself.
// ─────────────────────────────────────────────────────────────────────────────

const ConfirmDialogHost = () => {
  const [open, setOpen] = React.useState(false);
  const [opts, setOpts] = React.useState(null);
  const resolverRef = React.useRef(null);
  const confirmBtnRef = React.useRef(null);

  const close = (result) => {
    setOpen(false);
    const r = resolverRef.current;
    resolverRef.current = null;
    if (r) r(result);
  };

  React.useEffect(() => {
    window.confirmDialog = (o = {}) => new Promise(resolve => {
      // If a previous dialog is still open, resolve it as cancelled
      if (resolverRef.current) { try { resolverRef.current(false); } catch (_) {} }
      resolverRef.current = resolve;
      setOpts({
        title: o.title || 'Confirm',
        body: o.body || '',
        confirmLabel: o.confirmLabel || 'Confirm',
        cancelLabel: o.cancelLabel || 'Cancel',
        danger: !!o.danger,
      });
      setOpen(true);
    });
    return () => {
      // Resolve any pending promise as cancelled so callers don't hang forever
      // if the host unmounts (e.g. session logout) while a dialog is open.
      if (resolverRef.current) {
        try { resolverRef.current(false); } catch (_) {}
        resolverRef.current = null;
      }
      delete window.confirmDialog;
    };
  }, []);

  if (!open || !opts) return null;
  return (
    <window.ModalShell
      onClose={() => close(false)}
      ariaLabel={opts.title}
      className="confirm-modal"
      closeOnBackdrop={true}
      initialFocus={confirmBtnRef}
    >
      <div className="modal-body">
        <div className="confirm-modal-title">{opts.title}</div>
        {opts.body && <div className="confirm-modal-body">{opts.body}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn ghost" onClick={() => close(false)}>{opts.cancelLabel}</button>
        <button
          ref={confirmBtnRef}
          className={'btn ' + (opts.danger ? 'danger' : 'primary')}
          onClick={() => close(true)}
        >{opts.confirmLabel}</button>
      </div>
    </window.ModalShell>
  );
};

window.ConfirmDialogHost = ConfirmDialogHost;
