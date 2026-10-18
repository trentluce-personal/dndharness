# Product intent

## Current experience: sessions only (supersedes campaign-page UX)

The app opens to **Home**, restoring the original illustrated map/d20 hero,
large split serif heading with burgundy italic accent, caption, and decorative
divider. The original 1160px shell, branded header, theme/motion controls, and
site footer remain. One **Host a session** button sits above a naturally scrolled
feed of open sessions. The feed restores the original framed folio/book-cover
presentation and gold line art, with real session titles and parchment/theme-aware
host/count metadata and **Join** / **Open** actions. This reuses existing artwork
and presentation; the decorative d20 is not a roller. Finite hero/card entrances
honor the app's saved motion preference, and mobile stacks map/text and cards.
Hosting opens a compact dialog with **Session name** (1–150 characters) and
**Your name** (1–100). There is no campaign, edition, or account prerequisite.
The joined session retains the familiar session heading and warm ornamented roster panel,
with Back to Home and join/leave/host-end controls. There are no navigation tabs,
campaign editors, journals, sheets, dice,
battle, or scenario tools in the current interface.

`/` and `/sessions` show the same feed; `/sessions/host` opens its dialog and
`/sessions/:id` opens the roster. Legacy campaign/character/profile/dice routes
show an unavailable page with Back to Home. Previous storage, APIs, and
dormant components are retained without exposing their GUI. This simplification
does not delete or reinterpret existing campaign data. It removes capabilities,
while preserving the approved visual design and layout.

Sessions are standalone and ephemeral in API memory, with nullable campaign and
edition links (`null` for new sessions). Hosting sends only title and display name;
there are no dummy campaign writes. The active UI does not read campaigns or
editions, even during SSE refresh. Discovery is limited to this running app.
Cookies and IndexedDB coordinate first-use browser identity across tabs, including
LAN HTTP. Presence renews every 30 seconds; 5 minutes without renewal expires a
participant, and host expiry closes the session. API restart closes all sessions.
Discovery retries every 30 seconds and on visibility/reconnect, retaining known
memberships on temporary errors. Host/join entries survive request failure;
meaningful entries and busy lifecycle actions have navigation protection.

Local operation and explicit LAN opt-in remain as described below and in README.
Future combat/scenario capabilities require a separate agreed slice; none are
implied by the roster. The older campaign UX sections below are archival records,
not the current interface or a request to restore its scope.

## Purpose and audience

dndharness helps friends, family, or any group play Dungeons & Dragons with less
administrative friction and a more tangible shared experience. It should support
character management, dungeon-master tools, combat management, and useful visuals
that bring the group's story to life.

The people at the table remain the storytellers. Software should make it easier
to prepare, understand, and play the game without overwhelming the group or
forcing every table into one style of play.

## Intended hosting and play model

One person hosts the application on their computer. Other players join through
a web link on the same local network, using their own browsers. The application,
API, database, and campaign data stay within the group's setup.

The goal is a self-contained play experience: players should not need companion
software, hosted accounts, external game services, or internet access during play.
Assets needed by the application should be served locally. Host installation can
require Docker and initial downloads; a browser is the only intended client
requirement. Development tools such as OpenCode are not player requirements.

**Current state:** Docker Compose runs the frontend, API, and database. The web
port defaults to `127.0.0.1`; LAN access is an explicit opt-in using
`WEB_BIND_ADDRESS` and exact `APP_ORIGINS`, documented in `../README.md`. The API
and database remain internal services. Host guidance lists configured non-loopback
app URLs; `lanConfigured` means configured, not proven reachable. Devices need
the same trusted network and a private-network firewall allowance; no internet
exposure or router port forwarding is intended. Automated checks do not establish
physical-device reachability; verify the group's actual devices after opt-in.

## Development ethos and compatibility

Start as simple as possible, then expand when a real feature needs it. Build
small, understandable, composable pieces rather than speculative engines or
frameworks. Future-proofing is a development mindset, not a promise that unknown
future rules will work automatically.

- Keep edition-specific content and rules separate from shared UI,
  characters, and campaign storage. Use stable edition IDs and data-driven options.
- Adding edition metadata should not require rewriting UI. Different gameplay
  mechanics can need explicit edition-specific logic when actual play requires it.
