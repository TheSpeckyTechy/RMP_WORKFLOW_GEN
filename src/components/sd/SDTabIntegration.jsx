// ─── SDTabIntegration.jsx ────────────────────────────────────────────────────
// Wraps window.SchemeDetail so the RN39 Surface Dressing Designer is reachable
// from any scheme without editing SchemeDetail.jsx. We:
//
//   1. Replace window.SchemeDetail with a thin React wrapper.
//   2. The wrapper renders the original SchemeDetail by default.
//   3. It also renders an "RN39 Designer" button (via React.createPortal into
//      the existing page-head button row) that swaps the page contents for
//      the SDTab when clicked.
//   4. A "← Back to scheme" button restores the original SchemeDetail.
//
// Because the wrapper lives inside the existing React tree, SDTab gets the
// SchemeContext it needs via React.useContext — no separate root needed.
//
// Loaded AFTER src/components/SchemeDetail.jsx in index.html.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  if (!window.SchemeDetail) {
    console.warn('[SD] window.SchemeDetail not yet defined — integration deferred');
    return;
  }
  const Original = window.SchemeDetail;
  if (Original.__sdWrapped) return;

  function Wrapped(props) {
    const [sdActive, setSDActive] = React.useState(false);
    const [target, setTarget] = React.useState(null);

    // Find the page-head button row to portal our button into. Polls because
    // the DOM is built up over a couple of paint cycles after navigation.
    React.useEffect(() => {
      if (sdActive) { setTarget(null); return; }
      let cancelled = false;
      const find = () => {
        if (cancelled) return;
        // page-head's right-hand button cluster: second child div.
        const heads = document.querySelectorAll('.page-head');
        let row = null;
        heads.forEach(h => { if (!row) row = h.querySelector('div:last-child'); });
        if (row && row !== target) setTarget(row);
        else if (!row) setTimeout(find, 150);
      };
      find();
      return () => { cancelled = true; };
    }, [sdActive, props.schemeId]);

    if (sdActive) {
      return (
        <div className="sd-tab">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <button className="sd-btn sd-btn-secondary"
              onClick={() => setSDActive(false)} type="button">← Back to scheme</button>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              <strong>RN39 Surface Dressing Designer</strong> · {props.schemeId}
            </div>
          </div>
          {window.SD && window.SD.SDTab
            ? <window.SD.SDTab schemeId={props.schemeId} />
            : <div className="sd-warning">SD module failed to load.</div>}
        </div>
      );
    }

    const button = target && ReactDOM.createPortal(
      <button className="btn" onClick={() => setSDActive(true)} type="button"
        title="Open RN39 Surface Dressing Designer">
        <span style={{ fontWeight: 700, marginRight: 4 }}>RN39</span> Designer
      </button>,
      target
    );

    return (
      <>
        <Original {...props} />
        {button}
      </>
    );
  }

  Wrapped.__sdWrapped = true;
  window.SchemeDetail = Wrapped;
})();
