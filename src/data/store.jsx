// Complete scheme data model with every named range from the Master Workbook
window.WARDS = [
  { num: 1, name: "Strathmartine", councillors: [
    { title: "Councillor", name: "Kevin Keenan", party: "Lab" },
    { title: "Councillor", name: "Alan Ross", party: "SNP" },
    { title: "Bailie", name: "Willie Sawers", party: "SNP" },
  ]},
  { num: 2, name: "Lochee", councillors: [
    { title: "Councillor", name: "Charlie Malone", party: "Lab" },
    { title: "Councillor", name: "Siobhan Tolland", party: "SNP", role: "Depute Convener of City Development" },
    { title: "Bailie", name: "Michael Marra", party: "Lab" },
    { title: "Councillor", name: "Ken Lynn", party: "SNP" },
  ]},
  { num: 3, name: "Coldside", councillors: [
    { title: "Councillor", name: "George McIrvine", party: "SNP" },
    { title: "Councillor", name: "Mark Flynn", party: "SNP" },
    { title: "Bailie", name: "Helen Wright", party: "Lab" },
  ]},
  { num: 4, name: "Maryfield", councillors: [
    { title: "Councillor", name: "Lynne Short", party: "SNP" },
    { title: "Councillor", name: "Craig Duncan", party: "LD" },
    { title: "Bailie", name: "Stewart Hunter", party: "SNP" },
  ]},
  { num: 5, name: "North East", councillors: [
    { title: "Councillor", name: "Steven Rome", party: "SNP", role: "Convener of City Development" },
    { title: "Councillor", name: "Ken Cox", party: "SNP" },
    { title: "Councillor", name: "Jimmy Black", party: "SNP" },
    { title: "Bailie", name: "Anne Rendall", party: "SNP" },
  ]},
  { num: 6, name: "East End", councillors: [
    { title: "Councillor", name: "Kevin Cordell", party: "SNP" },
    { title: "Councillor", name: "Brian Gordon", party: "Lab" },
    { title: "Bailie", name: "Christina Roberts", party: "SNP" },
  ]},
  { num: 7, name: "The Ferry", councillors: [
    { title: "Councillor", name: "Craig Duncan", party: "LD" },
    { title: "Councillor", name: "Daniel Coleman", party: "SNP" },
    { title: "Bailie", name: "Derek Scott", party: "Con" },
  ]},
  { num: 8, name: "West End", councillors: [
    { title: "Lord Provost", name: "Bill Campbell", party: "SNP", isLordProvost: true },
    { title: "Councillor", name: "Nadia El-Nakla", party: "SNP" },
    { title: "Councillor", name: "Michael Crichton", party: "SNP" },
    { title: "Bailie", name: "Fraser Macpherson", party: "LD" },
  ]},
];

// Default shape for the BoQ tab. Quantities are derived from scheme.design{}
// at render time by the BoQ engine — this record only carries the things
// the BoQ tab itself owns: custom (user-added) lines, recent catalogue
// picks, BERR/VAT/percent-addition settings, and the touched flag that
// gates first-mount auto-line seeding.
window.defaultBoq = () => ({
  // User-added (custom) lines only. Auto-lines are derived from the
  // Designer state at render time and never persisted.
  custom_lines: [],      // [{uid,id,desc,qty,unit,bandOverride?,series,notes?}]
  recent_items: [],      // last ≤20 catalogue picks; pinned at the top of the
                         // catalogue drawer when no search/filter is active.
                         // Each: {seriesKey,id,desc,unit,series,rateA,rateB,rateC}
  settings: {
    useBERR:     false,
    berrIndex:   1.000,
    berrDate:    'May 2022',
    vatRate:     0.20,
    showPWP:     true,
    areaBandOverride: null,
    percentAdditions: {
      ohp:             { enabled: true,  pct: 0.125, label: 'Overheads & Profit' },
      contingency:     { enabled: true,  pct: 0.05,  label: 'Contingency' },
      ois:             { enabled: false, pct: 0.025, label: 'Off-site Items' },
      // Series 6400 uplifts — percentages come from the Tayside JMCA
      // catalogue (Band A, see boq_rates_full.js). Disabled by default so
      // they never apply silently; the BoQ tab toggles them.
      night_uplift:    { enabled: false, pct: 0.20,  label: 'Night-shift uplift (Series 6400/003)' },
      saturday_uplift: { enabled: false, pct: 0.20,  label: 'Saturday uplift (Series 6400/004)' },
      sunday_uplift:   { enabled: false, pct: 0.20,  label: 'Sunday uplift (Series 6400/005)' },
      dundee_area:     { enabled: false, pct: 0.03,  label: 'Dundee City Council area (Series 6400/011)' },
    },
  },
});

// Treatment Designer model — single source of truth for everything that ends
// up in the BoQ. Master holds the canonical totals (carriageway_area_m2,
// footway_area_m2); the designer subdivides them into zones and adds the
// ironworks / kerbs / lining / TM data the BoQ engine quantifies.
window.defaultDesign = () => ({
  zones: [],
  ironworks: {
    cway:  { mh: 0, water: 0, bt: 0, gas: 0, gullies: 0 },
    fway:  { mh: 0, water: 0, bt: 0, gas: 0 },
    raise: { mh: 0, water: 0, bt: 0, gas: 0, gullies: 0 },
  },
  kerbs:  [],
  lining: [],
  tm: {
    type: '',
    hours: '',
    phases: 1,
    diversion_by: '',
    compound: '',
    duration_days: null,
  },
  // Phase 2 designer flips this true on the first user edit, which freezes
  // the persisted shape so SchemeContext stops back-filling from legacy.
  touched: false,
});

