// boq_engine.js — pure-JS BoQ calculation engine
//
// Exports (via window):
//   window.BOQ_ENGINE.regenAutoLines(quick_inputs, scheme)  → [line, …]
//   window.BOQ_ENGINE.buildBoQLines(boq, scheme)            → { groups, lines, totals }
//   window.BOQ_ENGINE.MATERIALS                             → option lists for selects
//   window.BOQ_ENGINE.fmtGBP / fmtQty / fmtPct / uid / snapMillingDepth
//
// Depends on window.BOQ_RATES_FULL, window.boqItem, window.boqPickRateForSeries,
// window.BOQ_LEGACY_TAG_MAP (all provided by boq_rates_full.js + boq_rates.js).

(function () {
  // ── Material option tables ─────────────────────────────────────────────────
  const SURFACE_OPTIONS = [
    { tag: 'surf_hra3014_40_14', label: 'HRA 30/14F 40mm · 14mm chips' },
    { tag: 'surf_hra3014_40_20', label: 'HRA 30/14F 40mm · 20mm chips' },
    { tag: 'surf_hra3514_45_14', label: 'HRA 35/14F 45mm · 14mm chips' },
    { tag: 'surf_hra3514_45_20', label: 'HRA 35/14F 45mm · 20mm chips' },
    { tag: 'surf_sma10_40',      label: 'SMA 10 surf 40mm' },
    { tag: 'surf_ac10_40',       label: 'AC 10 close surf 40mm' },
    { tag: 'surf_ac14_40',       label: 'AC 14 close surf 40mm' },
    { tag: 'surf_ac10hb_40',     label: 'AC 10 HBC surf 40mm' },
    { tag: 'surf_ac14hb_40',     label: 'AC 14 HBC surf 40mm' },
    { tag: 'surf_hra5510_40',    label: 'HRA 55/10C surf 40mm' },
    { tag: 'surf_ac6_30',        label: 'AC 6 dense surf 30mm' },
  ];

  const BINDER_OPTIONS = [
    { tag: 'bin_hra5020_60', label: 'HRA 50/20 bin 60mm' },
    { tag: 'bin_ac20d_60',   label: 'AC 20 dense bin 60mm' },
    { tag: 'bin_ac20hdm_60', label: 'AC 20 HDM bin 60mm' },
  ];

  const BASE_OPTIONS = [
    { tag: 'base_ac32d_100',   label: 'AC 32 dense base 100mm' },
    { tag: 'base_ac32d_150',   label: 'AC 32 dense base 150mm' },
    { tag: 'base_ac32hdm_100', label: 'AC 32 HDM base 100mm' },
    { tag: 'base_ac32hdm_150', label: 'AC 32 HDM base 150mm' },
  ];

  const MILLING_DEPTHS = [25, 40, 50, 60, 70, 80, 100, 150, 200];

  const FOOTWAY_SURFACE_OPTIONS = [
    { tag: 'fw_ac6_30',     label: 'AC 6 close surf 30mm' },
    { tag: 'fw_ac10_30',    label: 'AC 10 close surf 30mm' },
    { tag: 'fw_hra156_30',  label: 'HRA 15/6F surf 30mm' },
    { tag: 'fw_hra1510_30', label: 'HRA 15/10F surf 30mm' },
  ];

  const KERB_OPTIONS = [
    { tag: 'kerb_k1_laid',   label: 'K1 half-batter — laid' },
    { tag: 'kerb_k1_raised', label: 'K1 half-batter — raised' },
    { tag: 'kerb_k2_laid',   label: 'K2 transition — laid' },
    { tag: 'kerb_k2_raised', label: 'K2 transition — raised' },
    { tag: 'kerb_k3_laid',   label: 'K3 bullnose — laid' },
  ];

  // ── Small helpers ──────────────────────────────────────────────────────────

  const fmtGBP = (v) =>
    '£' + (+v || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const fmtQty = (v, unit) => {
    const n = +v || 0;
    if (unit === 'No' || unit === 'Item') return n.toFixed(0);
    return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2).replace(/\.?0+$/, '');
  };

  const fmtPct = (v) => ((+v || 0) * 100).toFixed(1).replace(/\.0$/, '') + '%';

  // Short unique id for custom lines
  const uid = () => 'l' + Math.random().toString(36).slice(2, 10);

  const snapMillingDepth = (depth) => {
    const d = +depth || 40;
    return MILLING_DEPTHS.reduce((a, b) => Math.abs(b - d) < Math.abs(a - d) ? b : a);
  };

  const matchSurfaceTag = (treatmentType) => {
    const t = (treatmentType || '').toLowerCase();
    if (t.includes('hra 30') || t.includes('hra30')) return 'surf_hra3014_40_14';
    if (t.includes('hra 35') || t.includes('hra35')) return 'surf_hra3514_45_14';
    if (t.includes('hra 55') || t.includes('hra55')) return 'surf_hra5510_40';
    if (t.includes('sma 10') || t.includes('sma10')) return 'surf_sma10_40';
    if (t.includes('ac 14')  || t.includes('ac14'))  return 'surf_ac14_40';
    if (t.includes('ac 10')  || t.includes('ac10'))  return 'surf_ac10_40';
    if (t.includes('ac 6')   || t.includes('ac6'))   return 'surf_ac6_30';
    return 'surf_hra3014_40_14';
  };

  // Given an item id like '7/027' / '2700/43', return its series number.
  const seriesOf = (id) => {
    const head = parseInt((id || '').split('/')[0], 10);
    return head < 100 ? head * 100 : head;
  };

  // ── regenAutoLines ─────────────────────────────────────────────────────────
  // Build the auto-populated BoQ line set from the QuickInputRail fields.
  // Every line is tagged auto:true so the designer's regen button can strip
  // old auto lines without touching user-added ones.
  function regenAutoLines(q) {
    const lines = [];

    const pushByTag = (tag, qty, measurement) => {
      const item = window.boqItem && window.boqItem(tag);
      if (!item) return;
      const n = +qty || 0;
      if (n <= 0) return;
      lines.push({
        uid:  uid(),
        id:   item.id,
        desc: item.desc,
        unit: item.unit,
        qty:  n,
        bandOverride: null,
        series: seriesOf(item.id),
        auto: true,
      });
    };

    const cw   = +q.carriageway_area || 0;
    const fw   = +q.footway_area     || 0;
    const days = Math.max(1, +q.duration_days || 1);

    // Series 100 — Traffic Management
    switch (q.tm_type) {
      case 'full_closure':
        pushByTag('tm_closure_day', days);
        if (q.include_diversion) {
          pushByTag('tm_diversion_erect',  1);
          pushByTag('tm_diversion_day',    days);
          pushByTag('tm_diversion_remove', 1);
        }
        break;
      case 'portable_signals':
        pushByTag('tm_pts_erect',  1);
        pushByTag('tm_pts_day',    days);
        pushByTag('tm_pts_remove', 1);
        break;
      case 'stop_go':
        pushByTag('tm_sg_erect',  1);
        pushByTag('tm_sg_day',    days);
        pushByTag('tm_sg_remove', 1);
        break;
      case 'footway_works':
        pushByTag('tm_fw_erect',  1);
        pushByTag('tm_fw_day',    days);
        pushByTag('tm_fw_remove', 1);
        break;
    }

    // Series 700 — Pavements (carriageway).
    // Each layer reads its own area; null/0 override falls back to cw.
    const layerArea = (override) => {
      const n = +override;
      return n > 0 ? n : cw;
    };

    // Milling — one line per {depth, area} entry. Back-compat: if
    // milling_entries is absent fall back to the single milling_depth field.
    if (q.include_milling) {
      const entries = Array.isArray(q.milling_entries) && q.milling_entries.length
        ? q.milling_entries
        : [{ depth: q.milling_depth, area: null }];
      for (const m of entries) {
        const a = layerArea(m.area);
        if (a > 0) pushByTag('mill_' + snapMillingDepth(m.depth), a);
      }
    }

    if (q.include_tack)    pushByTag('tack', layerArea(q.tack_area));
    if (q.include_base)    pushByTag(q.base_tag || 'base_ac32d_100', layerArea(q.base_area));
    if (q.include_subbase) {
      const a   = layerArea(q.subbase_area);
      const vol = Math.round(a * (+q.subbase_depth || 150) / 1000 * 10) / 10;
      if (vol > 0) pushByTag('subbase_t1', vol);
    }
    if (q.include_binder)  pushByTag(q.binder_tag || 'bin_hra5020_60', layerArea(q.binder_area));
    const sA = layerArea(q.surface_area);
    if (sA > 0) pushByTag(q.surface_tag || 'surf_hra3014_40_14', sA);

    // Series 1100 — Kerbs
    if (+q.kerb_length > 0) pushByTag(q.kerb_type || 'kerb_k1_laid', +q.kerb_length);

    // Series 1100 — Footway surfacing
    if (fw > 0) {
      pushByTag(q.fw_surface_tag || 'fw_ac6_30', fw);
      if (q.include_fw_subbase) pushByTag('fw_subbase_150', fw);
    }

    // Series 1200 — Road markings
    if (q.include_markings   && +q.markings_area > 0) pushByTag('mark_area',      +q.markings_area);
    if (q.include_line_marks && +q.line_marks_m  > 0) pushByTag('mark_cont_100',  +q.line_marks_m);

    // Series 2700 — Ironwork
    if (+q.iw_sw_cway  > 0) pushByTag('iw_sw_cway',  +q.iw_sw_cway);
    if (+q.iw_sse_cway > 0) pushByTag('iw_sse_cway', +q.iw_sse_cway);
    if (+q.iw_bt_cway  > 0) pushByTag('iw_bt_cway',  +q.iw_bt_cway);
    if (+q.iw_sw_fw    > 0) pushByTag('iw_sw_fw',    +q.iw_sw_fw);
    if (+q.iw_sse_fw   > 0) pushByTag('iw_sse_fw',   +q.iw_sse_fw);
    if (+q.iw_bt_fw    > 0) pushByTag('iw_bt_fw',    +q.iw_bt_fw);

    return lines;
  }

  // ── buildBoQLines ──────────────────────────────────────────────────────────
  // Price every line in boq.custom_lines, group by series, apply Series 6400
  // percentage additions, BERR index and VAT to produce the totals ladder.
  //
  //   Subtotal (ex-VAT) → + Series 6400 additions → × BERR → PWP → + VAT → Total
  function buildBoQLines(boq, scheme) {
    if (!boq) return emptyResult();
    const settings  = (boq.settings  || {});
    const raw       = (boq.custom_lines || []);
    const areaBand  = settings.areaBandOverride;  // 'A'|'B'|'C'|null

    const priced = raw.map(l => {
      const item = window.boqFullItem(l.id);
      if (!item) {
        return Object.assign({}, l, { rate: 0, total: 0, bandApplied: null, missing: true });
      }
      const band = l.bandOverride || areaBand;
      const measure = band || (+l.qty || 0);
      const rate = window.boqPickRateForSeries(item, measure, l.series || seriesOf(l.id));
      const bandApplied = window.boqPickBand(item, measure, l.series || seriesOf(l.id));
      return Object.assign({}, l, {
        desc: l.desc || item.desc,
        unit: l.unit || item.unit,
        rate: rate,
        total: rate * (+l.qty || 0),
        bandApplied: bandApplied,
        missing: false,
      });
    });

    // Group by series, in the canonical order.
    const SERIES_ORDER = window.BOQ_SERIES_ORDER || [100,200,300,400,500,600,700,1100,1200,2700,3000,6400];
    const buckets = {};
    for (const l of priced) {
      const k = l.series || seriesOf(l.id);
      if (!buckets[k]) buckets[k] = [];
      buckets[k].push(l);
    }

    const groups = SERIES_ORDER
      .filter(n => buckets[n])
      .map(n => {
        const key = 's' + n;
        const def = (window.BOQ_RATES_FULL && window.BOQ_RATES_FULL[key]) || {};
        const subtotal = buckets[n].reduce((s, l) => s + (+l.total || 0), 0);
        return {
          num: n,
          key: key,
          title: def.title || ('Series ' + n),
          lines: buckets[n],
          itemCount: buckets[n].length,
          subtotal: subtotal,
        };
      });

    const subtotal = groups.reduce((s, g) => s + g.subtotal, 0);

    // Percentage additions (Series 6400 analogue). Only enabled entries apply.
    const addsDef = settings.percentAdditions || {};
    const adjustments = [];
    let runningAfterAdds = subtotal;
    for (const [key, add] of Object.entries(addsDef)) {
      if (!add || !add.enabled || !(+add.pct > 0)) continue;
      const amt = subtotal * (+add.pct);
      adjustments.push({ key, label: add.label || key, pct: +add.pct, amount: amt });
      runningAfterAdds += amt;
    }

    // BERR index (1.000 = no adjustment). Applied to (subtotal + additions).
    const berrIndex = settings.useBERR ? (+settings.berrIndex || 1) : 1;
    const berrAdjustmentAmt = runningAfterAdds * (berrIndex - 1);
    const pwp = runningAfterAdds + berrAdjustmentAmt;   // Works value
    const vatRate = +settings.vatRate || 0;
    const vat = pwp * vatRate;
    const totalIncVat = pwp + vat;

    return {
      groups,
      lines: priced,
      subtotal,
      adjustments,
      berrIndex,
      berrDate: settings.berrDate || '',
      berrAdjustmentAmt,
      useBERR: !!settings.useBERR,
      pwp,
      vatRate,
      vat,
      totalIncVat,
      areaBandOverride: areaBand,
    };
  }

  function emptyResult() {
    return {
      groups: [], lines: [],
      subtotal: 0, adjustments: [],
      berrIndex: 1, berrDate: '', berrAdjustmentAmt: 0, useBERR: false,
      pwp: 0, vatRate: 0, vat: 0, totalIncVat: 0,
      areaBandOverride: null,
    };
  }

  window.BOQ_ENGINE = {
    MATERIALS: {
      SURFACE_OPTIONS, BINDER_OPTIONS, BASE_OPTIONS,
      FOOTWAY_SURFACE_OPTIONS, KERB_OPTIONS, MILLING_DEPTHS,
    },
    fmtGBP, fmtQty, fmtPct, uid, snapMillingDepth, matchSurfaceTag, seriesOf,
    regenAutoLines, buildBoQLines,
  };
})();
