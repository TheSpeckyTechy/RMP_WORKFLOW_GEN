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

window.DESIGNERS = [
  { id: 'jake',    name: 'Jake McAllister',  initials: 'JM', colour: '#c46a2c', email: 'jake.mcallister@dundeecity.gov.uk', phone: '01382 834028' },
  { id: 'barry',   name: 'Barry Carver',     initials: 'BC', colour: '#3b82f6', email: '', phone: '' },
  { id: 'stephen', name: 'Stephen Lindsay',  initials: 'SL', colour: '#10b981', email: '', phone: '' },
  { id: 'adam',    name: 'Adam Macdonald',   initials: 'AM', colour: '#ec4899', email: '', phone: '' },
  { id: 'kevin',   name: 'Kevin Donald',     initials: 'KD', colour: '#8b5cf6', email: '', phone: '' },
  { id: 'new',     name: 'New Start',        initials: 'NS', colour: '#9ca3af', email: '', phone: '' },
];

// Default shape for the BoQ tab. Quantities are derived from scheme.design{}
// at render time by the BoQ engine — this record only carries the things
// the BoQ tab itself owns: custom (user-added) lines, recent catalogue
// picks, BERR/percent-addition settings, and the touched flag that
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
  // Footway works are scheme-wide (single-area); a single material picker
  // is enough. Empty surface tag means "no footway works" — the engine
  // emits no fw_surface line. Set fw_subbase to true for full reconstructions.
  footway: {
    surface_tag: '',     // tag from FOOTWAY_SURFACE_OPTIONS (e.g. 'fw_ac6_30')
    include_subbase: false,
  },
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
  assigned_designer_id: "jake",
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
  cdm_principal_designer: "Jake McAllister",
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

// Canonical working-day count for a scheme. Walks the calendar from
// date_start to date_finish inclusive, counting Mon–Fri (or every day if
// the scheme is on a 7-day pattern). The previous primitive
// `Math.round((b-a)/86400000 * 5/7)` formula in three different files
// systematically under-counted — Mon→Fri gave 3 instead of 5,
// Mon→Wed gave 1 instead of 3 — and showed up in the generated pack
// as "3 working days (15/06 to 19/06)" PCI lines.
window.workingDaysFor = (s) => {
  const E = window.BOQ_ENGINE;
  if (!s || !s.date_start || !s.date_finish) return null;
  const designerDays = s?.design?.tm?.duration_days;
  if (designerDays != null && designerDays !== '') return +designerDays;
  if (E?.computeWorkingDays) return E.computeWorkingDays(s.date_start, s.date_finish, s.working_pattern);
  return null;
};

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

// Scheme data is NOT shipped in the app any more — it lives as {id}.json
// files in the user's OneDrive data folder (File System Access backend).
// One-time seed files for the 2026/27 register are in seed-data/ in the
// repo (not deployed); copy them into the data folder once. See SETUP_FS.md.
window.SCHEMES = [];

window.PACK_DOCS = [
  { key: "front", name: "Front Sheet", type: "PDF", auto: true, working: true },
  { key: "pci", name: "PCI / CPP (FM710-10A)", type: "DOCX", auto: true, working: true },
  { key: "rsr", name: "Road Space Request Form", type: "DOCX", auto: true, working: true },
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

// Animated counter hook — counts from 0 → target using ease-out cubic over dur ms.
// Exported to window so Dashboard and Analytics can share the same implementation.
window.useCounter = (target, dur = 900) => {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    if (!target) { setVal(0); return; }
    let start = null, raf;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val;
};

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
    { key: "scheme_type", label: "Scheme Type", type: "select", options: ["Carriageway", "Footway", "Junction", "Cycleway", "Surface Dressing"] },
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
    { key: "prepared_by", label: "Prepared By (Designer)", type: "designer" },
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
      return total ? +(+s.tender_total / total).toFixed(2) : 0;
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