// Full scheme record — uses the exact named-range keys from the workbook
const baseScheme = (overrides) => ({
  // 1. Scheme Identity
  scheme_type: "Carriageway",
  road_name: "",
  project_number: "",
  financial_year: "2026/27",
  // Canonical sketch totals. Carriageway and footway are tracked separately
  // so a junction or mixed scheme can populate both. Designer zones must sum
  // to whichever total matches their surface kind (warning, no auto-correct).
  carriageway_area_m2: 0,
  footway_area_m2:     0,
  scheme_extent: "",
  grid_ref: "",
  // Treatment / TM / Ironwork / Kerbs / Lining live exclusively on
  // scheme.design{} (see window.defaultDesign at the bottom of this record).
  // This surface only owns identity + dates + people + budget + ward +
  // correspondence; everything else flows from the Treatment Designer.
  // 2. Key Dates
  date_prepared: "",
  date_approved: "",
  date_start: "",
  date_finish: "",
  // Drives computeWorkingDays in the BoQ engine. Stored as the human label
  // from the Master dropdown; isSevenDayPattern interprets it.
  working_pattern: "Mon–Fri",
  // Informational on the Master / RSR; does not currently affect rates.
  shift_pattern:   "Day",
  // 3. Project Team
  prepared_by: "Jake McAllister",
  designer_email: "jake.mcallister@dundeecity.gov.uk",
  designer_phone: "01382 834028",
  reviewed_by: "Steve Lindsay",
  approved_by: "Steve Lindsay",
  client_officer: "James Mullen",
  client_email: "James.Mullen@dundeecity.gov.uk",
  client_phone: "01382 307921",
  contractor: "Tayside Contracts",
  contractor_ref: "",
  contractor_pe: "",
  contractor_ch: "",
  contractor_ooh: "07767 326827",
  supervisor_name: "",
  supervisor_phone: "",
  supervisor_email: "",
  // 4. Budget
  budget: 0, tender_total: 0, cost_per_m2: 0,
  budget_code: "", cpp_ref: "", drawing_ref: "", sketch_pdf: "", network_length: 0,
  rsr_image_1: "", rsr_image_2: "",
  // 8. Ward & Correspondence
  ward_selected: "",
  ward_num: 1,
  postcode: "",
  postcode_link: "Click to open DCC lookup",
  // 9. PCI-specific (Pre-Construction Information)
  road_category: "C",
  pci_before: "", pci_after: "",
  pci_justification: "",
  pci_description: "",          // free text: full scope incl. areas, depths, materials
  pci_ironwork_summary: "",     // summary line pulled into PCI hazards/scope
  pci_lining_summary: "",       // summary line for lining works
  pci_occupiers: "",            // occupier / tenant info
  // Extra fields for the PCI pro-forma tokens
  client_name_address: "Fiona Welch\nDundee City Council, Executive Director of City Development",
  department: "Sustainable Transport and Roads",
  designer_head_of: "Head of Sustainable Transport and Roads",
  cdm_head_of: "Head of Design and Property",
  client_ref_work_order: "",
  contractor_address: "Contracts House, 1 Soutar Street, Dundee DD3 8SS",
  contractor_email: "",
  pci_site_security: "Heras fencing to be erected around the perimeter of the site to segregate members of the public from the working area and prevent unauthorised access. All excavations to be covered or made safe at all times.",
  welfare_toilet: "Yes",
  welfare_washing: "Yes",
  welfare_rest: "Yes",
  welfare_water: "Yes",
  welfare_changing: "No",
  haz_working_height: "N/A",
  haz_slips: "No unusual slip or trip hazards. Contractor to ensure site is tidy at all times.",
  haz_excavations: "Utilities are present — plans in site file, however accuracy of plans is unreliable. Designs and construction should eliminate potential utility impact by not exceeding 300mm depth where practicable. Trial holes and CAT scanning to be undertaken. All excavations to be made safe when left unattended.",
  haz_structures: "N/A",
  haz_health: "The Construction Phase Plan to include risk assessments, method statements and procedures to protect all personnel working or attending site.",
  haz_asbestos: "N/A",
  haz_public: "Works will be conducted under a road closure and protected in accordance with the Safety at Street Works and Road Works Code of Practice. Pedestrian access for businesses and residents will be maintained at all times. Vehicular access for emergency services will be maintained throughout the duration of the works.",
  haz_environment: "All waste generated through cold milling to be removed from site.",
  haz_other: "Contractor to adhere with latest government guidance relating to site safety.",
  haz_additional: "Contact has been made with each business and resident along the scheme extents. All informed of access restrictions during working hours.",
  cdm_principal_designer: "N/A",
  // Letter content overrides — when non-empty, these replace the auto-derived
  // subject / body text in the resident / business letter preview and mail merge.
  letter_subject_override: "",
  letter_body_override: "",
  // Utility search tracker — maps utility name to ISO applied date string
  utility_applied: {},
  // Bill of Quantities — new structured model (Stage 3+). See defaultBoq()
  // above for shape. SchemeContext back-fills this for schemes loaded from
  // pre-v2 storage.
  boq: window.defaultBoq(),
  // Treatment Designer state (Phase 1+). SchemeContext back-fills this from
  // legacy fields (treatments[], iron_*, kerb_length, tm_*) on load so old
  // schemes get a populated design{} without manual migration.
  design: window.defaultDesign(),
  // Meta
  status: "design",
  packProgress: 0,
  packTotal: 14,
  lastUpdated: "today",
  flags: [],
  docs_generated: {},
  ...overrides,
});

