// boq_rates.js — Embedded TC rate schedule (Tayside Contracts, JMCA BoQ)
// Source: Clepington Road / Lochee Road / Overton-Netherton BoQ workbooks.
// Three area-band rates per item: A (small), B (medium), C (large).
// Band thresholds vary by series — see bandThresholds per series.
// All rates in GBP (£).

window.BOQ_RATES = {

  // ── Series 100: Preliminaries ─────────────────────────────────────────────
  // Flat rate items (no area bands); rateA = TC rate used directly.
  s100: {
    title: 'Preliminaries',
    items: [
      // ── Full road closure (Type 1) ──
      { id:'1/009', desc:'Erect pedestrian & traffic safety measures — full road closure (Type 1)', unit:'Day', rateA:629.20, rateB:629.20, rateC:629.20, tag:'tm_closure_day' },

      // ── Diversion route ──
      { id:'1/023', desc:'Erection of temporary diversion route', unit:'Item', rateA:393.25, rateB:393.25, rateC:393.25, tag:'tm_diversion_erect' },
      { id:'1/024', desc:'Maintenance of temporary diversion route', unit:'Day', rateA:121.00, rateB:121.00, rateC:121.00, tag:'tm_diversion_day' },
      { id:'1/025', desc:'Removal of temporary diversion route', unit:'Item', rateA:393.25, rateB:393.25, rateC:393.25, tag:'tm_diversion_remove' },

      // ── Portable traffic signals ──
      { id:'1/070', desc:'Erection of portable traffic signals', unit:'Item', rateA:302.50, rateB:302.50, rateC:302.50, tag:'tm_pts_erect' },
      { id:'1/071', desc:'Maintenance of portable traffic signals', unit:'Day', rateA:42.35, rateB:42.35, rateC:42.35, tag:'tm_pts_day' },
      { id:'1/072', desc:'Removal of portable traffic signals', unit:'Item', rateA:302.50, rateB:302.50, rateC:302.50, tag:'tm_pts_remove' },

      // ── Stop/Go boards ──
      { id:'1/061', desc:'Erection of Stop/Go boards system', unit:'Item', rateA:121.00, rateB:121.00, rateC:121.00, tag:'tm_sg_erect' },
      { id:'1/062', desc:'Maintenance of Stop/Go boards system', unit:'Day', rateA:629.20, rateB:629.20, rateC:629.20, tag:'tm_sg_day' },
      { id:'1/063', desc:'Removal of Stop/Go boards system', unit:'Item', rateA:121.00, rateB:121.00, rateC:121.00, tag:'tm_sg_remove' },

      // ── Works on footways ──
      { id:'1/098', desc:'Erection of Works on Footways layout', unit:'Item', rateA:272.25, rateB:272.25, rateC:272.25, tag:'tm_fw_erect' },
      { id:'1/099', desc:'Maintenance of Works on Footways layout', unit:'Day', rateA:48.40, rateB:48.40, rateC:48.40, tag:'tm_fw_day' },
      { id:'1/100', desc:'Removal of Works on Footways layout', unit:'Item', rateA:272.25, rateB:272.25, rateC:272.25, tag:'tm_fw_remove' },
    ]
  },

  // ── Series 700: Pavements ─────────────────────────────────────────────────
  // Carriageway surfacing. Band thresholds in m²: <500 | 500-5000 | >5000
  // Milling bands: <500 | 500-5000 | >5000 m²
  // Sub-base bands in m³: <50 | 50-500 | >500
  s700: {
    title: 'Pavements',
    bandThresholds: [500, 5000],
    items: [
      // ── Surface courses ──
      { id:'7/027', desc:'AC 14 close surf 100/150 40mm — carriageway', unit:'m²', rateA:21.12, rateB:13.37, rateC:13.31, tag:'surf_ac14_40' },
      { id:'7/029', desc:'AC 10 close surf 100/150 40mm — carriageway', unit:'m²', rateA:20.85, rateB:13.16, rateC:13.09, tag:'surf_ac10_40' },
      { id:'7/031', desc:'AC 14 high binder content close surf 100/150 40mm — carriageway', unit:'m²', rateA:20.89, rateB:13.19, rateC:13.13, tag:'surf_ac14hb_40' },
      { id:'7/033', desc:'AC 10 high binder content close surf 100/150 40mm — carriageway', unit:'m²', rateA:21.31, rateB:13.60, rateC:13.54, tag:'surf_ac10hb_40' },
      { id:'7/035', desc:'HRA 30/14F surf 40/60 40mm with 20mm coated chippings — carriageway', unit:'m²', rateA:28.03, rateB:17.30, rateC:17.24, tag:'surf_hra3014_40_20' },
      { id:'7/037', desc:'HRA 30/14F surf 40/60 40mm with 14mm coated chippings — carriageway', unit:'m²', rateA:28.03, rateB:17.30, rateC:17.24, tag:'surf_hra3014_40_14' },
      { id:'7/045', desc:'HRA 35/14F surf 40/60 45mm with 14mm coated chippings — carriageway', unit:'m²', rateA:25.83, rateB:18.54, rateC:18.45, tag:'surf_hra3514_45_14' },
      { id:'7/043', desc:'HRA 35/14F surf 40/60 45mm with 20mm coated chippings — carriageway', unit:'m²', rateA:29.09, rateB:19.00, rateC:18.87, tag:'surf_hra3514_45_20' },
      { id:'7/053', desc:'SMA 10 surf 40/60 40mm — carriageway', unit:'m²', rateA:23.39, rateB:15.64, rateC:15.58, tag:'surf_sma10_40' },
      { id:'7/055', desc:'AC 6 SMA surf 100/150 30mm — carriageway', unit:'m²', rateA:20.29, rateB:12.55, rateC:12.49, tag:'surf_sma6_30' },
      { id:'7/059', desc:'HRA 55/10 C surf 100/150 PSV 65 40mm — carriageway', unit:'m²', rateA:22.26, rateB:14.54, rateC:14.44, tag:'surf_hra5510_40' },
      { id:'7/057', desc:'AC 6 dense surf 160/220 30mm — carriageway', unit:'m²', rateA:18.26, rateB:10.87, rateC:10.80, tag:'surf_ac6_30' },

      // ── Binder courses ──
      { id:'7/019', desc:'AC 20 dense bin 40/60 60mm — carriageway', unit:'m²', rateA:23.05, rateB:16.63, rateC:16.56, tag:'bin_ac20d_60' },
      { id:'7/021', desc:'AC 20 HDM bin 40/60 60mm — carriageway', unit:'m²', rateA:23.41, rateB:16.99, rateC:16.92, tag:'bin_ac20hdm_60' },
      { id:'7/023', desc:'HRA 50/20 bin 40/60 60mm — carriageway', unit:'m²', rateA:27.99, rateB:21.49, rateC:21.43, tag:'bin_hra5020_60' },
      { id:'7/025', desc:'AC 20 cold bound binder course 60mm — carriageway', unit:'m²', rateA:22.24, rateB:15.84, rateC:15.77, tag:'bin_ac20cb_60' },
      { id:'7/017', desc:'AC 20 cold bound binder course 100mm — carriageway', unit:'m²', rateA:29.98, rateB:23.41, rateC:23.34, tag:'bin_ac20cb_100' },

      // ── Base courses ──
      { id:'7/009', desc:'AC 32 dense base 40/60 100mm — carriageway', unit:'m²', rateA:30.87, rateB:24.28, rateC:24.25, tag:'base_ac32d_100' },
      { id:'7/007', desc:'AC 32 dense base 40/60 150mm — carriageway', unit:'m²', rateA:41.44, rateB:36.39, rateC:36.34, tag:'base_ac32d_150' },
      { id:'7/005', desc:'AC 32 dense base 40/60 200mm — carriageway', unit:'m²', rateA:51.68, rateB:50.10, rateC:50.06, tag:'base_ac32d_200' },
      { id:'7/015', desc:'AC 32 HDM base 40/60 100mm — carriageway', unit:'m²', rateA:31.70, rateB:25.09, rateC:25.06, tag:'base_ac32hdm_100' },
      { id:'7/013', desc:'AC 32 HDM base 40/60 150mm — carriageway', unit:'m²', rateA:42.65, rateB:38.15, rateC:37.55, tag:'base_ac32hdm_150' },
      { id:'7/011', desc:'AC 32 HDM base 40/60 200mm — carriageway', unit:'m²', rateA:52.65, rateB:50.09, rateC:50.05, tag:'base_ac32hdm_200' },

      // ── Sub-base (per m³, bands in m³: <50 | 50-500 | >500) ──
      { id:'7/001', desc:'Granular type 1 sub-base — carriageway', unit:'m³', rateA:55.45, rateB:37.44, rateC:37.44, bandThresholds:[50,500], tag:'subbase_t1' },
      { id:'7/003', desc:'Granular recycled type 1 sub-base — carriageway', unit:'m³', rateA:52.45, rateB:34.53, rateC:34.53, bandThresholds:[50,500], tag:'subbase_rt1' },

      // ── Tack coat ──
      { id:'7/104', desc:'PMBE bond coat (tack coat) 0.65–0.85 l/m²', unit:'m²', rateA:1.24, rateB:1.24, rateC:1.24, tag:'tack' },

      // ── Milling ──
      { id:'7/105', desc:'Cold milling 25mm deep', unit:'m²', rateA:7.85, rateB:2.16, rateC:1.81, tag:'mill_25' },
      { id:'7/106', desc:'Cold milling 40mm deep', unit:'m²', rateA:7.85, rateB:2.39, rateC:2.04, tag:'mill_40' },
      { id:'7/107', desc:'Cold milling 50mm deep', unit:'m²', rateA:8.31, rateB:2.60, rateC:2.25, tag:'mill_50' },
      { id:'7/108', desc:'Cold milling 60mm deep', unit:'m²', rateA:8.31, rateB:4.18, rateC:3.41, tag:'mill_60' },
      { id:'7/109', desc:'Cold milling 70mm deep', unit:'m²', rateA:8.31, rateB:4.18, rateC:3.34, tag:'mill_70' },
      { id:'7/110', desc:'Cold milling 80mm deep', unit:'m²', rateA:9.18, rateB:4.41, rateC:3.34, tag:'mill_80' },
      { id:'7/111', desc:'Cold milling 100mm deep', unit:'m²', rateA:9.18, rateB:5.04, rateC:4.43, tag:'mill_100' },
      { id:'7/112', desc:'Cold milling 150mm deep', unit:'m²', rateA:10.16, rateB:7.49, rateC:6.59, tag:'mill_150' },
      { id:'7/113', desc:'Cold milling 200mm deep', unit:'m²', rateA:11.88, rateB:9.92, rateC:8.76, tag:'mill_200' },

      // ── Regulating ──
      { id:'7/070', desc:'HRA 30/14F surf reg 40/60 — regulating course', unit:'m³', rateA:439.94, rateB:380.23, rateC:380.04, tag:'reg_hra3014' },
      { id:'7/063', desc:'AC 32 dense base reg 40/60 — regulating course', unit:'m³', rateA:315.31, rateB:271.68, rateC:271.36, tag:'reg_ac32d' },
      { id:'7/065', desc:'AC 20 dense bin reg 40/60 — regulating course', unit:'m³', rateA:309.31, rateB:265.91, rateC:265.61, tag:'reg_ac20d' },

      // ── Surface dressing ──
      { id:'7/084', desc:'Single surface dressing 10mm agg 12kg/m² intermediate binder 1.8 l/m²', unit:'m²', rateA:17.98, rateB:4.63, rateC:4.07, tag:'sd_10mm_int' },
      { id:'7/085', desc:'Single surface dressing 10mm agg 12kg/m² premium binder 1.8 l/m²', unit:'m²', rateA:17.52, rateB:4.76, rateC:4.19, tag:'sd_10mm_prem' },
      { id:'7/086', desc:'Single surface dressing 6mm agg 9kg/m² intermediate binder 1.6 l/m²', unit:'m²', rateA:17.62, rateB:4.27, rateC:3.70, tag:'sd_6mm_int' },
    ]
  },

  // ── Series 1100: Footways & Paved Areas ───────────────────────────────────
  s1100: {
    title: 'Footways & Paved Areas',
    items: [
      // ── Kerbs ──
      { id:'11/001', desc:'Precast concrete half batter kerb K1 — laid', unit:'m', rateA:90.25, rateB:90.25, rateC:90.25, tag:'kerb_k1_laid' },
      { id:'11/002', desc:'Precast concrete half batter kerb K1 — raised', unit:'m', rateA:99.76, rateB:99.76, rateC:99.76, tag:'kerb_k1_raised' },
      { id:'11/003', desc:'Precast concrete transition kerb K2 — laid', unit:'m', rateA:102.29, rateB:102.29, rateC:102.29, tag:'kerb_k2_laid' },
      { id:'11/004', desc:'Precast concrete transition kerb K2 — raised', unit:'m', rateA:107.69, rateB:107.69, rateC:107.69, tag:'kerb_k2_raised' },
      { id:'11/005', desc:'Precast concrete bullnose kerb K3 — laid', unit:'m', rateA:82.23, rateB:82.23, rateC:82.23, tag:'kerb_k3_laid' },

      // ── Footway surfacing (m²) ──
      { id:'11/194', desc:'AC 6 close surf 100/150 20mm — footway', unit:'m²', rateA:53.66, rateB:53.66, rateC:53.66, tag:'fw_ac6_20' },
      { id:'11/195', desc:'AC 6 close surf 100/150 30mm — footway', unit:'m²', rateA:56.30, rateB:56.30, rateC:56.30, tag:'fw_ac6_30' },
      { id:'11/196', desc:'AC 10 close surf 100/150 30mm — footway', unit:'m²', rateA:56.31, rateB:56.31, rateC:56.31, tag:'fw_ac10_30' },
      { id:'11/197', desc:'HRA 15/6F surf 40/60 20mm — footway', unit:'m²', rateA:54.86, rateB:54.86, rateC:54.86, tag:'fw_hra156_20' },
      { id:'11/198', desc:'HRA 15/6F surf 40/60 30mm — footway', unit:'m²', rateA:58.08, rateB:58.08, rateC:58.08, tag:'fw_hra156_30' },
      { id:'11/199', desc:'HRA 15/10F surf 40/60 30mm — footway', unit:'m²', rateA:58.09, rateB:58.09, rateC:58.09, tag:'fw_hra1510_30' },

      // ── Footway sub-base ──
      { id:'11/170', desc:'Granular type 1 sub-base 100mm — footway', unit:'m²', rateA:12.46, rateB:12.46, rateC:12.46, tag:'fw_subbase_100' },
      { id:'11/172', desc:'Granular type 1 sub-base 150mm — footway', unit:'m²', rateA:16.55, rateB:16.55, rateC:16.55, tag:'fw_subbase_150' },
    ]
  },

  // ── Series 1200: Traffic Signs & Road Markings ────────────────────────────
  s1200: {
    title: 'Traffic Signs & Road Markings',
    items: [
      { id:'12/146', desc:'Continuous line white thermoplastic 75mm wide', unit:'m', rateA:9.55, rateB:9.55, rateC:9.55, tag:'mark_cont_75' },
      { id:'12/149', desc:'Continuous line white thermoplastic 100mm wide', unit:'m', rateA:9.55, rateB:9.55, rateC:9.55, tag:'mark_cont_100' },
      { id:'12/150', desc:'Continuous line white thermoplastic 150mm wide', unit:'m', rateA:9.72, rateB:9.72, rateC:9.72, tag:'mark_cont_150' },
      { id:'12/148', desc:'Continuous line white thermoplastic 50mm wide', unit:'m', rateA:9.51, rateB:9.51, rateC:9.51, tag:'mark_cont_50' },
      { id:'12/154', desc:'Intermittent line white thermoplastic 50mm 600/600', unit:'m', rateA:9.51, rateB:9.51, rateC:9.51, tag:'mark_int_50_600' },
      { id:'12/155', desc:'Intermittent line white thermoplastic 50mm 600/2400', unit:'m', rateA:9.51, rateB:9.51, rateC:9.51, tag:'mark_int_50_2400' },
      { id:'12/147', desc:'Solid area white thermoplastic (hatching, box junctions etc.)', unit:'m²', rateA:16.02, rateB:16.02, rateC:16.02, tag:'mark_area' },
    ]
  },

  // ── Series 2700: Accommodation Works ─────────────────────────────────────
  s2700: {
    title: 'Accommodation Works',
    items: [
      // Scottish Water covers — carriageway
      { id:'2700/07', desc:'Raise Scottish Water cover & frame — carriageway (≤0.25m²)', unit:'No', rateA:137.35, rateB:137.35, rateC:137.35, tag:'iw_sw_cway' },
      // SSE/electricity covers — carriageway
      { id:'2700/23', desc:'Raise SSE (electricity) cover & frame — carriageway (≤0.25m²)', unit:'No', rateA:131.13, rateB:131.13, rateC:131.13, tag:'iw_sse_cway' },
      // BT covers — carriageway
      { id:'2700/43', desc:'Raise BT cover & frame — carriageway (≤0.25m²)', unit:'No', rateA:659.61, rateB:659.61, rateC:659.61, tag:'iw_bt_cway' },
      // Scottish Water covers — footway
      { id:'2700/01', desc:'Raise Scottish Water cover & frame — footway (≤0.25m²)', unit:'No', rateA:100.04, rateB:100.04, rateC:100.04, tag:'iw_sw_fw' },
      // SSE covers — footway
      { id:'2700/13', desc:'Raise SSE (electricity) cover & frame — footway (≤0.25m²)', unit:'No', rateA:100.04, rateB:100.04, rateC:100.04, tag:'iw_sse_fw' },
      // BT covers — footway
      { id:'2700/33', desc:'Raise BT cover & frame — footway (≤0.25m²)', unit:'No', rateA:410.92, rateB:410.92, rateC:410.92, tag:'iw_bt_fw' },
    ]
  },
};

// Helper: pick rate band for a given measurement and thresholds
window.boqPickRate = function(item, measurement) {
  const thresholds = item.bandThresholds || [500, 5000];
  if (measurement < thresholds[0]) return item.rateA;
  if (measurement < thresholds[1]) return item.rateB;
  return item.rateC;
};

// Lookup item by tag across all series
window.boqItem = function(tag) {
  for (const s of Object.values(window.BOQ_RATES)) {
    const found = s.items.find(i => i.tag === tag);
    if (found) return found;
  }
  return null;
};
