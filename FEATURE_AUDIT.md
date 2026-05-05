# RMP Design Studio — Full Feature Audit

**Date:** 2026-05-05
**Branch:** `claude/feature-audit-8OoT1`
**Version under audit:** 2.0.0 (per in-app metadata)
**Scope:** Whole repository at HEAD of `claude/feature-audit-8OoT1`

---

## 1. Executive summary

RMP Design Studio is a single-page web application that automates the production of road maintenance project paperwork (Bills of Quantities, Road Space Requests, PCI/CPP traffic plans, resident letters, and a project front sheet) for Dundee schemes. It runs entirely in the browser with no build step: `index.html` loads React, Babel Standalone, and a fixed list of `.jsx` modules over CDN, and persists schemes to `localStorage` plus a public Supabase project.

The core workflow is feature-complete: a user can create a scheme, fill the Master Workbook, build a BoQ from a 1,565-item priced catalogue, and download a 9-document pack. The main gaps are around **trust boundaries** (no real auth, public Supabase anon key in the page source, public DB writes), **build/test/CI** (none exist), **template/data validation** (silent failures on missing placeholders, no input validation), and **operational hygiene** (corrupted README, cache-busting query string on a single asset, dead stub files).

Risk-ranked headline issues are listed in §8.

---

## 2. Repository inventory

| Path | Purpose |
|---|---|
| `index.html` | Entry point; loads CDN libs, then 18 source files in fixed order. |
| `src/data/` | Static data and BoQ engine (data.js, boq_rates_full.js, boq_rates.js, boq_engine.js, store.jsx). |
| `src/context/SchemeContext.jsx` | React context, localStorage cache, Supabase sync. |
| `src/components/` | React UI: App, Dashboard, SchemeDetail, MasterWorkbook, BoQ family, Sidebar, PasswordGate, icons. |
| `src/components/previews/` | Document generators: RoadSpaceRequest, PCIPreview, LetterPreview, TCBoQExport. |
| `src/styles/` | `styles.css`, `sd-panels.css`, `sd-proforma.css`. |
| `templates/` | DOCX/XLSX templates fetched at runtime, plus 18 reference scheme PDFs and a sample CAG CSV. |
| `scripts/extract_boq_rates.py` | One-off Python tool that regenerates `boq_rates_full.js` from three reference Excel BoQs. |
| `assets/` | Sample PCI XML and UI screenshots. |
| `*.xlsx` (root) | Three reference BoQ source workbooks (Clepington, Lochee, Overton-Netherton). |
| `.github/workflows/` | Present but unaudited contents. |
| `.nojekyll` | Disables Jekyll on GitHub Pages. |

**Source LOC:** ~9,545 total across 21 source files. Heaviest modules:

| File | Lines | Role |
|---|---:|---|
| `boq_rates_full.js` | 1,962 | Embedded 1,565-item priced catalogue (machine-generated). |
| `BoQTab.jsx` | 987 | BoQ editor: quick-input rail, ledger, catalogue drawer. |
| `SchemeDetail.jsx` | 867 | Tabbed scheme view (Workbook, Treatment, Ward, Utilities, Pack). |
| `LetterPreview.jsx` | 776 | Resident letter mail-merge with CAG CSV import. |
| `App.jsx` | 665 | Root, modals, download orchestration. |
| `store.jsx` | 646 | Wards, councillors, default scheme, workbook schema. |
| `boq_engine.js` | 626 | BoQ auto-population, costing, banding, totals. |

Stub / minimal files: `data.js` (6 lines, placeholder), `Sidebar.jsx` (38 lines), `icons.jsx` (58 lines), `boq_rates.js` (53 lines, lookup wrapper).

---

## 3. Build, deploy, and runtime model

- **No bundler, no package.json, no node_modules.** All JS runs through Babel Standalone in the browser. Production deployments therefore download Babel + 6 other CDN libraries on every load and transpile JSX on the client.
- **CDN dependencies pinned by version** in `index.html`:
  - `@supabase/supabase-js@2`, `jszip@3.10.1`, `xlsx-js-style@1.2.0`, `docx-preview@0.3.5`, `jspdf@2.5.1`, `html2canvas@1.4.1`, `react@18.3.1`, `react-dom@18.3.1` (development build), `@babel/standalone@7.29.0`.
  - React is loaded as `react.development.js` — i.e. the dev build is shipped to end users, with extra warnings, larger size, and slower runtime.
  - Supabase script tag has no SRI hash; React, ReactDOM and Babel do.
