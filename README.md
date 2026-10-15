# dndharness

Locally run application that friends and family can use to play through a D&D campaign.

See [product intent](./docs/product.md) for the intended group-hosted LAN
experience, compatibility principles, and account/character/campaign/save model.
The [design guide](./docs/design.md) records the approved visual and interaction ethos.

## Frontend

A local React + Vite app, Express API, and PostgreSQL database. Create accounts,
keep edition-linked character sheets, run campaigns with a party, save/restore
chapters, and roll dice. Gameplay automation will grow as real play requires it.

## Repository layout

This is a native npm-workspace monorepo, with one root lockfile:

```text
apps/web/         React + Vite app, including its own package.json and build config
apps/api/         Express API, authentication, and workflow checks
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

This is a development server, exposed only on the host's loopback address.
Use either this container or `npm run dev` on port 5173, not both simultaneously.
The production static-server image can be added when deployment is needed.
Browser-review tooling still runs on the host using the same local URL.

The API and database are internal Docker services, not published to the host.
Vite proxies `/api` to Express, so sessions use same-origin cookies. PostgreSQL
stores accounts, sessions, editions, characters, campaigns, and saves in the
`dndharness_database` volume. `docker compose down` preserves it. **Do not use
`docker compose down -v` unless you intend to erase all local application data.**
Changing `.env` does not change the password of an already-initialized database.

### Accounts, characters, and campaigns

The interface is designed for first-time users: **Home** offers direct actions
to join friends or run a game. **Characters**, **Campaigns**, and **Dice roller**
have dedicated gameplay navigation. **Profile** and **Log out** are in
the top-right account controls. The dice roller is also available without an account.
Choose a rules edition when creating a character or campaign; ask your DM which
version to use. If you need a character while joining, you can create it directly
through PDF import from the join dialog and return with your invite code preserved.

1. Choose **Create an account**. Email is a local login identifier; no verification
   or password-recovery email is sent. Passwords require 10–128 characters.
2. **Profile** edits display name, optional private real name and bio, and password.
   Email is currently read-only. Password changes invalidate other sessions.
3. **Characters → Import character sheet** is the entry point for new characters.
   Upload a supported D&D Beyond PDF, review it, and add the character. Existing
    characters remain editable. **Delete character** on Home or Characters cards,
    or in the sheet editor, always asks **Are you sure you want to delete?** and names
    the character. Cancel keeps the character; explicit confirmation removes
    it from your library and future campaign join choices. Existing campaign copies,
    membership, and checkpoints remain intact; the internal character record is
    retained for those links. There is no undo. Card deletion keeps you on Home or
    Characters; deleting from the sheet returns to Characters. Failed deletion
    keeps the confirmation open so you can retry.
    The edition-linked core sheet includes ancestry, class, level,
   abilities, HP, AC, speed, background, equipment, and notes. This provisional
   sheet is manual data entry, not an automated 5e rules engine, and will change
   later. A character's edition is fixed after creation.
4. **Campaigns** is a library of saved adventure sources. **Open campaign** opens its
   overview, with a player-safe synopsis, rules edition, and DM identity; it does not start a live game. Archived campaigns
   remain accessible but cannot accept new characters while archived.
   **Campaigns → New campaign** prepares a saved campaign and makes you the DM. Add your own matching characters
   or share the invite code. A player uses **Join with code** and selects their own
   character of the same edition. Accounts can participate in several campaigns.
   The DM edits the source title and synopsis, private storyline, and private DM
   guidance. **Create planning canvas** saves an empty board; **Open planning canvas**
   returns to it. Add freely placed story, location, encounter, or NPC points with
   notes, location references, and manual NPC/enemy references. Move markers by
   dragging, arrow keys (Shift for five-percent steps), or X/Y percentage fields.
   **Add point at center** works without a pointer. Deleting a point asks for confirmation.
   Source and canvas edits require explicit Save; errors retain the draft.
   **Reload saved source** asks before discarding edits. Concurrent edits reject stale
   revisions and require reloading before saving. Leaving unsaved source edits asks
   whether to keep editing or discard; saving locks editing/navigation.
   The canvas is DM-only, limited to 100 points and 200,000 bytes for the whole source.
   It has no connections, maps/uploads, combat automation, live sessions, or playthrough branches.
5. **Existing play progress** keeps the existing journal, party, and checkpoints at
   `/campaigns/:id/progress`, separate from the editable source. The campaign keeps
   its own copy of each joined character sheet. The DM edits
   campaign sheets, manages the party, and updates the journal. Party members
   can read the journal, sheets, and saves. Existing journal notes are visible to the party,
   so they are not a private DM notebook. Emails, real names, and bios are private.
6. **Save checkpoint** writes an immutable snapshot of the journal, campaign title/status,
   DM public identity, party account links/public identities, and campaign sheets.
   It also saves the currently edited journal. **View checkpoint** views history;
   **Restore** replaces current campaign state/party after confirmation. Personal
   character sheets and save history are preserved. Only the DM can save/restore.
    Restoring a party can reinstate a previously removed member's access.
    Restoring a checkpoint does not replace the adventure source or its planning canvas.
7. Archive a campaign to mark it inactive; reactivate it to accept new party members.

Personal **Open character sheet** links open `/characters/:id` as a full page,
with **Home → Characters → saved name** breadcrumbs. Section destinations use
`/characters`, `/campaigns`, `/dice`, and `/profile`; campaigns open at
`/campaigns/:id`; private planning uses `/campaigns/:id/planning`, and existing
play progress uses `/campaigns/:id/progress`. Links support reload, direct access, browser Back/Forward, and
opening another tab. Signed-out links remain in place through login. Sheets are
resolved from the signed-in account's library; removed or inaccessible sheets
show an unavailable state. Personal sheets open read-first with framed abilities,
listed modifiers, persistent saving throws/skills, and Actions, Spells, Inventory,
Features, Background, and Notes tabs. Notes retains all modifier labels and other
PDF fields. **Edit character** opens the editor on the same URL; **Cancel editing**
asks to discard dirty edits, with **Keep editing** preserving the draft. Successful
saves return to the saved sheet. Personal edits save in place; failed saves retain the
draft. Leaving meaningful unsaved personal edits asks whether to keep editing or
discard, including browser history; reload/closing uses the browser's warning.
Campaign sheets and imported-sheet review remain dialogs.

Sessions last seven days and survive server restarts. Passwords use salted scrypt;
only hashed random session tokens are stored. Cookies are HTTP-only and SameSite.
Mutating requests accept JSON and validate supplied browser origins. This setup
is for local development; HTTPS/secure cookies (`COOKIE_SECURE=true`) and reverse
proxy configuration are needed for a future hosted deployment.

### Import a character sheet

In **Characters**, choose **Import character sheet** and select a form-fillable
D&D Beyond PDF (up to 10 MB). The app reads the PDF locally in your browser and
opens an editable draft with a character summary and extracted counts; nothing
is saved until you choose **Add character**, which stays visible during review.
Equipment rows expand when selected for editing; removal offers Undo.
Review the rules edition and fill in any missing core values. Current HP belongs
to each campaign and is not imported into personal sheets; newly joined campaign
copies start at maximum HP.
PHB-2024 references suggest the 2024 edition but remain editable before creation.
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
are not supported in this first version. Imports create new personal characters.

Focused importer checks: `node --test apps/web/test/characterImport.test.js`.

Character sheet format 3 adds structured `details` alongside format-2 `inventory`
and legacy equipment/notes text. Existing format-1/2 sheets and saved snapshots remain readable; restoring
history keeps its original HP and equipment. New/edited personal sheets omit
current HP, while campaign sheets retain it. Editing an old sheet upgrades its
format without parsing or replacing its old notes. Re-import a PDF to populate
the new fields; imports create a new character. Character details are copied to
campaigns and included in checkpoints, with the same party visibility as the
rest of the sheet. Each sheet is limited to 200 KB of JSON data.

### Optional fictional demo

```bash
docker compose exec api npm run seed:demo --workspace=@dndharness/api
```

This explicitly inserts two labeled fictional accounts, a character, a campaign,
and a save. It prints `dm@demo.test`, `player@demo.test`, and a newly generated
password. Keep the password locally. It refuses to overwrite existing demo
accounts. Demo content is **not** inserted during normal startup.

### API and migrations

SQL migrations in `apps/db/migrations` apply transactionally at API startup and
are recorded in `schema_migrations`. Add numbered migrations instead of editing
an already-applied migration. Campaign saves reject SQL updates/deletes through
a database trigger; snapshots carry a format version.

Migration `003_campaign_adventures.sql` adds independent version-1 adventure sources
with integer revisions. Existing sources inherit only the old campaign title;
their synopsis and private fields start blank and their canvas starts null. Old
shared summaries are not copied into the synopsis. Library/detail responses expose
only source title/synopsis; full source GET/PUT is DM-only. PUT sends the entire
source with its current `revision`; success increments it atomically and returns
canonical data. A stale revision returns 409. Source fields are independent of
legacy checkpoint creation/restoration.

Main endpoints (all under `/api`):

| Area | Endpoints |
| --- | --- |
| Public | `GET /health`, `GET /editions` |
| Accounts | `POST /auth/register`, `/auth/login`, `/auth/logout`; `GET /auth/me` |
| Profile | `PATCH /profile`; `POST /profile/password` |
| Characters | `GET/POST /characters`; `PATCH/DELETE /characters/:id` |
| Campaigns | `GET/POST /campaigns`; `GET/PATCH /campaigns/:id`; `POST /campaigns/join` |
| Adventure source (DM only) | `GET/PUT /campaigns/:id/adventure` |
| Party | `POST /campaigns/:id/party`; `PATCH/DELETE /campaigns/:id/party/:characterId` |
| Saves | `GET/POST /campaigns/:id/saves`; `POST /campaigns/:id/saves/:saveId/restore` |

The API validates inputs, enforces owner/DM access, and uses parameterized SQL.
The current login throttle is in-memory for this single local API process.
No account deletion, email changes/recovery, live multiplayer sync, or automated
edition-specific mechanics are implemented yet.

Run focused API workflow checks against a **dedicated test database**:

```bash
docker compose exec -T api npm run test --workspace=@dndharness/api
docker compose exec -T web npm run build --workspace=@dndharness/web
```

For a plain-SQL backup, store output outside Git (for example in ignored `artifacts/`):
`docker compose exec -T db pg_dump -U dndharness -d dndharness > artifacts/campaign-backup.sql`.
Create the destination directory first. This backup contains private application data.

The test command creates/reuses `dndharness_test`, clears only its fixtures, and
checks accounts, permissions, edition constraints, private fields, saves,
restoration, password changes, logout, and origin validation. It never targets
the main campaign database. No frontend unit runner or lint tool is configured.

### Dice tray and 3D visuals

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
`npm run dev` starts the frontend only; it expects an API at
`http://127.0.0.1:3001` (override `API_PROXY_TARGET` if needed). To run the API
outside Docker, provide `DATABASE_URL`, then use
`npm run dev --workspace=@dndharness/api`. The recommended all-in-one setup is Compose.

