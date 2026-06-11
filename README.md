# RMP Design Studio

Browser-based workflow tool for Dundee road maintenance projects. Manages a
register of schemes and generates the document pack for each — Road Space
Request, PCI/CPP traffic plan, resident letters, Bill of Quantities, Master
Workbook export, and a project front sheet.

> The original Word version of this README is preserved as `README.docx`.

## Running it

The app is a static SPA with no build step. Open `index.html` in a modern
browser, or serve the repo root with any static file server:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

`index.html` loads React, Babel Standalone, and the `.jsx` source files over
CDN. Script load order matters and is enforced in `index.html`.

## Repository layout

```
index.html                      Entry point. Loads CDN libs and source files in order.
src/
  data/         BoQ engine, priced catalogue (1,565 items), default scheme shape.
  context/      React context, localStorage cache, File System Access backend.
  components/   App, Dashboard, SchemeDetail, MasterWorkbook, BoQ tab.
  components/previews/   RSR, PCI, resident letter, tender-checker BoQ.
  styles/       styles.css, sd-panels.css, sd-proforma.css.
templates/      DOCX/XLSX templates fetched at runtime + reference scheme PDFs.
seed-data/      One JSON file per scheme for the 2026/27 register (not deployed).
                Copy into the data folder once on first setup. See SETUP_FS.md.
scripts/        export_seed_json.js — writes seed-data/ from store.jsx seeds.
                extract_boq_rates.py — regenerates boq_rates_full.js from Excel.
assets/         Sample PCI XML, UI screenshots.
```

See `templates/README.md` for the placeholder tag format used by each DOCX
template.

## Persistence

Scheme data is stored exclusively in the user's chosen data folder via the
**File System Access API** (Edge / Chrome on desktop). Each scheme is a
`{id}.json` file. Point the folder at a OneDrive-synced path and the OneDrive
client carries files between devices automatically.

`localStorage` provides an instant local cache — every edit writes there first
and then to the folder asynchronously. On mount the folder contents are fetched
and merged into state using a last-write-wins timestamp comparison.

Scheme data is **not** shipped in the deployed app. The `seed-data/` directory
in the repo contains one JSON file per scheme for the 2026/27 register; copy
those into your data folder on first setup (see SETUP_FS.md).

There is no Supabase backend or any third-party cloud service. Data residency
is entirely within DCC's OneDrive / M365 tenant.

## Updating the BoQ catalogue

`src/data/boq_rates_full.js` is generated from three reference Excel BoQs at
the repo root by `scripts/extract_boq_rates.py` (requires Python 3 and
`openpyxl`):

```sh
python3 scripts/extract_boq_rates.py
```

Commit the regenerated `boq_rates_full.js`.

## Audit

A full feature audit of the codebase lives in `FEATURE_AUDIT.md`.