- **Load order is significant** and enforced via the order of `<script>` tags in `index.html`. Any reordering breaks globals (the app uses `window.*` everywhere because there is no module system).
- **One asset is cache-busted by query string** (`TCBoQExport.jsx?v=7`); none of the others are. New deploys risk users hitting stale cached `.jsx` files.
- **`scripts/extract_boq_rates.py`** is the only build-time artefact generator. It must be re-run manually (Python + openpyxl) when rates change, and the generated `boq_rates_full.js` is committed.
- **Hosting:** `.nojekyll` indicates GitHub Pages.

---

## 4. Feature-by-feature walkthrough

### 4.1 Authentication / access control — `PasswordGate.jsx`
- A password-gate component exists but the implementation is a stub (80 lines, deferred).
- Anyone with the deployment URL can read and write data.
- The Supabase anon key is hard-coded in the client (expected for anon clients) but the project is configured for **public anonymous read AND write**, so the gate, even when functional, would only block UI access and not protect the database.

### 4.2 Scheme management — `Dashboard.jsx`, `SchemeDetail.jsx`, `SchemeContext.jsx`
- CRUD for schemes with five statuses: `design`, `review`, `ready`, `works`, `archived`.
- Completeness score (7 key fields) drives a progress bar.
- Filter chips by status; free-text search on road name / project number.
- Scheme register XLSX export from the dashboard.
- `onDuplicate` callback exists in context but is **not wired to any UI control** in `SchemeDetail.jsx` — duplication is dead code.
- No "recently opened" list, no draft autosave indicator, no unsaved-changes warning on tab close.

### 4.3 Master Workbook — `MasterWorkbook.jsx`, `store.jsx`
- 49 named ranges across 7 sections: road metadata, treatment, dates, traffic management, utilities, area calculations, contractor.
- Hardcoded ward + councillor roster (8 wards). Updates require a code change and redeploy.
- Two-way sync with `SchemeContext` → `localStorage` → Supabase.
- **No client-side validation:** numeric area fields accept negatives or non-numerics; date fields are unconstrained strings; project numbers have no format check.

### 4.4 Bill of Quantities — `BoQTab.jsx`, `boq_engine.js`, `boq_rates_full.js`
- **Quick-input rail** auto-populates ~10 common items (surface, binder, base, sub-base, milling, tack, TM, kerbs, footway, markings, ironwork) from Master fields.
- **Catalogue drawer** with full-text search across 1,565 priced lines extracted from three reference Excel BoQs.
- **Ledger view** grouped by series (Preliminaries, Site Clearance, Drainage, Pavements, etc.) with per-line quantity, unit, cost.
- **Cost banding** A–D by quantity thresholds per series.
- **Custom (user-defined) lines** supported.
- **Master-linked overrides:** Master metadata propagates to BoQ inputs unless the user has explicitly overridden a value.
- **Additions:** Overheads & Profit, Contingency, Off-site Items, BERR indexation (date + multiplier), VAT — all toggleable.
- Outputs: BoQ summary card (totals, £/m², band breakdown), BoQ PDF (`BoQSummaryPDF.jsx` via html2canvas + jsPDF), BoQ XLSX (`BoQExport.jsx`), tender-checker XLSX (`TCBoQExport.jsx`).
- **Validation gaps:** quantities accept ≤ 0 silently; selecting a material that no longer exists in the catalogue does not warn; custom-line unit field is free text.

### 4.5 Document generation — `previews/*`
| Document | Module | Output formats | Template |
|---|---|---|---|
| Road Space Request | `RoadSpaceRequest.jsx` | DOCX, PDF | `Road_Space_Request_Form_TEMPLATE.docx` (`{{TAG}}` placeholders) |
| PCI / CPP Traffic Plan | `PCIPreview.jsx` | DOCX, PDF | Same RSR template plus route-sketch overlay |
| Resident letter | `LetterPreview.jsx` | DOCX (single + bulk ZIP) | `Residential_Letter_Template (1).docx` (`<<TAG>>` / `«TAG»` placeholders) |
| Master Workbook export | (App-level) | XLSX | Generated from named-range schema |
| Front sheet | (App-level) | PDF | html2canvas snapshot |
| Tender-checker BoQ | `TCBoQExport.jsx` | XLSX | `TC_BoQ_JMCA_TEMPLATE.xlsx` |

