// ─── SurfaceDressingDesigner.jsx ─────────────────────────────────────────────
// Road Note 39 / RSTA Pocket Guide 7th Ed. surface dressing designer.
// Shown as "SD Design" tab on Surface Dressing scheme type only.
// SD design data stored on scheme.sd_design (via SchemeContext updateScheme).
// Rate overrides stored in localStorage under SD_RATES_KEY (global, shared).
//
// Exports (via window): SurfaceDressingDesigner
// Depends on: React, window.SchemeContext
// ─────────────────────────────────────────────────────────────────────────────

// Table 7.2.3 — Traffic Categories (commercial vehicles/lane/day)
const SD_TRAFFIC_CATEGORIES = [
  { cat: 'A', range: 'Over 3250',  min: 3250, max: Infinity, nrswa: 'S'   },
  { cat: 'B', range: '2501–3250',  min: 2501, max: 3250,     nrswa: 'S/1' },
  { cat: 'C', range: '2001–2500',  min: 2001, max: 2500,     nrswa: '1'   },
  { cat: 'D', range: '1251–2000',  min: 1251, max: 2000,     nrswa: '2'   },
  { cat: 'E', range: '501–1250',   min: 501,  max: 1250,     nrswa: '3'   },
  { cat: 'F', range: '251–500',    min: 251,  max: 500,      nrswa: '3'   },
  { cat: 'G', range: '126–250',    min: 126,  max: 250,      nrswa: '4'   },
  { cat: 'H', range: '0–125',      min: 0,    max: 125,      nrswa: '4'   },
];

const SD_LOCATION_TEMP_CAT = { South: 'A', Central: 'B', North: 'C/D' };

const SD_HARDNESS_FROM_PROBE = (mm) => {
  if (isNaN(mm) || mm === null) return null;
  if (mm <= 1.5) return 'Very Hard';
  if (mm <= 3)   return 'Hard';
  if (mm <= 5)   return 'Normal';
  if (mm <= 7)   return 'Soft';
  return 'Very Soft';
};

const SD_SUITABILITY_MATRIX = {
  'Very Hard & homogeneous':       { A:'Y', B:'Y', C:'Y', D:'Y', E:'Y', F:'Y', G:'Y', H:'Y' },
  'Hard & homogeneous':            { A:'Y', B:'Y', C:'Y', D:'Y', E:'Y', F:'Y', G:'Y', H:'Y' },
  'Normal & homogeneous':          { A:'Y', B:'Y', C:'Y', D:'Y', E:'Y', F:'Y', G:'Y', H:'Y' },
  'Soft & homogeneous':            { A:'T', B:'T', C:'Y', D:'Y', E:'Y', F:'Y', G:'Y', H:'Y' },
  'Very Soft & homogeneous':       { A:'E', B:'E', C:'T', D:'Y', E:'Y', F:'Y', G:'Y', H:'Y' },
  'Fatting up in wheel tracks':    { A:'T', B:'T', C:'Y', D:'Y', E:'Y', F:'Y', G:'Y', H:'Y' },
  'High macrotexture / fretted':   { A:'E', B:'Y', C:'Y', D:'Y', E:'Y', F:'Y', G:'Y', H:'Y' },
  'Porous':                        { A:'N', B:'N', C:'N', D:'E', E:'Y', F:'Y', G:'Y', H:'Y' },
  'Very variable':                 { A:'N', B:'N', C:'N', D:'E', E:'Y', F:'Y', G:'Y', H:'Y' },
  'Extensive patching':            { A:'E', B:'E', C:'E', D:'E', E:'E', F:'Y', G:'Y', H:'Y' },
  'Severe bleeding / blackening':  { A:'N', B:'N', C:'N', D:'N', E:'N', F:'N', G:'N', H:'N' },
};

const SD_SUITABILITY_KEY = {
  Y: { label: 'Suitable',        color: 'var(--green)',  desc: 'Surface dressing can be designed to meet most onerous requirements (BS EN 12272-2).' },
  T: { label: 'Texture concern', color: 'var(--amber)',  desc: 'Difficult to maintain high macrotexture, especially in wheel tracks. Achievable on low-speed roads.' },
  D: { label: 'Defects concern', color: 'var(--amber)',  desc: 'Difficult to meet most onerous defect requirements; less onerous levels should not be specified.' },
  E: { label: 'Expert design',   color: 'var(--accent)', desc: 'Design may be achievable by an expert to meet less onerous performance levels. Extra care in execution required.' },
  N: { label: 'Not appropriate', color: 'var(--red)',    desc: 'Surface dressing is not an appropriate treatment.' },
};

const SD_HARDNESS_GUIDANCE = {
  'Very Hard': 'Concrete, very old/oxidised dense surfaces. Probe ≤1.5mm. Expect minimal embedment.',
  'Hard':      'Older asphalt that resists chipping penetration. Probe ~1.5–3mm.',
  'Normal':    'Typical asphalt in reasonable condition. Probe ~3–5mm. Default for most schemes.',
  'Soft':      'Newer asphalt or surfaces showing softness/binder mobility. Probe ~5–7mm.',
  'Very Soft': 'Fresh surfacing or notably soft binder. Probe >7mm. Risk of over-embedment.',
  'Variable':  'Hardness varies significantly across carriageway (e.g. wheel tracks vs centreline).',
};

const SD_CONDITION_GUIDANCE = {
  'Very Hard & homogeneous':      'Old, hard, consistent surface — no patches/trenches.',
  'Hard & homogeneous':           'Aged but consistent — typical surface dressing candidate.',
  'Normal & homogeneous':         'Fair condition, consistent texture across carriageway.',
  'Soft & homogeneous':           'Newer asphalt, consistent. Watch wheel tracks on heavy traffic.',
  'Very Soft & homogeneous':      'Fresh or soft binder — generally not yet ready for dressing.',
  'Fatting up in wheel tracks':   'Smooth, shiny wheel tracks where binder has bled.',
  'High macrotexture / fretted':  'Open, gappy texture — fretting, raveling. Needs more binder to seal.',
  'Porous':                       'Porous asphalt or open-graded surface.',
  'Very variable':                'Mix of conditions — patches, repairs, inconsistent texture.',
  'Extensive patching':           'More than ~20% of surface is recent patches.',
  'Severe bleeding / blackening': 'Major bitumen rise — surface dressing inappropriate.',
};

const SD_SINGLE_DRESSING = {
  VeryHard: { A:'multi', B:'multi', C:'multi', D:'multi', E:{size:'S10',binder:1.5}, F:{size:'S6',binder:1.5}, G:{size:'S6',binder:1.5}, H:{size:'S6',binder:1.5} },
  Hard:     { A:'multi', B:{size:'S10',binder:1.8}, C:{size:'S10',binder:1.8}, D:{size:'S10',binder:1.6}, E:{size:'S10',binder:1.6}, F:{size:'S6',binder:1.5}, G:{size:'S6',binder:1.5}, H:{size:'S6',binder:1.5} },
  Normal:   { A:'multi', B:'multi', C:'multi', D:{size:'S10',binder:1.6}, E:{size:'S10',binder:1.6}, F:{size:'S10',binder:1.6}, G:{size:'S10',binder:1.5}, H:{size:'S6',binder:1.5} },
  Soft:     { A:null, B:null, C:null, D:null, E:null, F:null, G:null, H:{size:'S6',binder:1.4} },
  VerySoft: { A:null, B:null, C:null, D:null, E:null, F:null, G:null, H:null },
  Variable: { A:null, B:null, C:null, D:null, E:null, F:null, G:null, H:null },
};

const SD_RACKED_IN = {
  VeryHard: { A:{size:'R10',binder:1.9}, B:{size:'R10',binder:1.9}, C:{size:'R10',binder:1.9}, D:{size:'R10',binder:1.9}, E:{size:'R10',binder:1.9}, F:{size:'R10',binder:2.0}, G:{size:'R10',binder:2.0}, H:'unnecessary' },
  Hard:     { A:{size:'R14',binder:2.1}, B:{size:'R10',binder:1.8}, C:{size:'R10',binder:1.8}, D:{size:'R10',binder:1.8}, E:{size:'R10',binder:1.8}, F:{size:'R10',binder:1.9}, G:{size:'R10',binder:2.0}, H:'unnecessary' },
  Normal:   { A:{size:'R14',binder:2.0}, B:{size:'R14',binder:2.0}, C:{size:'R14',binder:2.0}, D:{size:'R14/R10',binder:1.8}, E:{size:'R10',binder:1.8}, F:{size:'R10',binder:1.9}, G:{size:'R10',binder:1.9}, H:'unnecessary' },
  Soft:     { A:null, B:null, C:null, D:{size:'R14',binder:2.0}, E:{size:'R14',binder:2.0}, F:{size:'R14',binder:1.8}, G:{size:'R10',binder:1.7}, H:'unnecessary' },
  VerySoft: { A:null, B:null, C:null, D:{size:'R14',binder:1.9}, E:{size:'R14',binder:1.6}, F:{size:'R10',binder:1.6}, G:{size:'R10',binder:1.7}, H:'unnecessary' },
  Variable: { A:null, B:null, C:null, D:{size:'R14',binder:1.9}, E:{size:'R14',binder:1.8}, F:{size:'R10',binder:1.8}, G:{size:'R10',binder:1.8}, H:'unnecessary' },
};

const SD_DOUBLE_DRESSING = {
  VeryHard: { A:{size:'D10/D10',l1:1.1,l2:1.2}, B:{size:'D10/D10',l1:1.1,l2:1.2}, C:{size:'D10/D10',l1:1.1,l2:1.2}, D:{size:'D10/D10',l1:1.1,l2:1.2}, E:{size:'D10/D10',l1:1.1,l2:1.2}, F:{size:'D10/D10',l1:1.2,l2:1.2}, G:{size:'D10/D10',l1:1.2,l2:1.3}, H:{size:'D10/D10',l1:1.2,l2:1.3} },
  Hard:     { A:{size:'D10',l1:1.0,l2:1.2}, B:{size:'D10',l1:1.0,l2:1.2}, C:{size:'D10',l1:1.0,l2:1.2}, D:{size:'D10',l1:1.0,l2:1.2}, E:{size:'D10',l1:1.0,l2:1.2}, F:{size:'D10',l1:1.1,l2:1.3}, G:{size:'D10',l1:1.1,l2:1.3}, H:{size:'D10',l1:1.1,l2:1.3} },
  Normal:   { A:{size:'D14/D10',l1:1.2,l2:1.3}, B:{size:'D14/D10',l1:1.2,l2:1.3}, C:{size:'D14/D10',l1:1.2,l2:1.3}, D:{size:'D14/D10',l1:1.2,l2:1.2}, E:{size:'D10',l1:1.0,l2:1.1}, F:{size:'D10',l1:1.0,l2:1.1}, G:{size:'D10',l1:1.0,l2:1.2}, H:{size:'D10',l1:1.0,l2:1.2} },
  Soft:     { A:null, B:null, C:null, D:{size:'D14',l1:1.0,l2:1.0}, E:{size:'D14/D10',l1:1.0,l2:1.1}, F:{size:'D14/D10',l1:1.0,l2:1.1}, G:{size:'D10',l1:1.1,l2:1.1}, H:{size:'D10',l1:1.1,l2:1.1} },
  VerySoft: { A:null, B:null, C:null, D:{size:'D14',l1:0.8,l2:1.0}, E:{size:'D14',l1:0.8,l2:1.0}, F:{size:'D14',l1:0.8,l2:1.1}, G:{size:'D10',l1:1.0,l2:1.1}, H:{size:'D10',l1:1.0,l2:1.1} },
  Variable: { A:null, B:null, C:null, D:{size:'D14',l1:1.0,l2:1.1}, E:{size:'D14/D10',l1:1.0,l2:1.1}, F:{size:'D14/D10',l1:1.0,l2:1.1}, G:{size:'D10',l1:1.0,l2:1.1}, H:{size:'D10',l1:1.0,l2:1.1} },
};

