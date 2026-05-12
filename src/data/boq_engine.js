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
  // Surface courses, ordered by Dundee design practice:
  //   1. The three primaries everyday schemes use, all at 40mm depth.
  //   2. Other hot-laid courses (HRA 35/14F, AC, HBC, etc.) kept available.
  //   3. Preventive / thin treatments at the bottom.
  //
  // Note on catalogue mapping for the new "Taycoat" and "SMA 14" tags:
  // - Taycoat = SMA 10 closed surf with 100/150 pen binder grade (a softer
  //   binder than the 40/60 used in the catalogue's 7/053 row). The priced
  //   catalogue does not yet carry a dedicated 100/150 row, so the tag is
  //   mapped to 7/053 (SMA 10 surf 40/60 40mm) as the closest priced
  //   analogue until a proper Taycoat row is added.
  // - SMA 14 = no priced row exists at 14mm aggregate; same fallback to
  //   7/053 until rates are added.
  // When new rates land in boq_rates_full.js, update the right-hand side of
  // the two new entries in BOQ_LEGACY_TAG_MAP — the rail labels here can
  // stay as they are.
  const SURFACE_OPTIONS = [
    // Dundee-typical primaries (40mm) ───────────────────────────────────────
    { tag: 'surf_taycoat_10_40', label: '40mm Taycoat — SMA 10 closed surf 100/150' },
    { tag: 'surf_hra3014_40_14', label: '40mm HRA 14mm' },
    { tag: 'surf_sma14_40',      label: '40mm SMA 14' },
    // Other hot-laid surface courses ───────────────────────────────────────
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

  // Compact variant — no pence. For dashboard summaries where a £100k+
  // figure with ".00" reads as visual noise. Same thousands separator.
  const fmtGBP0 = (v) =>
    '£' + Math.round(+v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

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

  // Canonical lookup maps built once from SURFACE_OPTIONS so the
  // matcher's first two passes are O(1) and exact rather than
  // substring-based. Without these, an input like "SD 10mm intermediate"
  // falls through every substring check and silently returns null,
  // dropping the zone's surface course from the BoQ.
  const SURFACE_TAGS  = new Set(SURFACE_OPTIONS.map(o => o.tag));
  const SURFACE_BY_LABEL = new Map(
    SURFACE_OPTIONS.map(o => [o.label.toLowerCase(), o.tag])
  );

  const matchSurfaceTag = (treatmentType) => {
    const raw = String(treatmentType || '').trim();
    if (!raw) return null;
    // Pass 1 — caller already gave us a known tag.
    if (SURFACE_TAGS.has(raw)) return raw;
    // Pass 2 — exact (case-insensitive) match against a SURFACE_OPTIONS label.
    const exact = SURFACE_BY_LABEL.get(raw.toLowerCase());
    if (exact) return exact;
    // Pass 3 — heuristic substring matcher for free-text inputs that come
    // from older schemes or Master-level treatment_type strings.
    const t = raw.toLowerCase();
    // Preventive treatments — matched FIRST so explicit micro/SD selections
    // aren't swallowed by broader substring checks below.
    if (t.includes('micro') || t.includes('slurry'))
      return 'surf_micro';
    // "SD 10mm intermediate" / "SD 6mm" — the abbreviated form that
    // the previous matcher missed because it required the full phrase
    // "surface dressing".
    const isSD = t.includes('surface dressing')
              || t.includes('surface-dressing')
              || /\bsd\b/.test(t);
    if (isSD) {
      if (t.includes('6mm') || t.includes('6 mm'))   return 'sd_6mm_int';
      if (t.includes('prem'))                         return 'sd_10mm_prem';
      return 'sd_10mm_int';
    }
    // Dundee-practice primaries — match BEFORE the legacy substring rules
    // so "Taycoat", "SMA 10 100/150", and "SMA 14" resolve to the new
    // dedicated tags rather than falling back to substring-matched defaults.
    if (t.includes('taycoat'))                                     return 'surf_taycoat_10_40';
    if ((t.includes('sma 10') || t.includes('sma10')) && t.includes('100/150')) return 'surf_taycoat_10_40';
    if ((t.includes('sma 14') || t.includes('sma14')))             return 'surf_sma14_40';
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
    // Reached only if every pass failed. Log so the silent-null case is
    // visible in dev tools and so a future test can assert this never
    // happens for any canonical SURFACE_OPTIONS label.
    // eslint-disable-next-line no-console
    console.warn(`[BOQ_ENGINE] matchSurfaceTag: no tag for surface "${raw}" — surface course line will be omitted from BoQ.`);
    return null;
  };

  // Given an item id like '7/027' / '2700/43', return its series number.
  const seriesOf = (id) => {
    const head = parseInt((id || '').split('/')[0], 10);
    return head < 100 ? head * 100 : head;
  };

  // ── regenAutoLines ─────────────────────────────────────────────────────────
  // Build the auto-populated BoQ line set from the design-derived inputs.
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
    const defaultBinderTag = q.binder_tag || 'bin_hra5020_60';
    const defaultBaseTag   = q.base_tag   || 'base_ac32d_100';
    const zonesPath = Array.isArray(q.surface_zones) && q.surface_zones.length;

    if (zonesPath) {
      for (const sz of q.surface_zones) {
        const a = +sz.area || 0;
        if (a <= 0) continue;
        if (sz.tag)             pushByTag(sz.tag, a);        // surface
        if (q.include_tack)     pushByTag('tack', a);        // tack follows surface
        // Per-zone binder/base material wins; fall through to the
        // scheme-level default for zones the Designer hasn't specified.
        if (q.include_binder && sz.needsBinder) pushByTag(sz.binderTag || defaultBinderTag, a);
        if (q.include_base   && sz.needsBase)   pushByTag(sz.baseTag   || defaultBaseTag,   a);
      }
    } else {
      // Manual (single-material) path.
      if (q.include_tack)   pushByTag('tack', layerArea(q.tack_area));
      if (q.include_binder) pushByTag(defaultBinderTag, layerArea(q.binder_area));
      if (q.include_base)   pushByTag(defaultBaseTag,   layerArea(q.base_area));
      const sA = layerArea(q.surface_area);
      if (sA > 0 && q.surface_tag) pushByTag(q.surface_tag, sA);
    }

    // Sub-base is scheme-wide for the manual path; zone-driven path sums the
    // areas of zones whose Designer subbase toggle is on. Migrated legacy
    // schemes get the per-zone needsSubbase flag set by the depth heuristic
    // (zones deeper than surface+binder), reproducing the engine's pre-
    // Phase-3 output exactly.
    if (q.include_subbase) {
      let area = 0;
      if (zonesPath) {
        area = q.surface_zones
          .filter(sz => sz.needsSubbase)
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
  // percentage additions and BERR index to produce the totals ladder.
  //
  //   Subtotal → + Series 6400 additions → × BERR → PWP → Total
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
      const qty  = +l.qty || 0;
      // Rate-cell zero fallback: if the catalogue has the item id but no
      // rate cell for the chosen band (rateA/B/C undefined), the helper
      // returns 0. A line with qty>0 and rate=0 contributes nothing to
      // the total — silently invisible. Flagging it `missing:true` puts
      // the row in the same red-outline / red-wash state as a wholly-
      // unknown line so the user can see something needs attention.
      const missing = qty > 0 && !(+rate > 0);
      return Object.assign({}, l, {
        desc: l.desc || item.desc,
        unit: l.unit || item.unit,
        rate: rate,
        total: rate * qty,
        bandApplied: bandApplied,
        missing,
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
    // VAT removed — Dundee CC is a government body and doesn't apply
    // VAT to its own works. The vatRate / vat / totalIncVat fields are
    // retained on the result (with zero / pwp values) so persisted
    // schemes and downstream consumers don't break.
    const vatRate = 0;
    const vat = 0;
    const totalIncVat = pwp;

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
      hasCustomTreatment: !matchSurfaceTag((window.schemeTreatment && window.schemeTreatment(scheme)) || ''),
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

  // Convert a DD/MM/YYYY → DD/MM/YYYY date pair to working days, counting
  // each qualifying day inclusively from start to finish. Returns:
  //   - null  if either date is missing or unparseable, or finish < start.
  //   - n ≥ 1 working days otherwise (min 1 even if the entire range falls
  //           on excluded days).
  //
  // `pattern` selects which days count:
  //   - 'weekday'   (default) — Mon–Fri only. Sat/Sun excluded.
  //   - 'seven_day'           — every day counts (used when crews work
  //                             through weekends, e.g. nightshift programmes).
  // Bank holidays are NOT excluded — that would need a Scotland-specific
  // calendar lookup.
  function computeWorkingDays(start, finish, pattern) {
    if (!start || !finish) return null;
    const parse = s => {
      const [d, m, y] = String(s).split('/');
      const dt = new Date(+y, +m - 1, +d);
      return isNaN(dt) ? null : dt;
    };
    const a = parse(start), b = parse(finish);
    if (!a || !b || b < a) return null;
    const sevenDay = isSevenDayPattern(pattern);
    let days = 0;
    const cur = new Date(a);
    while (cur <= b) {
      const dow = cur.getDay();
      if (sevenDay || (dow !== 0 && dow !== 6)) days++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, days);
  }

  // Stored value of working_pattern is the human-readable label from the
  // Master dropdown. Match defensively so future label tweaks don't break
  // the engine: anything that mentions "7", "sun", or "weekend" is 7-day.
  function isSevenDayPattern(pattern) {
    const t = String(pattern || '').toLowerCase();
    return /\b7\b|sun|weekend/.test(t);
  }

  // Core derivation — every quick-input the BoQ engine reads is sourced from
  // scheme.design{}, the Treatment Designer's single-source-of-truth model.
  // Untouched legacy schemes get their design{} back-filled by the
  // SchemeContext migration shim before the engine ever sees them, so this
  // function never has to fall through to the legacy fields directly.
  function deriveQuickInputsFromScheme(scheme) {
    const s = scheme || {};
    const design = s.design || (window.defaultDesign ? window.defaultDesign() : { zones: [], ironworks: { cway: {}, fway: {} }, kerbs: [], lining: [], tm: {} });
    const wd = computeWorkingDays(s.date_start, s.date_finish, s.working_pattern);

    // Filter zones with no area so a fresh "Add zone" placeholder doesn't
    // pollute the milling / surface_zones arrays.
    const zones = (design.zones || []).filter(z => +z.area_m2 > 0);

    // Per-zone milling and surface entries. The engine's line-builder reads
    // surface_zones[].needsBinder / needsBase / needsSubbase to decide which
    // structural layers each zone gets — those flags come straight from the
    // Designer's per-zone toggles.
    const millingFromZones = zones.map(z => ({
      depth:     +z.milling_depth_mm || +z.depth_mm || 40,
      area:      +z.area_m2,
      zoneId:    z.id,
      zoneLabel: z.label || '',
    }));
    const surfaceFromZones = zones.map(z => ({
      area:      +z.area_m2,
      tag:       matchSurfaceTag(z.surface || ''),
      depth:     +z.depth_mm || 40,
      zoneId:    z.id,
      zoneLabel: z.label || '',
      needsBinder:  !!z.includes_binder,
      needsBase:    !!z.includes_base,
      needsSubbase: !!z.includes_subbase,
      // Per-zone binder / base material; null falls through to the
      // scheme-level default in the line builder.
      binderTag: z.binder_tag || null,
      baseTag:   z.base_tag   || null,
    }));

    // Dominant zone (largest area) drives the scheme-level fallbacks for the
    // non-zoned manual path and the surface_tag chip.
    const dominant     = zones.slice().sort((a, b) => (+b.area_m2 || 0) - (+a.area_m2 || 0))[0];
    const dominantMill = +dominant?.milling_depth_mm || +dominant?.depth_mm || 40;

    const anyBinder  = surfaceFromZones.some(z => z.needsBinder);
    const anyBase    = surfaceFromZones.some(z => z.needsBase);
    const anySubbase = surfaceFromZones.some(z => z.needsSubbase);
    // Subbase depth = max across the zones that include it; typical default
    // 150mm if explicit toggle is set without a depth.
    const subbaseDepth = zones.reduce((max, z) =>
      z.includes_subbase ? Math.max(max, +z.subbase_depth_mm || 0) : max, 0) || 150;

    // Ironworks. iw_sw_* combines manhole + water covers — Scottish Water
    // pricing tag covers both. Footway block introduced in Phase 1; legacy
    // schemes get 0s through deriveDesignFromLegacy until the user populates.
    const cway = design.ironworks?.cway || {};
    const fway = design.ironworks?.fway || {};

    // Kerbs: total length across rows. Tag picked from the first row, with a
    // safe fallback. Phase 4+ will move kerbs to a per-row line-builder so
    // mixed types coexist; for now the engine still emits a single kerb line.
    const kerbTotal = (design.kerbs || []).reduce((t, k) => t + (+k.length_m || 0), 0);

    // Lining → Series 1200. Linear items feed line_marks_m (continuous
    // 100mm tag); area items feed markings_area (hatchings, boxes, symbols).
    const lining   = design.lining || [];
    const liningM  = lining.filter(r => r.unit === 'm').reduce((t, r) => t + (+r.quantity || 0), 0);
    const liningM2 = lining.filter(r => r.unit === 'm²').reduce((t, r) => t + (+r.quantity || 0), 0);

    const tm = design.tm || {};
    const footway = design.footway || {};

    return {
      carriageway_area:  +s.carriageway_area_m2 || 0,
      footway_area:      +s.footway_area_m2     || 0,
      // Footway surface tag is opt-in — empty means no fw_surface line.
      // The engine's existing default (`fw_ac6_30`) only fires when this
      // is non-empty AND footway_area > 0.
      fw_surface_tag:    footway.surface_tag || '',
      include_fw_subbase: !!footway.include_subbase,
      surface_tag:       matchSurfaceTag(dominant?.surface || ''),
      include_binder:    anyBinder,
      include_base:      anyBase,
      include_subbase:   anySubbase,
      subbase_depth:     subbaseDepth,
      milling_depth:     snapMillingDepth(dominantMill),
      include_milling:   true,
      include_tack:      true,
      kerb_length:       kerbTotal,
      iw_sw_cway:        (+cway.mh || 0) + (+cway.water || 0),
      iw_bt_cway:        +cway.bt  || 0,
      iw_gas_cway:       +cway.gas || 0,
      iw_gully_cway:     +cway.gullies || 0,
      iw_sw_fw:          (+fway.mh || 0) + (+fway.water || 0),
      iw_bt_fw:          +fway.bt  || 0,
      iw_gas_fw:         +fway.gas || 0,
      include_markings:   liningM2 > 0,
      markings_area:      liningM2,
      include_line_marks: liningM  > 0,
      line_marks_m:       liningM,
      tm_type:           mapSchemeTmType(tm.type),
      include_diversion: /diversion/i.test(tm.type || ''),
      // Designer-set duration wins over the date-based count, falling back
      // to 1 day (not 5) when neither is available so a bare date_start
      // doesn't masquerade as a real one-week duration.
      duration_days:     tm.duration_days != null ? +tm.duration_days : (wd != null ? wd : 1),
      milling_entries:   zones.length ? millingFromZones : [{ depth: snapMillingDepth(dominantMill), area: null }],
      surface_zones:     zones.length ? surfaceFromZones : null,
    };
  }

  // Effective quick inputs are now sourced purely from the Treatment
  // Designer's data model — the per-field override layer the old Quick
  // Input rail managed has been removed (Phase 4). Pre-Phase-4 schemes
  // may still have boq.overrides / boq.quick_inputs persisted; they're
  // ignored by the engine but kept on disk so a future cleanup can
  // surface or purge them in one place.
  function effectiveQuickInputs(scheme, _boq) {
    return deriveQuickInputsFromScheme(scheme);
  }

  window.BOQ_ENGINE = {
    MATERIALS: {
      SURFACE_OPTIONS, BINDER_OPTIONS, BASE_OPTIONS,
      FOOTWAY_SURFACE_OPTIONS, KERB_OPTIONS, MILLING_DEPTHS,
    },
    fmtGBP, fmtGBP0, fmtQty, fmtPct, uid, snapMillingDepth, matchSurfaceTag, seriesOf,
    regenAutoLines, buildBoQLines,
    deriveQuickInputsFromScheme, effectiveQuickInputs,
    mapSchemeTmType, computeWorkingDays, isSevenDayPattern,
  };
})();