Use the header's moon/sun icon button to switch to dark/light mode.
The first visit uses your system color preference; your choice is then saved
in this browser's local storage. If storage is unavailable, the toggle still
works for the current page session.

Theme changes, button feedback, and edition summaries use subtle transitions.
Supported browsers reveal theme changes outward from the toggle; others use
color transitions. Edition changes get a brief shimmer, and the d20 seal responds
to hover and focus.
The styled edition menu supports click/touch, arrow keys, Home/End, Enter/Space,
Escape, and Tab. Pointer clicks use a subtle border; keyboard focus uses a slim ring.
Buttons and edition options use soft pointer-positioned ripples. Keyboard
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
API workflow checks use Node's built-in test runner; frontend review uses Playwright.

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

- `apps/web/src/App.jsx`: the initial campaign-table screen.
- `apps/web/src/styles.css`: responsive styling using local system fonts.
- `apps/web/src/AccountWorkspace.jsx`: account dashboard and creation flows.
- `apps/web/src/CampaignDetail.jsx`: journal, party, and saved chapters.
- `apps/web/src/CampaignOverview.jsx`: safe source overview and private DM source editor.
- `apps/web/src/CampaignPlanningCanvas.jsx`: private blank-board planning and point editor.
- `apps/db/migrations/001_initial.sql`: schema and initial edition metadata.