const SD_INVERTED_DOUBLE = {
  Hard:     { A:{size:'D14',l1:0.9,l2:1.4}, B:{size:'D14',l1:0.9,l2:1.4}, C:{size:'D14',l1:1.0,l2:1.4}, D:{size:'D14',l1:1.0,l2:1.4}, E:{size:'D14',l1:1.0,l2:1.4}, F:{size:'D14',l1:1.0,l2:1.4}, G:{size:'D14',l1:1.1,l2:1.4}, H:{size:'D14',l1:1.1,l2:1.5} },
  Normal:   { A:{size:'D14',l1:0.9,l2:1.4}, B:{size:'D14',l1:0.9,l2:1.4}, C:{size:'D14',l1:1.0,l2:1.4}, D:{size:'D14',l1:1.0,l2:1.4}, E:{size:'D14',l1:1.0,l2:1.4}, F:{size:'D14',l1:1.0,l2:1.4}, G:{size:'D14',l1:1.1,l2:1.4}, H:{size:'D14',l1:1.1,l2:1.5} },
  VeryHard: { A:{size:'D14',l1:0.9,l2:1.4}, B:{size:'D14',l1:0.9,l2:1.4}, C:{size:'D14',l1:1.0,l2:1.4}, D:{size:'D14',l1:1.0,l2:1.4}, E:{size:'D14',l1:1.0,l2:1.4}, F:{size:'D14',l1:1.0,l2:1.4}, G:{size:'D14',l1:1.1,l2:1.4}, H:{size:'D14',l1:1.1,l2:1.5} },
  Soft:     { A:null,B:null,C:null,D:null,E:null,F:null,G:null,H:null },
  VerySoft: { A:null,B:null,C:null,D:null,E:null,F:null,G:null,H:null },
  Variable: { A:'expert',B:'expert',C:'expert',D:'expert',E:'expert',F:'expert',G:'expert',H:'expert' },
};

const SD_SANDWICH = {
  Hard:     { A:'expert',B:'expert',C:'expert',D:{size:'D10',l1:0.0,l2:1.4},E:{size:'D10',l1:0.0,l2:1.4},F:{size:'D10',l1:0.0,l2:1.4},G:{size:'D10',l1:0.0,l2:1.5},H:{size:'D10',l1:0.0,l2:1.5} },
  Normal:   { A:'expert',B:'expert',C:'expert',D:{size:'D10',l1:0.0,l2:1.4},E:{size:'D10',l1:0.0,l2:1.4},F:{size:'D10',l1:0.0,l2:1.4},G:{size:'D10',l1:0.0,l2:1.5},H:{size:'D10',l1:0.0,l2:1.5} },
  VeryHard: { A:'expert',B:'expert',C:'expert',D:{size:'D10',l1:0.0,l2:1.4},E:{size:'D10',l1:0.0,l2:1.4},F:{size:'D10',l1:0.0,l2:1.4},G:{size:'D10',l1:0.0,l2:1.5},H:{size:'D10',l1:0.0,l2:1.5} },
  Soft:     { A:null,B:null,C:null,D:null,E:null,F:null,G:null,H:null },
  VerySoft: { A:null,B:null,C:null,D:null,E:null,F:null,G:null,H:null },
  Variable: { A:'expert',B:'expert',C:'expert',D:{size:'D10',l1:0.0,l2:1.5},E:{size:'D10',l1:0.0,l2:1.5},F:{size:'D10',l1:0.0,l2:1.5},G:{size:'D10',l1:0.0,l2:1.5},H:{size:'D10',l1:0.0,l2:1.5} },
};

const SD_CHIPPING_SPREAD = {
  '2.8/6.3': { min: 8,  max: 11 },
  '6.3/10':  { min: 10, max: 14 },
  '8/14':    { min: 12, max: 16 },
};

const SD_SIZE_CODE_MAP = {
  S6:'2.8/6.3', S10:'6.3/10', S14:'8/14',
  R10:'6.3/10', R14:'8/14', 'R14/R10':'8/14',
  D10:'6.3/10', D14:'8/14', 'D14/D10':'8/14', 'D10/D10':'6.3/10',
};

const SD_CHIPPING_DESIGNATIONS = {
  S14:'8/14 mm (S14)', S10:'6.3/10 mm (S10)', S6:'2.8/6.3 mm (S6)',
  R14:'8/14 & 2.8/6.3 mm (R14)', R10:'6.3/10 & 2.8/6.3 mm (R10)',
  R10b:'6.3/10 & 4/2 mm (R10)', D14:'8/14 & 2.8/6.3 mm (D14)', D10:'6.3/10 & 2.8/6.3 mm (D10)',
};

const SD_ADJUSTMENTS = {
  season:      { early: 0, late: +0.2 },
  shape:       { f10: -0.1, f15: 0, f20: +0.1, f25: 'expert' },
  shade:       { open: 0, partial: +0.1, full: +0.2 },
  condition:   { veryRich: -0.2, rich: -0.1, normal: 0, wheelTracks: +0.1, lean: +0.2 },
  gradient_mag:{ lt5: 0, mid: +0.1, gt10: +0.2 },
  gradient_dir:{ uphill: -0.2, downhill: 0 },
  speed:       { high: +0.1, low: 0 },
  localTraffic:{ normal: 0, untrafficked: +0.2 },
  aggregate:   { rock: 0, blast: 0, steel: 0, gravel: +0.1 },
};

const SD_SEASON_DATA = {
  A: {
    S14:['high','high','sig','low','low','low','low','low','low','sig','high','high'],
    S10:['high','high','sig','low','low','low','low','low','low','low','sig','high'],
    R14:['high','high','sig','low','low','low','low','low','low','sig','high','high'],
    S6: ['high','high','sig','low','low','low','low','low','low','sig','high','high'],
    R10:['high','high','sig','low','low','low','low','low','low','low','sig','high'],
    D14:['high','sig','low','low','low','low','low','low','low','low','sig','high'],
    D10:['high','sig','low','low','low','low','low','low','low','low','sig','high'],
  },
  B: {
    S14:['high','high','high','sig','low','low','low','low','low','sig','high','high'],
    S10:['high','high','sig','sig','low','low','low','low','low','sig','high','high'],
    R14:['high','high','high','sig','low','low','low','low','low','sig','high','high'],
    S6: ['high','high','high','sig','low','low','low','low','low','sig','high','high'],
    R10:['high','high','sig','sig','low','low','low','low','low','sig','high','high'],
    D14:['high','high','sig','low','low','low','low','low','low','sig','high','high'],
    D10:['high','high','sig','sig','low','low','low','low','low','sig','high','high'],
  },
  'C/D': {
    S14:['high','high','high','high','sig','low','low','low','sig','high','high','high'],
    S10:['high','high','high','sig','sig','low','low','low','sig','sig','high','high'],
    R14:['high','high','high','high','sig','low','low','low','sig','sig','high','high'],
    S6: ['high','high','high','high','sig','low','low','low','sig','high','high','high'],
    R10:['high','high','high','sig','sig','low','low','low','sig','sig','high','high'],
    D14:['high','high','high','sig','low','low','low','low','low','sig','high','high'],
    D10:['high','high','high','sig','sig','low','low','low','sig','sig','high','high'],
  },
};

const SD_RISK_COLORS = { high:'var(--red)', sig:'var(--amber)', low:'var(--green)' };
const SD_RISK_LABELS = { high:'High risk', sig:'Significant risk', low:'Low risk' };

const SD_SERIES_700 = [
  { item:'7/084', desc:'Single SD, 6mm PSV60+, K1-70 unmodified',         binder:1.5, size:'S6',  rates:{small:5.85,medium:4.10,large:3.20} },
  { item:'7/085', desc:'Single SD, 6mm PSV65+, intermediate binder',       binder:1.5, size:'S6',  rates:{small:6.15,medium:4.35,large:3.45} },
  { item:'7/086', desc:'Single SD, 10mm PSV60+, K1-70 unmodified',         binder:1.6, size:'S10', rates:{small:6.05,medium:4.25,large:3.35} },
  { item:'7/087', desc:'Single SD, 10mm PSV60+, intermediate binder',      binder:1.6, size:'S10', rates:{small:6.35,medium:4.50,large:3.60} },
  { item:'7/088', desc:'Single SD, 10mm PSV65+, intermediate binder',      binder:1.8, size:'S10', rates:{small:6.65,medium:4.80,large:4.07} },
  { item:'7/089', desc:'Single SD, 10mm PSV65+, premium binder',           binder:1.8, size:'S10', rates:{small:7.10,medium:5.15,large:4.40} },
  { item:'7/090', desc:'Racked-in, 10/6mm PSV60+, intermediate binder',    binder:1.8, size:'R10', rates:{small:7.95,medium:5.85,large:4.75} },
  { item:'7/091', desc:'Racked-in, 10/6mm PSV65+, intermediate binder',    binder:1.8, size:'R10', rates:{small:8.30,medium:6.15,large:5.05} },
  { item:'7/092', desc:'Racked-in, 10/6mm PSV65+, premium binder',         binder:1.8, size:'R10', rates:{small:8.85,medium:6.55,large:5.45} },
  { item:'7/093', desc:'Racked-in, 14/6mm PSV60+, intermediate binder',    binder:2.0, size:'R14', rates:{small:8.45,medium:6.25,large:5.10} },
  { item:'7/094', desc:'Racked-in, 14/6mm PSV65+, intermediate binder',    binder:2.0, size:'R14', rates:{small:8.85,medium:6.55,large:5.45} },
  { item:'7/095', desc:'Racked-in, 14/6mm PSV65+, premium binder',         binder:2.0, size:'R14', rates:{small:9.40,medium:7.00,large:5.85} },
  { item:'7/096', desc:'Double SD, 10/6mm PSV60+, intermediate binder',    binder:2.2, size:'D10', rates:{small:9.85,medium:7.40,large:6.15} },
  { item:'7/097', desc:'Double SD, 10/6mm PSV65+, premium binder',         binder:2.2, size:'D10', rates:{small:10.65,medium:8.05,large:6.75} },
  { item:'7/098', desc:'Double SD, 14/6mm PSV60+, intermediate binder',    binder:2.5, size:'D14', rates:{small:10.40,medium:7.85,large:6.55} },
  { item:'7/099', desc:'Double SD, 14/6mm PSV65+, premium binder',         binder:2.5, size:'D14', rates:{small:11.20,medium:8.50,large:7.15} },
];

const SD_QTY_BAND       = (m2) => m2 < 500 ? 'small' : m2 <= 5000 ? 'medium' : 'large';
const SD_QTY_BAND_LABEL = { small:'< 500 m²', medium:'500–5,000 m²', large:'> 5,000 m²' };
const SD_RATES_KEY      = 'sd_designer_rate_overrides_v1';

const sdBlankDesign = () => ({
  // Site (separate from scheme fields, used for proforma)
  roadNumber:   '',
  regionArea:   'Dundee City',
  laneId:       'NB',
  numLanes:     '2',
  length:       '',
  width:        '',
  areaM2:       '',
  schemeRef:    'SD 26-27',
  // Traffic
  cvDay:        '',
  trafficSpeed: '30',
  // Location / temperature
  location:     'North',
  // Hardness
  rhProbeDepth: '',
  rhProbeTemp:  '20',
  hardness:     'Normal',
  // Surface
  surfaceCondition: 'Normal & homogeneous',
  condition:        'normal',
  // Geometry
  radiusCurvature:  'over250',
  junctionCrossing: 'nonApproach',
  gradientMag:      'lt5',
  gradientDir:      'flat',
  // PSV / AAV
  minPSV: '65',
  maxAAV: '14',
  // Site features
  highStressBraking: false,
  // Treatment
  dressingType: 'auto',
  binderGrade:  'intermediate',
  // Adjustments
  season:       'early',
  shape:        'f15',
  shade:        'open',
  speed:        'low',
  localTraffic: 'normal',
  aggregate:    'rock',
  installMonth: 7,
  // Pricing
  selectedItem: '',
  // Designer
  designerName:      '',
  designerInitials:  '',
  designDate:        new Date().toISOString().slice(0, 10),
  notes:             '',
});

// ─── Component ───────────────────────────────────────────────────────────────

