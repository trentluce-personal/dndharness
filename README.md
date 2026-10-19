# dndharness

Locally run application that friends and family can use to play through a D&D campaign.

See [product intent](./docs/product.md) for the group-hosted LAN
experience and compatibility principles.
The [design guide](./docs/design.md) records the approved visual and interaction ethos.

## Frontend

A local React + Vite app, Express API, and PostgreSQL database. The current UI is
**Home and Dice roller**: Home offers **Host a session** and a feed of open sessions.
The original illustrated map/d20 hero is restored, with its split serif heading,
burgundy italic accent, map caption, and decorative divider. The feed reuses the
original framed folio/book covers and gold line art, with real session titles,
host names, counts, and Join/Open actions on parchment/theme-aware metadata surfaces.
The familiar 1160px shell, branded header, warm ornamented roster panel,
theme/motion controls, and site footer retain the original fantasy identity.
Native **Home** and **Dice roller** navigation links sit above the page content.
Campaigns and character capabilities are unavailable; there is no separate
Live sessions navigation tab.

1. Open `/`. Choose **Host a session**, enter **Session name** (1–150 characters)
   and **Your name** (1–100), then host. No campaign, edition, or account is needed.
2. Friends open the same app address. The feed shows sessions live on this running
   app, with title, host, participant count, and **Join** / **Open**.
3. The session page shows the roster. Enter your name to join; players can leave,
   and the host can end the session after confirmation. **Back to Home** returns
   to the feed. `/sessions` is a feed alias; `/sessions/host` opens the host dialog.
4. Open **Dice roller** (`/dice` or `/dice/`) for local dice and recent rolls.
   Rolls are not shared or saved; history clears on leaving the view or reloading.
   Workspace navigation keeps session membership and presence renewal active.

Sessions are ephemeral, held in API memory. Presence renews every 30 seconds and
expires after 5 minutes without renewal; host expiry or an API restart closes the
session. Keep the app open and use the same address/browser profile. Automatic
cookie and IndexedDB setup preserves first-use identity across tabs, including
ordinary LAN HTTP. Tabs sharing that cookie share membership and host authority.
Discovery retries every 30 seconds and on visibility/reconnect; failures keep known
memberships and offer **Retry session check**. Failed host/join requests keep entries;
cancel/navigation protects meaningful entries and pending lifecycle requests.

LAN access remains an explicit opt-in, documented below. Discovery does not scan
other installations. There are no battle, scenario, journal, or sheet tools
in this UI. Existing campaign/character/history storage and legacy APIs are retained;
old GUI routes show an unavailable page with **Back to Home**. Session actions
do not create dummy campaigns or mutate saved campaign data. Historical feature
notes below are explicitly archival, not current usage.

## Repository layout

This is a native npm-workspace monorepo, with one root lockfile:

```text
apps/web/         React + Vite app, including its own package.json and build config
apps/api/         Express API and workflow checks
apps/db/          SQL migrations for the PostgreSQL schema
packages/         Shared packages, added only when multiple apps need them
scripts/          Local development-tool installers
.opencode/        Agent commands and skills
.playwright/      Browser-review tooling configuration
```

Install dependencies from the root. App runtime dependencies belong in their
app's package; agent/browser tooling belongs in root development dependencies.
The frontend produces static files in `apps/web/dist`, with no Node process
required at runtime. This separation allows each future app to have its own
container. The frontend's Vite development container lives in `apps/web/Dockerfile`,
with local orchestration in `compose.yaml`. Container builds use the repository
root as context for workspace manifests and the root lockfile.

### Run with Docker (live development)

With Docker Desktop running Linux containers, run from the repository root:

First create an ignored `.env` from `.env.example` and set `POSTGRES_PASSWORD`
to a long random URL-safe value (hex or letters/numbers). The current workspace
already has a generated local password; do not commit `.env`.

```bash
docker compose up --build -d --wait
```

Open **<http://127.0.0.1:5173>**. Host Node.js is not required to serve the app.
The source is bind-mounted, so frontend edits update live through Vite. Windows
file watching uses 250 ms polling. Dependencies are installed from the root
lockfile at startup, into Linux-only Docker volumes separate from host dependencies.
The first start needs network access to download the image and npm packages.

```bash
docker compose logs -f web api   # Follow output; Ctrl+C stops following
docker compose restart web api  # Reinstall dependencies after manifest/lockfile changes
docker compose stop             # Stop; keep the container and dependency volumes
docker compose up -d --wait      # Start again
docker compose down             # Remove the container; keep dependency volumes
```

In VS Code, open this repository folder and choose **Terminal → Run Task…**
or press **Ctrl+Shift+P** and select **Tasks: Run Task**. With Docker Desktop
running and `.env` configured as above, choose:

