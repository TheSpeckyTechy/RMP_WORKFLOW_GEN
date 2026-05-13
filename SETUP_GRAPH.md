# Microsoft Graph (SharePoint / OneDrive) backend — setup

This guide covers the one-time configuration to switch RMP Design Studio's
scheme storage from Supabase to Microsoft Graph, so every scheme lives as
a JSON file in your `@dundeecity.gov.uk` OneDrive — DCC's tenant, DCC's
audit log, no third-party data store.

The migration ships with both backends side by side, selected by a single
constant in `src/context/SchemeContext.jsx`:

```js
const BACKEND_MODE = 'supabase';   // 'supabase' | 'graph'
```

Default is `'supabase'`. Nothing changes until you've done the
registration below and flipped that constant.

---

## 1 · Register the app in Azure AD

Most likely path — your account may not have permission to register apps
directly; if not, ask DCC IT for the equivalent one-off action. The
process takes ~5 minutes for someone with rights.

1. Sign in to <https://entra.microsoft.com> (or the older
   `portal.azure.com` → Azure Active Directory) as a DCC account with
   admin rights.
2. **App registrations → New registration**.
3. Fields:
   - **Name**: `RMP Design Studio`
   - **Supported account types**:
     **Accounts in this organizational directory only** *(dundeecity.gov.uk
     only — Single tenant)*.
   - **Redirect URI**:
     - Platform: **Single-page application (SPA)**
     - URI: `https://thespeckytechy.github.io/RMP_WORKFLOW_GEN/`
       *(plus `http://localhost:8080/` if you ever test locally)*.
4. Click **Register**.
5. On the **Overview** page note down two values:
   - **Application (client) ID**
   - **Directory (tenant) ID**

## 2 · Grant Microsoft Graph permissions

Still in the app registration:

1. **API permissions → Add a permission → Microsoft Graph → Delegated**.
2. Add:
   - `Files.ReadWrite` — read/write the user's OneDrive content.
   - `User.Read` — sign-in basics, gives us their display name.
3. **Grant admin consent for dundeecity.gov.uk** *(button on the same
   page — needs an admin if you aren't one)*.

Verify the **Status** column shows green ticks against both permissions.

## 3 · Optional: pin to a shared SharePoint site

By default each user's schemes live in **their own OneDrive**, in
`/RMP/scheme-data`. That works for single-author use but doesn't share
data across colleagues.

To use a shared SharePoint document library instead:

1. Create a site (or use an existing one) — *Settings → Site contents →
   New → Document library → "scheme-data"*.
2. In `SchemeContext.jsx`, switch the `graphFolderPath()` paths from
   `/me/drive/...` to `/sites/{site-id}/drive/root:/scheme-data:...`.
   Site ID lookup: `GET /v1.0/sites/dundeecity.sharepoint.com:/sites/{site-slug}`.

This is a follow-up; the initial migration uses `/me/drive` for
simplicity.

## 4 · Wire the IDs into the code

In `src/context/SchemeContext.jsx` near the top:

```js
const GRAPH_CONFIG = {
  clientId: 'REPLACE_WITH_AZURE_AD_APP_ID',     // ← Application (client) ID
  tenantId: 'REPLACE_WITH_AZURE_AD_TENANT_ID',  // ← Directory (tenant) ID
  scopes: ['Files.ReadWrite', 'User.Read'],
  schemeFolder: 'RMP/scheme-data',
};
```

Then flip the mode:

```js
const BACKEND_MODE = 'graph';
```

## 5 · Deploy and test

1. Commit and push. GitHub Pages redeploys in ~1–2 minutes.
2. Visit the deployed URL. The app loads in offline-only mode — your
   existing localStorage data still renders.
3. Open the topbar — there'll be a **Sign in** prompt (you'll wire the
   button up after this PR; for now you can call `window.SchemeContext`
   via DevTools: `useContext(SchemeContext).signIn()`).
4. First sign-in pops up a Microsoft login window. Use your
   `@dundeecity.gov.uk` account. Accept the consent screen the first
   time.
5. The first save creates `/RMP/scheme-data/{id}.json` in your OneDrive
   (auto-creating the folder).
6. Check by opening OneDrive in a browser tab — you should see the JSON
   files appearing as you edit schemes.

## 6 · Roll back

The migration is on a single PR. If DCC IT denies the app registration,
or you decide to stay on Supabase, **close the PR without merging** and
delete the branch. Production stays unchanged.

If the PR has merged and you want to revert: flip `BACKEND_MODE` back to
`'supabase'`, commit, deploy. The Supabase code is still present in the
file and ready to take over.

---

## What changed inside the codebase

- `index.html` — adds the MSAL.js v2 CDN script tag.
- `src/context/SchemeContext.jsx` — adds:
  - `GRAPH_CONFIG` constants
  - MSAL `init` / `graphSignIn` / `graphSignOut` / `getGraphToken`
  - `graphFetch` HTTP wrapper
  - `graphUpsertOnce` and `graphFetchAll` mirroring the Supabase
    functions
  - Single dispatcher functions `backendUpsertOnce` and `backendFetchAll`
    that branch on `BACKEND_MODE`
  - `signIn` / `signOut` / `backendMode` exposed on the Context value
    so the UI can render a sign-in button when `syncStatus ===
    'auth-required'`.

All offline-first behaviour from PR #113 (last-write-wins via
`updated_at`) and PR #126 (failed-upsert retry queue, browser-online
event drain) carries over unchanged — both backends share that
machinery.

## Threat-model improvements after the migration

| | Supabase today | Graph / SharePoint |
|---|---|---|
| Authentication | Anon publishable key embedded in client JS | Azure AD sign-in per user |
| Authorisation | Anyone with the URL has read/write | SharePoint group permissions |
| Audit log | Supabase logs — outside DCC IG | M365 Unified Audit Log |
| Retention / recovery | Manual / Supabase backups | 93-day recycle bin + version history |
| Data residency | AWS US (EU region available) | DCC's tenant region |
| Contract chain | DCC needs a fresh DPA | Already in Microsoft contract |

The single biggest win is removing the anon key from the published JS.