- Preserve support for existing editions when adding new ones. A change to the
  default edition must not silently change existing characters or campaigns.
- Preserve existing user data across application updates. Use versioned SQL
  migrations and versioned sheet/save formats; provide explicit migration or
  compatibility handling when a format changes.
- Historical saves must remain intelligible and retain their original meaning.
  Do not reinterpret old snapshots silently using new rules or overwrite history.
- Introduce shared packages, dependencies, and abstractions only for demonstrated
  needs. Confirm major architecture choices with the user.

## Archived model: shared campaigns, characters, checkpoints, and versions

Historical model retained for understanding stored data and dormant code. Its
campaign-based UI and live-hosting requirements are superseded by sessions only:

- **Open workspace:** no accounts, login, profiles, personal library, or invite
  codes. Anyone reaching the app can edit, save, and use any campaign. DM remains
  a tabletop role, not an application ownership or privacy boundary. This approved
  model supersedes the earlier account/member model.
- **Campaign:** editable adventure source, party, and journal tied to one fixed
   edition. The synopsis is suitable for the library; storyline, DM guidance, and
  canvas are preparation spoilers, **not confidential**. Everyone can open them.
  The saved adventure title is the canonical library/navigation identity. The
  independently editable **Journal title** does not rename that adventure.
  Opening a campaign does not host a live session. Archived campaigns remain
  editable but cannot accept imported characters until reactivated.
  Archive/reactivate is a separate status action: clear journal/checkpoint drafts
  by saving or discarding them first, then send status and the expected revision
  without journal fields. Archiving also prevents hosting a new session.
- **Campaign character:** belongs directly to a campaign. PDF import is the only
  creation path; the campaign supplies the edition. Sheets retain current and
  maximum HP, equipment, and listed references without automated rules. Missing
  imported current HP starts at maximum HP. Existing and historical HP is preserved.
  Sheet edits and confirmed removal can be recovered by reverting complete history.
- **Checkpoint:** named immutable snapshot of journal title, campaign status,
  journal, and party.
  Creation saves journal edits and checkpoint atomically. Restore replaces that
  scope, deliberately excluding the adventure title, source, and canvas. Legacy checkpoint rows remain
  retained and readable with account identities omitted.
  A checkpoint-list load failure leaves journal/party use available, retains
  previously loaded checkpoints, and offers a local retry rather than an empty
  history message.
- **Complete version history:** saved campaign mutations automatically retain
  complete version-2 snapshots: campaign title/edition/status, full adventure and
  canvas, journal state, and identity-free campaign party sheets. Preview shows
  meaningful contents before an explicit revert confirmation. Revert replaces
  that complete scope and appends a version; history and checkpoints are retained.
- **Revision-aware editing:** every existing-campaign write, including removals,
  checkpoints, and restores, checks an expected campaign revision. Source saves
  also check the source revision. Drafts retain their load-time revisions, errors
  retain edits, and reload/discard is explicit. Navigation and editor dismissal
  protect meaningful drafts, including navigation to history and browser Back.
- **Preserved legacy records:** orphan personal character/account/profile rows
  remain in storage but are unavailable in this first slice. Old personal/profile
  URLs provide an actionable shared-campaign destination without exposing data.
- **Live session:** an ephemeral table around the current saved campaign, with a
  display-name roster and a read view of saved journal and party sheets. Home
  offers hosting and joining; discovery lists this app's sessions, not other
  network installations. One session may be active per campaign, with different
  campaigns hosted concurrently. Only active campaigns can open new sessions.
  Joining does not assign or claim characters. Only the session host can explicitly
  end the table; campaign editing, preparation, saves, and history stay open to
  everyone, including people who have not joined.
