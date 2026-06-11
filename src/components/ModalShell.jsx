// ─── ModalShell.jsx ─────────────────────────────────────────────────────────
// Modal primitive that wraps the existing .modal-backdrop / .modal markup with
// proper UX: Escape closes, focus trap (Tab cycles within), return focus on
// unmount, body scroll-lock. Pure additive — visual styling is unchanged.
//
// Usage:
//   <ModalShell onClose={fn} ariaLabel="New scheme" className="rsr-modal">
//     <div className="modal-head">…</div>
//     <div className="modal-body">…</div>
//     <div className="modal-foot">…</div>
//   </ModalShell>
//
// Props:
//   onClose       (fn)         — called on Escape, backdrop click, or close action
//   ariaLabel     (string)     — accessible label for the dialog
//   className     (string)     — extra classes on the .modal element
//   closeOnBackdrop (bool)     — default true; set false for confirmations
//   initialFocus  (ref)        — optional ref to focus on mount
// ─────────────────────────────────────────────────────────────────────────────

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Module-level stack of open modal instance ids.
// The id at the top of the stack is the "topmost" modal that owns Escape.
// Using a stack (rather than a counter) means non-LIFO closes (a lower modal
// closes first) don't corrupt the depth count or leave body scroll locked.
let _modalStack = [];
let _nextModalId = 0;

const useModal = ({ onClose, initialFocus } = {}) => {
  const dialogRef     = React.useRef(null);
  const triggerRef    = React.useRef(null);
  const instanceId    = React.useRef(++_nextModalId);
  // Stable refs so the effect never needs to re-run when these change.
  const onCloseRef      = React.useRef(onClose);
  const initialFocusRef = React.useRef(initialFocus);
  React.useEffect(() => { onCloseRef.current = onClose; });
  React.useEffect(() => { initialFocusRef.current = initialFocus; });

  React.useEffect(() => {
    const id = instanceId.current;
    _modalStack.push(id);
    triggerRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFirst = () => {
      const node = dialogRef.current;
      if (!node) return;
      const f = initialFocusRef.current;
      if (f && f.current) { f.current.focus(); return; }
      const focusable = node.querySelectorAll(FOCUSABLE);
      if (focusable.length) focusable[0].focus();
      else node.setAttribute('tabindex', '-1'), node.focus();
    };
    const t = setTimeout(focusFirst, 0);

    const onKey = (e) => {
      if (e.key === 'Escape') {
        // Only the topmost modal (last entry in the stack) handles Escape.
        if (_modalStack[_modalStack.length - 1] !== id) return;
        e.stopPropagation();
        onCloseRef.current && onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const node = dialogRef.current;
      if (!node) return;
      const focusable = Array.from(node.querySelectorAll(FOCUSABLE)).filter(el => !el.hasAttribute('disabled'));
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);

    return () => {
      clearTimeout(t);
      // Remove this id from wherever it sits in the stack (not necessarily
      // the top — non-LIFO closes are safe with this approach).
      _modalStack = _modalStack.filter(x => x !== id);
      document.removeEventListener('keydown', onKey, true);
      // Only restore body scroll when no other modals remain open.
      if (_modalStack.length === 0) {
        document.body.style.overflow = prevOverflow;
      }
      const trigger = triggerRef.current;
      if (trigger && typeof trigger.focus === 'function') {
        try { trigger.focus(); } catch (_) {}
      }
    };
  }, []); // Stable: mutable values accessed via refs; depth managed by stack

  return { dialogRef };
};

const ModalShell = ({ onClose, ariaLabel, className = '', closeOnBackdrop = true, initialFocus, children }) => {
  const { dialogRef } = useModal({ onClose, initialFocus });
  const onBackdropClick = (e) => {
    if (!closeOnBackdrop) return;
    if (e.target === e.currentTarget) onClose && onClose();
  };
  return (
    <div className="modal-backdrop" onMouseDown={onBackdropClick}>
      <div
        ref={dialogRef}
        className={`modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );
};

window.useModal = useModal;
window.ModalShell = ModalShell;
