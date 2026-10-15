# Product intent

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

**Current state:** Docker Compose runs the frontend, API, and database, but the
published web port is bound to `127.0.0.1`. Other computers cannot join yet.
LAN exposure, host-link instructions, and cross-device session behavior remain
to be implemented and verified. Do not describe LAN play as already supported.

## Development ethos and compatibility

Start as simple as possible, then expand when a real feature needs it. Build
small, understandable, composable pieces rather than speculative engines or
frameworks. Future-proofing is a development mindset, not a promise that unknown
future rules will work automatically.

- Keep edition-specific content and rules separate from shared UI, accounts,
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

## Accounts, characters, campaigns, and saves

These relationships are the current agreed product model:

- **Account:** a person at the table. Owns personal characters and profile
  information. The same person can be a player in one campaign and DM in another.
  Private profile fields are separate from the public display name seen by a party.
- **Personal character:** owned by one account, with a sheet attached to a
  specific edition. The current character's edition is fixed after creation.
  Any future conversion between editions must be deliberate.
  Maximum HP belongs to the personal sheet; current HP belongs to campaign copies.
  Existing legacy personal HP is not used when joining a campaign.
  Owners can delete a personal character from their library and future join choices.
  Its internal record remains to preserve campaign copies, membership, and checkpoint
  restoration. Deletion has confirmation and no in-app undo; restoring a campaign
  does not restore the character to the personal library.
- **Campaign:** an editable adventure source tied to an edition, with one account
  as its DM. Its title and player-safe synopsis are visible to members. Its
  storyline, DM guidance, and planning canvas are private to the DM. The source
  is independent of preserved existing play progress: party characters linked to
  accounts, shared journal, and checkpoints. Players still join those existing
  records by invite code with a matching-edition character.
- **Campaign character:** a campaign-specific copy of a personal sheet. Its HP,
  equipment, notes, and other state can evolve without overwriting the personal
  character or another campaign's copy. The DM currently edits campaign sheets.
  Newly joined copies start at maximum HP. Existing campaign HP and historical
  saved HP remain unchanged.
- **Save / saved chapter:** an immutable, versioned snapshot of the campaign's
  state, DM public identity, party identities/account links, and campaign sheets.
  It is a checkpoint like a game save, separate from the mutable current campaign.
- **Restore:** the DM can replace the current journal and party state with a
  snapshot. Personal sheets and save history remain intact. Restoring a previous
  party can also reinstate that party's access; this must remain explicit.
  Restore does not replace the adventure source or its private planning canvas.

The current journal contains a session number, location, story summary, and
party-visible notes. It is not yet a combat engine or a private DM notebook.
Only the DM currently creates/restores saves and manages the party; members can
read campaign information and history. Permissions belong on the server as well
as in the interface.

## Current scope and deliberate boundaries

Implemented foundations: local accounts and sessions, profile/password editing,
database-backed editions, core character sheets, campaign creation/joining,
campaign sheet copies, journal editing, snapshot saves/restoration, and a dice tray.
Campaign source overview/editing and the private blank planning canvas are also
implemented. Version-1 sources use revision-checked whole-source saves; stale
saves fail without replacing the draft. The canvas supports up to 100 freely
placed story/location/encounter/NPC points with notes and manual location/NPC/enemy
references, bounded percentage coordinates, pointer/touch and keyboard movement.
The complete source is limited to 200,000 UTF-8 bytes. It has explicit save/reload
and no autosave. Existing sources inherit only their old title, not their shared
journal summary. Member overview/library requests expose safe metadata only;
full source endpoints enforce DM-only access.

- The **core character sheet is provisional** and will change later. It currently
  supports manual entry of identity, class/ancestry/background, level, abilities,
  HP, AC, speed, equipment, and notes. It does not automate edition-specific rules.
- Character import reads form-fillable D&D Beyond PDFs locally in the browser,
  then presents an editable, unsaved personal-character draft. It is the only
  new-character creation path in the interface. Existing personal characters and
  imported drafts remain editable. Missing values
  require input; rules edition remains a user choice. Equipment has structured
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
- **Combat management, maps/uploads, connected planning graphs, richer DM tools, and live multiplayer state**
  are product goals, not implemented capabilities.
- Account recovery emails, account deletion, and hosted deployment are outside
  the current increment. There is no dependence on an external identity service.
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
  such as accounts, permissions, campaigns, character sheets, and saves. Neo4j
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

## Proposed campaign and live-instance UX

The Campaigns page presents editable adventure sources as a library. Opening one
accesses its safe overview and, for the DM, private source editing and planning;
it does not start a live game. Existing play progress lives at a separate destination.
Archived entries remain accessible and do not become
read-only; archiving prevents adding characters. Only checkpoints are immutable.

The image/instance mental model treats campaigns as the editable base adventure,
like an adventure book with storyline and DM preparation. “Image” describes that
source identity, not an immutable template. The source is now stored independently
from old journal/party/checkpoint records. Future playthrough branches and live
instances remain unimplemented; their storage and lifecycle contracts are still
undecided. A live session
instance could be the temporary table opened for an evening. A DM
would host a lobby; players would join with compatible existing campaign copies
or new copies of personal characters and mark ready. The DM would start play,
publish shared story/journal content, pause/resume, and close the live session.
Closing would release live seats without archiving/deleting the campaign or
changing personal originals.

This remains a future design proposal, not an approved production schema or
final experience. Implement it one stage at a time, agreeing on the next smallest
useful slice before starting it. Live session instances, lobby/readiness controls,
friend discovery, and multiplayer synchronization are not implemented; LAN access
also remains future work as described above.

## Priorities to discuss

The following are discussion topics, not an approved implementation order:

- LAN hosting: how the host shares a link, what setup is required, and which
  browser/device combinations the group needs.
- Combat UX: the event-driven management/simulation workflow, what the DM versus
  players should control, and how actions, effects, and outcomes are presented.
  Agree on this experience before implementing the approved future architecture.
- Character-sheet evolution: which edition to automate first and which fields,
  calculations, or imports matter to the group's real characters.
- DM information boundaries: party-visible journal versus private notes.
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