window.baseScheme = baseScheme;

// Total scheme footprint in m² — sum of carriageway + footway. Use anywhere
// a single "scheme area" number is shown (Dashboard tile, BoQ chip, £/m²
// denominator, etc.). For BoQ-engine math that needs the two split out, read
// the underlying fields directly.
window.schemeArea = (s) => (+s?.carriageway_area_m2 || 0) + (+s?.footway_area_m2 || 0);

// Dominant zone's surface treatment (largest by area), or empty. Replaces
// the legacy scheme.treatment_type field for headers, exports, and any
// other "name the treatment" surface.
window.schemeTreatment = (s) => {
  const zones = (s?.design?.zones || []).filter(z => +z.area_m2 > 0);
  const dom = zones.slice().sort((a, b) => (+b.area_m2 || 0) - (+a.area_m2 || 0))[0];
  return dom?.surface || '';
};

// TM fields lifted from scheme.design.tm with safe defaults, mirroring the
// shape the old scheme.tm_* fields had so consumers can swap inline.
window.schemeTM = (s) => ({
  type:         s?.design?.tm?.type         || '',
  hours:        s?.design?.tm?.hours        || '',
  phases:       +s?.design?.tm?.phases      || 1,
  diversion_by: s?.design?.tm?.diversion_by || '',
  compound:     s?.design?.tm?.compound     || '',
});

