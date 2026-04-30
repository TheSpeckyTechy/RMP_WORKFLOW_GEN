// ─── rn39logic.js ────────────────────────────────────────────────────────────
// Pure design-logic helpers for Road Note 39 / RSTA Pocket Guide 7th Ed.
// Reads tables from window.RN39; exposes itself as window.RN39_LOGIC.
// ─────────────────────────────────────────────────────────────────────────────
window.RN39_LOGIC = (function () {
const R = window.RN39;

function seasonFromMonth(month) { const m = parseInt(month); return (m === 8 || m === 9) ? 'late' : 'early'; }

function getCurrentSchemeRef() {
  const now = new Date(); const y = now.getFullYear() % 100; const m = now.getMonth();
  const y1 = m >= 3 ? y : y - 1; const y2 = (y1 + 1) % 100;
  const pad = (n) => String((n + 100) % 100).padStart(2, '0');
  return `SD ${pad(y1)}-${pad(y2)}`;
}

function getTrafficCategory(cvDay) {
  const n = parseFloat(cvDay); if (isNaN(n)) return null;
  return R.TRAFFIC_CATEGORIES.find(t => n >= t.min && n <= t.max) || null;
}

function getTempCategory(location) { return R.LOCATION_TEMP_CAT[location] || 'C/D'; }

function correctProbeDepth(rhProbeDepth, rhProbeTemp) {
  const d = parseFloat(rhProbeDepth); const t = parseFloat(rhProbeTemp);
  if (isNaN(d)) return null; if (isNaN(t)) return d;
  return +(d + 0.07 * (20 - t)).toFixed(2);
}

function getProbeHardness(rhProbeDepth, rhProbeTemp = 20) {
  const corrected = correctProbeDepth(rhProbeDepth, rhProbeTemp);
  if (corrected == null) return null;
  return R.HARDNESS_FROM_PROBE(corrected);
}

function getSuitability(scheme, trafficCat) {
  if (!trafficCat) return null;
  const code = R.SUITABILITY_MATRIX[scheme.surfaceCondition]?.[trafficCat.cat];
  return code ? Object.assign({ code }, R.SUITABILITY_KEY[code]) : null;
}

function recommendDressing(scheme, trafficCat) {
  if (!trafficCat) return null;
  const cat = trafficCat.cat;
  const speed = parseInt(scheme.trafficSpeed) || 30;
  const isLight = ['G', 'H'].includes(cat);
  const isHeavy = ['A', 'B', 'C', 'D', 'E', 'F'].includes(cat);
  const tightCurve = scheme.radiusCurvature === 'under100' || scheme.radiusCurvature === '100to250';
  const steepGrad = scheme.gradientMag === 'gt10';
  const isApproach = scheme.junctionCrossing === 'approach';

  if (scheme.highStressBraking) {
    return { type: 'hfs', label: 'High Friction Surfacing',
      reason: 'High-stress braking zone — surface dressing not appropriate. Use HFS instead.' };
  }
  if (isLight) {
    if (tightCurve || steepGrad || speed >= 50 || isApproach) {
      return { type: 'racked', label: 'Racked-in (intermediate binder)',
        reason: 'Light traffic but high-stress features. Racked-in or double dressing recommended (Fig. 8.3a).' };
    }
    if (['Soft', 'Very Soft'].includes(scheme.hardness)) {
      return { type: 'racked', label: 'Racked-in or sandwich',
        reason: 'Soft/very soft hardness — racked-in or sandwich preferred (Fig. 8.3a).' };
    }
    if (scheme.hardness === 'Variable' || scheme.surfaceCondition.includes('variable') || scheme.surfaceCondition.includes('patching') || scheme.surfaceCondition.includes('Fatting')) {
      return { type: 'sandwich', label: 'Sandwich, inverted, or double dressing',
        reason: 'Variable / patched / fatted surface — sandwich or double dressing preferred (Fig. 8.3a).' };
    }
    if (cat === 'H' && ['Very Hard', 'Hard', 'Normal'].includes(scheme.hardness)) {
      return { type: 'single', label: 'Single SD with unmodified binder',
        reason: 'Easy site conditions, light traffic, hard/normal homogeneous surface (Fig. 8.3a).' };
    }
    return { type: 'single', label: 'Single SD with intermediate binder',
      reason: 'Light traffic, hard/normal homogeneous surface (Fig. 8.3a).' };
  }
  if (isHeavy) {
    if (scheme.hardness === 'Very Hard' && ['A', 'B', 'C'].includes(cat)) {
      return { type: 'inverted', label: 'Inverted Double with intermediate/premium binder',
        reason: 'Heavy traffic on very hard surface — inverted double creates a false base for embedment (Fig. 8.3b).' };
    }
    if (['Very Hard', 'Hard', 'Normal'].includes(scheme.hardness) && ['A', 'B', 'C'].includes(cat)) {
      if (tightCurve || steepGrad || isApproach) {
        return { type: 'double', label: 'Double SD with premium / super-premium binder',
          reason: 'Heavy traffic + bends/gradient/junction. Premium-grade binder per RN39 Fig. 8.3b note 2.' };
      }
      return { type: 'racked', label: 'Racked-in with premium binder',
        reason: 'Heavy traffic, hard/normal homogeneous. Premium binder; double dressing where noise is a concern (Fig. 8.3b).' };
    }
    if (['Soft', 'Very Soft', 'Variable'].includes(scheme.hardness)) {
      return { type: 'racked', label: 'Racked-in or double SD',
        reason: 'Soft/variable hardness with heavy traffic — racked-in or double recommended (Fig. 8.3b).' };
    }
    return { type: 'racked', label: 'Racked-in or double SD',
      reason: 'Heavy traffic — racked-in or double dressing recommended (Fig. 8.3b).' };
  }
  return { type: 'single', label: 'Single SD', reason: 'Default recommendation.' };
}

function getActiveType(scheme, recommendation) {
  return scheme.dressingType === 'auto' ? recommendation?.type : scheme.dressingType;
}

function getBaseDesign(scheme, trafficCat, activeType) {
  if (!trafficCat || !activeType || activeType === 'hfs') return null;
  const hardnessKey = scheme.hardness.replace(/\s/g, '');
  const tables = { single: R.SINGLE_DRESSING, racked: R.RACKED_IN, double: R.DOUBLE_DRESSING, inverted: R.INVERTED_DOUBLE, sandwich: R.SANDWICH };
  return tables[activeType]?.[hardnessKey]?.[trafficCat.cat] ?? null;
}

function getTotalAdjustment(scheme) {
  let adj = 0; let expert = false; const components = {};
  const apply = (key, v) => {
    if (v === 'expert') { expert = true; components[key] = 'expert'; }
    else if (typeof v === 'number') { adj += v; components[key] = v; }
  };
  apply('season', R.ADJUSTMENTS.season[seasonFromMonth(scheme.installMonth)]);
  apply('aggregate', R.ADJUSTMENTS.aggregate[scheme.aggregate]);
  apply('shape', R.ADJUSTMENTS.shape[scheme.shape]);
  apply('shade', R.ADJUSTMENTS.shade[scheme.shade]);
  apply('condition', R.ADJUSTMENTS.condition[scheme.condition]);
  const gradMag = R.ADJUSTMENTS.gradient_mag[scheme.gradientMag] ?? 0;
  if (scheme.gradientDir === 'uphill') apply('gradient', -gradMag); else apply('gradient', gradMag);
  apply('speed', R.ADJUSTMENTS.speed[scheme.speed]);
  apply('localTraffic', R.ADJUSTMENTS.localTraffic[scheme.localTraffic]);
  const capped = Math.max(-0.2, Math.min(0.4, adj));
  return { raw: adj, capped, expert, wasCapped: adj !== capped, components };
}

function getFinalRates(baseDesign, totalAdjustment, activeType) {
  if (!baseDesign || typeof baseDesign === 'string') return null;
  if (activeType === 'double' || activeType === 'inverted' || activeType === 'sandwich') {
    return {
      l1: +(baseDesign.l1 + (activeType === 'sandwich' ? 0 : totalAdjustment.capped)).toFixed(2),
      l2: +(baseDesign.l2 + totalAdjustment.capped).toFixed(2),
      size: baseDesign.size,
    };
  }
  return { binder: +(baseDesign.binder + totalAdjustment.capped).toFixed(2), size: baseDesign.size };
}

function getChippingSpread(finalRates) {
  if (!finalRates?.size) return null;
  const primary = finalRates.size.split('/')[0];
  const nominal = R.SIZE_CODE_MAP[primary];
  return nominal ? Object.assign({ nominal }, R.CHIPPING_SPREAD[nominal]) : null;
}

function getChippingTonnes(chippingSpread, areaM2) {
  if (!chippingSpread || !areaM2) return null;
  const area = parseFloat(areaM2); if (isNaN(area)) return null;
  const midRate = (chippingSpread.min + chippingSpread.max) / 2;
  return ((area * midRate) / 1000).toFixed(2);
}

function getSeasonalRisk(finalRates, scheme) {
  if (!finalRates?.size || !scheme) return null;
  const primary = finalRates.size.split('/')[0];
  const cat = R.LOCATION_TEMP_CAT[scheme.location];
  return R.SEASON_DATA[cat]?.[primary]?.[scheme.installMonth - 1] ?? null;
}

function getMatchingItems(finalRates, activeType, series700) {
  if (!finalRates?.size || !activeType || activeType === 'hfs') return [];
  const primary = finalRates.size.split('/')[0];
  const typePrefix = activeType === 'single' ? 'S' : activeType === 'racked' ? 'R' : 'D';
  return series700.filter(item => item.size[0] === typePrefix && item.size === primary);
}

function pickDefaultItem(matchingItems, scheme) {
  if (!matchingItems.length) return null;
  const psvNum = parseInt(scheme.minPSV) >= 65 ? 65 : 60;
  const grade = scheme.binderGrade === 'superpremium' ? 'premium' : scheme.binderGrade;
  let best = matchingItems.find(i => i.desc.includes(`PSV${psvNum}+`) && i.desc.toLowerCase().includes(grade));
  if (!best) best = matchingItems.find(i => i.desc.includes(`PSV${psvNum}+`));
  if (!best) best = matchingItems[0];
  return best || null;
}

function validateForProforma(scheme) {
  const missing = [];
  if (!scheme.siteName?.trim()) missing.push('Site / Section Location');
  if (!scheme.length || parseFloat(scheme.length) <= 0) missing.push('Length');
  if (!scheme.width || parseFloat(scheme.width) <= 0) missing.push('Width');
  if (!scheme.cvDay) missing.push('Medium/Heavy Traffic (cv/lane/day)');
  if (scheme.rhProbeDepth === '' || scheme.rhProbeDepth == null) missing.push('RH Probe Depth');
  if (!scheme.designerName?.trim()) missing.push('Designer name');
  return missing;
}

function fmtAdj(v) {
  if (v === undefined) return '';
  if (v === 'expert') return 'EXP';
  if (typeof v !== 'number') return '';
  if (v === 0) return '0';
  return (v > 0 ? '+' : '') + v.toFixed(1);
}

return { seasonFromMonth, getCurrentSchemeRef, getTrafficCategory, getTempCategory, correctProbeDepth, getProbeHardness, getSuitability, recommendDressing, getActiveType, getBaseDesign, getTotalAdjustment, getFinalRates, getChippingSpread, getChippingTonnes, getSeasonalRisk, getMatchingItems, pickDefaultItem, validateForProforma, fmtAdj };
})();
