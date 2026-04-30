// ─── rn39.js ─────────────────────────────────────────────────────────────────
// Road Note 39 / RSTA Pocket Guide 7th Ed. data tables + Series 700 BERR 85/1.
// Loaded as a plain <script>; values exposed as window.RN39.
// ─────────────────────────────────────────────────────────────────────────────
window.RN39 = (function () {
const TRAFFIC_CATEGORIES = [
{cat:'A',range:'Over 3250',min:3250,max:Infinity,nrswa:'S'},
{cat:'B',range:'2501–3250',min:2501,max:3250,nrswa:'S/1'},
{cat:'C',range:'2001–2500',min:2001,max:2500,nrswa:'1'},
{cat:'D',range:'1251–2000',min:1251,max:2000,nrswa:'2'},
{cat:'E',range:'501–1250',min:501,max:1250,nrswa:'3'},
{cat:'F',range:'251–500',min:251,max:500,nrswa:'3'},
{cat:'G',range:'126–250',min:126,max:250,nrswa:'4'},
{cat:'H',range:'0–125',min:0,max:125,nrswa:'4'}];
const LOCATION_TEMP_CAT = { South:'A', Central:'B', North:'C/D' };
const HARDNESS_FROM_PROBE = (mm) => { if(isNaN(mm)||mm==null)return null; if(mm<=1.5)return 'Very Hard'; if(mm<=3)return 'Hard'; if(mm<=5)return 'Normal'; if(mm<=7)return 'Soft'; return 'Very Soft'; };
const SUITABILITY_MATRIX = {
'Very Hard & homogeneous':      {A:'Y',B:'Y',C:'Y',D:'Y',E:'Y',F:'Y',G:'Y',H:'Y'},
'Hard & homogeneous':           {A:'Y',B:'Y',C:'Y',D:'Y',E:'Y',F:'Y',G:'Y',H:'Y'},
'Normal & homogeneous':         {A:'Y',B:'Y',C:'Y',D:'Y',E:'Y',F:'Y',G:'Y',H:'Y'},
'Soft & homogeneous':           {A:'T',B:'T',C:'Y',D:'Y',E:'Y',F:'Y',G:'Y',H:'Y'},
'Very Soft & homogeneous':      {A:'E',B:'E',C:'T',D:'Y',E:'Y',F:'Y',G:'Y',H:'Y'},
'Fatting up in wheel tracks':   {A:'T',B:'T',C:'Y',D:'Y',E:'Y',F:'Y',G:'Y',H:'Y'},
'High macrotexture / fretted':  {A:'E',B:'Y',C:'Y',D:'Y',E:'Y',F:'Y',G:'Y',H:'Y'},
'Porous':                       {A:'N',B:'N',C:'N',D:'E',E:'Y',F:'Y',G:'Y',H:'Y'},
'Very variable':                {A:'N',B:'N',C:'N',D:'E',E:'Y',F:'Y',G:'Y',H:'Y'},
'Extensive patching':           {A:'E',B:'E',C:'E',D:'E',E:'E',F:'Y',G:'Y',H:'Y'},
'Severe bleeding / blackening': {A:'N',B:'N',C:'N',D:'N',E:'N',F:'N',G:'N',H:'N'}};
const SUITABILITY_KEY = {
Y:{label:'Suitable',color:'#6ad19a',desc:'Surface dressing can be designed to meet most onerous requirements (BS EN 12272-2).'},
T:{label:'Texture concern',color:'#e0a458',desc:'Difficult to maintain high macrotexture, especially in wheel tracks. Achievable on low-speed roads.'},
D:{label:'Defects concern',color:'#e0a458',desc:'Difficult to meet most onerous defect requirements; less onerous levels should not be specified.'},
E:{label:'Expert design',color:'#e09d57',desc:'Design may be achievable by an expert to meet less onerous performance levels. Extra care in execution required.'},
N:{label:'Not appropriate',color:'#e57373',desc:'Surface dressing is not an appropriate treatment.'}};
const HARDNESS_GUIDANCE = {
'Very Hard':'Concrete or very old/oxidised surface. Probe ≤1.5mm. Minimal embedment.',
'Hard':'Older asphalt resisting penetration. Probe 1.5–3mm.',
'Normal':'Typical asphalt in reasonable condition. Probe 3–5mm.',
'Soft':'Newer asphalt or softer binder. Probe 5–7mm.',
'Very Soft':'Fresh surfacing. Probe >7mm. Risk of over-embedment.',
'Variable':'Hardness varies across carriageway.'};
const CONDITION_GUIDANCE = {
'Very Hard & homogeneous':'Old, hard, consistent surface — no patches/trenches.',
'Hard & homogeneous':'Aged but consistent — typical SD candidate.',
'Normal & homogeneous':'Fair condition, consistent texture.',
'Soft & homogeneous':'Newer asphalt, consistent. Watch wheel tracks.',
'Very Soft & homogeneous':'Fresh/soft binder — generally not yet ready.',
'Fatting up in wheel tracks':'Smooth, shiny wheel tracks. Common pre-dressing condition.',
'High macrotexture / fretted':'Open, gappy texture — needs more binder to seal.',
'Porous':'Porous asphalt or open-graded surface.',
'Very variable':'Mix of conditions across the road.',
'Extensive patching':'>20% patches. Patches behave differently.',
'Severe bleeding / blackening':'Major bitumen rise — SD inappropriate.'};
const SINGLE_DRESSING = {
VeryHard:{A:'multi',B:'multi',C:'multi',D:'multi',E:{size:'S10',binder:1.5},F:{size:'S6',binder:1.5},G:{size:'S6',binder:1.5},H:{size:'S6',binder:1.5}},
Hard:{A:'multi',B:{size:'S10',binder:1.8},C:{size:'S10',binder:1.8},D:{size:'S10',binder:1.6},E:{size:'S10',binder:1.6},F:{size:'S6',binder:1.5},G:{size:'S6',binder:1.5},H:{size:'S6',binder:1.5}},
Normal:{A:'multi',B:'multi',C:'multi',D:{size:'S10',binder:1.6},E:{size:'S10',binder:1.6},F:{size:'S10',binder:1.6},G:{size:'S10',binder:1.5},H:{size:'S6',binder:1.5}},
Soft:{A:null,B:null,C:null,D:null,E:null,F:null,G:null,H:{size:'S6',binder:1.4}},
VerySoft:{A:null,B:null,C:null,D:null,E:null,F:null,G:null,H:null},
Variable:{A:null,B:null,C:null,D:null,E:null,F:null,G:null,H:null}};
const RACKED_IN = {
VeryHard:{A:{size:'R10',binder:1.9},B:{size:'R10',binder:1.9},C:{size:'R10',binder:1.9},D:{size:'R10',binder:1.9},E:{size:'R10',binder:1.9},F:{size:'R10',binder:2.0},G:{size:'R10',binder:2.0},H:'unnecessary'},
Hard:{A:{size:'R14',binder:2.1},B:{size:'R10',binder:1.8},C:{size:'R10',binder:1.8},D:{size:'R10',binder:1.8},E:{size:'R10',binder:1.8},F:{size:'R10',binder:1.9},G:{size:'R10',binder:2.0},H:'unnecessary'},
Normal:{A:{size:'R14',binder:2.0},B:{size:'R14',binder:2.0},C:{size:'R14',binder:2.0},D:{size:'R14/R10',binder:1.8},E:{size:'R10',binder:1.8},F:{size:'R10',binder:1.9},G:{size:'R10',binder:1.9},H:'unnecessary'},
Soft:{A:null,B:null,C:null,D:{size:'R14',binder:2.0},E:{size:'R14',binder:2.0},F:{size:'R14',binder:1.8},G:{size:'R10',binder:1.7},H:'unnecessary'},
VerySoft:{A:null,B:null,C:null,D:{size:'R14',binder:1.9},E:{size:'R14',binder:1.6},F:{size:'R10',binder:1.6},G:{size:'R10',binder:1.7},H:'unnecessary'},
Variable:{A:null,B:null,C:null,D:{size:'R14',binder:1.9},E:{size:'R14',binder:1.8},F:{size:'R10',binder:1.8},G:{size:'R10',binder:1.8},H:'unnecessary'}};
const DOUBLE_DRESSING = {
VeryHard:{A:{size:'D10/D10',l1:1.1,l2:1.2},B:{size:'D10/D10',l1:1.1,l2:1.2},C:{size:'D10/D10',l1:1.1,l2:1.2},D:{size:'D10/D10',l1:1.1,l2:1.2},E:{size:'D10/D10',l1:1.1,l2:1.2},F:{size:'D10/D10',l1:1.2,l2:1.2},G:{size:'D10/D10',l1:1.2,l2:1.3},H:{size:'D10/D10',l1:1.2,l2:1.3}},
Hard:{A:{size:'D10',l1:1.0,l2:1.2},B:{size:'D10',l1:1.0,l2:1.2},C:{size:'D10',l1:1.0,l2:1.2},D:{size:'D10',l1:1.0,l2:1.2},E:{size:'D10',l1:1.0,l2:1.2},F:{size:'D10',l1:1.1,l2:1.3},G:{size:'D10',l1:1.1,l2:1.3},H:{size:'D10',l1:1.1,l2:1.3}},
Normal:{A:{size:'D14/D10',l1:1.2,l2:1.3},B:{size:'D14/D10',l1:1.2,l2:1.3},C:{size:'D14/D10',l1:1.2,l2:1.3},D:{size:'D14/D10',l1:1.2,l2:1.2},E:{size:'D10',l1:1.0,l2:1.1},F:{size:'D10',l1:1.0,l2:1.1},G:{size:'D10',l1:1.0,l2:1.2},H:{size:'D10',l1:1.0,l2:1.2}},
Soft:{A:null,B:null,C:null,D:{size:'D14',l1:1.0,l2:1.0},E:{size:'D14/D10',l1:1.0,l2:1.1},F:{size:'D14/D10',l1:1.0,l2:1.1},G:{size:'D10',l1:1.1,l2:1.1},H:{size:'D10',l1:1.1,l2:1.1}},
VerySoft:{A:null,B:null,C:null,D:{size:'D14',l1:0.8,l2:1.0},E:{size:'D14',l1:0.8,l2:1.0},F:{size:'D14',l1:0.8,l2:1.1},G:{size:'D10',l1:1.0,l2:1.1},H:{size:'D10',l1:1.0,l2:1.1}},
Variable:{A:null,B:null,C:null,D:{size:'D14',l1:1.0,l2:1.1},E:{size:'D14/D10',l1:1.0,l2:1.1},F:{size:'D14/D10',l1:1.0,l2:1.1},G:{size:'D10',l1:1.0,l2:1.1},H:{size:'D10',l1:1.0,l2:1.1}}};
const INVERTED_DOUBLE = {
Hard:{A:{size:'D14',l1:0.9,l2:1.4},B:{size:'D14',l1:0.9,l2:1.4},C:{size:'D14',l1:1.0,l2:1.4},D:{size:'D14',l1:1.0,l2:1.4},E:{size:'D14',l1:1.0,l2:1.4},F:{size:'D14',l1:1.0,l2:1.4},G:{size:'D14',l1:1.1,l2:1.4},H:{size:'D14',l1:1.1,l2:1.5}},
Normal:{A:{size:'D14',l1:0.9,l2:1.4},B:{size:'D14',l1:0.9,l2:1.4},C:{size:'D14',l1:1.0,l2:1.4},D:{size:'D14',l1:1.0,l2:1.4},E:{size:'D14',l1:1.0,l2:1.4},F:{size:'D14',l1:1.0,l2:1.4},G:{size:'D14',l1:1.1,l2:1.4},H:{size:'D14',l1:1.1,l2:1.5}},
VeryHard:{A:{size:'D14',l1:0.9,l2:1.4},B:{size:'D14',l1:0.9,l2:1.4},C:{size:'D14',l1:1.0,l2:1.4},D:{size:'D14',l1:1.0,l2:1.4},E:{size:'D14',l1:1.0,l2:1.4},F:{size:'D14',l1:1.0,l2:1.4},G:{size:'D14',l1:1.1,l2:1.4},H:{size:'D14',l1:1.1,l2:1.5}},
Soft:{A:null,B:null,C:null,D:null,E:null,F:null,G:null,H:null},
VerySoft:{A:null,B:null,C:null,D:null,E:null,F:null,G:null,H:null},
Variable:{A:'expert',B:'expert',C:'expert',D:'expert',E:'expert',F:'expert',G:'expert',H:'expert'}};
const SANDWICH = {
Hard:{A:'expert',B:'expert',C:'expert',D:{size:'D10',l1:0.0,l2:1.4},E:{size:'D10',l1:0.0,l2:1.4},F:{size:'D10',l1:0.0,l2:1.4},G:{size:'D10',l1:0.0,l2:1.5},H:{size:'D10',l1:0.0,l2:1.5}},
Normal:{A:'expert',B:'expert',C:'expert',D:{size:'D10',l1:0.0,l2:1.4},E:{size:'D10',l1:0.0,l2:1.4},F:{size:'D10',l1:0.0,l2:1.4},G:{size:'D10',l1:0.0,l2:1.5},H:{size:'D10',l1:0.0,l2:1.5}},
VeryHard:{A:'expert',B:'expert',C:'expert',D:{size:'D10',l1:0.0,l2:1.4},E:{size:'D10',l1:0.0,l2:1.4},F:{size:'D10',l1:0.0,l2:1.4},G:{size:'D10',l1:0.0,l2:1.5},H:{size:'D10',l1:0.0,l2:1.5}},
Soft:{A:null,B:null,C:null,D:null,E:null,F:null,G:null,H:null},
VerySoft:{A:null,B:null,C:null,D:null,E:null,F:null,G:null,H:null},
Variable:{A:'expert',B:'expert',C:'expert',D:{size:'D10',l1:0.0,l2:1.5},E:{size:'D10',l1:0.0,l2:1.5},F:{size:'D10',l1:0.0,l2:1.5},G:{size:'D10',l1:0.0,l2:1.5},H:{size:'D10',l1:0.0,l2:1.5}}};
const CHIPPING_SPREAD = { '2.8/6.3':{min:8,max:11}, '6.3/10':{min:10,max:14}, '8/14':{min:12,max:16} };
const SIZE_CODE_MAP = { S6:'2.8/6.3',S10:'6.3/10',S14:'8/14',R10:'6.3/10',R14:'8/14','R14/R10':'8/14',D10:'6.3/10',D14:'8/14','D14/D10':'8/14','D10/D10':'6.3/10' };
const CHIPPING_DESIGNATIONS = { S14:'8/14 mm (S14)',S10:'6.3/10 mm (S10)',S6:'2.8/6.3 mm (S6)',R14:'8/14 & 2.8/6.3 mm (R14)',R10:'6.3/10 & 2.8/6.3 mm (R10)',R10b:'6.3/10 & 4/2 mm (R10)',D14:'8/14 & 2.8/6.3 mm (D14)',D10:'6.3/10 & 2.8/6.3 mm (D10)' };
const ADJUSTMENTS = {
season:{early:0,late:0.2},
shape:{f10:-0.1,f15:0,f20:0.1,f25:'expert'},
shade:{open:0,partial:0.1,full:0.2},
condition:{veryRich:-0.2,rich:-0.1,normal:0,wheelTracks:0.1,lean:0.2},
gradient_mag:{lt5:0,mid:0.1,gt10:0.2},
gradient_dir:{uphill:-0.2,downhill:0},
speed:{high:0.1,low:0},
localTraffic:{normal:0,untrafficked:0.2},
aggregate:{rock:0,blast:0,steel:0,gravel:0.1}};
const SEASON_DATA = {
A:{S14:['high','high','sig','low','low','low','low','low','low','sig','high','high'],S10:['high','high','sig','low','low','low','low','low','low','low','sig','high'],R14:['high','high','sig','low','low','low','low','low','low','sig','high','high'],S6:['high','high','sig','low','low','low','low','low','low','sig','high','high'],R10:['high','high','sig','low','low','low','low','low','low','low','sig','high'],D14:['high','sig','low','low','low','low','low','low','low','low','sig','high'],D10:['high','sig','low','low','low','low','low','low','low','low','sig','high']},
B:{S14:['high','high','high','sig','low','low','low','low','low','sig','high','high'],S10:['high','high','sig','sig','low','low','low','low','low','sig','high','high'],R14:['high','high','high','sig','low','low','low','low','low','sig','high','high'],S6:['high','high','high','sig','low','low','low','low','low','sig','high','high'],R10:['high','high','sig','sig','low','low','low','low','low','sig','high','high'],D14:['high','high','sig','low','low','low','low','low','low','sig','high','high'],D10:['high','high','sig','sig','low','low','low','low','low','sig','high','high']},
'C/D':{S14:['high','high','high','high','sig','low','low','low','sig','high','high','high'],S10:['high','high','high','sig','sig','low','low','low','sig','sig','high','high'],R14:['high','high','high','high','sig','low','low','low','sig','sig','high','high'],S6:['high','high','high','high','sig','low','low','low','sig','high','high','high'],R10:['high','high','high','sig','sig','low','low','low','sig','sig','high','high'],D14:['high','high','high','sig','low','low','low','low','low','sig','high','high'],D10:['high','high','high','sig','sig','low','low','low','sig','sig','high','high']}};
const RISK_COLORS = { high:'#e57373', sig:'#e0a458', low:'#6ad19a' };
const RISK_LABELS = { high:'High risk', sig:'Significant risk', low:'Low risk' };
const SERIES_700 = [
{item:'7/084',desc:'Single SD, 6mm PSV60+, K1-70 unmodified',binder:1.5,size:'S6',rates:{small:5.85,medium:4.10,large:3.20}},
{item:'7/085',desc:'Single SD, 6mm PSV65+, intermediate binder',binder:1.5,size:'S6',rates:{small:6.15,medium:4.35,large:3.45}},
{item:'7/086',desc:'Single SD, 10mm PSV60+, K1-70 unmodified',binder:1.6,size:'S10',rates:{small:6.05,medium:4.25,large:3.35}},
{item:'7/087',desc:'Single SD, 10mm PSV60+, intermediate binder',binder:1.6,size:'S10',rates:{small:6.35,medium:4.50,large:3.60}},
{item:'7/088',desc:'Single SD, 10mm PSV65+, intermediate binder',binder:1.8,size:'S10',rates:{small:6.65,medium:4.80,large:4.07}},
{item:'7/089',desc:'Single SD, 10mm PSV65+, premium binder',binder:1.8,size:'S10',rates:{small:7.10,medium:5.15,large:4.40}},
{item:'7/090',desc:'Racked-in, 10/6mm PSV60+, intermediate binder',binder:1.8,size:'R10',rates:{small:7.95,medium:5.85,large:4.75}},
{item:'7/091',desc:'Racked-in, 10/6mm PSV65+, intermediate binder',binder:1.8,size:'R10',rates:{small:8.30,medium:6.15,large:5.05}},
{item:'7/092',desc:'Racked-in, 10/6mm PSV65+, premium binder',binder:1.8,size:'R10',rates:{small:8.85,medium:6.55,large:5.45}},
{item:'7/093',desc:'Racked-in, 14/6mm PSV60+, intermediate binder',binder:2.0,size:'R14',rates:{small:8.45,medium:6.25,large:5.10}},
{item:'7/094',desc:'Racked-in, 14/6mm PSV65+, intermediate binder',binder:2.0,size:'R14',rates:{small:8.85,medium:6.55,large:5.45}},
{item:'7/095',desc:'Racked-in, 14/6mm PSV65+, premium binder',binder:2.0,size:'R14',rates:{small:9.40,medium:7.00,large:5.85}},
{item:'7/096',desc:'Double SD, 10/6mm PSV60+, intermediate binder',binder:2.2,size:'D10',rates:{small:9.85,medium:7.40,large:6.15}},
{item:'7/097',desc:'Double SD, 10/6mm PSV65+, premium binder',binder:2.2,size:'D10',rates:{small:10.65,medium:8.05,large:6.75}},
{item:'7/098',desc:'Double SD, 14/6mm PSV60+, intermediate binder',binder:2.5,size:'D14',rates:{small:10.40,medium:7.85,large:6.55}},
{item:'7/099',desc:'Double SD, 14/6mm PSV65+, premium binder',binder:2.5,size:'D14',rates:{small:11.20,medium:8.50,large:7.15}}];
const QTY_BAND = (m2) => m2 < 500 ? 'small' : m2 <= 5000 ? 'medium' : 'large';
const QTY_BAND_LABEL = { small:'< 500 m²', medium:'500–5,000 m²', large:'> 5,000 m²' };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SCHEME_STATUS = { draft:{label:'Draft',color:'#7d6f8d'}, approved:{label:'Approved',color:'#c08c4f'}, onSite:{label:'On Site',color:'#4f9bc0'}, complete:{label:'Complete',color:'#6ad19a'} };
const SURFACE_TO_CONDITION = {
'Very Hard & homogeneous':'normal','Hard & homogeneous':'normal','Normal & homogeneous':'normal',
'Soft & homogeneous':'normal','Fatting up in wheel tracks':'wheelTracks',
'High macrotexture / fretted':'lean','Porous':'lean','Severe bleeding / blackening':'veryRich'};
return { TRAFFIC_CATEGORIES, LOCATION_TEMP_CAT, HARDNESS_FROM_PROBE, SUITABILITY_MATRIX, SUITABILITY_KEY, HARDNESS_GUIDANCE, CONDITION_GUIDANCE, SINGLE_DRESSING, RACKED_IN, DOUBLE_DRESSING, INVERTED_DOUBLE, SANDWICH, CHIPPING_SPREAD, SIZE_CODE_MAP, CHIPPING_DESIGNATIONS, ADJUSTMENTS, SEASON_DATA, RISK_COLORS, RISK_LABELS, SERIES_700, QTY_BAND, QTY_BAND_LABEL, MONTHS, SCHEME_STATUS, SURFACE_TO_CONDITION };
})();