window.SCHEMES = [
  baseScheme({
    id: "R5008",
    road_name: "Clepington Road",
    project_number: "R6016",
    scheme_extent: "Balgray Pl to Hindmarsh Ave",
    grid_ref: "340227 732142",
    carriageway_area_m2: 2370,
    treatment_type: "HRA 30/14F surf 40/60",
    surface_depth_mm: 40, binder_depth_mm: 50, subbase_depth_mm: 10, total_depth_mm: 100,
    traffic_category: "Medium-High",
    matrix: { traffic:"Heavy", bus_stops:"1–2", junctions:"Minor", turning:"Occasional", parking:"No", condition:"Poor", cracking:"Block", rutting:"5–15mm" },
    treatments: [
      { id:1, zone:"40mm inlay — main carriageway", area_m2:805,  depth_mm:40,  treatment_type:"HRA 30/14F surf 40/60" },
      { id:2, zone:"100mm deep inlay — junction areas", area_m2:1565, depth_mm:100, treatment_type:"HRA 30/14F surf 40/60" },
    ],
    road_category: "B", pci_before: "35", pci_after: "75",
    network_length: 320, contractor_ref: "TC/DCC/R5008",
    drawing_ref: "R6016-DCC-ZZ-DR-C-001", cpp_ref: "CPP-R5008-2026",
    budget_code: "C2601", pci_justification: "Structural failure and surface deterioration beyond maintenance threshold. PCI survey confirms category D deficiency. Resurfacing required to restore structural integrity and ride quality.",
    utility_applied: { "LSBUD (multi-utility)":"2026-02-24", "SGN (Gas)":"2026-02-24", "Scottish Water":"2026-02-24", "SSEN (Electricity)":"2026-02-24", "Cityfibre":"2026-02-24", "Virgin Media":"2026-02-24", "Openreach (BT)":"2026-02-24" },
    ward_num: 3, ward_selected: "Coldside",
    postcode: "DD3 7EE",
    tender_total: 129436.41, budget: 135000, cost_per_m2: 54.61,
    date_prepared: "24/02/2026", date_approved: "28/02/2026",
    date_start: "12/05/2026", date_finish: "05/06/2026",
    tm_type: "Partial Road Closure", tm_hours: "08:00-15:30", tm_phases: 4,
    tm_compound: "Balgray Pl hammerhead",
    contractor_pe: "Garry Robertson", contractor_ch: "K McLeod",
    iron_mh: 13, iron_water: 8, iron_gas: 1, iron_bt: 0, iron_gullies: 5,
    kerb_length: 12, lining_req: "Yes",
    packProgress: 9, packTotal: 14,
    financial_year: "2026/27",
    lastUpdated: "2h ago",
    flags: [],
    pci_description: "Carriageway Resurfacing as per R6016-DCC-ZZ-DR-C-001 & 002 Resurfacing Plan & Cross-section drawings.\n\n40mm Carriageway Resurfacing — 805m²: plane off existing surface to a depth of 40mm across full extents. DCC Engineer present during operations to identify localised areas requiring deeper excavation up to 100mm. Post-milling: regulate using HRA 30/14F surface regulating course (40/60 pen) at 0.43 m³/t; lay 40mm HRA 30/14F (40/60 pen) Surface Course. Pre-coated chippings to be evenly distributed and fully embedded. Material temperatures to be recorded on delivery and prior to laying. Form smooth transition ramps at tie-in points. Maintain traffic flow between 15:30 and 07:30.\n\n100mm Carriageway Resurfacing — 1565m²: plane off to initial 40mm with further excavation to 100mm where instructed. Build-up: HRA 30/14F regulating layer where required; 60mm HRA 50/20 (40/60 pen) binder; 40mm HRA 30/14F (40/60 pen) surface course. Full compaction and bond between layers; pre-coated chippings applied uniformly. Temporary road surface available for public use between 15:30 and 07:00.",
    pci_ironwork_summary: "13 no. Scottish Water manhole covers and frames to be reset. 1 no. gas cover to be replaced. 5 no. existing gully gratings to be adjusted and tied into new surface levels. Ref: R6016-DCC-ZZ-DR-C-003.",
    pci_lining_summary: "All road markings to be installed as per the specifications in the Master Lining Plan (R6016-DCC-ZZ-DR-C-004).",
    pci_occupiers: "All residents and businesses along Clepington Road contacted in advance of commencement. Attention given to North End Motors — aware that the road will be completely shut with no access; opportunity to leave access open will be explored where practicable.",
    haz_public: "Works conducted under road closure between the Tak A Wa (Chinese takeaway) and 187 Clepington Road, protected in accordance with the Safety at Street Works and Road Works Code of Practice. Works delivered in two phases — once the roundabout is resurfaced it reopens for 24-hour use. Pedestrian access for businesses and residents maintained at all times. Emergency services vehicular access maintained throughout.",
    haz_additional: "Businesses in the area: contact has been made by the client with each business; each has been informed of no possible access between 07:30 and 15:30 throughout the duration of the works. Evidence of heave caused by tree roots — advice to be sought prior to works commencing.",
    recipients: [
      { type: "resident", name: "The Current Occupier", address1: "176 Clepington Road",  address2: "",              postcode: "DD3 7ED", town: "DUNDEE" },
      { type: "resident", name: "The Current Occupier", address1: "178 Clepington Road",  address2: "",              postcode: "DD3 7ED", town: "DUNDEE" },
      { type: "resident", name: "The Current Occupier", address1: "180 Clepington Road",  address2: "",              postcode: "DD3 7ED", town: "DUNDEE" },
      { type: "business",  name: "North End Motors",     address1: "Unit 3, Balgray Pl",   address2: "",              postcode: "DD3 7EE", town: "DUNDEE" },
      { type: "business",  name: "Tak A Wa",             address1: "187 Clepington Road",  address2: "",              postcode: "DD3 7EE", town: "DUNDEE" },
      { type: "resident", name: "The Current Occupier", address1: "185 Clepington Road",  address2: "",              postcode: "DD3 7EE", town: "DUNDEE" },
      { type: "resident", name: "The Current Occupier", address1: "183 Clepington Road",  address2: "",              postcode: "DD3 7EE", town: "DUNDEE" },
    ],
  }),
  baseScheme({
    id: "ARRAN-DR",
    road_name: "Arran Drive",
    project_number: "",
    scheme_extent: "Arran Drive — whole length",
    grid_ref: "",
    carriageway_area_m2: 668,
    scheme_type: "Carriageway",
    treatment_type: "AC14 close binder 40/60",
    surface_depth_mm: 40, binder_depth_mm: 0, subbase_depth_mm: 0, total_depth_mm: 40,
    binder_grade: "40/60",
    traffic_category: "",
    treatments: [
      { id:1, zone:"A1 — 100mm AC14 patch (Road Closure)", area_m2:595, depth_mm:100, treatment_type:"AC14 Surface course, AC20 Binder" },
      { id:2, zone:"A2 — 40mm AC14 patch (TTL Closure)",    area_m2:19,  depth_mm:40,  treatment_type:"AC14 close binder 40/60" },
      { id:3, zone:"A3 — 40mm AC14 patch (TTL Closure)",    area_m2:23,  depth_mm:40,  treatment_type:"AC14 close binder 40/60" },
      { id:4, zone:"A4 — 40mm AC14 patch (TTL Closure)",    area_m2:31,  depth_mm:40,  treatment_type:"AC14 close binder 40/60" },
    ],
    ward_num: 2, ward_selected: "Lochee",
    postcode: "",
    date_prepared: "07/04/2026",
    date_approved: "16/04/2026",
    date_start: "05/05/2026",
    date_finish: "",
    tm_type: "Full road closure",
    tm_phases: 1,
    tm_hours: "",
    tm_diversion_by: "Tayside Contracts",
    tm_compound: "",
    prepared_by: "Jake McAllister",
    reviewed_by: "Steve Lindsay",
    approved_by: "Steve Lindsay",
    contractor: "Tayside Contracts",
    contractor_ref: "",
    contractor_pe: "Ross Smith",
    contractor_ch: "",
    contractor_ooh: "07767 326827",
    contractor_address: "Tayside Contracts, Soutar Street, Dundee",
    drawing_ref: "DCC-SD-001",
    cpp_ref: "",
    budget_code: "",
    road_category: "",
    pci_before: "", pci_after: "",
    pci_justification: "Carriageway defects along Arran Drive require localised patching ahead of a full-length surface dressing treatment to restore surface integrity and extend serviceable life.",
    pci_description: "Pre-patching works on Arran Drive (whole length), followed by surface dressing.\n\nPatch A1 — 595m² 100mm AC14 patch: plane existing surface to 100mm and reinstate with AC20 binder course and AC14 surface course. Works carried out under road closure.\n\nPatches A2 (19m²), A3 (23m²), A4 (31m²) — 40mm AC14 patches: plane existing surface to 40mm and reinstate with AC14 surface course. Works carried out under two-way traffic lights (TTL) closures.\n\nSurface dressing: applied across the whole length of Arran Drive under road closure following completion of the patching works. Refer to drawing DCC-SD-001 S01 R0.",
    pci_ironwork_summary: "",
    pci_lining_summary: "",
    pci_occupiers: "Residents and businesses along Arran Drive to be notified in advance of works. Property number ranges along the scheme extent include: 131–141, 155–177, 181–191, 205–227, 231–241, 243–253, and no. 277.",
    haz_public: "Works to be carried out under a full road closure (main carriageway patching and surface dressing) with localised two-way traffic light closures for minor 40mm patches. Pedestrian access to be maintained for the duration of the works. Vehicular diversion: Westbound — High Street, Coupar Angus Road, South Road (and return). Eastbound — Charleston Drive, Ancrum Road, High Street, Coupar Angus Road, South Road (and return). Emergency services access to be maintained throughout.",
    tender_total: 0, budget: 0, cost_per_m2: 0,
    network_length: 0,
    iron_mh: 0, iron_bt: 0, iron_water: 0, iron_gas: 0, iron_gullies: 0,
    kerb_length: 0, lining_req: "",
    financial_year: "2026/27",
    packProgress: 3, packTotal: 14,
    status: "design",
    lastUpdated: "today",
    flags: [],
  }),
  // ── 2026/27 programme — Jake McAllister schemes only (start date > Apr 2026) ──
  baseScheme({ id:"PR010", road_name:"Abertay Street", project_number:"PR010",
    scheme_type:"Footway", treatment_type:"AC10 Taycoat 100/150",
    date_start:"15/06/2026",
    prepared_by:"Jake McAllister", supervisor_name:"D MacLachlan",
    ward_num:3, ward_selected:"Coldside", financial_year:"2026/27",
    status:"design", packProgress:0, packTotal:14, lastUpdated:"today",
  }),
  baseScheme({ id:"PR011", road_name:"Guthrie Terrace", project_number:"R6083",
    scheme_type:"Carriageway",
    scheme_extent: "Guthrie Terrace Full Length",
    carriageway_area_m2: 2250,
    grid_ref: "N04788931637",
    treatment_type:"AC10 Taycoat 100/150",
    surface_depth_mm: 40, binder_depth_mm: 0, subbase_depth_mm: 0, total_depth_mm: 40,
    binder_grade: "100/150",
    traffic_category: "Low",
    matrix: { traffic:"Light", bus_stops:"None", junctions:"Minor", turning:"None", parking:"On-street", condition:"Poor", cracking:"Block", rutting:"<5mm" },
    treatments: [
      { id:1, zone:"Full carriageway — 40mm AC10 Taycoat 100/150", area_m2:2250, depth_mm:40, treatment_type:"AC10 Taycoat 100/150" },
    ],
    drawing_ref: "R6083-DCC-ZZ-DR-C-001",
    cpp_ref: "CPP-R6083-2026",
    contractor_ref: "TC/DCC/R6083",
    road_category: "C",
    pci_before: "", pci_after: "",
    network_length: 320,
    budget_code: "",
    date_prepared: "05/05/2026",
    date_start:"15/06/2026",
    date_finish: "17/06/2026",
    tm_type: "Complete Road Closure",
    tm_hours: "08:00-15:30",
    tm_phases: 1,
    tm_compound: "On-street adjacent to works",
    prepared_by:"Jake McAllister", contractor_pe:"Garry Robertson", supervisor_name:"R Keen",
    contractor_email: "garry.robertson@tayside-contracts.co.uk",
    contractor_ooh: "07771 765668",
    ward_num:4, ward_selected:"Maryfield", financial_year:"2026/27",
    tender_total: 70075,
    iron_mh: 0, iron_water: 12, iron_gas: 0, iron_bt: 0, iron_gullies: 1,
    kerb_length: 0, lining_req: "Yes",
    pci_justification: "Surface deterioration and cracking across the full width of Guthrie Terrace carriageway. Existing surface has exceeded its serviceable life and requires full resurfacing to restore ride quality and prevent further structural deterioration. Pre-design sketch R6083 PDS-01 and resurfacing plan R6083-DCC-ZZ-DR-C-001 confirm full-length scheme extent of 2,250m².",
    pci_description: "Carriageway resurfacing of Guthrie Terrace (full length) as per resurfacing plan R6083-DCC-ZZ-DR-C-001, ironwork plan R6083-DCC-ZZ-DR-C-002 and lining plan R6083-DCC-ZZ-DR-C-003 (Dundee City Council Roads Maintenance Partnership, drawn J McAllister, dated 05/05/2026).\n\n40mm AC 10 100/150 (Taycoat) Close Graded Surface Course — 2,250m² (carriageway surface course 1,920m²): plane off existing surface to a depth of 40mm across the full carriageway extent. Screed where required prior to laying. Form smooth transition ramps at all tie-in points. Works to be delivered in 1 phase of construction under complete road closure of Guthrie Terrace.\n\nWorks programme: 2 working days (15/06/2026 to 17/06/2026).\n\nIronwork: 12 no. Scottish Water covers to be adjusted to new surface level. 1 no. gully to be adjusted to new surface level. See ironwork plan R6083-DCC-ZZ-DR-C-002.\n\nRoad markings: road marking reinstatement required on completion of surfacing — see lining plan R6083-DCC-ZZ-DR-C-003.\n\nAll temporary reinstatements within the scheme extent to be made permanent prior to works commencing.",
    pci_ironwork_summary: "12 no. Scottish Water covers to be adjusted to new surface level. 1 no. gully to be adjusted to new surface level. Ref: R6083-DCC-ZZ-DR-C-002.",
    pci_lining_summary: "Road marking reinstatement required on completion of surfacing. Ref: R6083-DCC-ZZ-DR-C-003.",
    pci_occupiers: "Residential properties and businesses along full length of Guthrie Terrace to be notified in advance of works. St. Margaret's Church (adjacent to western end of scheme) to be informed — pedestrian access to be maintained at all times during working hours. Pedestrian access for all businesses to be maintained throughout. Pedestrian crossing points to be maintained at all times.",
    haz_public: "Works to be carried out under a complete road closure in accordance with the Safety at Street Works and Road Works Code of Practice. Works to be carried out in phases to minimise disruption to footway users and businesses. Pedestrian access to all properties and businesses along Guthrie Terrace to be maintained at all times. Pedestrian crossing points to be maintained throughout the duration of the works. Vehicular access for emergency services to be maintained throughout.",
    haz_environment: "All waste arisings from cold milling to be removed from site and disposed of at an approved facility. No materials to be stockpiled on the public footway overnight.",
    haz_additional: "Residents and businesses along Guthrie Terrace have been / will be notified by letter in advance of commencement. St. Margaret's Church (adjacent site) to be contacted directly prior to works commencing to confirm access arrangements. On-street parking along the terrace will be suspended for the duration of the works under a Traffic Regulation Order.",
    sketch_pdf:"Guthrie Terrace.pdf",
    status:"design", packProgress:0, packTotal:14, lastUpdated:"today",
  }),
  baseScheme({ id:"PR013", road_name:"Seagate — Nightshift", project_number:"R6087",
    scheme_type:"Carriageway", treatment_type:"HRA 30/14F surf 40/60",
    date_start:"28/06/2026", tm_hours:"Nightshift (19:00-06:00)",
    prepared_by:"Jake McAllister", contractor_pe:"Garry Robertson", supervisor_name:"R Keen",
    ward_num:6, ward_selected:"East End", financial_year:"2026/27",
    status:"design", packProgress:0, packTotal:14, lastUpdated:"today",
    sketch_pdf:"Seagate.pdf",
  }),
  baseScheme({ id:"PR015", road_name:"Byron Crescent — Footway", project_number:"PR015",
    scheme_type:"Footway", treatment_type:"AC10 Taycoat 100/150",
    date_start:"29/06/2026",
    prepared_by:"Jake McAllister", supervisor_name:"R McNab",
    ward_num:5, ward_selected:"North East", financial_year:"2026/27",
    status:"design", packProgress:0, packTotal:14, lastUpdated:"today",
  }),
  baseScheme({ id:"PR017", road_name:"CAT 4 Week 2 — Old Glamis Road", project_number:"PR017",
    scheme_type:"Carriageway", treatment_type:"AC14 close binder 40/60",
    date_start:"13/07/2026",
    prepared_by:"Jake McAllister", contractor_pe:"Garry Robertson", supervisor_name:"R Keen",
    ward_num:5, ward_selected:"North East", financial_year:"2026/27",
    status:"design", packProgress:0, packTotal:14, lastUpdated:"today",
  }),
  baseScheme({ id:"PR022", road_name:"Dunholm Road — Footway", project_number:"R6080",
    scheme_type:"Footway", treatment_type:"AC10 Taycoat 100/150",
    date_start:"10/08/2026",
    prepared_by:"Jake McAllister", supervisor_name:"R McNab",
    ward_num:1, ward_selected:"Strathmartine", financial_year:"2026/27",
    status:"design", packProgress:0, packTotal:14, lastUpdated:"today",
    sketch_pdf:"Dunholm Road.pdf",
  }),
  baseScheme({ id:"PR025", road_name:"Eton Street — Thin Surfacing", project_number:"PR025",
    scheme_type:"Carriageway", treatment_type:"Micro-asphalt",
    date_start:"24/08/2026",
    prepared_by:"Jake McAllister", contractor_pe:"Garry Robertson", supervisor_name:"R Keen",
    ward_num:4, ward_selected:"Maryfield", financial_year:"2026/27",
    status:"design", packProgress:0, packTotal:14, lastUpdated:"today",
  }),
  baseScheme({ id:"PR032", road_name:"Brownhill Road & Balgarthno Road", project_number:"R6013",
    scheme_type:"Carriageway", treatment_type:"HRA 30/14F surf 40/60",
    date_start:"05/10/2026",
    prepared_by:"Jake McAllister", contractor_pe:"Garry Robertson", supervisor_name:"R Keen",
    ward_num:2, ward_selected:"Lochee", financial_year:"2026/27",
    status:"design", packProgress:0, packTotal:14, lastUpdated:"today",
  }),
  baseScheme({ id:"PR034", road_name:"Derwent Avenue", project_number:"R6078",
    scheme_type:"Carriageway", treatment_type:"HRA 30/14F surf 40/60",
    date_start:"26/10/2026",
    prepared_by:"Jake McAllister", contractor_pe:"Garry Robertson", supervisor_name:"R Keen",
    ward_num:1, ward_selected:"Strathmartine", financial_year:"2026/27",
    status:"design", packProgress:0, packTotal:14, lastUpdated:"today",
    sketch_pdf:"Derwent Avenue.pdf",
  }),
  baseScheme({ id:"PR038", road_name:"Ambleside Avenue", project_number:"R6072",
    scheme_type:"Carriageway", treatment_type:"HRA 30/14F surf 40/60",
    date_start:"16/11/2026",
    prepared_by:"Jake McAllister", contractor_pe:"Garry Robertson", supervisor_name:"R Keen",
    ward_num:5, ward_selected:"North East", financial_year:"2026/27",
    status:"design", packProgress:0, packTotal:14, lastUpdated:"today",
    sketch_pdf:"Ambleside Avenue.pdf",
  }),
  baseScheme({ id:"PR049", road_name:"Marryat Street", project_number:"R6084",
    scheme_type:"Carriageway", treatment_type:"HRA 30/14F surf 40/60",
    date_start:"22/02/2027",
    prepared_by:"Jake McAllister", contractor_pe:"Garry Robertson", supervisor_name:"R Keen",
    ward_num:8, ward_selected:"West End", financial_year:"2026/27",
    status:"design", packProgress:0, packTotal:14, lastUpdated:"today",
    sketch_pdf:"Marryat Street.pdf",
  }),
  baseScheme({ id:"PR053", road_name:"Saggar Street", project_number:"R6086",
    scheme_type:"Carriageway", treatment_type:"HRA 30/14F surf 40/60",
    date_start:"29/03/2027",
    prepared_by:"Jake McAllister", contractor_pe:"Garry Robertson", supervisor_name:"R Keen",
    ward_num:6, ward_selected:"East End", financial_year:"2026/27",
    status:"design", packProgress:0, packTotal:14, lastUpdated:"today",
    sketch_pdf:"Saggar Street.pdf",
  }),
];

