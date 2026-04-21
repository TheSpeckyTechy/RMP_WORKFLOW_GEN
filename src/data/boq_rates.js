// boq_rates.js — COMPATIBILITY SHIM
//
// Every priced item now lives in boq_rates_full.js (window.BOQ_RATES_FULL).
// This file preserves the legacy API so any caller using the old tag-based
// lookups — window.boqItem('surf_hra3014_40_14'), window.boqPickRate(item, m)
// — keeps working unchanged.
//
// MUST load AFTER boq_rates_full.js.

(function () {
  const FULL    = window.BOQ_RATES_FULL;
  const TAG_MAP = window.BOQ_LEGACY_TAG_MAP || {};

  if (!FULL) {
    console.error('boq_rates.js: BOQ_RATES_FULL not loaded; check script order in index.html');
    return;
  }

  // Build reverse index: id → legacy tag (for injecting .tag onto catalogue items)
  const idToTag = {};
  for (const [tag, id] of Object.entries(TAG_MAP)) idToTag[id] = tag;

  // Re-expose BOQ_RATES in its legacy shape for any code that iterates it.
  window.BOQ_RATES = {};
  for (const [key, series] of Object.entries(FULL)) {
    window.BOQ_RATES[key] = {
      title:          series.title,
      bandThresholds: series.bandThresholds,
      items:          series.items
        .filter(it => idToTag[it.id])
        .map(it => Object.assign({}, it, { tag: idToTag[it.id] })),
    };
  }

  // boqItem(tag) — lookup by legacy tag, returns item with .tag property attached
  window.boqItem = function (tag) {
    const id   = TAG_MAP[tag];
    if (!id) return null;
    const item = window.boqFullItem(id);
    return item ? Object.assign({}, item, { tag: tag }) : null;
  };

  // boqPickRate(item, measurement) — delegate to the per-series helper.
  // Series is inferred from the item's id (e.g. '7/027' → 700, '2700/43' → 2700).
  window.boqPickRate = function (item, measurement) {
    if (!item) return 0;
    const headNum = parseInt((item.id || '').split('/')[0], 10);
    // Items with numeric prefix 1–99 are already the series/100 form
    // (e.g. '7' → 700, '11' → 1100, '12' → 1200); 2700/3000/6400 are 4-digit.
    const seriesNum = headNum < 100 ? headNum * 100 : headNum;
    return window.boqPickRateForSeries(item, measurement, seriesNum);
  };
})();
