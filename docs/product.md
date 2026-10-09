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
- **Campaign:** a shared, ongoing game tied to an edition, with one account as
  its DM and a party of characters linked to their owning accounts. Players join
  by an invite code with a matching-edition character.
- **Campaign character:** a campaign-specific copy of a personal sheet. Its HP,
  equipment, notes, and other state can evolve without overwriting the personal
  character or another campaign's copy. The DM currently edits campaign sheets.
- **Save / saved chapter:** an immutable, versioned snapshot of the campaign's
  state, DM public identity, party identities/account links, and campaign sheets.
  It is a checkpoint like a game save, separate from the mutable current campaign.
- **Restore:** the DM can replace the current journal and party state with a
  snapshot. Personal sheets and save history remain intact. Restoring a previous
  party can also reinstate that party's access; this must remain explicit.

The current journal contains a session number, location, story summary, and
party-visible notes. It is not yet a combat engine or a private DM notebook.
Only the DM currently creates/restores saves and manages the party; members can
read campaign information and history. Permissions belong on the server as well
as in the interface.

## Current scope and deliberate boundaries

Implemented foundations: local accounts and sessions, profile/password editing,
database-backed editions, core character sheets, campaign creation/joining,
campaign sheet copies, journal editing, snapshot saves/restoration, and a dice tray.

- The **core character sheet is provisional** and will change later. It currently
  supports manual entry of identity, class/ancestry/background, level, abilities,
  HP, AC, speed, equipment, and notes. It does not automate edition-specific rules.
- The **dice tray** is an animated local roller. Its results/history are not yet
  persisted or synchronized with a party. Actual 3D rendering is a possible later
  enhancement, not a requirement of this increment.
- **Combat management, richer DM tools, maps/visuals, and live multiplayer state**
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

## Priorities to discuss

The following are discussion topics, not an approved implementation order:

- LAN hosting: how the host shares a link, what setup is required, and which
  browser/device combinations the group needs.
- First shared gameplay workflow: combat/initiative, live dice, or campaign-state
  updates, and what the DM versus players should control.
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