window.PACK_DOCS = [
  { key: "front", name: "Front Sheet", type: "PDF", auto: true, working: true },
  { key: "pci", name: "PCI / CPP (FM710-10A)", type: "DOCX", auto: true, working: true },
  { key: "rsr", name: "Road Space Request Form", type: "DOCX", auto: true, working: true },
  { key: "letter", name: "Resident / Business Letter", type: "DOCX", auto: true, working: true },
  { key: "boq", name: "Bill of Quantities", type: "XLSX", auto: true, working: true },
  { key: "drawings", name: "Resurfacing & Ironwork Plans", type: "DWG", auto: false },
  { key: "tm", name: "Traffic Management Plans", type: "PDF", auto: false },
  { key: "utilities", name: "Utility Searches Pack", type: "PDF", auto: false },
];

window.PORTAL_LINKS = [
  { name: "LSBUD",              desc: "Multi-utility search before you dig", url: "https://lsbud.co.uk/#/",                                             domain: "lsbud.co.uk" },
  { name: "Digdat",             desc: "Utility asset data portal",           url: "https://utilities.digdat.co.uk/Account/Login.aspx",                  domain: "utilities.digdat.co.uk" },
  { name: "CityFibre",          desc: "Fibre plant map viewer",              url: "https://plant.cityfibre.com/emaps/#/map/56.467233,-3.028910,16z",    domain: "plant.cityfibre.com" },
  { name: "Openreach",          desc: "Maps on Demand",                      url: "https://www.openreach.co.uk/mapsondemand/index.html",                domain: "openreach.co.uk" },
  { name: "Grid Ref Finder",    desc: "OS Grid Reference lookup",            url: "https://gridreferencefinder.com/",                                   domain: "gridreferencefinder.com" },
];