| Task | Command |
| --- | --- |
| Application: Start | `docker compose up -d --wait` |
| Application: Stop | `docker compose stop` |
| Application: Rebuild and start | `docker compose up --build -d --wait` |
| Application: Status | `docker compose ps --all` |
| Application: Logs | `docker compose logs -f web api` |

Tasks run from the repository root. After starting, use the app URL above.
**Application: Logs** keeps following output until you press **Ctrl+C** in its
terminal or use **Tasks: Terminate Task**; this stops following, not the containers.

The container uses `restart: unless-stopped`, so it comes back when Docker starts
after a Windows restart, unless you explicitly stopped it. Enable Docker Desktop
startup at sign-in if you want it available automatically. Source files remain
in the repository; theme and motion preferences remain in your browser.

This is a development server, exposed only on the host's loopback address by default.
Use either this container or `npm run dev` on port 5173, not both simultaneously.
The production static-server image can be added when deployment is needed.
Browser-review tooling still runs on the host using the same local URL.

The API and database are internal Docker services, not published to the host.
Vite proxies `/api` to Express. PostgreSQL
stores editions, campaigns, campaign characters, checkpoints, and history in the
`dndharness_database` volume. `docker compose down` preserves it. **Do not use
`docker compose down -v` unless you intend to erase all local application data.**
Changing `.env` does not change the password of an already-initialized database.

### Opt in to LAN access (Docker Compose)

The default `WEB_BIND_ADDRESS=127.0.0.1` keeps port 5173 local. To let your group
connect from other devices, deliberately edit your ignored `.env`:

```dotenv
# Example only: replace 192.168.1.50 with the host computer's actual LAN IPv4 address.
WEB_BIND_ADDRESS=0.0.0.0
APP_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://192.168.1.50:5173
```

You can bind `WEB_BIND_ADDRESS` to that specific LAN IP instead of `0.0.0.0`
(all IPv4 interfaces). Keep the loopback origins and include every exact app
origin the group will use: scheme, hostname/IP, and port, comma-separated, with
no paths or wildcards. A hostname is usable only if the group's devices can
resolve it; changing the computer's LAN address requires updating this setting.

Apply the opt-in with `docker compose up -d --wait web api`. Both services need
the updated `APP_ORIGINS`. Share **http://192.168.1.50:5173** with your actual IP;
`localhost` and `127.0.0.1` on a friend's device refer to their own device.
Connect devices to the same trusted local network. Allow inbound TCP 5173 only
on the host's private-network firewall profile, scoped to the local network.
Guest Wi-Fi/client isolation may prevent connections. Do not configure router
port forwarding or expose this accountless development server to the internet.
Anyone who can reach it can edit campaigns and read shared preparation.

Vite derives an explicit hostname allowlist from `APP_ORIGINS` and checks the
request Host (including port) before proxying `/api`; unconfigured addresses
are rejected even for reads. The API separately checks supplied browser origins;
live-session actions require an allowed Origin. `/api/hosting` returns
`{ lanConfigured, joinUrls }` from configured non-loopback origins, never from
request host headers. **Configured does not mean reachable**: it cannot verify
the bind address, firewall, address resolution, or another device's connection.
Automated configuration/browser checks are not physical-device LAN verification;
confirm access from each intended device after opting in.

To return to local-only use, set `WEB_BIND_ADDRESS=127.0.0.1`, remove LAN origins
from `APP_ORIGINS`, and run `docker compose up -d --wait web api` again.

### Archived usage: shared campaigns (not in the current GUI)

**Historical reference only.** The Home/session UX above supersedes this section,
the former campaign-based hosting instructions, and the import instructions below.
Their storage and APIs are retained; their pages are unavailable.

The app opens directly into **Home**, with **Host a session** and **Join a session**
actions. **Campaigns** opens the shared saved-adventure library; **Dice roller**
has its own destination. Accounts, login,
profiles, personal character libraries, and invite-code joining are no longer
part of this experience. Anyone reaching this app can edit and save any campaign.
Legacy personal rows are preserved but unavailable in this first slice;
`/characters`, old personal sheet links, and `/profile` explain the change and
link to campaigns without exposing preserved personal data.

1. Choose **New campaign**, enter a title, and choose the group's rules edition.
   The edition is fixed. Opening the saved adventure does not start a live game.
   The top campaign navigation links to **Overview**, **Planning canvas**,
   **Party & journal**, and **Version history**, with the current page marked.
2. In the overview, edit the source title, synopsis, storyline, and DM guidance.
   Preparation contains spoilers but is **shared, not confidential**. Everyone
   can open and edit it. Source edits require explicit Save; errors retain drafts.
   The saved adventure title identifies the campaign in the library and breadcrumbs;
   it updates after server confirmation. **Journal title** names the journal
   independently and does not rename the adventure.