- **Browser presence:** a capability cookie identifies the browser on the same
  host URL, without accounts. First-use host/join setup coordinates across tabs
  through IndexedDB and requires site storage and cookies. It supports ordinary
  insecure LAN HTTP without a Web Locks dependency. Tabs sharing the cookie share identity; changing browser
  profile or URL hostname can change identity. Membership follows workspace
  navigation, with 30-second heartbeats and a five-minute lease. Player expiry
  removes that seat; host expiry ends the table. API restart closes all sessions
  because they live only in memory. Session lifecycle actions do not mutate
  campaign data, revisions, checkpoints, or complete history.
  Background membership discovery also retries every 30 seconds independently
  of SSE activity; becoming visible requests discovery and renewal. Temporary
  failures retain known memberships, while successful session reads update
  independently of other failures. Workspace errors offer a manual session-check
  retry. Late responses from before a membership action cannot undo that action;
  retrying does not guarantee renewal while a browser or device is suspended.
  Ambiguous initialization failures preserve coordination state rather than risk
  replacing another tab's identity. Recovery starts with waiting/retrying; if
  blocked, close all app tabs and clear site data before reopening with storage
  and cookies enabled. That resets identity and host authority, not ownership
  recovery: end an existing table first if possible, otherwise wait for its
  five-minute host lease to expire without renewal. Saved campaign data remains.
- **Realtime saved-state refresh:** SSE carries invalidations, while HTTP writes
  and subsequent authoritative reads carry data. Reconnect triggers a full refresh,
  not durable event replay. Clean views refresh; meaningful dirty drafts and their
  original revisions remain intact. There is no silent rebase or automatic merge.

The current journal contains its own title, a session number, location, story summary, and
party-visible notes. It is not yet a combat engine or a private DM notebook.
Everyone using the app can edit it, manage campaign sheets, and recover saved
versions. Saved changes refresh other open browsers through SSE invalidations;
unsaved drafts and local dice are not shared gameplay state.

## Archived implemented scope (not the current GUI)

Implemented foundations: an accountless shared workspace, database-backed editions,
campaign creation, direct campaign PDF import, read-first campaign sheets, journal
editing, atomic checkpoints/restoration, automatic complete version preview/revert,
live host/join presence, same-app session discovery, SSE saved-state refresh,
opt-in LAN configuration, and a dice tray. Source overview/editing and a shared blank planning canvas are
also implemented. Version-1 sources use revision-checked whole-source saves; stale
saves fail without replacing the draft. The canvas supports up to 100 freely
placed story/location/encounter/NPC points with notes and manual location/NPC/enemy
references, bounded percentage coordinates, pointer/touch and keyboard movement.
The complete source is limited to 200,000 UTF-8 bytes. It has explicit save/reload
and no autosave. Existing sources inherit only their old title, not their shared
journal summary. Overview/library responses use source metadata; complete
preparation remains accessible to everyone and is clearly labeled as spoilers.

- The **core character sheet is provisional** and will change later. It currently
  supports manual entry of identity, class/ancestry/background, level, abilities,
  HP, AC, speed, equipment, and notes. It does not automate edition-specific rules.
- Character import reads form-fillable D&D Beyond PDFs locally in the browser,
  then presents an editable, unsaved campaign-character draft. It is the only
  new-character creation path in the interface. Existing campaign characters and
  imported drafts remain editable. Missing values
  require input; rules edition comes from the campaign. A PDF edition suggestion
  cannot silently change it; conversion is not automated. Equipment has structured
  item names, quantities, listed weights, and separate coins (sheet format 2);
   legacy free-text equipment remains readable. Sheet format 3 preserves skills,
   saving throws/proficiency, attacks, spells/spellcasting, features/actions, and
   identity/story details as structured editable references. Unknown filled PDF
   fields remain reviewable. Printed spell preparation markers are not inferred
   as gameplay state. Existing format-1/2 notes and historical saves remain intact.
   These references are not converted into automated rules.
  Scanned/flattened PDFs are outside this initial import scope.
- The **dice tray** uses local themed 3D visuals with precomputed authoritative
  outcomes. Reduced motion and rendering failures use a non-3D fallback.
  Its results/history are not yet persisted or synchronized with a party.
- **Combat management, maps/uploads, connected planning graphs, richer DM tools, and synchronized gameplay state**
  are product goals, not implemented capabilities.
- Internet-hosted deployment, cross-installation/network discovery, character
  assignment, readiness/start/pause controls, shared dice, and persistent
  playthrough branches are outside this stage. There is no external identity service.
- Fictional demo data is opt-in and clearly labeled; verification uses isolated
  test data rather than personal campaign records.

## Experience and quality