window.UTILITIES = [
  { name: "LSBUD (multi-utility)", portal: "linesearchbeforeudig.co.uk" },
  { name: "SGN (Gas)", portal: "sgn.co.uk/safety" },
  { name: "Scottish Water", portal: "scottishwater.co.uk" },
  { name: "SSEN (Electricity)", portal: "ssen.co.uk" },
  { name: "Cityfibre", portal: "digdat.cityfibre" },
  { name: "Virgin Media", portal: "digdat.virgin" },
  { name: "Openreach (BT)", portal: "openreach.co.uk" },
  { name: "CCTV / Traffic Signals", portal: "DCC internal" },
  { name: "Street Lighting", portal: "DCC internal" },
];

// Tayside Contracts — project-engineer pool for the Contractor Project Engineer field.
// Address for all: Contracts House, 1 Soutar Street, Dundee, DD3 8SS
window.TAYSIDE_STAFF = [
  { name: "Darren Conway",   role: "Senior Project Engineer",    mobile: "07585 987484", directLine: "",              email: "darren.conway@tayside-contracts.co.uk" },
  { name: "Garry Robertson", role: "Project Engineer",           mobile: "07771 765668", directLine: "01382 834083", email: "garry.robertson@tayside-contracts.co.uk" },
  { name: "Ross Smith",      role: "Project Engineer",           mobile: "07799 583208", directLine: "01382 834085", email: "ross.smith@tayside-contracts.co.uk" },
  { name: "Blair Shaw",      role: "Assistant Project Engineer", mobile: "07468 707896", directLine: "01382 834127", email: "blair.shaw@tayside-contracts.co.uk" },
];

