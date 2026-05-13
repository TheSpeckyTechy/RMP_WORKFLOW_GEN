# File System Access backend — local OneDrive setup

This backend stores every scheme as a JSON file in a folder **you pick
on your own work laptop**. Point it at your OneDrive folder and the
OneDrive client automatically syncs everything to DCC's tenant — no
Azure AD app registration, no IT involvement, no anon key in the
published JS.

## Constraints (be aware before flipping the switch)

- **Desktop only**. The File System Access API exists in Edge / Chrome
  / Opera. **Not** Firefox, **not** Safari, **not** mobile browsers.
  This is intentionally your fix for the work laptop, not a multi-
  device solution.
- **Per-device pick**. Each browser on each device asks once for the
  folder. The OneDrive client carries data between devices, but each
  browser still needs its own "Choose data folder" click.
- **No cloud failover**. If the OneDrive client is paused or stopped,
  saves go to the local file but don't reach the cloud until the
  client catches up. Same as any other OneDrive document.

## Setup — three steps

### 1 · Make sure OneDrive is signed in and syncing

Tray icon (bottom-right) → OneDrive → confirm it shows
`OneDrive - dundeecity.gov.uk` and **Up to date**.

### 2 · Create a folder

Wherever you like inside the synced OneDrive folder, e.g.

```
C:\Users\jake.mcallister\OneDrive - dundeecity.gov.uk\Documents\RMP-Designs
```

Empty folder is fine — the app will fill it.

### 3 · Flip the backend mode

Edit `src/context/SchemeContext.jsx` near the top:

```diff
- const BACKEND_MODE = 'supabase';
+ const BACKEND_MODE = 'fs';
```

Commit, push. GitHub Pages redeploys in 1–2 minutes.

## First use after deployment

1. Open the deployed app in **Edge** (or Chrome).
2. The sync chip in the top bar reads **📁 Choose data folder**.
3. Click it → native folder picker → navigate to the folder from
   step 2 → **Select**.
4. Browser asks once: *"Let this site read and write files in this
   folder?"* → **Allow**.
5. The chip flips to **Saving… → Synced**. Every scheme edit from
   this point writes `{id}.json` into your folder.
6. The OneDrive client picks up the new files within seconds and
   ferries them to the cloud.

## Verifying data residency

After making your first edit:

1. Open File Explorer → navigate to the folder you picked.
2. You should see one `.json` file per scheme.
3. Right-click any file → look for the green-tick OneDrive overlay
   icon. That means it's been synced to DCC's cloud.
4. Open <https://office.com> → OneDrive → navigate to the same
   path. Files visible there confirms cloud round-trip.

## What this backend gives you vs Supabase

| | Supabase today | File System Access |
|---|---|---|
| Where data lives | AWS US/EU Postgres | Your work laptop + DCC OneDrive tenant |
| Anon key in JS | Yes — anyone with the URL can read | None — file-system permissions |
| IT involvement | None (already deployed) | None |
| Audit trail | Supabase logs, outside DCC IG | M365 Unified Audit Log + version history |
| Multi-device | Real-time across devices | Each device picks the folder once; OneDrive syncs between |
| Mobile | Works | Doesn't work — desktop browsers only |
| Recovery from accidental delete | Manual / Supabase backups | 93-day OneDrive recycle bin + version history per file |

## What happens to existing data when you flip the switch

Nothing automatic. You have two paths:

**Path A — Start fresh.** Just flip the constant. The seed schemes
load from `window.SCHEMES` as always; your edits accumulate in the
new folder. Supabase data is untouched (and ignored).

**Path B — Carry your edits over.** Before flipping, open the
deployed app on Supabase mode, open DevTools, run:

```js
const ctx = React.useContext(window.SchemeContext);   // or grab via window.__schemeStore if exposed
JSON.stringify(ctx.schemes, null, 2);
```

Copy the output, save each scheme as `{id}.json` into your folder
manually. Then flip the constant and the file backend picks them up.

(In practice Path A is fine — your seed-derived data is in
localStorage too, so the first FS render still shows everything;
the next edit creates the matching JSON file.)

## Rollback

Flip `BACKEND_MODE` back to `'supabase'`. Both backends are still
present in the source; the switch is one line.
