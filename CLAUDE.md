# RMP Workflow Generator — Claude Instructions

## Version string

`window.APP_VERSION` is defined in `index.html` (near the bottom, just before the service worker registration script).

**Before every merge to main, update it to today's date** using the format `vYY.MM.DD` — e.g. `v26.05.28` for 28 May 2026.

This lets the user confirm which version of the app is running from the version label in the sidebar.

## Git workflow

- Development branch: `claude/magical-mccarthy-1TtxY`
- Always push to this branch, then create a PR and squash-merge into `main`
- Use GitHub MCP tools (`mcp__github__push_files`, `mcp__github__create_pull_request`, `mcp__github__merge_pull_request`) for all GitHub operations — do not rely on local git push

## File saves (File System Access API)

All document exports save to the user's OneDrive project subfolders via the browser File System Access API (`fsSaveToProjectFolder` in `src/context/SchemeContext.jsx`). The folder map is:

| Document | OneDrive subfolder |
|---|---|
| BoQ XLSX + PDF | `Contract/` |
| TC BoQ XLSX | `Contract/` |
| Master Workbook XLSX | `Contract/` |
| PCI/CPP DOCX + PDF | `CDM/` |
| Utility Searches | `CDM/` |
| RSR DOCX + PDF | `Project Admin/` |
| Letters DOCX/ZIP + PDF | `Project Admin/` |
| Front Sheet PDF | `Project Admin/` |
| Resurfacing & Ironwork Plans | `Drawings/Draft/` |
| Traffic Management Plans | `Drawings/Received/` |
| Handover Pack PDF | `Design & Reports/` |

Versioned saves archive the previous file as `{name}_R1.ext`, `_R2.ext` etc. in a `Superseded/` subfolder.
