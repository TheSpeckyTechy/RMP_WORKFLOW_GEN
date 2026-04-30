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
    // Preventive / thin treatments — dramatically cheaper per m² than
    // hot-laid courses. Listing them explicitly here fixes the catastrophic
    // silent default where Master selections of "Micro-asphalt" used to
    // resolve to HRA 30/14F (5–6× over-price).
    { tag: 'surf_micro',         label: 'Micro-asphalt (slurry seal) — preventive' },
    { tag: 'sd_10mm_int',        label: 'Surface dressing 10mm · intermediate binder' },
    { tag: 'sd_10mm_prem',       label: 'Surface dressing 10mm · premium binder' },
    { tag: 'sd_6mm_int',         label: 'Surface dressing 6mm · intermediate binder' },
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
    // Preventive treatments — matched FIRST so explicit micro/SD selections
    // aren't swallowed by broader substring checks below.
    if (t.includes('micro') || t.includes('slurry'))
      return 'surf_micro';
    if (t.includes('surface dressing') || t.includes('surface-dressing')) {
      if (t.includes('6mm') || t.includes('6 mm'))   return 'sd_6mm_int';
      if (t.includes('prem'))                         return 'sd_10mm_prem';
      return 'sd_10mm_int';
    }
    // HBC variants before plain AC so they match precisely.
    if (t.includes('ac14') && (t.includes('hbc') || t.includes('hb '))) return 'surf_ac14hb_40';
    if (t.includes('ac 14') && (t.includes('hbc') || t.includes('hb '))) return 'surf_ac14hb_40';
    if (t.includes('ac10') && (t.includes('hbc') || t.includes('hb '))) return 'surf_ac10hb_40';
    if (t.includes('ac 10') && (t.includes('hbc') || t.includes('hb '))) return 'surf_ac10hb_40';
    // Standard hot-laid courses.
    if (t.includes('hra 30') || t.includes('hra30')) return 'surf_hra3014_40_14';
    if (t.includes('hra 35') || t.includes('hra35')) return 'surf_hra3514_45_14';
    if (t.includes('hra 55') || t.includes('hra55')) return 'surf_hra5510_40';
    if (t.includes('sma 10') || t.includes('sma10')) return 'surf_sma10_40';
    if (t.includes('ac 14')  || t.includes('ac14'))  return 'surf_ac14_40';
    if (t.includes('ac 10')  || t.includes('ac10'))  return 'surf_ac10_40';
    if (t.includes('ac 6')   || t.includes('ac6'))   return 'surf_ac6_30';
    return null;
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

    // Series 100 — Traffic Management. Internal codes are bijective with
    // the Master dropdown (see SCHEME_TO_INTERNAL_TM). New codes
    // (partial_closure, lane_closure, two_way_lights, give_take,
    // full_closure_diversion) reuse the nearest existing rate triplet for
    // now; distinct priced items for partial-closure and give-and-take
    // are a follow-up (see audit D2).
    const tm = q.tm_type;
    const isFullClosure = tm === 'full_closure' || tm === 'partial_closure' || tm === 'full_closure_diversion';
    const isPts         = tm === 'portable_signals' || tm === 'lane_closure' || tm === 'two_way_lights';
    if (isFullClosure) {
      pushByTag('tm_closure_day', days);
      if (q.include_diversion || tm === 'full_closure_diversion') {
        pushByTag('tm_diversion_erect',  1);
        pushByTag('tm_diversion_day',    days);
        pushByTag('tm_diversion_remove', 1);
      }
    } else if (isPts) {
      pushByTag('tm_pts_erect',  1);
      pushByTag('tm_pts_day',    days);
      pushByTag('tm_pts_remove', 1);
    } else if (tm === 'stop_go') {
      pushByTag('tm_sg_erect',  1);
      pushByTag('tm_sg_day',    days);
      pushByTag('tm_sg_remove', 1);
    } else if (tm === 'footway_works') {
      pushByTag('tm_fw_erect',  1);
      pushByTag('tm_fw_day',    days);
      pushByTag('tm_fw_remove', 1);
    }
    // 'give_take' and 'none' emit no TM lines (informal / no TM).

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

    // Structural layers — zone-driven path emits per-zone lines so deep
    // inlay zones get binder/base lines while shallow inlay zones don't.
    // Dedupe at the end folds same-material lines across zones together.
    const binderTag = q.binder_tag || 'bin_hra5020_60';
    const baseTag   = q.base_tag   || 'base_ac32d_100';
    const zonesPath = Array.isArray(q.surface_zones) && q.surface_zones.length;

    if (zonesPath) {
      for (const sz of q.surface_zones) {
        const a = +sz.area || 0;
        if (a <= 0) continue;
        if (sz.tag)             pushByTag(sz.tag, a);        // surface
        if (q.include_tack)     pushByTag('tack', a);        // tack follows surface
        if (q.include_binder && sz.needsBinder) pushByTag(binderTag, a);
        if (q.include_base   && sz.needsBase)   pushByTag(baseTag,   a);
      }
    } else {
      // Manual (single-material) path.
      if (q.include_tack)   pushByTag('tack', layerArea(q.tack_area));
      if (q.include_binder) pushByTag(binderTag, layerArea(q.binder_area));
      if (q.include_base)   pushByTag(baseTag,   layerArea(q.base_area));
      const sA = layerArea(q.surface_area);
      if (sA > 0 && q.surface_tag) pushByTag(q.surface_tag, sA);
    }

    // Sub-base is scheme-wide (rarely zone-driven — it's a full reconstruction
    // layer). If zoned, uses the sum of zone areas that need base (ie.
    // zones deep enough to warrant sub-base).
    if (q.include_subbase) {
      let area = 0;
      if (zonesPath) {
        area = q.surface_zones
          .filter(sz => sz.needsBase)
          .reduce((t, sz) => t + (+sz.area || 0), 0);
      } else {
        area = layerArea(q.subbase_area);
      }
      const vol = Math.round(area * (+q.subbase_depth || 150) / 1000 * 10) / 10;
      if (vol > 0) pushByTag('subbase_t1', vol);
    }

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
    if (+q.iw_sw_cway   > 0) pushByTag('iw_sw_cway',   +q.iw_sw_cway);
    if (+q.iw_sse_cway  > 0) pushByTag('iw_sse_cway',  +q.iw_sse_cway);
    if (+q.iw_bt_cway   > 0) pushByTag('iw_bt_cway',   +q.iw_bt_cway);
    if (+q.iw_gas_cway  > 0) pushByTag('iw_gas_cway',  +q.iw_gas_cway);
    if (+q.iw_sw_fw     > 0) pushByTag('iw_sw_fw',     +q.iw_sw_fw);
    if (+q.iw_sse_fw    > 0) pushByTag('iw_sse_fw',    +q.iw_sse_fw);
    if (+q.iw_bt_fw     > 0) pushByTag('iw_bt_fw',     +q.iw_bt_fw);
    if (+q.iw_gas_fw    > 0) pushByTag('iw_gas_fw',    +q.iw_gas_fw);
    // Series 500 — Gully grating reset (priced per raised grating unit)
    if (+q.iw_gully_cway > 0) pushByTag('iw_gully_cway', +q.iw_gully_cway);

    return dedupeLines(lines);
  }

  // Collapse auto-lines that share the same (item id, bandOverride) into a
  // single line with summed quantity. Real JMCA pricing picks the rate band
  // from the TOTAL line quantity — so 4 zones of 19 + 23 + 31 + 595 m² of
  // the same AC14 surface course must be one 668 m² line (Band B), not four
  // separate lines (one Band A and three Band B).
  //
  // Dedup key includes bandOverride so a user-forced Band A line never folds
  // into an auto-banded line of the same material.
  function dedupeLines(lines) {
    const bucket = new Map();
    const order = [];
    for (const l of lines) {
      const key = l.id + '\x00' + (l.bandOverride || '');
      if (bucket.has(key)) {
        bucket.get(key).qty += +l.qty || 0;
      } else {
        bucket.set(key, { ...l });
        order.push(key);
      }
    }
    return order.map(k => bucket.get(k));
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
      hasCustomTreatment: !matchSurfaceTag(scheme.treatment_type),
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

  // ── Master → BoQ derivation layer ──────────────────────────────────────────
  // The Master Workbook is the source of truth. These helpers project the
  // scheme's Master fields into the quick_inputs shape the BoQ consumes.
  // Fields absent from this map (base_tag, footway surface, markings, etc.)
  // have no Master analogue and always come straight from stored quick_inputs.

  // Scheme.tm_type is human-readable; BoQ's internal code is snake_case.
  // Bijective map between Master Workbook tm_type strings and BoQ's
  // internal snake_case codes. Keeping these 1-to-1 prevents the lossy
  // roundtrip where pushing an overridden tm_type back to the Master
  // used to collapse every "portable_signals" to "Two-way lights".
  const SCHEME_TO_INTERNAL_TM = {
    'Full road closure':        'full_closure',
    'Full Closure + Diversion': 'full_closure_diversion',
    'Partial Road Closure':     'partial_closure',
    'Lane Closure':             'lane_closure',
    'Two-way lights':           'two_way_lights',
    'Stop/Go boards':           'stop_go',
    'Give & Take':              'give_take',
    'Works on footways only':   'footway_works',
    'None':                     'none',
  };
  const INTERNAL_TO_SCHEME_TM = Object.fromEntries(
    Object.entries(SCHEME_TO_INTERNAL_TM).map(([k, v]) => [v, k])
  );

  function mapSchemeTmType(s) {
    if (!s) return 'none';
    if (SCHEME_TO_INTERNAL_TM[s]) return SCHEME_TO_INTERNAL_TM[s];
    // Fuzzy fallback for legacy free-text values a designer may have typed.
    const t = String(s).toLowerCase();
    if (t === 'none' || !t.trim())              return 'none';
    if (t.includes('footway'))                  return 'footway_works';
    if (t.includes('diversion'))                return 'full_closure_diversion';
    if (t.includes('partial'))                  return 'partial_closure';
    if (t.includes('give'))                     return 'give_take';
    if (t.includes('stop') && t.includes('go')) return 'stop_go';
    if (t.includes('lane'))                     return 'lane_closure';
    if (t.includes('two-way'))                  return 'two_way_lights';
    if (t.includes('closure'))                  return 'full_closure';
    return 'full_closure';
  }

  // Convert a DD/MM/YYYY → DD/MM/YYYY date pair to working days
  // (calendar × 5/7, min 1). Returns null if either date is unparseable.
  function computeWorkingDays(start, finish) {
    if (!start || !finish) return null;
    const parse = s => { const [d,m,y] = String(s).split('/'); return new Date(+y, +m-1, +d); };
    const a = parse(start), b = parse(finish);
    if (isNaN(a) || isNaN(b)) return null;
    return Math.max(1, Math.round((b - a) / 86400000 * 5 / 7));
  }

  // Core derivation — everything that the BoQ can look up from the Master.
  // When scheme.treatments has priced zones, their (area, depth, material)
  // trios drive the milling and surface-course lines so the Treatment tab
  // effectively feeds the BoQ without the designer re-entering anything.
  function deriveQuickInputsFromScheme(scheme) {
    const s = scheme || {};
    const isFootway = s.scheme_type === 'Footway';
    const wd = computeWorkingDays(s.date_start, s.date_finish);

    const zones = (s.treatments || []).filter(z => +z.area_m2 > 0);

    // Per-zone layer build-up. Designers set `zone.depth_mm` as the TOTAL
    // excavation depth, not per-layer depths. We derive which structural
    // layers are needed from the depth relative to the Master's surface +
    // binder depths:
    //   depth ≤ surface_depth              → surface only (standard inlay)
    //   surface < depth ≤ surface+binder   → surface + binder (deep inlay)
    //   depth > surface + binder           → surface + binder + base
    const surfaceDepth = +s.surface_depth_mm || 40;
    const binderDepth  = +s.binder_depth_mm  || 60;
    const zoneNeedsBinder = z => (+z.depth_mm || 40) > surfaceDepth;
    const zoneNeedsBase   = z => (+z.depth_mm || 40) > (surfaceDepth + binderDepth);

    const millingFromZones = zones.map(z => ({
      depth:     +z.depth_mm || 40,
      area:      +z.area_m2,
      zoneId:    z.id,
      zoneLabel: z.zone || '',
    }));
    const surfaceFromZones = zones.map(z => ({
      area:      +z.area_m2,
      tag:       matchSurfaceTag(z.treatment_type || s.treatment_type),
      depth:     +z.depth_mm || 40,
      zoneId:    z.id,
      zoneLabel: z.zone || '',
      needsBinder: zoneNeedsBinder(z),
      needsBase:   zoneNeedsBase(z),
    }));
    // Any zone deep enough to warrant a binder/base drives the scheme-level
    // toggle on. Designers can still explicitly override via the rail.
    const anyZoneNeedsBinder = zones.some(zoneNeedsBinder);
    const anyZoneNeedsBase   = zones.some(zoneNeedsBase);

    return {
      carriageway_area:  isFootway ? 0 : (+s.area_m2 || 0),
      footway_area:      isFootway ? (+s.area_m2 || 0) : 0,
      surface_tag:       matchSurfaceTag(s.treatment_type),
      include_binder:    anyZoneNeedsBinder || +s.binder_depth_mm  > 0,
      include_base:      anyZoneNeedsBase,
      include_subbase:   +s.subbase_depth_mm > 0,
      subbase_depth:     +s.subbase_depth_mm || 150,
      milling_depth:     snapMillingDepth(+s.surface_depth_mm || 40),
      include_milling:   true,
      include_tack:      true,
      kerb_length:       +s.kerb_length || 0,
      iw_sw_cway:        (+s.iron_mh || 0) + (+s.iron_water || 0),
      iw_bt_cway:        +s.iron_bt  || 0,
      iw_gas_cway:       +s.iron_gas || 0,
      iw_gully_cway:     +s.iron_gullies || 0,
      tm_type:           mapSchemeTmType(s.tm_type),
      include_diversion: /diversion/i.test(s.tm_type || ''),
      duration_days:     wd != null ? wd : 5,
      // Zone-driven shapes. When zones.length > 0 these win over the
      // scalar surface_tag / milling_entries values above.
      milling_entries:   zones.length ? millingFromZones : [{ depth: snapMillingDepth(+s.surface_depth_mm || 40), area: null }],
      surface_zones:     zones.length ? surfaceFromZones : null,
    };
  }

  // Effective quick inputs = stored values for overridden keys, Master-derived
  // for everything else, with non-linked stored keys passed through verbatim.
  function effectiveQuickInputs(scheme, boq) {
    const derived    = deriveQuickInputsFromScheme(scheme);
    const overridden = (boq && boq.overrides)    || {};
    const stored     = (boq && boq.quick_inputs) || {};
    const out = { ...stored, ...derived };
    for (const k in derived) {
      if (overridden[k] && (k in stored)) out[k] = stored[k];
    }
    return out;
  }

  // Reverse map from internal surface tag to the canonical Master
  // treatment_type string. Multiple tags can share the same Master value
  // (e.g. 14mm and 20mm chippings both land on "HRA 30/14F surf 40/60").
  // Every value here MUST exist in the Master dropdown in
  // window.WORKBOOK_SCHEMA so the roundtrip preserves spec integrity.
  const TAG_TO_MASTER_TREATMENT = {
    surf_hra3014_40_14: 'HRA 30/14F surf 40/60',
    surf_hra3014_40_20: 'HRA 30/14F surf 40/60',
    surf_hra3514_45_14: 'HRA 35/14F surf 40/60',
    surf_hra3514_45_20: 'HRA 35/14F surf 40/60',
    surf_hra5510_40:    'HRA 55/10F surf 40/60',
    surf_sma10_40:      'SMA 10 surf 40/60',
    surf_sma6_30:       'SMA 6 surf 100/150',
    surf_ac14_40:       'AC14 close surf 40/60',
    surf_ac10_40:       'AC10 close surf 40/60',
    surf_ac14hb_40:     'AC14 HBC surf 40/60',
    surf_ac10hb_40:     'AC10 HBC surf 40/60',
    surf_ac6_30:        'AC6 dense 100/150',
    surf_micro:         'Micro-asphalt',
    sd_10mm_int:        'Surface dressing 10mm intermediate',
    sd_10mm_prem:       'Surface dressing 10mm premium',
    sd_6mm_int:         'Surface dressing 6mm intermediate',
  };

  // Push an overridden BoQ value back to its Master field. Returns the
  // patch object to apply to the scheme (or null if this field has no clean
  // Master reverse-mapping). Caller runs updateScheme(schemeId, patch) and
  // clears the override flag.
  function schemePatchForOverride(key, overrideValue, scheme) {
    const num = () => +overrideValue || 0;
    const bool = () => !!overrideValue;
    switch (key) {
      case 'carriageway_area': return { area_m2: num() };
      case 'footway_area':     return { area_m2: num() };   // footway schemes store area here too
      case 'kerb_length':      return { kerb_length: num() };
      case 'subbase_depth':    return { subbase_depth_mm: num() };
      case 'milling_depth':    return { surface_depth_mm: num() };
      case 'iw_bt_cway':       return { iron_bt: num() };
      case 'iw_gas_cway':      return { iron_gas: num() };
      case 'iw_gully_cway':    return { iron_gullies: num() };
      case 'include_binder':   return { binder_depth_mm: bool() ? (+scheme.binder_depth_mm || 60) : 0 };
      case 'include_subbase':  return { subbase_depth_mm: bool() ? (+scheme.subbase_depth_mm || 150) : 0 };
      case 'surface_tag': {
        // Map the internal tag to a canonical Master treatment_type string
        // the dropdown actually accepts. Writing the SURFACE_OPTIONS label
        // (e.g. "HRA 30/14F 40mm · 14mm chips") would put an orphan value
        // into the Master that no downstream reader could parse.
        const masterStr = TAG_TO_MASTER_TREATMENT[overrideValue];
        return masterStr ? { treatment_type: masterStr } : null;
      }
      case 'tm_type': {
        // Use the bijective map so every internal code round-trips to
        // exactly the Master dropdown option the designer originally
        // chose — no silent collapse onto a single default.
        const masterStr = INTERNAL_TO_SCHEME_TM[overrideValue];
        return masterStr ? { tm_type: masterStr } : null;
      }
      // iw_sw_cway splits into iron_mh + iron_water — ambiguous, no clean push.
      // include_diversion is a regex read of tm_type — no clean push.
      // duration_days is derived from date_start/date_finish — no clean push.
      default: return null;
    }
  }

  // Inventory of Master-linked fields. Drives the rail's LinkedField UI and
  // the scheme-level overrides banner.
  const LINKED_FIELDS = [
    { key:'carriageway_area',  label:'Default area',       unit:'m²' },
    { key:'footway_area',      label:'Footway area',       unit:'m²' },
    { key:'surface_tag',       label:'Surface course' },
    { key:'include_binder',    label:'Binder course' },
    { key:'include_base',      label:'Base course' },
    { key:'include_subbase',   label:'Sub-base' },
    { key:'subbase_depth',     label:'Sub-base depth',     unit:'mm' },
    { key:'milling_depth',     label:'Milling depth',      unit:'mm' },
    { key:'kerb_length',       label:'Kerb length',        unit:'m' },
    { key:'iw_sw_cway',        label:'SW covers — c’way',  unit:'No' },
    { key:'iw_bt_cway',        label:'BT covers — c’way',  unit:'No' },
    { key:'iw_gas_cway',       label:'Gas covers — c’way', unit:'No' },
    { key:'iw_gully_cway',     label:'Gully reset — c’way',unit:'No' },
    { key:'tm_type',           label:'TM type' },
    { key:'include_diversion', label:'Include diversion' },
    { key:'duration_days',     label:'Duration',           unit:'days' },
  ];

  window.BOQ_ENGINE = {
    MATERIALS: {
      SURFACE_OPTIONS, BINDER_OPTIONS, BASE_OPTIONS,
      FOOTWAY_SURFACE_OPTIONS, KERB_OPTIONS, MILLING_DEPTHS,
    },
    fmtGBP, fmtQty, fmtPct, uid, snapMillingDepth, matchSurfaceTag, seriesOf,
    regenAutoLines, buildBoQLines,
    deriveQuickInputsFromScheme, effectiveQuickInputs,
    mapSchemeTmType, computeWorkingDays,
    schemePatchForOverride,
    LINKED_FIELDS,
  };
})();
