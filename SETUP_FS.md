# File System Access backend — local OneDrive setup

This app stores every scheme as a JSON file in a folder **you pick on your
own work laptop**. Point it at your OneDrive folder and the OneDrive client
automatically syncs everything to DCC's tenant — no Azure AD app
registration, no IT involvement, no third-party cloud service.

Scheme data is **not** shipped in the deployed app. The `seed-data/` directory
in the repo holds one `{id}.json` file per scheme for the 2026/27 register.
Copy those files into your data folder once on first setup (see step 3 below).

## Constraints (be aware before first use)

- **Desktop only.** The File System Access API is available in Edge / Chrome
  / Opera. **Not** Firefox, **not** Safari, **not** mobile browsers.
- **Per-device pick.** Each browser on each device asks once for the folder.
  The OneDrive client carries data between devices; each browser still needs
  its own "Choose data folder" click.
- **No cloud failover.** If the OneDrive client is paused or stopped, saves
  go to the local file but don't reach the cloud until the client catches up —
  same as any other OneDrive document.

## Setup — four steps

### 1 · Make sure OneDrive is signed in and syncing

Tray icon (bottom-right) → OneDrive → confirm it shows
`OneDrive - dundeecity.gov.uk` and **Up to date**.

### 2 · Create a folder

Wherever you like inside the synced OneDrive folder, e.g.

```
C:\Users\jake.mcallister\OneDrive - dundeecity.gov.uk\Documents\RMP-Designs
```

Empty folder is fine — you will add the seed files in the next step.

### 3 · Seed a new machine / fresh folder

Copy the contents of `seed-data/` from the repo into the folder you just
created. Each file is named `{id}.json` and contains the scheme record for
one scheme in the 2026/27 register.

If you already have a folder from another machine synced via OneDrive, the
JSON files will already be there — skip this step.

```
# From the repo root (adjust paths as needed):
cp seed-data/*.json "C:\Users\jake.mcallister\OneDrive - dundeecity.gov.uk\Documents\RMP-Designs\"
```

Or just drag-and-drop the files in Windows Explorer.

### 4 · Connect the folder in the app

1. Open the deployed app in **Edge** (or Chrome).
2. The sync chip in the top bar reads **📁 Choose data folder**.
3. Click it → native folder picker → navigate to the folder from step 2 → **Select**.
4. Browser asks once: *"Let this site read and write files in this folder?"* → **Allow**.
5. The chip flips to **Saving… → Synced**. Every scheme edit from this point
   writes `{id}.json` into your folder.
6. The OneDrive client picks up new and changed files within seconds and
   ferries them to the cloud.

## Verifying data residency

After making your first edit:

1. Open File Explorer → navigate to the folder you picked.
2. You should see one `.json` file per scheme.
3. Right-click any file → look for the green-tick OneDrive overlay icon.
   That means it has been synced to DCC's cloud.
4. Open <https://office.com> → OneDrive → navigate to the same path.
   Files visible there confirms cloud round-trip.

## What this backend gives you

| | File System Access (this app) |
|---|---|
| Where data lives | Your work laptop + DCC OneDrive tenant |
| Credentials in JS | None — file-system permissions only |
| IT involvement | None |
| Audit trail | M365 Unified Audit Log + version history per file |
| Multi-device | Each device picks the folder once; OneDrive syncs between |
| Mobile | Doesn't work — desktop browsers only |
| Recovery from accidental delete | 93-day OneDrive recycle bin + version history per file |

## Re-generating seed-data/

If the scheme register changes and you need a fresh set of seed files, run:

```sh
node scripts/export_seed_json.js
```

This reads the scheme definitions from `src/data/store.jsx` and writes one
`{id}.json` per scheme into `seed-data/`. Commit the result and distribute to
any machine that needs a fresh folder.