3. **Create planning canvas** saves a blank board. Add freely placed story,
   location, encounter, or NPC points with notes and manual references. Move
   markers by dragging, arrow keys (Shift for five-percent steps), or X/Y fields.
   **Add point at center** works without a pointer. Point deletion is confirmed.
   The canvas is limited to 100 points and the complete source to 200,000 bytes.
4. **Party & journal** (`/campaigns/:id/progress`) preserves the existing journal,
   party, and checkpoints. **Import character sheet** reads a supported PDF,
   reviews an unsaved draft, and adds a campaign-owned sheet directly to the party.
   The campaign supplies the edition; no blank manual creation is offered.
   Sheets open read-first with listed abilities, skills, saving throws, and reference
   tabs. **Edit character** edits the campaign sheet; dismissal of meaningful
   changes asks to keep editing or discard. **Remove** names the character and
   confirms removal, recoverable through complete version history.
5. Save the shared journal explicitly. **Save checkpoint** saves the current
   journal edits and a named immutable checkpoint in one atomic request. Checkpoints
   include journal title, campaign status, journal, and party, **not** source or canvas. Preview and
   confirmed restore are available; legacy checkpoints remain readable with
   account identities omitted. Restoring does not erase checkpoints or history.
   Journal, checkpoint, party, and status actions show feedback near their controls.
   If checkpoints cannot load, the journal and party remain usable and previously
   loaded checkpoints remain visible. Choose **Retry loading checkpoints** to
   retry that list; a load failure is not reported as an empty checkpoint history.
6. **Version history** (`/campaigns/:id/history`) lists automatic complete versions.
   **Preview version** shows source text, canvas points/references, journal, and
   expandable complete party sheets. **Revert to this version** explicitly confirms
   replacing source, canvas, title/status, journal, and party. Revert appends a
   new version and retains all previous history and checkpoints.
7. In **Party & journal**, use the separate **Campaign status** section to
   **Archive campaign** or **Reactivate campaign**. Save the journal and save or
   clear the checkpoint name first, or confirm **Discard drafts and reload**.
   Status changes send only the new status and expected revision, without saving
   journal fields. Archived source, sheets, and journals remain editable;
   reactivate before importing characters or hosting a new session.

All existing-campaign writes send an expected campaign revision. Source saves
also retain their source revision check. Editors capture revisions at draft load;
they never silently rebase stale drafts. Conflicts keep drafts and require an
explicit confirmed reload. Save or discard journal/checkpoint drafts before party
mutations or checkpoint restores. Navigation to history, links, and browser Back
respect unsaved edits; reload/closing uses the browser warning. Draft protection
is in-page, not a promise of recovery after closing the browser. Deep links,
reload, Back/Forward, and native new-tab links remain supported.

Mutating API requests accept JSON. The shared workspace remains open to everyone
reaching this local group setup, whether or not they join a live session.

### Archived usage: campaign-based live sessions (superseded)

1. On **Home**, choose **Host a session**, select a saved active campaign, enter
   a display name, and choose **Host session**. Campaign cards also offer hosting
   or a link to their existing session. Opening a campaign alone never hosts it.
2. Friends open the same app address, choose **Join a session**, then **View
   session**, enter a display name, and choose **Join session**. Discovery lists only
   sessions on this running app; it does not scan the network or discover other
   installations. A session page has a roster and the current saved journal and
   party sheets. Preparation is omitted there, but remains accessible to everyone
   through the campaign workspace.
3. There is **one active session per campaign**; distinct campaigns can have
   sessions at the same time. Joining is presence at the table, not assignment
   or exclusive control of a character. There are no readiness, start-play,
   pause/resume, combat, or shared-dice controls in this stage.
4. Membership and the host's ability to end a session use a browser capability
   cookie, not an account or display-name identity. Keep using the same host URL
   and browser profile; switching between localhost, an IP, and a hostname can
   use different cookies. Host/join setup uses IndexedDB and cookies to keep
   identity consistent across tabs; enable both for this site. This works on
   ordinary LAN HTTP without requiring Web Locks. Tabs sharing the cookie share
   that browser identity.
   Joined membership follows navigation around the workspace; opening Campaigns,
   history, or Dice roller does not leave the table.
   Background membership checks retry every **30 seconds**, even without new live
   events, and recheck when the page becomes visible. Temporary failures retain
   known memberships; successful session checks still update when another fails.
   **Retry session check** requests another check from the workspace error message.
5. The open workspace sends presence heartbeats every **30 seconds**. Membership
   expires after **5 minutes** without renewal; host expiry ends the whole session.
   Closing the browser or background-device suspension can stop renewal. Players
   can **Leave session**; only the session host can explicitly **End session** after
   confirmation. This authority does not restrict campaign editing or history:
   those remain open to everyone.