- Templates are loaded over `fetch()`. **Failures are silent** — there is no UI to surface a 404 on a template, and no validation that all expected placeholders are present in the DOCX.
- The "all 9 documents" download manager animates progress in a modal but does not hard-fail the batch when one document throws; per-document statuses are tracked individually.

### 4.6 Resident-letter mail merge — `LetterPreview.jsx`
- CAG (Common Address Gazetteer) CSV import panel.
- Per-recipient placeholder substitution + DOCX preview via `docx-preview`.
- Bulk export to ZIP via JSZip.
- Filename used in templates folder is `Residential_Letter_Template (1).docx` — the trailing ` (1)` suggests an accidentally retained "Save As" copy of the original; should be normalised.

### 4.7 Persistence — `SchemeContext.jsx`
- `localStorage` is the source of truth for fast reads.
- Supabase sync runs on every scheme update and on initial mount.
- Anonymous public access; **no user accounts, no row-level isolation, no audit log.** Two users editing different schemes simultaneously will not conflict (different rows), but two users on the same scheme have last-write-wins with no merge or warning.
- A `boq` shape migration is performed on load to upgrade older schemes; this is undocumented and should be retained until older clients are confirmed extinct.

### 4.8 UI / accessibility — `styles/*`, `App.jsx`
- Three CSS files; responsive grid down to single-column on mobile; sidebar collapses.
- **No ARIA labels, no documented keyboard navigation, no screen-reader testing notes, no focus-management in modals.** The custom modals (`GenerateModal`, `RSRModal`, `PCIModal`, `LetterModal`) do not appear to trap focus.
- Icons are inline SVG with no `<title>` / `aria-label`.

### 4.9 Window globals (implicit API)
The download orchestrator depends on these being attached during render:
- `window.__downloadRSR(scheme)`, `window.__downloadRSRPdf(scheme)`
- `window.__downloadPCI(scheme)`, `window.__downloadPCIPdf(scheme)`
- `window.__workbookExport()`
- `window.__downloadBoQ()` / `window.__exportBoQForScheme(scheme)`
- `window.__downloadFront()` / `window.__downloadFrontPdf(scheme)`
- `window.exportBoQSummaryPDF(scheme, boq, computed)`

This is a fragile contract: a child component must mount and register before the orchestrator runs, and any rename is an undetectable runtime break.

### 4.10 Edit-mode hooks
`App.jsx` listens for `window.__edit_mode_available` postMessages. The receiver is minimal and the surrounding feature looks unfinished.

---

## 5. Documented vs implemented features

The repository ships a `README.md` at the root, but **the file is a Microsoft Word `.docx` (PKZip header) misnamed as Markdown.** GitHub will render it as raw binary. This needs to be either renamed to `README.docx` (and a real Markdown README written) or converted to actual Markdown. There is also a separate `templates/README.md` whose contents were not parsed in this audit but should be checked.

Because the README is unreadable as Markdown, "documented features" in this audit means the feature surface visible from the UI strings and module structure. Under that lens, every claimed feature has at least skeleton implementation, with the gaps noted in §4.

---

## 6. Code health

### 6.1 Dead / placeholder code
- `src/data/data.js` (6 lines) — placeholder; only exists to anchor script load order.
- `onDuplicate` plumbing in `SchemeContext` — no UI consumer.
- `__edit_mode_available` listener — no observed producer.
- `PasswordGate.jsx` — non-functional stub.

### 6.2 No tests, no CI checks for code
- There is a `.github/workflows/` directory but no in-repo unit, integration, or end-to-end tests. No linter, no formatter config (`.eslintrc`, `.prettierrc`), no type-checking. Any regression must be caught manually.

### 6.3 No TODO/FIXME markers
A grep for `TODO|FIXME|XXX|HACK` in `src/` returned nothing. Either the codebase is genuinely free of intentional debt markers or — more likely given the unfinished features above — those gaps were never written down.

