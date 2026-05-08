// Smoke test for the BoQ engine end-to-end on this branch.
// Loads the engine + store + migration shim under a Node window stub,
// migrates the seed schemes, computes BoQ totals, prints them.
// Pipe both branches through this and diff to verify Phase 3's
// "byte-identical for migrated schemes" claim.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repo = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(repo, p), 'utf8');

// Strip JSX from a single file by running it through @babel/standalone if
// available; otherwise skip. We only need engine + store + migration shim,
// none of which use JSX heavily — but store.jsx and SchemeContext.jsx do
// have arrow-function JSX returns. Skip those that don't load cleanly.
const ctx = {
  console,
  React: { createContext: () => ({}), useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({}), useContext: () => ({}), useMemo: (fn) => fn(), useCallback: (fn) => fn },
  ReactDOM: {},
  setTimeout, clearTimeout,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, key: () => null, length: 0 },
};
ctx.window = ctx;
ctx.globalThis = ctx;

// Stub Supabase before loading SchemeContext
ctx.supabase = { createClient: () => ({ from: () => ({ select: () => Promise.resolve({ data: [], error: null }), upsert: () => Promise.resolve({ error: null }), delete: () => ({ eq: () => Promise.resolve({ error: null }) }) }) }) };

vm.createContext(ctx);

const loadPlain = (p) => {
  try { vm.runInContext(read(p), ctx, { filename: p }); }
  catch (e) { console.error(`load ${p}: ${e.message}`); throw e; }
};

// Plain JS — load directly
loadPlain('src/data/boq_rates_full.js');
loadPlain('src/data/boq_rates.js');
loadPlain('src/data/boq_engine.js');

// JSX files: strip just the React.createContext / JSX bits we don't need
// for the engine + migration test. We only care about:
//   - window.defaultBoq, window.defaultDesign, window.baseScheme, window.SCHEMES, window.schemeArea
//   - migrate (withBoq + withDesign + deriveDesignFromLegacy)
// store.jsx: only the trailing JSX is in WARDS data (none) — it's pure JS
//   except baseScheme uses no JSX. Should load.
loadPlain('src/data/store.jsx');

// SchemeContext.jsx: has JSX in SchemeProvider.return. Need to strip.
const ctxSrc = read('src/context/SchemeContext.jsx');
// Cut the JSX return block — keep everything before SchemeProvider and the
// migrate helpers (deriveDesignFromLegacy / withDesign / withBoq / migrate).
const cutAt = ctxSrc.indexOf('const SchemeProvider');
const headOnly = ctxSrc.slice(0, cutAt) + '\nwindow.__migrate = migrate;\n';
vm.runInContext(headOnly, ctx, { filename: 'src/context/SchemeContext.jsx (head)' });

// ── Run the smoke test ──────────────────────────────────────────────────────
const E = ctx.window.BOQ_ENGINE;
const migrate = ctx.window.__migrate;

console.log('Engine loaded:', !!E);
console.log('migrate loaded:', !!migrate);
console.log('SCHEMES loaded:', ctx.window.SCHEMES?.length, 'schemes');
console.log('');

const targets = ['R5008', 'ARRAN-DR', 'PR011'];
for (const id of targets) {
  const seed = ctx.window.SCHEMES.find(s => s.id === id);
  if (!seed) { console.log(`${id}: not found`); continue; }
  const migrated = migrate(seed);
  const effective = E.effectiveQuickInputs(migrated, migrated.boq);
  const autoLines = E.regenAutoLines(effective);
  const computed  = E.buildBoQLines({ ...migrated.boq, quick_inputs: effective, custom_lines: autoLines }, migrated);
  console.log(`── ${id} (${seed.road_name}) ──`);
  console.log(`  zones (design): ${migrated.design.zones.length}`);
  console.log(`  total (ex VAT): ${computed.subtotal?.toFixed(2)}`);
  console.log(`  total (inc VAT): ${computed.totalIncVat?.toFixed(2)}`);
  console.log(`  lines: ${computed.lines?.length}, groups: ${computed.groups?.length}`);
  // Per-series subtotals — diff target
  for (const g of (computed.groups || [])) {
    console.log(`    S${g.num} ${g.title}: £${g.subtotal?.toFixed(2)}`);
  }
  console.log('');
}