Expand **How session presence works** on the directory or session page for lifecycle
details. **Connect your group on the local network** keeps setup guidance in a
separate disclosure on hosting and session pages.

Sessions are ephemeral, in API memory: **an API restart closes all sessions**.
Hosting, joining, leaving, and ending do not save, archive, delete, or otherwise
mutate the campaign, its revisions, checkpoints, or complete versions. Existing
save/version/history behavior is unchanged, and saved campaign data survives.

If browser setup stays pending after a failed connection or closed tab, wait and
try again first. If it remains blocked, close **all tabs for this app**, clear
this site's data in browser settings, enable site storage and cookies, then reopen.
Clearing site data resets browser identity and any existing host authority; it
does not recover control of an old table. End that table before resetting if you
still can, or wait for its host lease to expire after five minutes without renewal
before hosting that campaign again. Saved campaigns and history are unaffected.

Realtime uses **server-sent events (SSE) for invalidation**, with normal HTTP
requests for writes and authoritative reads. Clean views refresh after changes;
reconnection triggers a full authoritative refresh rather than replaying missed
events. Dirty source, canvas, journal, and character drafts stay intact with
their captured revisions. Updates do not silently rebase drafts; stale saves
fail and require explicit reload/discard before retrying. Dice results remain
local to their page and are not broadcast.

### Archived usage: import a character sheet (unavailable in the GUI)

In a campaign’s **Party & journal**, choose **Import character sheet** and select a form-fillable
D&D Beyond PDF (up to 10 MB). The app reads the PDF locally in your browser and
opens an editable draft with a character summary and extracted counts; nothing
is saved until you choose **Add character**, which stays visible during review.
Equipment rows expand when selected for editing; removal offers Undo.
Review the fixed campaign edition and fill in any missing core values. Imported
characters start at maximum HP; current HP can be reviewed in the campaign draft.
PHB-2024 references suggest an edition; a mismatch is shown for review without
changing the campaign edition or converting rules.
Equipment is imported as editable item rows (name, quantity, listed weight), with
separate copper/silver/electrum/gold/platinum coin fields. Unknown quantities and
weights remain blank; listed PDF weights are preserved without assuming whether
they are per-item or total. Existing free-text equipment remains editable as notes.
Saving throws and skills retain listed modifiers and proficiency/expertise.
Attacks, spells (including printed preparation markers and page references),
spellcasting stats, slot headings, features/actions, identity, and story details
have separate expandable, editable reference sections. These values are not
automatically calculated game rules. Text, checkbox, and choice fields are read;
unrecognized filled fields appear under **Other PDF fields** for review. An “O”
preparation marker is preserved as printed, not interpreted as prepared/unprepared.
The original PDF
is not uploaded or retained. Scanned/flattened PDFs and other document formats
are not supported in this first version. Imports create new campaign characters.

Focused frontend checks: `npm run test:web` (existing Node logic tests for importer, source
payloads, revision-preserving drafts, canonical merges, sheets, and deep links).

Character sheet format 3 adds structured `details` alongside format-2 `inventory`
and legacy equipment/notes text. Existing format-1/2 sheets and saved snapshots remain readable; restoring
history keeps its original HP and equipment. Campaign sheets retain current HP.
Editing an old sheet upgrades its
format without parsing or replacing its old notes. Re-import a PDF to populate
the new fields; imports create a new campaign character. Details are included in
checkpoints and complete versions, with the same shared visibility as the
rest of the sheet. Each sheet is limited to 200 KB of JSON data.

### Legacy storage: optional fictional demo (not shown in the GUI)

```bash
docker compose exec api npm run seed:demo --workspace=@dndharness/api
```

This explicitly inserts labeled fictional shared campaign, character, and
checkpoint content. Demo content is **not** inserted during normal startup.

### API and migrations

SQL migrations in `apps/db/migrations` apply transactionally at API startup and
are recorded in `schema_migrations`. Add numbered migrations instead of editing
an already-applied migration. Campaign saves reject SQL updates/deletes through
a database trigger; snapshots carry a format version.

Migration `003_campaign_adventures.sql` adds independent version-1 adventure sources
with integer revisions. Existing sources inherit only the old campaign title;
their synopsis and preparation fields start blank and their canvas starts null. Old
shared summaries are not copied into the synopsis. Library/detail responses expose
source title/synopsis. Full source GET/PUT is now shared and returns `campaignRevision`.
PUT sends the entire source with its `revision` and `expectedRevision`; success
returns canonical data. A stale revision returns 409. Source fields remain
independent of legacy checkpoint creation/restoration but are in complete history.

Main endpoints (all under `/api`):