### 6.4 Cache-busting consistency
Only `TCBoQExport.jsx?v=7` is versioned in `index.html`. After deploys, users will reliably get the new tender-checker export but may see stale versions of every other module until the browser cache expires.

---

## 7. Security posture

| # | Concern | Evidence | Severity |
|---|---|---|---|
| S1 | Public anonymous Supabase access for both reads and writes | `SchemeContext.jsx` uses anon key; no auth gate; `PasswordGate` is a stub | **High** if the deployment is internet-reachable |
| S2 | PII in mail-merge (CAG addresses, resident names) persisted to a public DB | `LetterPreview.jsx` + Supabase sync | **High** if real CAG data is uploaded |
| S3 | React **development build** shipped to users | `react.development.js` in `index.html` | Medium (perf, info disclosure of warnings) |
| S4 | No SRI on Supabase script tag | `index.html` | Low–medium (CDN compromise vector) |
| S5 | Babel Standalone in production | `index.html` | Medium (perf, supply-chain surface) |
| S6 | Templates loaded via `fetch` with no integrity check | RSR/PCI/Letter previews | Low (templates are same-origin) |
| S7 | No CSP, no `referrer-policy`, no security headers visible from the static page | `index.html` | Low–medium |
| S8 | Three Excel reference workbooks committed at repo root may contain commercial pricing data | `*.xlsx` at root | Review for confidentiality |

A dedicated `/security-review` is recommended before any wider rollout.

### 7.1 Branch / PR hygiene
The current branch is `claude/feature-audit-8OoT1`; the working tree was clean before this audit was added.

---

## 8. Risk-ranked findings (top 10)

1. **`README.md` is a binary .docx misnamed as Markdown.** Easy to fix; embarrassing in the repo root.
2. **`PasswordGate` is non-functional**, while the deployment talks to Supabase with anonymous public access. Either remove the gate (and admit the app is public) or wire it to real auth (Supabase Auth + RLS).
3. **Supabase row-level security must be reviewed.** With anon writes enabled, anyone who finds the URL can edit or destroy every scheme.
4. **React development build is shipped to production.** Switch to `react.production.min.js` and `react-dom.production.min.js`.
5. **Babel Standalone is shipped to production.** Add a tiny build step (Vite/esbuild) that pre-transpiles the JSX once and removes Babel from the runtime path.
6. **No CI / tests / lint.** At minimum add `eslint`, a `prettier` config, and a smoke test that boots the bundle in a headless browser.
7. **No template-placeholder validation.** A renamed placeholder will silently produce a half-merged DOCX. Add an assertion pass over each template at fetch-time.
8. **No input validation in Master Workbook / BoQ.** Negative areas, malformed dates, and zero quantities all accept silently. Add per-field validators.
9. **Cache-busting is inconsistent.** Either version every `<script>` query string per release or move to a hashed-bundle build.
10. **Stub / unfinished hooks** (`data.js`, `onDuplicate`, `__edit_mode_available`) should be either finished or removed; carrying them forward as inert code raises onboarding cost and obscures intent.

---

## 9. Recommended next steps (in order)

1. Replace the binary `README.md` with a real Markdown overview (and rename the original to `README.docx` if the Word version is still wanted).
2. Decide the auth posture: either lock Supabase down (RLS + Supabase Auth) and finish `PasswordGate`, or make it explicit that the deployment is public-by-design and document the trust model.
3. Add a minimal Vite (or esbuild) build that emits a hashed bundle and replaces Babel + dev-build React in the served HTML.
4. Add `eslint` + `prettier` + a GitHub Actions check that runs them on PRs.
5. Add a single Playwright smoke test: load the page, create a scheme, fill one Master field, and click "Generate pack".
6. Add a runtime "template self-check" that warns in the console if any expected placeholder is missing from a fetched DOCX.
7. Add per-field validators in `MasterWorkbook.jsx` and the BoQ custom-line editor.
8. Audit / clean dead code: `data.js`, unused `onDuplicate`, edit-mode listener.
9. Decide on a cache strategy (hashed filenames preferred) and apply uniformly.
10. Move the three reference `*.xlsx` workbooks out of the repo root if they contain commercially sensitive pricing — at least into a `reference/` folder, ideally out of the repo entirely.

---

*Generated on `claude/feature-audit-8OoT1`.*
