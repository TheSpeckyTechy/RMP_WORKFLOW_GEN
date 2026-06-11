// Export each scheme from window.SCHEMES (as defined in src/data/store.jsx)
// to seed-data/{id}.json as pretty-printed JSON. Uses the raw seed shape —
// no migrate() is applied. Run once to build the seed-data/ directory that
// the app reads on first setup of a new data folder.
//
// Usage: node scripts/export_seed_json.js

'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const repo = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(repo, p), 'utf8');

// Minimal window/React stub — mirrors smoke_boq.js approach.
const ctx = {
  console,
  React: {
    createContext: () => ({}),
    useState:      () => [null, () => {}],
    useEffect:     () => {},
    useRef:        () => ({}),
    useContext:    () => ({}),
    useMemo:       (fn) => fn(),
    useCallback:   (fn) => fn,
  },
  ReactDOM: {},
  setTimeout, clearTimeout,
  localStorage: {
    getItem:    () => null,
    setItem:    () => {},
    removeItem: () => {},
    key:        () => null,
    length: 0,
  },
};
ctx.window    = ctx;
ctx.globalThis = ctx;

vm.createContext(ctx);

const loadPlain = (p) => {
  try {
    vm.runInContext(read(p), ctx, { filename: p });
  } catch (e) {
    console.error(`load ${p}: ${e.message}`);
    throw e;
  }
};

// store.jsx uses window.defaultBoq and window.defaultDesign, plus React hooks
// for useCounter (harmless), and defines window.SCHEMES.
loadPlain('src/data/store.jsx');

const schemes = ctx.window.SCHEMES;
if (!Array.isArray(schemes) || schemes.length === 0) {
  console.error('window.SCHEMES is empty or not an array — nothing to export.');
  process.exit(1);
}

// Create output directory.
const outDir = path.join(repo, 'seed-data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let written = 0;
for (const scheme of schemes) {
  if (!scheme.id) { console.warn('Skipping scheme with no id:', scheme.road_name); continue; }
  const payload = {
    ...scheme,
    updated_at: scheme.updated_at || '2026-06-11T00:00:00.000Z',
  };
  const outPath = path.join(outDir, `${scheme.id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  written++;
}

console.log(`Exported ${written} scheme(s) to seed-data/`);