// The full Master Workbook schema — all 8 sections, 49 named ranges, in cell order
window.WORKBOOK_SCHEMA = [
  { section: "1. Scheme Identity", fields: [
    { key: "scheme_type", label: "Scheme Type", type: "select", options: ["Carriageway", "Footway", "Junction", "Cycleway"] },
    { key: "road_name", label: "Road Name", type: "text" },
    { key: "project_number", label: "Project Number", type: "text", mono: true },
    { key: "financial_year", label: "Financial Year", type: "text", mono: true },
    { key: "carriageway_area_m2", label: "Carriageway Area (m²)", type: "number", mono: true },
    { key: "footway_area_m2",     label: "Footway Area (m²)",     type: "number", mono: true },
    { key: "scheme_extent", label: "Scheme Extent", type: "text" },
    { key: "grid_ref", label: "Grid Reference", type: "text", mono: true },
  ]},
  { section: "2. Key Dates", fields: [
    { key: "date_prepared", label: "Design Prepared Date", type: "date" },
    { key: "date_approved", label: "Design Approved Date", type: "date" },
    { key: "date_start", label: "Proposed Start Date", type: "date" },
    { key: "date_finish", label: "Proposed Finish Date", type: "date" },
    { key: "working_pattern", label: "Working Pattern", type: "select",
      options: ["Mon–Fri", "Mon–Sun (incl. weekends)"] },
    { key: "shift_pattern", label: "Shift", type: "select",
      options: ["Day", "Night", "Day & night"] },
  ]},
  { section: "3. Project Team", fields: [
    { key: "prepared_by", label: "Prepared By (Designer)", type: "text" },
    { key: "designer_email", label: "Designer Email", type: "email" },
    { key: "designer_phone", label: "Designer Phone", type: "text", mono: true },
    { key: "reviewed_by", label: "Reviewed By", type: "text" },
    { key: "approved_by", label: "Approved By", type: "text" },
    { key: "client_officer", label: "Client Officer", type: "text" },
    { key: "client_email", label: "Client Officer Email", type: "email" },
    { key: "client_phone", label: "Client Officer Phone", type: "text", mono: true },
    { key: "contractor", label: "Contractor", type: "text" },
    { key: "contractor_ref", label: "Contractor Reference", type: "text", mono: true },
    { key: "contractor_pe", label: "Contractor Project Engineer", type: "tayside-pe" },
    { key: "contractor_ch", label: "Contractor Chargehand", type: "text" },
    { key: "contractor_ooh", label: "Contractor Out-of-Hours", type: "text", mono: true },
    { key: "supervisor_name", label: "Site Supervisor Name", type: "text" },
    { key: "supervisor_phone", label: "Site Supervisor Phone", type: "text", mono: true },
    { key: "supervisor_email", label: "Site Supervisor Email", type: "email" },
  ]},
  { section: "4. Budget & Tender", fields: [
    { key: "budget", label: "Budget Allocation (£)", type: "number", mono: true },
    { key: "tender_total", label: "Tender Total (£)", type: "number", mono: true },
    { key: "cost_per_m2", label: "Cost per m² (£)", type: "calc", mono: true, formula: s => {
      const total = (+s.carriageway_area_m2 || 0) + (+s.footway_area_m2 || 0);
      return total ? (+s.tender_total / total).toFixed(2) : 0;
    }},
    { key: "network_length", label: "Network Length (m)", type: "number", mono: true },
    { key: "budget_code", label: "Budget Code", type: "text", mono: true },
    { key: "cpp_ref", label: "CPP Reference", type: "text", mono: true },
    { key: "drawing_ref", label: "Drawing Reference", type: "text", mono: true },
  ]},
  { section: "5. Ward & Correspondence", fields: [
    { key: "ward_selected", label: "Ward", type: "ward" },
    { key: "postcode", label: "Postcode (for lookup)", type: "text", mono: true },
    { key: "postcode_link", label: "Postcode Lookup Link", type: "link" },
  ]},
  { section: "6. PCI / CPP Content", fields: [
    { key: "road_category", label: "Road Category", type: "select", options: ["A", "B", "C", "D", "U"] },
    { key: "pci_before", label: "PCI Score — Before Works", type: "number", mono: true },
    { key: "pci_after", label: "PCI Score — After Works (target)", type: "number", mono: true },
    { key: "pci_justification", label: "Scheme Justification", type: "textarea" },
    { key: "client_name_address", label: "Client Name & Address", type: "textarea" },
    { key: "department", label: "Department / Division", type: "text" },
    { key: "designer_head_of", label: "Designer — on behalf of (Head of)", type: "text" },
    { key: "cdm_head_of", label: "CDM PD — on behalf of (Head of)", type: "text" },
    { key: "client_ref_work_order", label: "Client Ref / Work / GVA Order", type: "text", mono: true },
    { key: "contractor_address", label: "Contractor Address", type: "text" },
    { key: "contractor_email", label: "Contractor Email", type: "email" },
    { key: "pci_description", label: "Description of Work (full scope)", type: "textarea" },
    { key: "pci_ironwork_summary", label: "Ironwork Summary", type: "textarea" },
    { key: "pci_lining_summary", label: "Lining Works Summary", type: "textarea" },
    { key: "pci_occupiers", label: "Occupiers / Tenants on Site", type: "textarea" },
    { key: "pci_site_security", label: "Site Security Arrangements", type: "textarea" },
    { key: "cdm_principal_designer", label: "CDM Principal Designer", type: "text" },
    { key: "welfare_toilet", label: "Welfare — Toilet", type: "select", options: ["Yes", "No"] },
    { key: "welfare_washing", label: "Welfare — Hot/Cold Washing", type: "select", options: ["Yes", "No"] },
    { key: "welfare_rest", label: "Welfare — Rest Facilities", type: "select", options: ["Yes", "No"] },
    { key: "welfare_water", label: "Welfare — Mains Drinking Water", type: "select", options: ["Yes", "No"] },
    { key: "welfare_changing", label: "Welfare — Heated Changing Room", type: "select", options: ["Yes", "No"] },
    { key: "haz_working_height", label: "Hazard — Working at Height", type: "textarea" },
    { key: "haz_slips", label: "Hazard — Slips, Trips & Falls", type: "textarea" },
    { key: "haz_excavations", label: "Hazard — Excavations & Services", type: "textarea" },
    { key: "haz_structures", label: "Hazard — Collapse of Structures/Materials", type: "textarea" },
    { key: "haz_health", label: "Hazard — Health Hazards", type: "textarea" },
    { key: "haz_asbestos", label: "Hazard — Exposure to Asbestos", type: "textarea" },
    { key: "haz_public", label: "Hazard — Risks to Public & Building Users", type: "textarea" },
    { key: "haz_environment", label: "Environmental Policies", type: "textarea" },
    { key: "haz_other", label: "Other Dangers on Site", type: "textarea" },
    { key: "haz_additional", label: "Additional Information / Nearby Activities", type: "textarea" },
  ]},
];