function SurfaceDressingDesigner({ schemeId }) {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);

  const [view, setView]                     = React.useState('design');
  const [showAssessmentHelp, setShowHelp]   = React.useState(false);
  const [showRateEditor, setShowRateEditor] = React.useState(false);
  const [portalOpen, setPortalOpen]         = React.useState(false);
  const [activeStep, setActiveStep]         = React.useState(0);
  const portalBodyRef                        = React.useRef(null);
  const stepRefs                             = React.useRef(Array(9).fill(null));
  const [rateOverrides, setRateOverrides]   = React.useState(() => {
    try { const v = localStorage.getItem(SD_RATES_KEY); return v ? JSON.parse(v) : {}; }
    catch { return {}; }
  });

  // Persist rate overrides to localStorage. If the write fails (quota
  // exhaustion / private browsing sandbox), surface a Toast so the user
  // doesn't think their edits saved and silently lose them on refresh.
  // The bare catch{} that used to live here was the same bug class as
  // A7 — only on a per-component basis instead of via the central
  // SchemeContext.
  React.useEffect(() => {
    try {
      localStorage.setItem(SD_RATES_KEY, JSON.stringify(rateOverrides));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[SD] rate-override save failed:', e);
      if (window.Toast) {
        window.Toast.show({
          kind: 'error',
          msg: "Couldn't save SD rate overrides — browser storage may be full.",
          duration: 10000,
        });
      }
    }
  }, [rateOverrides]);

  const effectiveSeries700 = React.useMemo(() =>
    SD_SERIES_700.map(item => rateOverrides[item.item] ? { ...item, rates: rateOverrides[item.item] } : item),
    [rateOverrides]
  );

  // Active SD design — merge scheme.sd_design over defaults
  const active = React.useMemo(() => ({
    ...sdBlankDesign(),
    ...(scheme.sd_design || {}),
  }), [scheme.sd_design]);

  const update = (patch) => {
    updateScheme(schemeId, { sd_design: { ...(scheme.sd_design || {}), ...patch } });
  };

  // Pre-populate from parent scheme on first open
  React.useEffect(() => {
    if (scheme.sd_design) return;
    const patch = {};
    if (scheme.road_name) patch.siteName = scheme.road_name;
    if (scheme.project_number) patch.schemeRef = scheme.project_number;
    const area = window.schemeArea ? window.schemeArea(scheme) : 0;
    if (area > 0) patch.areaM2 = String(area);
    updateScheme(schemeId, { sd_design: { ...sdBlankDesign(), ...patch } });
    // Runs once when the SD-Design tab is first opened for this scheme.
    // The early-return on `scheme.sd_design` makes this idempotent; on
    // remount (e.g. switching schemes) the new scheme either already
    // has sd_design and we no-op, or we seed it freshly. Listing
    // scheme/schemeId/updateScheme in deps would cause a useless
    // re-run on every parent rerender.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Portal: scroll-reveal + active-step tracking via IntersectionObserver
  React.useEffect(() => {
    if (!portalOpen) return;
    const body = portalBodyRef.current;
    const refs = stepRefs.current.filter(Boolean);
    if (!refs.length) return;

    const revealObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('sd-revealed'); });
    }, { threshold: 0.1 });

    const trackObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = stepRefs.current.indexOf(e.target);
          if (idx !== -1) setActiveStep(idx);
        }
      });
    }, { root: body, threshold: 0.25 });

    refs.forEach(r => { revealObs.observe(r); trackObs.observe(r); });
    return () => { revealObs.disconnect(); trackObs.disconnect(); };
  }, [portalOpen]);

  // Auto-derive area from length × width if blank
  React.useEffect(() => {
    const l = parseFloat(active.length);
    const w = parseFloat(active.width);
    if (!isNaN(l) && !isNaN(w) && !active.areaM2) {
      update({ areaM2: (l * w).toFixed(0) });
    }
  }, [active.length, active.width]);

  // ── Derived values ──────────────────────────────────────────────────────────

  const trafficCat = React.useMemo(() => {
    const n = parseFloat(active.cvDay);
    if (isNaN(n)) return null;
    return SD_TRAFFIC_CATEGORIES.find(t => n >= t.min && n <= t.max);
  }, [active.cvDay]);

  const tempCat = SD_LOCATION_TEMP_CAT[active.location] || 'C/D';

  const suitability = React.useMemo(() => {
    if (!trafficCat) return null;
    const code = SD_SUITABILITY_MATRIX[active.surfaceCondition]?.[trafficCat.cat];
    return code ? { code, ...SD_SUITABILITY_KEY[code] } : null;
  }, [active.surfaceCondition, trafficCat]);

  const probeHardness = React.useMemo(() => {
    if (!active.rhProbeDepth) return null;
    return SD_HARDNESS_FROM_PROBE(parseFloat(active.rhProbeDepth));
  }, [active.rhProbeDepth]);

  const dressingRecommendation = React.useMemo(() => {
    if (!trafficCat) return null;
    const cat       = trafficCat.cat;
    const speed     = parseInt(active.trafficSpeed) || 30;
    const isLight   = ['G','H'].includes(cat);
    const isHeavy   = ['A','B','C','D','E','F'].includes(cat);
    const tightCurve = active.radiusCurvature === 'under100' || active.radiusCurvature === '100to250';
    const steepGrad  = active.gradientMag === 'gt10';
    const isApproach = active.junctionCrossing === 'approach';

    if (active.highStressBraking) {
      return { type:'hfs', label:'High Friction Surfacing', reason:'High-stress braking zone — surface dressing not appropriate. Use HFS instead.' };
    }
    if (isLight) {
      if (tightCurve || steepGrad || speed >= 50 || isApproach)
        return { type:'racked', label:'Racked-in (intermediate binder)', reason:'Light traffic but high-stress features. Racked-in or double recommended (Fig. 8.3a).' };
      if (['Soft','Very Soft'].includes(active.hardness))
        return { type:'racked', label:'Racked-in or sandwich', reason:'Soft/very soft hardness — racked-in or sandwich preferred (Fig. 8.3a).' };
      if (active.hardness === 'Variable' || active.surfaceCondition.includes('variable') || active.surfaceCondition.includes('patching') || active.surfaceCondition.includes('Fatting'))
        return { type:'sandwich', label:'Sandwich, inverted, or double dressing', reason:'Variable / patched / fatted surface — sandwich or double preferred (Fig. 8.3a).' };
      if (cat === 'H' && ['Very Hard','Hard','Normal'].includes(active.hardness))
        return { type:'single', label:'Single SD with unmodified binder', reason:'Easy conditions, light traffic, hard/normal surface (Fig. 8.3a).' };
      return { type:'single', label:'Single SD with intermediate binder', reason:'Light traffic, hard/normal homogeneous surface (Fig. 8.3a).' };
    }
    if (isHeavy) {
      if (active.hardness === 'Very Hard' && ['A','B','C'].includes(cat))
        return { type:'inverted', label:'Inverted Double with intermediate/premium binder', reason:'Heavy traffic on very hard surface — inverted double creates a false base for embedment (Fig. 8.3b).' };
      if (['Very Hard','Hard','Normal'].includes(active.hardness) && ['A','B','C'].includes(cat)) {
        if (tightCurve || steepGrad || isApproach)
          return { type:'double', label:'Double SD with premium / super-premium binder', reason:'Heavy traffic + bends/gradient/junction. Premium-grade binder per RN39 Fig. 8.3b note 2.' };
        return { type:'racked', label:'Racked-in with premium binder', reason:'Heavy traffic, hard/normal homogeneous. Premium binder; double where noise is a concern (Fig. 8.3b).' };
      }
      if (['Soft','Very Soft','Variable'].includes(active.hardness))
        return { type:'racked', label:'Racked-in or double SD', reason:'Soft/variable hardness with heavy traffic (Fig. 8.3b).' };
      return { type:'racked', label:'Racked-in or double SD', reason:'Heavy traffic — racked-in or double recommended (Fig. 8.3b).' };
    }
    return { type:'single', label:'Single SD', reason:'Default recommendation.' };
  }, [active, trafficCat]);

  const activeType = active.dressingType === 'auto' ? dressingRecommendation?.type : active.dressingType;

  const baseDesign = React.useMemo(() => {
    if (!trafficCat || !activeType || activeType === 'hfs') return null;
    const hk = active.hardness.replace(/\s/g, '');
    const table = activeType === 'single'   ? SD_SINGLE_DRESSING
                : activeType === 'racked'   ? SD_RACKED_IN
                : activeType === 'double'   ? SD_DOUBLE_DRESSING
                : activeType === 'inverted' ? SD_INVERTED_DOUBLE
                : activeType === 'sandwich' ? SD_SANDWICH : null;
    return table?.[hk]?.[trafficCat.cat] ?? null;
  }, [active.hardness, trafficCat, activeType]);

  const totalAdjustment = React.useMemo(() => {
    let adj = 0, expert = false;
    const components = {};
    const apply = (key, v) => {
      if (v === 'expert') { expert = true; components[key] = 'expert'; }
      else if (typeof v === 'number') { adj += v; components[key] = v; }
    };
    apply('season',      SD_ADJUSTMENTS.season[active.season]);
    apply('aggregate',   SD_ADJUSTMENTS.aggregate[active.aggregate]);
    apply('shape',       SD_ADJUSTMENTS.shape[active.shape]);
    apply('shade',       SD_ADJUSTMENTS.shade[active.shade]);
    apply('condition',   SD_ADJUSTMENTS.condition[active.condition]);
    const gradMag = SD_ADJUSTMENTS.gradient_mag[active.gradientMag] ?? 0;
    apply('gradient', active.gradientDir === 'uphill' ? -gradMag : gradMag);
    apply('speed',       SD_ADJUSTMENTS.speed[active.speed]);
    apply('localTraffic',SD_ADJUSTMENTS.localTraffic[active.localTraffic]);
    const capped = Math.max(-0.2, Math.min(0.4, adj));
    return { raw: adj, capped, expert, wasCapped: adj !== capped, components };
  }, [active]);

  const finalRates = React.useMemo(() => {
    if (!baseDesign || typeof baseDesign === 'string') return null;
    const isMulti = activeType === 'double' || activeType === 'inverted' || activeType === 'sandwich';
    if (isMulti) {
      return {
        l1: +(baseDesign.l1 + (activeType === 'sandwich' ? 0 : totalAdjustment.capped)).toFixed(2),
        l2: +(baseDesign.l2 + totalAdjustment.capped).toFixed(2),
        size: baseDesign.size,
      };
    }
    return { binder: +(baseDesign.binder + totalAdjustment.capped).toFixed(2), size: baseDesign.size };
  }, [baseDesign, totalAdjustment, activeType]);

  const chippingSpread = React.useMemo(() => {
    if (!finalRates?.size) return null;
    const nominal = SD_SIZE_CODE_MAP[finalRates.size.split('/')[0]];
    return nominal ? { nominal, ...SD_CHIPPING_SPREAD[nominal] } : null;
  }, [finalRates]);

  const seasonalRisk = React.useMemo(() => {
    if (!finalRates?.size) return null;
    const primary = finalRates.size.split('/')[0];
    return SD_SEASON_DATA[tempCat]?.[primary]?.[active.installMonth - 1] ?? null;
  }, [finalRates, active.installMonth, tempCat]);

  const matchingItems = React.useMemo(() => {
    if (!finalRates?.size || !activeType || activeType === 'hfs') return [];
    const primary    = finalRates.size.split('/')[0];
    const typePrefix = activeType === 'single' ? 'S' : activeType === 'racked' ? 'R' : 'D';
    return effectiveSeries700.filter(i => i.size[0] === typePrefix && i.size === primary);
  }, [finalRates, activeType, effectiveSeries700]);

  // Auto-select best matching item
  React.useEffect(() => {
    if (matchingItems.length === 0) return;
    if (active.selectedItem && matchingItems.some(i => i.item === active.selectedItem)) return;
    const psvNum = parseInt(active.minPSV) >= 65 ? 65 : 60;
    const grade  = active.binderGrade === 'superpremium' ? 'premium' : active.binderGrade;
    let best = matchingItems.find(i => i.desc.includes(`PSV${psvNum}+`) && i.desc.toLowerCase().includes(grade));
    if (!best) best = matchingItems.find(i => i.desc.includes(`PSV${psvNum}+`));
    if (!best) best = matchingItems[0];
    if (best && best.item !== active.selectedItem) update({ selectedItem: best.item });
  }, [matchingItems, active.minPSV, active.binderGrade]);

  const selectedRate = React.useMemo(() => {
    if (!active.selectedItem || !active.areaM2) return null;
    const item = effectiveSeries700.find(i => i.item === active.selectedItem);
    if (!item) return null;
    const area = parseFloat(active.areaM2);
    if (isNaN(area)) return null;
    const band = SD_QTY_BAND(area);
    return { item, band, rate: item.rates[band], total: item.rates[band] * area };
  }, [active.selectedItem, active.areaM2, effectiveSeries700]);

  const SD_STEP_LABELS = ['Site','Traffic','Hardness','Surface','Treatment','Adjustments','Seasonal','Pricing','Designer'];

  const stepComplete = React.useMemo(() => [
    Boolean(active.areaM2 && active.roadNumber),
    Boolean(active.cvDay),
    Boolean(active.rhProbeDepth),
    Boolean(trafficCat && suitability),
    Boolean(baseDesign && typeof baseDesign === 'object'),
    !totalAdjustment.expert,
    Boolean(seasonalRisk && seasonalRisk !== 'high'),
    Boolean(selectedRate),
    Boolean(active.designerName),
  ], [active, trafficCat, suitability, baseDesign, totalAdjustment, seasonalRisk, selectedRate]);

  const completedCount = stepComplete.filter(Boolean).length;

  const scrollToStep = (i) => {
    const el = stepRefs.current[i];
    if (el && portalBodyRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveStep(i);
    }
  };

  const months  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const today   = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' });
  const isMultiLayer = activeType === 'double' || activeType === 'inverted' || activeType === 'sandwich';

  function fmtAdj(v) {
    if (v === undefined) return '';
    if (v === 'expert') return 'EXP';
    if (typeof v !== 'number') return '';
    return v === 0 ? '0' : (v > 0 ? '+' : '') + v.toFixed(1);
  }

  // ── Proforma render ─────────────────────────────────────────────────────────

  const renderProforma = () => {
    const proformaChip = finalRates?.size?.split('/')[0] || '';
    const isChipOn = (k) => k !== 'R10b' && proformaChip === k;
    // sd-pf-scroll wrapper lets the fixed-width 210mm proforma scroll
    // horizontally inside its tab on phones rather than overflow the
    // viewport. On desktop the wrapper is a no-op (page fits).
    return (
      <div className="sd-pf-scroll">
      <div className="sd-pf-page">
        <div className="sd-pf-title">PROFORMA FOR RECORDING DESIGNS</div>
        <div className="sd-pf-subtitle">Design of road surface dressings to Road Note 39 (Seventh Edition)</div>

        <div className="sd-pf-line">
          <div className="sd-pf-lbl">Road number:</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 130px 1fr',gap:6,alignItems:'center'}}>
            <div className="sd-pf-val">{active.roadNumber}</div>
            <div className="sd-pf-lbl" style={{textAlign:'right'}}>Region/Area:</div>
            <div className="sd-pf-val">{active.regionArea}</div>
          </div>
        </div>
        <div className="sd-pf-line">
          <div className="sd-pf-lbl">Section location:</div>
          <div className="sd-pf-val sd-pf-val-fill">{scheme.road_name || active.siteName}</div>
        </div>
        <div className="sd-pf-line">
          <div className="sd-pf-lbl">Length:</div>
          <div style={{display:'grid',gridTemplateColumns:'80px 18px 70px 80px 18px 70px 80px 60px 1fr 18px',gap:4,alignItems:'center',fontSize:9.5}}>
            <div className="sd-pf-val">{active.length}</div><div className="sd-pf-unit">m</div>
            <div className="sd-pf-lbl">Width:</div>
            <div className="sd-pf-val">{active.width}</div><div className="sd-pf-unit">m</div>
            <div className="sd-pf-lbl">No. of lanes:</div>
            <div className="sd-pf-val">{active.numLanes}</div>
            <div className="sd-pf-lbl">Area:</div>
            <div className="sd-pf-val">{active.areaM2 ? parseFloat(active.areaM2).toLocaleString() : ''}</div>
            <div className="sd-pf-unit">m²</div>
          </div>
        </div>
        <div className="sd-pf-line">
          <div className="sd-pf-lbl">Lane(s):</div>
          <div style={{display:'grid',gridTemplateColumns:'70px 130px 90px 130px 1fr',gap:6,alignItems:'center'}}>
            <div className="sd-pf-val">{active.laneId}</div>
            <div className="sd-pf-lbl">Medium/Heavy Traffic:</div>
            <div className="sd-pf-val-suffix"><span>{active.cvDay}</span><span className="sd-pf-unit">cv/l/d</span></div>
            <div className="sd-pf-lbl">NRSWA road type:</div>
            <div className="sd-pf-val">{trafficCat?.nrswa ?? ''}</div>
          </div>
        </div>
        <div className="sd-pf-line">
          <div className="sd-pf-lbl sd-pf-lbl-req">Traffic Speed:</div>
          <div><span className="sd-pf-val-suffix" style={{minWidth:120}}><span>{active.trafficSpeed}</span><span className="sd-pf-unit">mph</span></span></div>
        </div>

        <div className="sd-pf-srow">
          <div className="sd-pf-srow-label sd-pf-lbl-req">Traffic category:</div>
          <div className="sd-pf-options">
            {['A','B','C','D','E','F','G','H'].map(c => (
              <div key={c} className={`sd-pf-opt ${trafficCat?.cat === c ? 'sd-pf-opt-on' : ''}`} style={{flex:1,minWidth:0}}>{c}</div>
            ))}
          </div>
        </div>

        <div className="sd-pf-srow">
          <div className="sd-pf-srow-label sd-pf-lbl-req">Location:</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:8,alignItems:'center'}}>
            <div className="sd-pf-options">
              {['South','Central','North'].map(l => (
                <div key={l} className={`sd-pf-opt sd-pf-opt-wide ${active.location === l ? 'sd-pf-opt-on' : ''}`} style={{flex:1}}>{l}</div>
              ))}
            </div>
            <div className="sd-pf-srow-label sd-pf-lbl-req">Temperature Category:</div>
            <div className="sd-pf-options">
              {['A','B','C','D'].map(t => {
                const on = (tempCat === 'C/D' && (t === 'C' || t === 'D')) || tempCat === t;
                return <div key={t} className={`sd-pf-opt ${on ? 'sd-pf-opt-on' : ''}`} style={{flex:1}}>{t}</div>;
              })}
            </div>
          </div>
        </div>

        <div className="sd-pf-srow">
          <div className="sd-pf-srow-label">Road Hardness (RH) probe depth:</div>
          <div style={{display:'grid',gridTemplateColumns:'70px 18px 30px 60px 22px 70px 1fr 70px 1fr',gap:4,alignItems:'center'}}>
            <div className="sd-pf-val">{active.rhProbeDepth}</div><div className="sd-pf-unit">mm</div>
            <div className="sd-pf-lbl">at</div>
            <div className="sd-pf-val">{active.rhProbeTemp}</div><div className="sd-pf-unit">°C</div>
            <div className="sd-pf-lbl">Min. PSV:</div>
            <div className="sd-pf-val">{active.minPSV}</div>
            <div className="sd-pf-lbl">Max. AAV:</div>
            <div className="sd-pf-val">{active.maxAAV}</div>
          </div>
        </div>

        <div className="sd-pf-srow">
          <div className="sd-pf-srow-label sd-pf-lbl-req">RH Category:</div>
          <div className="sd-pf-options">
            {['Very Hard','Hard','Normal','Soft','Very Soft','Variable'].map(h => (
              <div key={h} className={`sd-pf-opt sd-pf-opt-wide ${active.hardness === h ? 'sd-pf-opt-on' : ''}`} style={{flex:1}}>{h}</div>
            ))}
          </div>
        </div>

        <div className="sd-pf-srow">
          <div className="sd-pf-srow-label sd-pf-lbl-req">Surface condition:</div>
          <div className="sd-pf-options">
            {[
              {k:'veryRich',l:'Very binder rich'},{k:'rich',l:'Binder Rich'},
              {k:'normal',l:'Normal'},{k:'wheelTracks',l:'Texture in wheel tracks'},{k:'lean',l:'Binder lean/Porous'},
            ].map(o => (
              <div key={o.k} className={`sd-pf-opt sd-pf-opt-wide ${active.condition === o.k ? 'sd-pf-opt-on' : ''}`} style={{flex:1}}>{o.l}</div>
            ))}
          </div>
        </div>

        <div className="sd-pf-srow">
          <div className="sd-pf-srow-label sd-pf-lbl-req">Radius of curvature:</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto 110px',gap:10,alignItems:'center'}}>
            <div className="sd-pf-options">
              {[{k:'under100',l:'Under 100 m'},{k:'100to250',l:'100 – 250 m'},{k:'over250',l:'over 250 m'}].map(o => (
                <div key={o.k} className={`sd-pf-opt sd-pf-opt-wide ${active.radiusCurvature === o.k ? 'sd-pf-opt-on' : ''}`} style={{flex:1}}>{o.l}</div>
              ))}
            </div>
            <div className="sd-pf-srow-label">Expected Month on Site:</div>
            <div className="sd-pf-val">{months[active.installMonth - 1]}</div>
          </div>
        </div>

        <div className="sd-pf-srow">
          <div className="sd-pf-srow-label sd-pf-lbl-req">Junction or crossing:</div>
          <div className="sd-pf-options" style={{maxWidth:280}}>
            <div className={`sd-pf-opt sd-pf-opt-wide ${active.junctionCrossing === 'approach' ? 'sd-pf-opt-on' : ''}`} style={{flex:1}}>Approach</div>
            <div className={`sd-pf-opt sd-pf-opt-wide ${active.junctionCrossing === 'nonApproach' ? 'sd-pf-opt-on' : ''}`} style={{flex:1}}>Non-approach</div>
          </div>
        </div>

        <div className="sd-pf-srow">
          <div className="sd-pf-srow-label sd-pf-lbl-req">Overall gradient:</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,alignItems:'center'}}>
            <div className="sd-pf-options">
              {[{k:'lt5',l:'up to 5 %'},{k:'mid',l:'5 – 10 %'},{k:'gt10',l:'Over 10 %'}].map(o => (
                <div key={o.k} className={`sd-pf-opt sd-pf-opt-wide ${active.gradientMag === o.k ? 'sd-pf-opt-on' : ''}`} style={{flex:1}}>{o.l}</div>
              ))}
            </div>
            <div className="sd-pf-options">
              <div className={`sd-pf-opt sd-pf-opt-wide ${active.gradientDir === 'uphill' ? 'sd-pf-opt-on' : ''}`}>Uphill</div>
              <div className={`sd-pf-opt sd-pf-opt-wide ${active.gradientDir === 'downhill' ? 'sd-pf-opt-on' : ''}`}>Downhill</div>
            </div>
          </div>
        </div>

        <div className="sd-pf-divider" />

        <div className="sd-pf-srow">
          <div className="sd-pf-srow-label sd-pf-lbl-req">Type of surface dressing:</div>
          <div className="sd-pf-options">
            {[{k:'single',l:'Single'},{k:'racked',l:'Racked-In'},{k:'double',l:'Double'},{k:'inverted',l:'Inverted Double'},{k:'sandwich',l:'Sandwich'}].map(o => (
              <div key={o.k} className={`sd-pf-opt sd-pf-opt-wide ${activeType === o.k ? 'sd-pf-opt-on' : ''}`} style={{flex:1}}>{o.l}</div>
            ))}
          </div>
        </div>

        <div className="sd-pf-srow" style={{alignItems:'flex-start'}}>
          <div className="sd-pf-srow-label sd-pf-lbl-req">Chipping size:</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 110px',gap:0,alignItems:'stretch'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:0}}>
              {['S14','S10','S6','R14','R10','R10b','D14','D10'].map(k => (
                <div key={k} className={`sd-pf-opt ${isChipOn(k) ? 'sd-pf-opt-on' : ''}`} style={{minWidth:0,padding:'5px 4px'}}>
                  {SD_CHIPPING_DESIGNATIONS[k] || k}
                </div>
              ))}
              <div className="sd-pf-opt" style={{visibility:'hidden'}}>&nbsp;</div>
            </div>
            <div style={{border:'1px solid #555',padding:4,fontSize:'9.5px',fontStyle:'italic',display:'flex',flexDirection:'column'}}>
              <div>Other:</div>
              <div style={{flex:1,minHeight:60}} />
            </div>
          </div>
        </div>

        <div className="sd-pf-srow">
          <div className="sd-pf-srow-label sd-pf-lbl-req">Aggregate type:</div>
          <div className="sd-pf-options">
            {[{k:'rock',l:'Crushed rock'},{k:'blast',l:'Blast-furnace slag'},{k:'steel',l:'Steel slag'},{k:'gravel',l:'Gravel'}].map(o => (
              <div key={o.k} className={`sd-pf-opt sd-pf-opt-wide ${active.aggregate === o.k ? 'sd-pf-opt-on' : ''}`} style={{flex:1}}>{o.l}</div>
            ))}
          </div>
        </div>

        <div className="sd-pf-srow">
          <div className="sd-pf-srow-label sd-pf-lbl-req">Shape: Flakiness Cat.</div>
          <div className="sd-pf-options">
            {['f10','f15','f20','f25'].map(k => (
              <div key={k} className={`sd-pf-opt sd-pf-opt-wide ${active.shape === k ? 'sd-pf-opt-on' : ''}`} style={{flex:1}}>{k.toUpperCase()}</div>
            ))}
          </div>
        </div>

        <div className="sd-pf-srow">
          <div className="sd-pf-srow-label">Bituminous emulsion binder:</div>
          <div className="sd-pf-options">
            {[{k:'unmodified',l:'Unmodified'},{k:'intermediate',l:'Intermediate'},{k:'premium',l:'Premium Grade'},{k:'superpremium',l:'Super-Premium'}].map(o => (
              <div key={o.k} className={`sd-pf-opt sd-pf-opt-wide ${active.binderGrade === o.k ? 'sd-pf-opt-on' : ''}`} style={{flex:1}}>{o.l}</div>
            ))}
          </div>
        </div>

        <div className="sd-pf-srow">
          <div className="sd-pf-srow-label">Seasonal risk category:</div>
          <div className="sd-pf-options">
            {[{k:'high',l:'High'},{k:'sig',l:'Significant'},{k:'low',l:'Low'}].map(o => (
              <div key={o.k} className={`sd-pf-opt sd-pf-opt-wide ${seasonalRisk === o.k ? 'sd-pf-opt-on' : ''}`} style={{flex:1}}>{o.l}</div>
            ))}
          </div>
        </div>

        <div className="sd-pf-binder-row">
          <div className="sd-pf-srow-label">Binder spread rate</div>
          <div className="sd-pf-binder-cell">
            <div className="sd-pf-srow-label">First layer</div>
            <div className="sd-pf-binder-input">
              <span>{finalRates ? (isMultiLayer ? finalRates.l1 : finalRates.binder) : ''}</span>
              <span className="sd-pf-unit">L/m²</span>
            </div>
          </div>
          <div className="sd-pf-binder-cell">
            <div className="sd-pf-srow-label">Second layer *</div>
            <div className="sd-pf-binder-input">
              <span>{finalRates && isMultiLayer ? finalRates.l2 : ''}</span>
              <span className="sd-pf-unit">L/m²</span>
            </div>
          </div>
        </div>

        <table className="sd-pf-adj-table sd-pf-adj-outer">
          <thead>
            <tr>
              <th rowSpan={2} className="sd-pf-loc">Location</th>
              <th rowSpan={2} className="sd-pf-vert">Season</th>
              <th rowSpan={2} className="sd-pf-vert">Aggregate type</th>
              <th rowSpan={2} className="sd-pf-vert">shape</th>
              <th rowSpan={2}></th>
              <th rowSpan={2} className="sd-pf-vert">Shade</th>
              <th rowSpan={2} className="sd-pf-vert">Surface condition</th>
              <th rowSpan={2} className="sd-pf-vert">Gradient</th>
              <th rowSpan={2} className="sd-pf-vert">Traffic Speed</th>
              <th rowSpan={2} className="sd-pf-vert">Local traffic</th>
              <th rowSpan={2}>Sum of factors</th>
              <th colSpan={2}>Rate of spread of binder L/m2</th>
            </tr>
            <tr>
              <th className="sd-pf-spread">1st</th>
              <th className="sd-pf-spread">2nd</th>
            </tr>
          </thead>
          <tbody>
            <tr className="sd-pf-row-data">
              <td>{scheme.road_name || active.siteName || ''}</td>
              <td>{fmtAdj(totalAdjustment.components.season)}</td>
              <td>{fmtAdj(totalAdjustment.components.aggregate)}</td>
              <td>{fmtAdj(totalAdjustment.components.shape)}</td>
              <td></td>
              <td>{fmtAdj(totalAdjustment.components.shade)}</td>
              <td>{fmtAdj(totalAdjustment.components.condition)}</td>
              <td>{fmtAdj(totalAdjustment.components.gradient)}</td>
              <td>{fmtAdj(totalAdjustment.components.speed)}</td>
              <td>{fmtAdj(totalAdjustment.components.localTraffic)}</td>
              <td>{totalAdjustment.capped >= 0 ? '+' : ''}{totalAdjustment.capped.toFixed(2)}</td>
              <td>{finalRates ? (isMultiLayer ? finalRates.l1 : finalRates.binder) : ''}</td>
              <td>{finalRates && isMultiLayer ? finalRates.l2 : ''}</td>
            </tr>
            {[0,1,2].map(i => (
              <tr key={i} className="sd-pf-row-blank">
                {Array(13).fill(null).map((_,j) => <td key={j}></td>)}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="sd-pf-footer">
          <div className="sd-pf-footer-cell">
            <div className="sd-pf-srow-label">Designer:</div>
            <div className="sd-pf-val">{active.designerName}</div>
          </div>
          <div className="sd-pf-footer-cell">
            <div className="sd-pf-srow-label">Initials:</div>
            <div className="sd-pf-val">{active.designerInitials}</div>
          </div>
          <div className="sd-pf-footer-cell">
            <div className="sd-pf-srow-label">Date:</div>
            <div className="sd-pf-date-box">
              {active.designDate
                ? <span>{new Date(active.designDate).toLocaleDateString('en-GB')}</span>
                : <span style={{color:'#555'}}>/&nbsp;&nbsp;&nbsp;/</span>}
            </div>
          </div>
        </div>
        {active.notes && <div className="sd-pf-notes"><strong>Notes:</strong> {active.notes}</div>}
      </div>
      </div>
    );
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const sdStyles = `
    .sd-wrap { font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace); color: var(--ink); line-height: 1.5; }
    .sd-view-toggle { display: flex; gap: 0; border: 1px solid var(--line); border-radius: 3px; overflow: hidden; margin-bottom: 16px; width: fit-content; }
    .sd-view-btn { background: transparent; color: var(--ink-3); border: none; padding: 7px 18px; font-family: inherit; font-size: 11px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px; }
    .sd-view-btn.sd-active { background: var(--accent); color: white; font-weight: 700; }
    .sd-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
    @media (max-width: 900px) { .sd-grid-2 { grid-template-columns: 1fr; } }
    .sd-panel { background: var(--bg-elev); border: 1px solid var(--line); border-radius: 4px; padding: 18px; margin-bottom: 14px; }
    .sd-panel-title { font-family: var(--font-sans, inherit); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: var(--accent); margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 8px; justify-content: space-between; }
    .sd-panel-title-l { display: flex; align-items: center; gap: 8px; }
    .sd-step-num { background: var(--accent); color: white; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
    .sd-help-btn { background: transparent; border: 1px solid var(--line); color: var(--ink-3); width: 22px; height: 22px; border-radius: 50%; cursor: pointer; font-size: 11px; font-family: inherit; flex-shrink: 0; }
    .sd-help-btn:hover { border-color: var(--accent); color: var(--accent); }
    .sd-field { margin-bottom: 12px; }
    .sd-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-3); margin-bottom: 6px; }
    .sd-input, .sd-select, .sd-textarea { width: 100%; background: var(--bg); border: 1px solid var(--line); color: var(--ink); padding: 9px 11px; font-family: inherit; font-size: 13px; border-radius: 3px; }
    .sd-textarea { resize: vertical; min-height: 60px; }
    .sd-input:focus, .sd-select:focus, .sd-textarea:focus { outline: none; border-color: var(--accent); }
    .sd-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .sd-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .sd-row-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }
    .sd-chk-label { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--ink-2); cursor: pointer; line-height: 1.4; }
    .sd-chk-label input { margin-top: 2px; accent-color: var(--accent); }
    .sd-result { background: var(--bg-sunken); border: 1px solid var(--line); padding: 11px; border-radius: 3px; margin-top: 8px; }
    .sd-result-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-3); margin-bottom: 4px; }
    .sd-result-value { font-family: var(--font-sans, inherit); font-size: 20px; font-weight: 600; color: var(--ink); }
    .sd-result-sub { font-size: 11px; color: var(--ink-2); margin-top: 2px; }
    .sd-suit-box { padding: 14px; border-radius: 3px; margin-top: 10px; border-left: 4px solid; }
    .sd-suit-title { font-family: var(--font-sans, inherit); font-size: 14px; font-weight: 700; margin-bottom: 4px; }
    .sd-suit-desc { font-size: 12px; color: var(--ink-2); }
    .sd-rec-box { background: var(--accent-wash); border: 1px solid var(--accent); padding: 14px; border-radius: 3px; margin-top: 10px; }
    .sd-rec-title { font-family: var(--font-sans, inherit); color: var(--accent); font-weight: 700; font-size: 14px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .sd-rec-text { font-size: 12px; color: var(--accent-ink, var(--ink-2)); line-height: 1.5; }
    .sd-season-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 2px; margin-top: 8px; }
    .sd-season-cell { padding: 6px 2px; text-align: center; font-size: 10px; font-weight: 600; cursor: pointer; border: 1px solid transparent; border-radius: 2px; }
    .sd-season-cell.sd-active { border-color: var(--accent); outline: 1px solid var(--accent); }
    .sd-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    .sd-table th, .sd-table td { padding: 6px 8px; border: 1px solid var(--line); text-align: left; }
    .sd-table th { background: var(--bg-sunken); color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .sd-pricing-table tbody tr { cursor: pointer; }
    .sd-pricing-table tbody tr:hover { background: var(--accent-wash); }
    .sd-pricing-table tr.sd-selected { background: var(--accent-wash); }
    .sd-pricing-hl { background: var(--bg-sunken); border: 2px solid var(--accent); padding: 16px; border-radius: 3px; margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
    .sd-pricing-big { font-family: var(--font-sans, inherit); font-size: 24px; font-weight: 700; color: var(--accent); }
    .sd-warning { background: var(--red-wash, rgba(192,57,43,0.08)); border-left: 3px solid var(--red); padding: 11px; margin-top: 10px; font-size: 12px; color: var(--ink); border-radius: 2px; }
    .sd-info { background: var(--accent-wash); border-left: 3px solid var(--accent); padding: 11px; margin-top: 10px; font-size: 12px; color: var(--ink); border-radius: 2px; }
    .sd-help-text { font-size: 11px; color: var(--ink-3); margin-top: 4px; padding: 8px 10px; background: var(--bg-sunken); border-left: 2px solid var(--line); line-height: 1.5; }
    .sd-actions { margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap; }
    .sd-btn { background: var(--accent); color: white; border: none; padding: 11px 22px; font-family: inherit; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; border-radius: 3px; }
    .sd-btn:hover { filter: brightness(1.05); }
    .sd-btn-sec { background: transparent; color: var(--accent); border: 1px solid var(--accent); }
    .sd-btn-sec:hover { background: var(--accent-wash); }
    .sd-tab-action { background: transparent; color: var(--accent); border: 1px dashed var(--accent); padding: 4px 10px; font-size: 11px; cursor: pointer; font-family: inherit; border-radius: 2px; }
    .sd-tab-action:hover { background: var(--accent-wash); }
    .sd-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; }
    .sd-modal { background: var(--bg); border: 1px solid var(--line); max-width: 700px; width: 100%; max-height: 85vh; overflow: auto; padding: 24px; border-radius: 4px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); }
    .sd-modal-title { color: var(--accent); font-family: var(--font-sans, inherit); font-size: 16px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .sd-modal-close { float: right; background: transparent; color: var(--ink-3); border: none; font-size: 18px; cursor: pointer; }
    .sd-rate-grid { display: grid; grid-template-columns: 100px 1fr 80px 80px 80px; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 11px; }
    .sd-rate-grid input { background: var(--bg); border: 1px solid var(--line); color: var(--ink); padding: 6px 8px; font-family: inherit; font-size: 12px; border-radius: 2px; width: 100%; }
    .sd-footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid var(--line); font-size: 10px; color: var(--ink-3); text-align: center; letter-spacing: 0.5px; }

    /* ── Proforma (screen preview + print) — always white/black as a print document ── */
    .sd-pf-page { background: white; color: black; font-family: 'IBM Plex Sans', system-ui, sans-serif; font-size: 10px; padding: 18mm 14mm; max-width: 210mm; margin: 0 auto; line-height: 1.3; }
    .sd-pf-title { text-align: center; font-weight: 700; font-size: 13px; }
    .sd-pf-subtitle { text-align: center; font-style: italic; font-size: 11px; margin-bottom: 12px; }
    .sd-pf-line { display: grid; grid-template-columns: 130px 1fr; gap: 0; align-items: center; margin-bottom: 2px; }
    .sd-pf-lbl { font-size: 9.5px; font-style: italic; padding-right: 6px; white-space: nowrap; }
    .sd-pf-lbl-req::after { content: ' *'; font-style: normal; }
    .sd-pf-val { background: #ececec; border: 1px solid #555; padding: 2px 6px; min-height: 18px; min-width: 40px; font-size: 10px; display: inline-block; }
    .sd-pf-val-fill { flex: 1; }
    .sd-pf-unit { font-size: 9px; font-style: italic; }
    .sd-pf-val-suffix { background: #ececec; border: 1px solid #555; padding: 2px 6px; min-width: 50px; font-size: 10px; display: inline-flex; justify-content: space-between; align-items: center; gap: 6px; }
    .sd-pf-srow { display: grid; grid-template-columns: 130px 1fr; gap: 4px; align-items: center; margin-bottom: 2px; }
    .sd-pf-srow-label { font-size: 9.5px; font-style: italic; }
    .sd-pf-options { display: flex; gap: 0; flex-wrap: wrap; }
    .sd-pf-opt { border: 1px solid #555; padding: 3px 8px; font-size: 9.5px; min-width: 50px; text-align: center; background: white; margin-right: -1px; margin-bottom: -1px; line-height: 1.25; }
    .sd-pf-opt-on { background: #ffe4b5 !important; font-weight: 700; }
    .sd-pf-opt-wide { min-width: 80px; }
    .sd-pf-divider { height: 3px; background: black; margin: 8px 0; }
    .sd-pf-binder-row { display: grid; grid-template-columns: 130px 1fr 1fr; gap: 8px; align-items: center; margin-top: 4px; }
    .sd-pf-binder-cell { display: grid; grid-template-columns: auto 1fr; gap: 6px; align-items: center; }
    .sd-pf-binder-input { background: #ececec; border: 1px solid #555; padding: 3px 6px; min-height: 22px; min-width: 100px; font-size: 10px; display: flex; justify-content: space-between; align-items: center; }
    .sd-pf-adj-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9px; }
    .sd-pf-adj-table th, .sd-pf-adj-table td { border: 1px solid #000; padding: 3px; text-align: center; vertical-align: middle; }
    .sd-pf-adj-table thead th { background: white; font-weight: 400; font-size: 9px; }
    .sd-pf-vert { writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; padding: 6px 3px; height: 80px; }
    .sd-pf-loc { width: 110px; min-width: 110px; }
    .sd-pf-spread { width: 60px; }
    .sd-pf-row-data td { height: 22px; }
    .sd-pf-row-blank td { height: 22px; background: white; }
    .sd-pf-adj-outer { border-top: 2.5px solid black; border-bottom: 2.5px solid black; }
    .sd-pf-footer { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; align-items: center; margin-top: 10px; }
    .sd-pf-footer-cell { display: grid; grid-template-columns: auto 1fr; gap: 6px; align-items: center; }
    .sd-pf-date-box { background: #ececec; border: 1px solid #555; padding: 2px 6px; min-width: 100px; font-size: 10px; display: flex; justify-content: space-between; align-items: center; }
    .sd-pf-notes { margin-top: 10px; padding: 6px 8px; border: 1px solid #888; font-size: 9.5px; }
    @media (max-width: 640px) {
      .sd-row-2, .sd-row-3 { grid-template-columns: 1fr; }
      .sd-row-4 { grid-template-columns: 1fr 1fr; }
      .sd-view-toggle { width: 100%; }
      .sd-view-btn { flex: 1; text-align: center; }
      .sd-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .sd-season-grid { grid-template-columns: repeat(6, 1fr); }
      .sd-rate-grid { grid-template-columns: 60px 1fr 60px 60px 60px; font-size: 10px; }
      .sd-rate-grid input { padding: 4px 5px; }
    }

    /* ── Entry card ──────────────────────────────────────────────────────────── */
    .sd-entry-card { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; gap: 22px; text-align: center; padding: 48px 24px; }
    .sd-entry-scheme { font-family: var(--font-sans, inherit); font-size: 20px; font-weight: 700; color: var(--ink); }
    .sd-entry-progress { width: 100%; max-width: 380px; }
    .sd-entry-progress-track { height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; }
    .sd-entry-progress-fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.5s ease; }
    .sd-entry-progress-label { font-size: 11px; color: var(--ink-3); margin-top: 7px; text-transform: uppercase; letter-spacing: 0.5px; }
    .sd-entry-btn { background: var(--accent); color: white; border: none; padding: 15px 32px; font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; border-radius: 4px; letter-spacing: 0.5px; animation: sd-glow-pulse 2.5s ease-in-out infinite; }
    .sd-entry-btn:hover { filter: brightness(1.1); }
    @keyframes sd-glow-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(244,114,22,0.4); }
      50% { box-shadow: 0 0 18px 5px rgba(244,114,22,0.18), 0 0 0 8px rgba(244,114,22,0.05); }
    }
    @media (prefers-reduced-motion: reduce) { .sd-entry-btn { animation: none; } }

    /* ── Portal overlay ──────────────────────────────────────────────────────── */
    .sd-portal-overlay { position: fixed; inset: 0; z-index: 9000; background: var(--bg); display: flex; flex-direction: column; animation: sd-portal-in 280ms ease; }
    @keyframes sd-portal-in { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .sd-portal-overlay { animation: none; } }

    /* ── Portal header ───────────────────────────────────────────────────────── */
    .sd-portal-hdr { display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: var(--bg-elev); border-bottom: 1px solid var(--line); flex-shrink: 0; flex-wrap: wrap; }
    .sd-portal-hdr-name { font-family: var(--font-sans, inherit); font-size: 13px; font-weight: 700; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
    .sd-portal-hdr-stats { display: flex; gap: 8px; flex-wrap: wrap; flex: 1; }
    .sd-portal-stat { font-size: 11px; color: var(--ink-3); background: var(--bg-sunken); padding: 3px 8px; border-radius: 3px; border: 1px solid var(--line); }
    .sd-portal-stat strong { color: var(--accent); }
    .sd-portal-exit { background: transparent; color: var(--ink-3); border: 1px solid var(--line); padding: 5px 12px; font-family: inherit; font-size: 11px; cursor: pointer; border-radius: 3px; white-space: nowrap; flex-shrink: 0; }
    .sd-portal-exit:hover { border-color: var(--red); color: var(--red); background: var(--red-wash, rgba(192,57,43,0.08)); }

    /* ── Portal body + rail ──────────────────────────────────────────────────── */
    .sd-portal-body { display: flex; flex: 1; overflow: hidden; }
    .sd-portal-rail { width: 54px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; padding: 18px 0; gap: 0; background: var(--bg-elev); border-right: 1px solid var(--line); overflow-y: auto; }
    .sd-rail-dot { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--line); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--ink-3); cursor: pointer; transition: border-color 0.2s, background 0.2s, color 0.2s; flex-shrink: 0; }
    .sd-rail-dot:hover { border-color: var(--accent); color: var(--accent); }
    .sd-rail-dot.sd-rail-active { border-color: var(--accent); background: var(--accent); color: white; }
    .sd-rail-dot.sd-rail-done { border-color: var(--green, #16a34a); color: var(--green, #16a34a); background: rgba(22,163,74,0.08); }
    .sd-rail-dot.sd-rail-done.sd-rail-active { background: var(--accent); border-color: var(--accent); color: white; }
    .sd-rail-connector { width: 2px; height: 10px; background: var(--line); flex-shrink: 0; margin: 1px 0; }

    /* ── Portal content + scroll-reveal ─────────────────────────────────────── */
    .sd-portal-content { flex: 1; overflow-y: auto; padding: 16px 20px; }
    .sd-portal-content .sd-panel { opacity: 0; transform: translateY(14px); transition: opacity 350ms ease, transform 350ms ease; }
    .sd-portal-content .sd-panel.sd-revealed { opacity: 1; transform: none; }
    .sd-portal-content .sd-grid-2 .sd-panel { margin-bottom: 14px; }
    @media (prefers-reduced-motion: reduce) { .sd-portal-content .sd-panel { opacity: 1 !important; transform: none !important; } }
    @media (max-width: 600px) {
      .sd-portal-rail { width: 40px; }
      .sd-rail-dot { width: 24px; height: 24px; font-size: 10px; }
      .sd-portal-content { padding: 12px; }
      .sd-portal-hdr-name { max-width: 120px; font-size: 12px; }
    }
    .sd-modal-bg { z-index: 9500; }

    @media print {
      @page { margin: 0; size: A4; }
      .sd-no-print { display: none !important; }
      .sd-pf-page { page-break-after: always; box-shadow: none !important; }
    }
  `;

  // ── Render ──────────────────────────────────────────────────────────────────

  const renderDesignSteps = () => (<>

    {/* STEP 1: SITE */}
    <div ref={el=>stepRefs.current[0]=el} className="sd-panel">
      <div className="sd-panel-title"><div className="sd-panel-title-l"><span className="sd-step-num">1</span>SITE IDENTIFICATION</div></div>
      <div className="sd-row-3">
        <div className="sd-field">
          <label className="sd-label">Road Number</label>
          <input className="sd-input" value={active.roadNumber} onChange={e=>update({roadNumber:e.target.value})} placeholder="e.g. U1234" />
        </div>
        <div className="sd-field">
          <label className="sd-label">Region / Area</label>
          <input className="sd-input" value={active.regionArea} onChange={e=>update({regionArea:e.target.value})} />
        </div>
        <div className="sd-field">
          <label className="sd-label">Scheme Reference</label>
          <input className="sd-input" value={active.schemeRef} onChange={e=>update({schemeRef:e.target.value})} />
        </div>
      </div>
      <div className="sd-row-4">
        <div className="sd-field">
          <label className="sd-label">Length (m)</label>
          <input className="sd-input" type="number" value={active.length} onChange={e=>update({length:e.target.value})} />
        </div>
        <div className="sd-field">
          <label className="sd-label">Width (m)</label>
          <input className="sd-input" type="number" value={active.width} onChange={e=>update({width:e.target.value})} />
        </div>
        <div className="sd-field">
          <label className="sd-label">No. of Lanes</label>
          <input className="sd-input" type="number" value={active.numLanes} onChange={e=>update({numLanes:e.target.value})} />
        </div>
        <div className="sd-field">
          <label className="sd-label">Area (m²)</label>
          <input className="sd-input" type="number" value={active.areaM2} onChange={e=>update({areaM2:e.target.value})} />
          {active.areaM2 && !isNaN(parseFloat(active.areaM2)) && (
            <div className="sd-result-sub" style={{marginTop:4}}>{SD_QTY_BAND_LABEL[SD_QTY_BAND(parseFloat(active.areaM2))]}</div>
          )}
        </div>
      </div>
      <div className="sd-row-3">
        <div className="sd-field">
          <label className="sd-label">Lane(s)</label>
          <input className="sd-input" value={active.laneId} onChange={e=>update({laneId:e.target.value})} placeholder="NB/SB/EB/WB" />
        </div>
        <div className="sd-field">
          <label className="sd-label">Location (drives Temp. Cat.)</label>
          <select className="sd-select" value={active.location} onChange={e=>update({location:e.target.value})}>
            <option>South</option><option>Central</option><option>North</option>
          </select>
          <div className="sd-result-sub" style={{marginTop:4}}>Temperature Category: <strong style={{color:'var(--accent)'}}>{tempCat}</strong></div>
        </div>
      </div>
    </div>

    {/* STEP 2: TRAFFIC */}
    <div ref={el=>stepRefs.current[1]=el} className="sd-panel">
      <div className="sd-panel-title"><div className="sd-panel-title-l"><span className="sd-step-num">2</span>TRAFFIC</div></div>
      <div className="sd-row-2">
        <div className="sd-field">
          <label className="sd-label">Medium/Heavy Traffic (cv/lane/day)</label>
          <input className="sd-input" type="number" value={active.cvDay} onChange={e=>update({cvDay:e.target.value})} placeholder="HGV/CV count" />
          {trafficCat && (
            <div className="sd-result">
              <div className="sd-result-label">Traffic Category</div>
              <div className="sd-result-value">{trafficCat.cat} <span style={{fontSize:13,color:'var(--ink-3)',fontWeight:400}}>({trafficCat.range} CV/day)</span></div>
              <div className="sd-result-sub">NRSWA Road Type {trafficCat.nrswa}</div>
            </div>
          )}
        </div>
        <div className="sd-field">
          <label className="sd-label">Traffic Speed (mph)</label>
          <select className="sd-select" value={active.trafficSpeed} onChange={e=>update({trafficSpeed:e.target.value, speed:parseInt(e.target.value)>=50?'high':'low'})}>
            <option>20</option><option>30</option><option>40</option><option>50</option><option>60</option><option>70</option>
          </select>
        </div>
      </div>
    </div>

    {/* STEP 3 & 4: HARDNESS + SURFACE */}
    <div className="sd-grid-2">
      <div ref={el=>stepRefs.current[2]=el} className="sd-panel" style={{marginBottom:0}}>
        <div className="sd-panel-title">
          <div className="sd-panel-title-l"><span className="sd-step-num">3</span>ROAD HARDNESS</div>
          <button className="sd-help-btn" onClick={()=>setShowHelp(true)} title="Assessment guidance">?</button>
        </div>
        <div className="sd-row-2">
          <div className="sd-field">
            <label className="sd-label">RH Probe Depth (mm)</label>
            <input className="sd-input" type="number" step="0.1" value={active.rhProbeDepth} onChange={e=>update({rhProbeDepth:e.target.value})} placeholder="e.g. 4.2" />
          </div>
          <div className="sd-field">
            <label className="sd-label">Probe Temp (°C)</label>
            <input className="sd-input" type="number" value={active.rhProbeTemp} onChange={e=>update({rhProbeTemp:e.target.value})} />
          </div>
        </div>
        {probeHardness && probeHardness !== active.hardness && (
          <div className="sd-info">
            Probe depth suggests <strong>{probeHardness}</strong>.
            <button className="sd-tab-action" style={{marginLeft:8,padding:'2px 8px'}} onClick={()=>update({hardness:probeHardness})}>Apply</button>
          </div>
        )}
        <div className="sd-field">
          <label className="sd-label">RH Category</label>
          <select className="sd-select" value={active.hardness} onChange={e=>update({hardness:e.target.value})}>
            <option>Very Hard</option><option>Hard</option><option>Normal</option><option>Soft</option><option>Very Soft</option><option>Variable</option>
          </select>
          <div className="sd-help-text">{SD_HARDNESS_GUIDANCE[active.hardness]}</div>
        </div>
        <div className="sd-row-2">
          <div className="sd-field">
            <label className="sd-label">Min PSV</label>
            <input className="sd-input" type="number" value={active.minPSV} onChange={e=>update({minPSV:e.target.value, selectedItem:''})} />
          </div>
          <div className="sd-field">
            <label className="sd-label">Max AAV</label>
            <input className="sd-input" type="number" value={active.maxAAV} onChange={e=>update({maxAAV:e.target.value})} />
          </div>
        </div>
      </div>

      <div ref={el=>stepRefs.current[3]=el} className="sd-panel" style={{marginBottom:0}}>
        <div className="sd-panel-title"><div className="sd-panel-title-l"><span className="sd-step-num">4</span>SURFACE & GEOMETRY</div></div>
        <div className="sd-field">
          <label className="sd-label">Surface Characteristic (RN39 Fig. 8.1)</label>
          <select className="sd-select" value={active.surfaceCondition} onChange={e=>update({surfaceCondition:e.target.value})}>
            {Object.keys(SD_SUITABILITY_MATRIX).map(k=><option key={k}>{k}</option>)}
          </select>
          <div className="sd-help-text">{SD_CONDITION_GUIDANCE[active.surfaceCondition]}</div>
        </div>
        <div className="sd-field">
          <label className="sd-label">Surface Condition (Proforma)</label>
          <select className="sd-select" value={active.condition} onChange={e=>update({condition:e.target.value})}>
            <option value="veryRich">Very binder rich (-0.2)</option>
            <option value="rich">Binder Rich (-0.1)</option>
            <option value="normal">Normal (0)</option>
            <option value="wheelTracks">Texture in wheel tracks (+0.1)</option>
            <option value="lean">Binder lean / Porous (+0.2)</option>
          </select>
        </div>
        <div className="sd-row-2">
          <div className="sd-field">
            <label className="sd-label">Radius of Curvature</label>
            <select className="sd-select" value={active.radiusCurvature} onChange={e=>update({radiusCurvature:e.target.value})}>
              <option value="under100">Under 100 m</option>
              <option value="100to250">100 – 250 m</option>
              <option value="over250">Over 250 m</option>
            </select>
          </div>
          <div className="sd-field">
            <label className="sd-label">Junction or Crossing</label>
            <select className="sd-select" value={active.junctionCrossing} onChange={e=>update({junctionCrossing:e.target.value})}>
              <option value="approach">Approach</option>
              <option value="nonApproach">Non-approach</option>
            </select>
          </div>
        </div>
        <div className="sd-row-2">
          <div className="sd-field">
            <label className="sd-label">Gradient Magnitude</label>
            <select className="sd-select" value={active.gradientMag} onChange={e=>update({gradientMag:e.target.value})}>
              <option value="lt5">Up to 5% (0)</option>
              <option value="mid">5 – 10% (+0.1)</option>
              <option value="gt10">Over 10% (+0.2)</option>
            </select>
          </div>
          <div className="sd-field">
            <label className="sd-label">Gradient Direction</label>
            <select className="sd-select" value={active.gradientDir} onChange={e=>update({gradientDir:e.target.value})}>
              <option value="flat">Flat / N/A</option>
              <option value="uphill">Uphill (reduces)</option>
              <option value="downhill">Downhill (increases)</option>
            </select>
          </div>
        </div>
        <div className="sd-field">
          <label className="sd-chk-label">
            <input type="checkbox" checked={active.highStressBraking} onChange={e=>update({highStressBraking:e.target.checked})} />
            <span style={{color:active.highStressBraking?'var(--red)':'var(--ink-2)'}}>High-stress braking zone (e.g. fast dual carriageway → roundabout)</span>
          </label>
        </div>
        {suitability && !active.highStressBraking && (
          <div className="sd-suit-box" style={{background:`${suitability.color}15`,borderLeftColor:suitability.color}}>
            <div className="sd-suit-title" style={{color:suitability.color}}>{suitability.label.toUpperCase()}</div>
            <div className="sd-suit-desc">{suitability.desc}</div>
          </div>
        )}
      </div>
    </div>

    {/* STEP 5: TREATMENT */}
    <div ref={el=>stepRefs.current[4]=el} className="sd-panel">
      <div className="sd-panel-title"><div className="sd-panel-title-l"><span className="sd-step-num">5</span>TREATMENT SELECTION</div></div>
      {dressingRecommendation && (
        <div className="sd-rec-box">
          <div className="sd-rec-title">RN39 Recommends</div>
          <div className="sd-rec-text"><strong>{dressingRecommendation.label}</strong><br/>{dressingRecommendation.reason}</div>
        </div>
      )}
      {dressingRecommendation?.type === 'hfs' ? (
        <div className="sd-warning" style={{marginTop:12}}>
          <strong>SURFACE DRESSING NOT APPROPRIATE.</strong> Specify High Friction Surfacing (HFS) instead.
        </div>
      ) : (
        <div className="sd-row-3" style={{marginTop:12}}>
          <div className="sd-field">
            <label className="sd-label">Override Dressing Type</label>
            <select className="sd-select" value={active.dressingType} onChange={e=>update({dressingType:e.target.value, selectedItem:''})}>
              <option value="auto">Auto (RN39)</option>
              <option value="single">Single</option>
              <option value="racked">Racked-in</option>
              <option value="double">Double</option>
              <option value="inverted">Inverted Double</option>
              <option value="sandwich">Sandwich</option>
            </select>
          </div>
          <div className="sd-field">
            <label className="sd-label">Binder Grade</label>
            <select className="sd-select" value={active.binderGrade} onChange={e=>update({binderGrade:e.target.value, selectedItem:''})}>
              <option value="unmodified">Unmodified (K1-70)</option>
              <option value="intermediate">Intermediate</option>
              <option value="premium">Premium Grade</option>
              <option value="superpremium">Super-Premium</option>
            </select>
          </div>
          <div className="sd-field">
            <label className="sd-label">Aggregate Type</label>
            <select className="sd-select" value={active.aggregate} onChange={e=>update({aggregate:e.target.value})}>
              <option value="rock">Crushed rock (0)</option>
              <option value="blast">Blast-furnace slag (0)</option>
              <option value="steel">Steel slag (0)</option>
              <option value="gravel">Gravel (+0.1)</option>
            </select>
          </div>
        </div>
      )}
      {baseDesign === null && trafficCat && activeType !== 'hfs' && (
        <div className="sd-warning"><strong>Not suitable:</strong> This combination is not recommended by RN39.</div>
      )}
      {baseDesign === 'multi' && (
        <div className="sd-warning"><strong>Multiple-layer dressing preferred</strong> — switch to racked-in or double.</div>
      )}
      {baseDesign === 'unnecessary' && (
        <div className="sd-info">Racking-in is unnecessary for this traffic category — single dressing sufficient.</div>
      )}
      {baseDesign === 'expert' && (
        <div className="sd-warning"><strong>Expert design required</strong> for this combination.</div>
      )}
      {baseDesign && typeof baseDesign === 'object' && (
        <div className="sd-row-2" style={{marginTop:12}}>
          <div className="sd-result">
            <div className="sd-result-label">Base Chipping Code</div>
            <div className="sd-result-value">{baseDesign.size}</div>
            <div className="sd-result-sub">{SD_CHIPPING_DESIGNATIONS[baseDesign.size.split('/')[0]]}</div>
          </div>
          <div className="sd-result">
            <div className="sd-result-label">Base Binder Rate</div>
            <div className="sd-result-value">
              {isMultiLayer ? `${baseDesign.l1} / ${baseDesign.l2} L/m²` : `${baseDesign.binder} L/m²`}
            </div>
            <div className="sd-result-sub">Before local adjustment</div>
          </div>
        </div>
      )}
    </div>

    {/* STEP 6: ADJUSTMENTS */}
    {dressingRecommendation?.type !== 'hfs' && (
      <div ref={el=>stepRefs.current[5]=el} className="sd-panel">
        <div className="sd-panel-title"><div className="sd-panel-title-l"><span className="sd-step-num">6</span>LOCAL ADJUSTMENTS — TABLE 9.2.6</div></div>
        <div className="sd-grid-2">
          <div>
            <div className="sd-row-2">
              <div className="sd-field">
                <label className="sd-label">Season</label>
                <select className="sd-select" value={active.season} onChange={e=>update({season:e.target.value})}>
                  <option value="early">Early/mid-season (0)</option>
                  <option value="late">Late season (+0.2)</option>
                </select>
              </div>
              <div className="sd-field">
                <label className="sd-label">Flakiness Cat. (BS EN)</label>
                <select className="sd-select" value={active.shape} onChange={e=>update({shape:e.target.value})}>
                  <option value="f10">F10 (-0.1)</option>
                  <option value="f15">F15 (0)</option>
                  <option value="f20">F20 (+0.1)</option>
                  <option value="f25">F25 (expert)</option>
                </select>
              </div>
            </div>
            <div className="sd-row-2">
              <div className="sd-field">
                <label className="sd-label">Shade</label>
                <select className="sd-select" value={active.shade} onChange={e=>update({shade:e.target.value})}>
                  <option value="open">Open to sun (0)</option>
                  <option value="partial">Partially shaded (+0.1)</option>
                  <option value="full">Fully shaded (+0.2)</option>
                </select>
              </div>
              <div className="sd-field">
                <label className="sd-label">Local Traffic</label>
                <select className="sd-select" value={active.localTraffic} onChange={e=>update({localTraffic:e.target.value})}>
                  <option value="normal">Design range (0)</option>
                  <option value="untrafficked">Effectively untrafficked (+0.2)</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <div className="sd-result">
              <div className="sd-result-label">Cumulative Adjustment</div>
              <div className="sd-result-value">
                {totalAdjustment.capped >= 0 ? '+' : ''}{totalAdjustment.capped.toFixed(2)} L/m²
                {totalAdjustment.wasCapped && (
                  <span style={{fontSize:11,color:'var(--amber)',marginLeft:12}}>
                    (raw {totalAdjustment.raw >= 0 ? '+' : ''}{totalAdjustment.raw.toFixed(2)} capped)
                  </span>
                )}
              </div>
              <div className="sd-result-sub">Max +0.4 / −0.2 L/m² per RN39 Table 9.2.6</div>
              <div style={{marginTop:8,fontSize:10,color:'var(--ink-3)',lineHeight:1.6}}>
                Season {fmtAdj(totalAdjustment.components.season)} · Agg {fmtAdj(totalAdjustment.components.aggregate)} · Shape {fmtAdj(totalAdjustment.components.shape)} · Shade {fmtAdj(totalAdjustment.components.shade)}<br/>
                Condition {fmtAdj(totalAdjustment.components.condition)} · Gradient {fmtAdj(totalAdjustment.components.gradient)} · Speed {fmtAdj(totalAdjustment.components.speed)} · Local {fmtAdj(totalAdjustment.components.localTraffic)}
              </div>
            </div>
            {totalAdjustment.expert && (
              <div className="sd-warning"><strong>Expert design required</strong> — refer to specialist designer.</div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* STEP 7: SEASONAL RISK */}
    {finalRates && (
      <div ref={el=>stepRefs.current[6]=el} className="sd-panel">
        <div className="sd-panel-title"><div className="sd-panel-title-l"><span className="sd-step-num">7</span>SEASONAL RISK — TEMP. CAT. {tempCat}</div></div>
        <div style={{fontSize:12,color:'var(--ink-3)',marginBottom:8}}>Click a month to assess installation risk for {finalRates.size}.</div>
        <div className="sd-season-grid">
          {months.map((m,i) => {
            const primary = finalRates.size.split('/')[0];
            const risk = SD_SEASON_DATA[tempCat]?.[primary]?.[i] ?? 'high';
            return (
              <div key={m}
                className={`sd-season-cell ${active.installMonth === i+1 ? 'sd-active' : ''}`}
                style={{background:SD_RISK_COLORS[risk],color:'#111'}}
                onClick={()=>update({installMonth:i+1})}>{m}</div>
            );
          })}
        </div>
        {seasonalRisk && (
          <div className="sd-info" style={{background:`${SD_RISK_COLORS[seasonalRisk]}15`,borderLeftColor:SD_RISK_COLORS[seasonalRisk],color:'var(--ink)'}}>
            <strong style={{color:SD_RISK_COLORS[seasonalRisk]}}>{months[active.installMonth-1]}: {SD_RISK_LABELS[seasonalRisk]}</strong>
            {seasonalRisk === 'high' && ' — surface dressing should not be undertaken.'}
            {seasonalRisk === 'sig'  && ' — extra care in design and execution required.'}
            {seasonalRisk === 'low'  && ' — normally successful given appropriate weather.'}
          </div>
        )}
      </div>
    )}

    {/* STEP 8: PRICING */}
    {finalRates && matchingItems.length > 0 && (
      <div ref={el=>stepRefs.current[7]=el} className="sd-panel">
        <div className="sd-panel-title">
          <div className="sd-panel-title-l"><span className="sd-step-num">8</span>SERIES 700 PRICING</div>
          <button className="sd-tab-action" onClick={()=>setShowRateEditor(true)}>⚙ Edit Rates</button>
        </div>
        <table className="sd-table sd-pricing-table">
          <thead>
            <tr><th>Item</th><th>Description</th><th>&lt; 500</th><th>500–5,000</th><th>&gt; 5,000</th></tr>
          </thead>
          <tbody>
            {matchingItems.map(item => (
              <tr key={item.item} className={item.item === active.selectedItem ? 'sd-selected' : ''}
                onClick={()=>update({selectedItem:item.item})}>
                <td><strong style={{color:'var(--accent)'}}>{item.item}</strong></td>
                <td>{item.desc}</td>
                <td>£{item.rates.small.toFixed(2)}</td>
                <td>£{item.rates.medium.toFixed(2)}</td>
                <td>£{item.rates.large.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {selectedRate && (
          <div className="sd-pricing-hl">
            <div>
              <div className="sd-result-label">Selected Item</div>
              <div style={{fontSize:18,fontWeight:600,color:'var(--ink)'}}>{selectedRate.item.item}</div>
            </div>
            <div>
              <div className="sd-result-label">Quantity Band</div>
              <div style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>{SD_QTY_BAND_LABEL[selectedRate.band]}</div>
            </div>
            <div>
              <div className="sd-result-label">Rate</div>
              <div style={{fontSize:18,fontWeight:600,color:'var(--ink)'}}>£{selectedRate.rate.toFixed(2)}/m²</div>
            </div>
            <div>
              <div className="sd-result-label">Indicative Total</div>
              <div className="sd-pricing-big">{(window.BOQ_ENGINE?.fmtGBP || (n=>'£'+n))(selectedRate.total)}</div>
            </div>
          </div>
        )}
      </div>
    )}

    {/* STEP 9: DESIGNER & NOTES */}
    <div ref={el=>stepRefs.current[8]=el} className="sd-panel">
      <div className="sd-panel-title"><div className="sd-panel-title-l"><span className="sd-step-num">9</span>DESIGNER & NOTES</div></div>
      <div className="sd-row-3">
        <div className="sd-field">
          <label className="sd-label">Designer</label>
          <input className="sd-input" value={active.designerName} onChange={e=>update({designerName:e.target.value})} placeholder="Full name" />
        </div>
        <div className="sd-field">
          <label className="sd-label">Initials</label>
          <input className="sd-input" value={active.designerInitials} onChange={e=>update({designerInitials:e.target.value})} maxLength={5} />
        </div>
        <div className="sd-field">
          <label className="sd-label">Design Date</label>
          <input className="sd-input" type="date" value={active.designDate} onChange={e=>update({designDate:e.target.value})} />
        </div>
      </div>
      <div className="sd-field">
        <label className="sd-label">Design Notes</label>
        <textarea className="sd-textarea" value={active.notes} onChange={e=>update({notes:e.target.value})}
          placeholder="Site visit observations, drawing references, photo refs, special considerations..." rows={3} />
      </div>
    </div>

    <div className="sd-actions">
      <button className="sd-btn" onClick={()=>setView('proforma')}>📋 View RN39 Proforma</button>
    </div>

    <div className="sd-footer">
      DUNDEE CITY COUNCIL · HIGHWAY MAINTENANCE ·
      BASED ON ROAD NOTE 39 (RSTA POCKET GUIDE 7TH ED., MARCH 2016) ·
      PRICING PER SERIES 700 BERR 85/1 · DESIGN GUIDANCE ONLY — VERIFY ON SITE
    </div>

  </>);

  return (
    <div className="sd-wrap">
      <style>{sdStyles}</style>

      {/* ENTRY CARD — shown when portal is closed */}
      {!portalOpen && (
        <div className="sd-entry-card">
          <div className="sd-entry-scheme">{scheme.road_name || 'Surface Dressing Design'}</div>
          <div className="sd-entry-progress">
            <div className="sd-entry-progress-track">
              <div className="sd-entry-progress-fill" style={{width:`${Math.round(completedCount/9*100)}%`}} />
            </div>
            <div className="sd-entry-progress-label">{completedCount} of 9 steps complete</div>
          </div>
          <button className="sd-entry-btn" onClick={()=>{setPortalOpen(true);setView('design');}}>
            Enter Surface Dressing Software →
          </button>
        </div>
      )}

      {/* PORTAL OVERLAY — fullscreen zero-distraction mode */}
      {portalOpen && (
        <div className="sd-portal-overlay">

          {/* Live header */}
          <div className="sd-portal-hdr">
            <div className="sd-portal-hdr-name">{scheme.road_name || 'SD Design'}</div>
            <div className="sd-portal-hdr-stats">
              {trafficCat && <span className="sd-portal-stat">Cat <strong>{trafficCat.cat}</strong></span>}
              {dressingRecommendation && dressingRecommendation.type !== 'hfs' && (
                <span className="sd-portal-stat">RN39: <strong>{dressingRecommendation.label}</strong></span>
              )}
              {selectedRate && <span className="sd-portal-stat">Rate: <strong>£{selectedRate.rate.toFixed(2)}/m²</strong></span>}
              {selectedRate && <span className="sd-portal-stat">Total: <strong>{(window.BOQ_ENGINE?.fmtGBP||(n=>'£'+n))(selectedRate.total)}</strong></span>}
            </div>
            <button className="sd-portal-exit" onClick={()=>setPortalOpen(false)}>✕ Exit portal</button>
          </div>

          {/* Body = rail + scrollable content */}
          <div className="sd-portal-body">

            {/* Progress rail */}
            <div className="sd-portal-rail">
              {SD_STEP_LABELS.map((label,i) => (
                <React.Fragment key={i}>
                  <div
                    className={`sd-rail-dot${activeStep===i?' sd-rail-active':''}${stepComplete[i]?' sd-rail-done':''}`}
                    onClick={()=>scrollToStep(i)}
                    title={`Step ${i+1}: ${label}`}
                  >{stepComplete[i]?'✓':i+1}</div>
                  {i<8&&<div className="sd-rail-connector"/>}
                </React.Fragment>
              ))}
            </div>

            {/* Scrollable content */}
            <div className="sd-portal-content" ref={portalBodyRef}>
              <div className="sd-view-toggle sd-no-print">
                <button className={`sd-view-btn ${view==='design'?'sd-active':''}`} onClick={()=>setView('design')}>Design</button>
                <button className={`sd-view-btn ${view==='proforma'?'sd-active':''}`} onClick={()=>setView('proforma')}>RN39 Proforma</button>
              </div>

              {view==='proforma' && (
                <>
                  <div style={{maxWidth:'210mm',margin:'0 auto',background:'white',color:'black',boxShadow:'0 4px 24px rgba(0,0,0,0.5)'}}>
                    {renderProforma()}
                  </div>
                  <div className="sd-actions sd-no-print" style={{justifyContent:'center',marginTop:16}}>
                    <button className="sd-btn" onClick={()=>window.print()}>⎙ Print Proforma</button>
                    <button className="sd-btn sd-btn-sec" onClick={()=>setView('design')}>← Back to Design</button>
                  </div>
                </>
              )}

              {view==='design'&&renderDesignSteps()}
            </div>
          </div>

          {/* RATE EDITOR MODAL */}
          {showRateEditor && (
            <div className="sd-modal-bg" onClick={()=>setShowRateEditor(false)}>
              <div className="sd-modal" onClick={e=>e.stopPropagation()} style={{maxWidth:780}}>
                <button className="sd-modal-close" onClick={()=>setShowRateEditor(false)}>✕</button>
                <div className="sd-modal-title">Edit Series 700 Rates</div>
                <div style={{fontSize:12,color:'var(--ink-2)',marginBottom:14,lineHeight:1.6}}>
                  Default rates are <strong style={{color:'var(--amber)'}}>indicative placeholders</strong>. Replace with your actual BERR 85/1 figures. Saved globally and applied across all schemes.
                </div>
                <div className="sd-rate-grid" style={{fontWeight:700,color:'var(--accent)',borderBottom:'1px solid var(--orange)'}}>
                  <div>Item</div><div>Description</div><div>&lt; 500</div><div>500–5,000</div><div>&gt; 5,000</div>
                </div>
                {SD_SERIES_700.map(item => {
                  const cur = rateOverrides[item.item] || item.rates;
                  const isOverridden = !!rateOverrides[item.item];
                  return (
                    <div key={item.item} className="sd-rate-grid">
                      <div><strong style={{color:isOverridden?'var(--green)':'var(--accent)'}}>{item.item}</strong></div>
                      <div style={{fontSize:10,color:'var(--ink-3)'}}>{item.desc}</div>
                      {['small','medium','large'].map(band => (
                        <input key={band} type="number" step="0.01" value={cur[band]}
                          onChange={e => {
                            const v = parseFloat(e.target.value);
                            if (isNaN(v)) return;
                            setRateOverrides(prev => ({ ...prev, [item.item]: { ...cur, [band]: v } }));
                          }} />
                      ))}
                    </div>
                  );
                })}
                <div style={{marginTop:14,display:'flex',gap:10,justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:11,color:'var(--ink-3)'}}>{Object.keys(rateOverrides).length} of {SD_SERIES_700.length} items overridden</div>
                  <button className="sd-btn sd-btn-sec" onClick={()=>{if(confirm('Reset all rates to defaults?'))setRateOverrides({});}}>Reset to Defaults</button>
                </div>
              </div>
            </div>
          )}

          {/* ASSESSMENT HELP MODAL */}
          {showAssessmentHelp && (
            <div className="sd-modal-bg" onClick={()=>setShowHelp(false)}>
              <div className="sd-modal" onClick={e=>e.stopPropagation()}>
                <button className="sd-modal-close" onClick={()=>setShowHelp(false)}>✕</button>
                <div className="sd-modal-title">Site Assessment Guidance</div>
                <div style={{fontSize:13,color:'var(--ink)',lineHeight:1.7}}>
                  <p><strong style={{color:'var(--accent)'}}>Surface Hardness</strong> determines how readily chippings will embed. Probe depth measurement gives quantitative result; categories shown are indicative ranges.</p>
                  <ul style={{marginTop:8,paddingLeft:18}}>
                    {Object.entries(SD_HARDNESS_GUIDANCE).map(([k,v]) => (
                      <li key={k} style={{marginBottom:6}}><strong>{k}:</strong> {v}</li>
                    ))}
                  </ul>
                  <p style={{marginTop:14}}><strong style={{color:'var(--accent)'}}>High-stress braking zone</strong> overrides standard suitability check. Surface dressing has insufficient skid resistance in these zones — High Friction Surfacing required instead.</p>
                  <p style={{marginTop:14}}><strong style={{color:'var(--accent)'}}>Practical tip:</strong> Photograph and note conditions across the carriageway. Wheel tracks often differ from centreline. Where conditions vary, characterise the worst case.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

window.SurfaceDressingDesigner = SurfaceDressingDesigner;