Preserve the approved classy fantasy identity and satisfying, expressive
interactions. The concrete visual and motion conventions live in
[`design.md`](./design.md). Everyday actions should stay legible, quick, and
predictable; decoration must not interfere with forms or play.

Keyboard operation, small-screen layouts, useful error feedback, and reduced
motion with an explicit app override are part of the intended experience.
Verify real browser behavior and inspect screenshots rather than treating a
successful build as proof of UI quality.

## Approved future direction: event-driven combat and hybrid storage

Design decision recorded on 2026-10-09:

- The first main gameplay feature will be **event-driven combat management and
  simulation**. This describes combat actions, resolved outcomes, and resulting
  state changes; it does not by itself commit to autonomous combat AI.
- Use a **hybrid PostgreSQL / Neo4j architecture**, assigning data to the model
  that fits it. PostgreSQL remains responsible for relational application data
  such as campaigns, character sheets, and saves. Neo4j
  is intended for relationship-heavy combat state, such as effect instances,
  sources and targets, concentration, grapples, and effect dependencies.
- The preferred ownership model is PostgreSQL as the authoritative store for
  resolved combat events and checkpoints, with Neo4j as a rebuildable projection
  of combat relationships. Edition-aware application rules determine outcomes;
  database relationships do not constitute a rules engine.
- Historical events/checkpoints must retain resolved outcomes and relevant rules
  versions so later rule changes do not silently reinterpret past combat.
- Finalize and agree on the combat UX design **before starting implementation**
  of combat or the hybrid database architecture. The existing visual design guide
  remains the foundation; it does not yet specify the combat experience.
- Exact event contracts, projection consistency, replay/restore behavior, and
  deployment details will be designed after the UX is agreed. Neo4j and combat
  event processing are not currently implemented.

## Archived campaign/live-table UX and future playthrough proposals

The Campaigns page presents editable adventure sources as a shared library. Opening one
accesses its overview and shared source editing and planning;
it does not start a live game. Top campaign navigation links **Overview**,
**Planning canvas**, **Party & journal**, and **Version history** as separate
destinations. Existing play progress lives in Party & journal.
Archived entries remain accessible and do not become
read-only; archiving prevents adding characters. Only checkpoints are immutable.

The image/instance mental model treats campaigns as the editable base adventure,
like an adventure book with storyline and DM preparation. “Image” describes that
source identity, not an immutable template. The source is now stored independently
from old journal/party/checkpoint records. The implemented live table is a temporary
presence roster around that same saved campaign, not a copy or independent run.
Closing it releases live presence without archiving/deleting the campaign or
erasing characters. Its session view omits preparation for convenience, not privacy.
The session presence actions are **Join session** and **Leave session**, with a
confirmed **End session** for the host. Lifecycle and network setup details use
compact disclosures so the roster and current saved campaign remain prominent.

Future persistent playthrough branches, character assignment, readiness, explicit
start-play, pause/resume, and shared gameplay events remain proposals. Their
storage and lifecycle contracts are undecided. Do not infer those capabilities
from the current Host/Join controls or SSE saved-state refresh. Agree on the next
smallest useful slice before expanding this experience.

## Archived discussion topics (not current UI scope)

The following are discussion topics, not an approved implementation order:

- LAN hosting validation: verify the documented opt-in on the group's actual
  browser/device combinations and network, then address demonstrated setup friction.
- Combat UX: the event-driven management/simulation workflow, what the DM versus
  players should control, and how actions, effects, and outcomes are presented.
  Agree on this experience before implementing the approved future architecture.
- Character-sheet evolution: which edition to automate first and which fields,
  calculations, or imports matter to the group's real characters.
- Future live-session spoiler presentation: preparation is currently shared,
  not confidential; any stronger information boundary needs a new explicit decision.
- Visual tools: maps, tokens, encounters, or 3D dice, chosen for actual play value.
- Save behavior as gameplay expands: checkpoint granularity, state included, and
  handling simultaneous edits or restore while other players are connected.

Agree on the next smallest useful slice before expanding these areas.

## Keeping session context durable

Read this document for product intent, `design.md` for experience conventions,
and `../README.md` for current setup/capabilities. `../AGENTS.md` supplies the
development workflow and is loaded by OpenCode. Update these documents when
decisions or capabilities change; do not store credentials, campaign content,
or session transcripts here.