| Area | Endpoints |
| --- | --- |
| Public | `GET /health`, `GET /editions`, `GET /hosting` |
| Realtime | `GET /events` (SSE invalidations and reconnect refresh signal) |
| Browser capability | `POST /live-browser` with `{}` to initialize; `{probe:true}` to check without issuing a cookie |
| Live sessions | `GET/POST /live-sessions`; `GET /live-sessions/:id`; `POST /live-sessions/:id/join`, `/heartbeat`, `/leave`, `/end` |
| Campaigns | `GET/POST /campaigns`; `GET/PATCH /campaigns/:id` |
| Adventure source | `GET/PUT /campaigns/:id/adventure` |
| Campaign characters | `POST /campaigns/:id/characters`; `PATCH/DELETE /campaigns/:id/characters/:characterId` |
| Complete history | `GET /campaigns/:id/history`, `GET /campaigns/:id/history/:historyId`; `POST /campaigns/:id/history/:historyId/restore` |
| Saves | `GET/POST /campaigns/:id/saves`; `POST /campaigns/:id/saves/:saveId/restore` |

The current frontend uses only live discovery, presence, and SSE, without any
`/campaigns` or `/editions` reads (including reconnect). Hosting sends
`POST /live-sessions {title, displayName}`; standalone session detail has
`campaignId: null` and `editionId: null`, plus title, host, roster, revision,
participant count, start time, and browser `self` membership. Campaign and edition
endpoints in this table are retained legacy APIs, not GUI workflows.

The web app handles capability initialization before host/join. Direct API clients
must first send JSON `{}` to `POST /api/live-browser` with an allowed `Origin`
and retain its response cookie. Success is `200 {ready:true}`; a JSON
`{probe:true}` request returns `{ready:boolean}` without issuing a cookie.
Host/join without a valid capability cookie returns **428** and does not issue
one. See [the API runtime contract](./apps/api/README.md) for cross-tab setup details.

The API validates inputs, checks expected revisions, and uses parameterized SQL.
The frontend does not bootstrap authentication or request personal libraries.
Complete snapshots use version 2 with identity-free campaign and party data.
Legacy checkpoint rows remain immutable; identity fields are sanitized on read.
Live presence and saved-state refresh use the single running API process; automated
edition-specific mechanics and persistent playthrough instances are not implemented.

Run focused API workflow checks against a **dedicated test database**:

```bash
docker compose exec -T api npm run test --workspace=@dndharness/api
docker compose exec -T web npm run build --workspace=@dndharness/web
```

For a plain-SQL backup, store output outside Git (for example in ignored `artifacts/`):
`docker compose exec -T db pg_dump -U dndharness -d dndharness > artifacts/campaign-backup.sql`.
Create the destination directory first. This backup contains private application data.

The test command creates/reuses `dndharness_test`, clears only its fixtures, and
checks shared campaigns, revision conflicts, character workflows, checkpoints,
complete history/restoration, legacy sanitization, live-session leases/authority,
SSE refresh signaling, and origin validation. The wrapper explicitly runs four
test files and does not forward filter arguments. Serialize all suite invocations:
they share `dndharness_test`. Only the test child targets that database; the running
API and normal Compose browser traffic still target campaign data. Fresh browser
profiles isolate identity, not persistent writes. Browser mutation checks require
an isolated API/database environment; without one, report them blocked. Do not
seed campaigns, truncate campaign data, or use `docker compose down -v` for checks.
Existing frontend Node logic tests run with `npm run test:web`; no component test
runner or lint tool is configured.

### Dice roller and 3D visuals

Roll d4/d6/d8/d10/d12/d20/d100, up to ten dice, with a modifier. Results use
browser cryptographic randomness with rejection sampling; animation does not
determine the result. The last five rolls are page-local and are not saved or
broadcast campaign events. Reduced motion uses an instant, non-3D result.

The local `@dndharness/dice-3d` package supplies themed WebGL visuals using pinned
`@3d-dice/dice-box-threejs` (Three.js/Cannon). The scene is loaded separately from
the main app and needs no hosted service, remote textures, or sounds. Dice are
forced to the precomputed values and read back for verification; a visual mismatch,
rendering error, context loss, or 15-second roll timeout switches to the text
fallback without losing the roll. d100 uses a tens die and a units die.
The tray fits a fixed physics area to the screen; resize updates wait for a
running throw to settle so changing window size does not alter its outcome.

Each die-type button shows a static rendering of the real 3D dice (d100 is a
tens/units pair), including in reduced motion, with each die's label above its thumbnail.
The **Dice color** dropdown shows body-color swatches beside named palettes and
the selected value; **Custom color** reveals
a body-color input with automatically contrasting numerals. The
choice applies to thumbnails, the tray preview, and rolls, and is saved only in
this browser; **Theme default** follows light/dark mode. Appearance controls are
disabled during throws. Changing appearance does not roll or add history.
Without WebGL, the labeled die buttons and text results remain usable.

