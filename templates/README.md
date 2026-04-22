# RMP Design Studio — Template Files

These files are loaded at runtime by the browser. Do not rename or move them
without updating the corresponding fetch paths in the source code.

---

## Active files

### `Road_Space_Request_Form_TEMPLATE.docx`
Used by **RSRModal** (`src/components/previews/RoadSpaceRequest.jsx`) for DOCX
download, and by **PCIPreview** (`src/components/previews/PCIPreview.jsx`) for
the PCI/CPP DOCX download.

Placeholder format: `{{TAG_NAME}}` (double curly braces, uppercase)

Key tags: `{{PREPARED_BY}}`, `{{ROAD_NAME}}`, `{{PROJECT_NUMBER}}`,
`{{DATE_START}}`, `{{DATE_FINISH}}`, `{{CONTRACTOR}}`, `{{WARD_SELECTED}}`,
`{{GRID_REF}}`, `{{SCHEME_EXTENT}}`, `{{TM_TYPE}}`, `{{TM_HOURS}}`,
`{{DATE_PREPARED}}` and ~15 more mapped in `RoadSpaceRequest.jsx`.

### `Residential_Letter_Template (1).docx`
Used by **LetterPreview** (`src/components/previews/LetterPreview.jsx`) for
single-letter preview and bulk mail-merge ZIP download.

Fetch path in source: `templates/Residential_Letter_Template (1).docx`
(browser `fetch()` handles the space — no `%20` encoding needed).

Placeholder format: `<<TAG>>` or `«TAG»` (angle-bracket / chevron style)

Key tags: `<<ROAD_NAME>>`, `<<DATE_START>>`, `<<DATE_FINISH>>`,
`<<RECIPIENT_NAME>>`, `<<RECIPIENT_ADDRESS>>`, `<<WARD_SELECTED>>`,
`<<PREPARED_BY>>`, `<<PROJECT_NUMBER>>`, `<<TREATMENT_TYPE>>`,
`<<FINANCIAL_YEAR>>`.

---

## Support files

### `CAG (4).csv`
Sample Common Address Gazetteer export for testing the "Import from CAG" panel
in the letter modal. Not referenced in source code — for manual use only.

### `RMP_Design_Master_Workbook.xlsx`
Reference workbook used during development. Not fetched at runtime.
