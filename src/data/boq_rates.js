// boq_rates.js — COMPATIBILITY SHIM
//
// Every priced item now lives in boq_rates_full.js (window.BOQ_RATES_FULL).
// This file preserves the legacy tag-based lookup API so any caller using
// window.boqItem('surf_hra3014_40_14') keeps working unchanged.
//
// MUST load AFTER boq_rates_full.js.

(function () {
  const FULL    = window.BOQ_RATES_FULL;
  const TAG_MAP = window.BOQ_LEGACY_TAG_MAP || {};

  if (!FULL) {
    console.error('boq_rates.js: BOQ_RATES_FULL not loaded; check script order in index.html');
    return;
  }

  // boqItem(tag) — lookup by legacy tag, returns item with .tag property attached.
  // Fix #10: window.BOQ_RATES rebuild and window.boqPickRate removed — both had
  // zero consumers across src/ and index.html. window.boqItem is retained as it
  // is used by boq_engine.js regenAutoLines (pushByTag calls boqItem internally).
  window.boqItem = function (tag) {
    const id   = TAG_MAP[tag];
    if (!id) return null;
    const item = window.boqFullItem(id);
    return item ? Object.assign({}, item, { tag: tag }) : null;
  };
})();