### Run locally

Install [Node.js 24 LTS](https://nodejs.org/) (includes npm). On Windows x64,
you can instead install the pinned repo-local Node.js **24.21.0**:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File './scripts/install-node.ps1'
```

The script verifies the official archive's SHA-256 and Node version, and installs
Node and npm in ignored `.tools/node/`. Open a **new VS Code terminal** to pick up
the workspace PATH setting. No permanent user PATH change is made. In an existing
Git Bash terminal, use `export PATH="$(pwd)/.tools/node:$PATH"`; in PowerShell,
use `$env:PATH = "$PWD\.tools\node;$env:PATH"` and `npm.cmd` if script execution
policy blocks `npm.ps1`. External terminals need this PATH setup explicitly.

Then run from the repository root:

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite (normally <http://127.0.0.1:5173>).
The development server binds to your local machine. Stop it with Ctrl+C.
The LAN opt-in above applies to Compose; plain `npm run dev` reads `APP_ORIGINS`
from its process environment, not the root Compose `.env` file.
`npm run dev` starts the frontend only; it expects an API at
`http://127.0.0.1:3001` (override `API_PROXY_TARGET` if needed). To run the API
outside Docker, provide `DATABASE_URL`, then use
`npm run dev --workspace=@dndharness/api`. The recommended all-in-one setup is Compose.

Use the header's moon/sun icon button to switch to dark/light mode.
The first visit uses your system color preference; your choice is then saved
in this browser's local storage. If storage is unavailable, the toggle still
works for the current page session.

Theme changes and button feedback use subtle transitions.
Supported browsers reveal theme changes outward from the toggle; others use
color transitions. The d20 seal responds to hover and focus.
Pointer clicks use a subtle border; keyboard focus uses a slim ring.
Buttons use soft pointer-positioned ripples. Keyboard
activation ripples start at the center, and reduced motion disables them.
Entrance animations and motion effects respect your system's reduced-motion setting.
Use **Enable animations / Motion on** in the header to override motion for this
app. This browser remembers your choice; the first visit uses your system setting.

### Build and preview

```bash
npm run build
npm run preview
```

The production build is written to `apps/web/dist/`. Preview serves that build locally.
Web logic checks use `npm run test:web` (or `npm run test --workspace=@dndharness/web`),
which runs `node --test test/*.test.js` in the web workspace. For one file, use
`node --test apps/web/test/characterImport.test.js` from the root. API workflow
checks also use Node's built-in runner; browser review uses Playwright. There is
no generic root `test` command that includes database-mutating API tests.

Root scripts forward to npm workspaces. For a targeted build, use
`npm run build --workspace=@dndharness/web`. The root build runs each workspace's
build script when present.

### Agent browser review

Playwright CLI **0.1.22** is a pinned root development dependency, installed by
`npm ci`. It uses the locally installed Chrome browser by default; no hosted
browser service or API key is needed. The CLI's pinned transitive Playwright
version is currently an alpha release, recorded in the root lockfile.

With the app running, use these commands from the root:

```bash
npm run browser -- -s=frontend open http://127.0.0.1:5173
npm run browser -- -s=frontend snapshot
npm run browser -- -s=frontend screenshot --filename=artifacts/browser/desktop.png
npm run browser -- -s=frontend resize 390 844
npm run browser -- -s=frontend screenshot --filename=artifacts/browser/mobile.png
npm run browser -- -s=frontend console error
npm run browser -- -s=frontend close
```

Add `--headed` to `open` to watch the browser. Use the fresh snapshot's element
refs with `click`, `hover`, `select`, and `press`; see `npm run browser -- --help`.
If Chrome is unavailable, install it or use
`npm run browser -- install-browser chromium` and remove the `channel` setting
in `.playwright/cli.config.json` to use downloaded Chromium.

The agent's `frontend-review` skill requires screenshot image inspection,
desktop/mobile checks, real interactions, and relevant runtime checks for UI
changes. Screenshots and DOM snapshots provide complementary evidence. Static
images alone do not verify animation smoothness; traces or intermediate-state
inspection can investigate motion issues. Image review needs an image-capable model.

Browser output goes to ignored `artifacts/browser/`. Default profiles are
in-memory and separate from your normal browser, with storage retained only
within the review session. Keep profiles, saved state, traces, and screenshots
out of Git. Close only the review session when finished.

### Design approach

Start as simple as possible and expand when a real feature needs it. Shared UI
and edition-specific data should remain separate, small, composable pieces.

- `apps/web/src/App.jsx`: original shell, brand, theme/motion header, footer, and session-only bootstrap.
- `apps/web/src/styles.css`: responsive styling using local system fonts.
- `apps/web/src/SharedWorkspace.jsx`: Home/Dice roller navigation, feed/dialog/roster routing, and draft guard.
- `apps/web/src/LandingHero.jsx`: restored original decorative map/d20 hero and single Host a session action.
- `apps/web/src/FolioCover.jsx`: presentation adapted from the original CampaignLibrary cover markup and SVG, without campaign behavior.
- `apps/web/src/LiveSessions.jsx`: Home folio feed, compact host form, and roster controls.
- `apps/web/src/workspace.css`: original hero/folio styling, warm session panels, roster, and forms.
- The following campaign components are dormant historical implementations:
- `apps/web/src/CampaignDetail.jsx`: journal, party, and saved chapters.
- `apps/web/src/CampaignOverview.jsx`: source overview and shared preparation editor.
- `apps/web/src/CampaignPlanningCanvas.jsx`: shared blank-board planning and point editor.
- `apps/web/src/CampaignHistory.jsx`: complete version preview and guarded revert.
- `apps/db/migrations/001_initial.sql`: schema and initial edition metadata.

To add edition metadata, insert a row through a new SQL migration:

```sql
INSERT INTO editions (id, name, short_name, description, sort_order)
VALUES ('my-ruleset', 'My ruleset', 'Custom', 'The rules our table uses.', 3);
```

In the dormant campaign UI, the API catalog drove edition selection. `is_default` selects the default and adds
`(Default)` to its option title. A partial unique index permits only one default;
clear the previous default before setting a new one. Currently 2024 is the default.
The current session UI has no edition selector; saved characters/campaigns retain their edition.
Adding metadata does not implement gameplay rules: editions with different
mechanics may eventually need their own rule modules.

## OpenCode

This repository includes [OpenCode configuration](./opencode.json),
[project instructions](./AGENTS.md), and a project-local command in `.opencode/`.
Use `/small-feature your feature description` to work on a minimal increment
following the project's design principles. After adding or editing OpenCode
configuration or command files, quit and restart OpenCode to load the changes.
The frontend-review skill lives in `.opencode/skills/frontend-review/SKILL.md`;
restart OpenCode after adding or editing skills as well.

### Project quality workflow

The starting package uses small project-local instructions, with no new runtime
dependencies or external plugins:

| Resource | Purpose |
| --- | --- |
| `docs/design.md` | Approved palette, typography, components, motion, and copy conventions |
| `.opencode/skills/web-feature/SKILL.md` | Acceptance criteria → implementation → focused checks → review |
| `.opencode/skills/ui-quality/SKILL.md` | Controls, forms, accessibility, responsiveness, and interaction criteria |
| `.opencode/skills/frontend-review/SKILL.md` | Real browser interactions and screenshot inspection |
| `.opencode/skills/verification/SKILL.md` | Focused check selection, safe targets, and acceptance-linked completion evidence |
| `.opencode/skills/regression-debugging/SKILL.md` | Reproduction, discriminating diagnostics, minimal causal fixes, and regression evidence |
| `.opencode/agents/app-reviewer.md` | Independent review of requirements, permissions, data integrity, and UI |
| `.opencode/skills/feature-dispatch/SKILL.md` | Scoped parallel workstreams, shared contracts, integration, and verification |
| `.opencode/agents/dispatcher.md` | Read-only default coordinator using existing agents with specialist briefs |

Use `/small-feature your feature description` for incremental implementation.
The command loads `web-feature`; UI work uses `ui-quality` and `frontend-review`
with the design guide. These workflows scale to the change: small edits get
focused checks, while consequential account/save/schema/shared-control changes
get one independent reviewer pass when available.

`verification` owns check selection and evidence; `regression-debugging` handles
failures. Report acceptance → command/scenario → target/environment → result and
artifact/limitations, distinguishing **pass**, **fail**, **blocked**, and **static
inspection**. Reuse still-applicable evidence; repeat only for relevant edits,
failures, or unresolved concerns. Optional checks are not universal gates.

To request a review directly, use:

```text
@app-reviewer Review the campaign save changes against these acceptance criteria: …
```

Supply scope/changed files, expected behavior, and verification evidence. The
reviewer cannot edit files or run arbitrary shell commands; it reads code and
reports findings. Runtime checks remain with the implementing agent against
isolated test data. Suggestions are not automatically applied.

The guidance is project-authored and informed by Anthropic frontend-design,
Impeccable, Vercel interface/React guidelines, W3C ARIA patterns, Playwright,
Express, and OWASP. Sources are linked in the guide/skills. External stylistic
opinions do not override this app's approved fantasy identity. Restart OpenCode
to discover new or edited skills and agents; the pinned CLI remains unchanged.

### Multi-agent feature dispatch

**dispatcher** is the configured default primary agent. You can request work
directly or use `/dispatch-feature your feature description`. `/small-feature`
also targets the dispatcher and delegates a minimal increment to one implementer.
Other coordinating agents use `feature-dispatch` for substantial features with
separable aspects under the project instructions; scoped workers do not re-dispatch.

The dispatcher cannot edit files. Its shell access is restricted to three Git
inspection commands (`git status --short`, `git diff`, and
`git log --oneline -10`). It delegates all edits and runtime checks, including
integration wiring, documentation, builds, tests, and browser operations, to
workers. It reads the resulting changes and evidence and remains responsible for
completion. If no implementation worker is available, it reports a blocker.

The dispatcher agrees acceptance criteria and shared API/data contracts, then
assigns exclusive file ownership. It normally sends UI/interaction and API/data
work to separate `general` agents with specialist briefs, uses `explore` for
bounded research, and requests one read-only `app-reviewer` pass after integration.
Only independent work runs concurrently; small or tightly coupled changes use
one implementer. Workers share the checkout and report cross-boundary needs to
the dispatcher, which assigns final wiring, documentation, and integrated checks
to a worker and reviews the results. Worker permissions still permit implementation;
the read-only restriction applies to the coordinator itself.

Test database runs and other shared-state checks are serialized; browser sessions
and artifacts have distinct names when delegated. The dispatcher reports actual
verification evidence and remaining gaps. Parallel work can use more model
requests; agents inherit the selected model unless configured otherwise, and
image inspection still requires an image-capable model. No extra provider,
plugin, dependency, or separate worktree is required.

Quit and restart OpenCode after these harness changes to discover the dispatcher,
command, and skill. Existing sessions retain their loaded configuration.

### Install the repo-local CLI

On Windows x64, run the setup script from the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-opencode.ps1
```

Or, from Git Bash:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\install-opencode.ps1'
```

The script downloads OpenCode **1.18.33** from its official GitHub release,
checks the pinned SHA-256 checksum and executable version, and installs it
in `.tools/opencode/`. The downloaded executable is ignored by Git.
Running setup again skips installation when the pinned version is present.
No global installation or permanent user PATH change is required.

Open this repository folder in VS Code, then open a **new terminal**.
The workspace defaults to Git Bash and prepends the local installation to
PATH, so bare `opencode` uses this repository's copy before a global copy.
Verify with:

```bash
command -v opencode
opencode --version
```

The path should point to this repository's `.tools/opencode/opencode.exe`
(Git Bash may omit `.exe`), and the version should be `1.18.33`.
Existing terminals must be closed and
reopened to pick up the workspace environment.

This PATH setting applies only to VS Code terminals in this workspace;
an external terminal does not activate it just by entering the repository.
From an external Windows terminal, use `.\.tools\opencode\opencode.exe`
explicitly. For other platforms, see the
[official installation guide](https://opencode.ai/docs/).

Automatic updates are disabled in the repo configuration to keep the version
pinned. To upgrade, update the version and archive checksum in the installer
(and the documented version above), then rerun setup.

### Connect GitHub Copilot

From the repository directory, launch:

```powershell
opencode
```

1. Run `/connect` and select **GitHub Copilot**.
2. Follow the device sign-in instructions at <https://github.com/login/device>.
   A GitHub account with a Copilot subscription is required; available models
   depend on your plan and account settings.
3. Run `/models` to choose an available model.

The repository enables GitHub Copilot and Deep Infra and leaves model
selection to your account. Credentials are stored by OpenCode in your user
profile, not in the repository. Do not paste tokens into configuration files
or commit them.

### Connect Deep Infra

1. Create an API key in the [Deep Infra dashboard](https://deepinfra.com/dash).
2. Quit and restart OpenCode from this repository to load the provider configuration.
3. Run `/connect`, search for **Deep Infra**, and enter your API key at the prompt.
4. Run `/models` and choose a Deep Infra model. For coding tasks, choose one
   with tool-calling support; screenshot review also requires image input support.

Deep Infra usage is billed through your Deep Infra account. OpenCode stores
the key in your user profile, outside the repository.

Session sharing is disabled. Project permissions allow file edits, shell commands,
and access outside the project; agent-specific restrictions keep the dispatcher
and independent reviewer read-only with limited Git inspection. These settings do
not prevent code from being sent to the selected model provider.

OpenCode loads `AGENTS.md` automatically; there is no need to run `/init`.
To inspect the resolved configuration without making a model request, run:

```powershell
opencode debug config
```

Resolved configuration can contain credentials from local settings; inspect it
locally and do not commit or paste secret-bearing output. This inspection does
not reload the current session: quit and restart OpenCode after editing skills,
agents, commands, or configuration.