To add edition metadata, insert a row through a new SQL migration:

```sql
INSERT INTO editions (id, name, short_name, description, sort_order)
VALUES ('my-ruleset', 'My ruleset', 'Custom', 'The rules our table uses.', 3);
```

The API catalog drives the UI. `is_default` selects the default and adds
`(Default)` to its option title. A partial unique index permits only one default;
clear the previous default before setting a new one. Currently 2024 is the default.
The landing selection resets on reload; saved characters/campaigns retain their edition.
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
| `.opencode/agents/app-reviewer.md` | Independent review of requirements, permissions, data integrity, and UI |
| `.opencode/skills/feature-dispatch/SKILL.md` | Scoped parallel workstreams, shared contracts, integration, and verification |
| `.opencode/agents/dispatcher.md` | Read-only default coordinator using existing agents with specialist briefs |

Use `/small-feature your feature description` for incremental implementation.
The command loads `web-feature`; UI work uses `ui-quality` and `frontend-review`
with the design guide. These workflows scale to the change: small edits get
focused checks, while consequential account/save/schema/shared-control changes
get one independent reviewer pass when available.

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

Session sharing is disabled. File edits, shell commands, and access outside
the project require approval. These settings do not prevent code from being
sent to the selected model provider.

OpenCode loads `AGENTS.md` automatically; there is no need to run `/init`.
To inspect the resolved configuration without making a model request, run:

```powershell
opencode debug config
```
