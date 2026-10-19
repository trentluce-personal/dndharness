# dndharness design guide

## Product and direction

A local D&D table for friends and family. The current experience is **Home and
Dice roller**, superseding the earlier Home/Campaigns/Live sessions/Dice navigation and
campaign-based hosting. Start with the smallest useful feature.

The approved direction is **classy, warm fantasy with expressive interactions**.
Preserve the parchment/burgundy/gold and charcoal themes, serif headings, d20
seal, and restrained ornament. This is the user's chosen identity; a third-party
skill's dislike of cream backgrounds, italic headings, or cards is not a reason
to redesign it. Extend the existing visual vocabulary before inventing another.

## Current Home and Dice roller UX

- Retain the original 1160px app shell and content proportions, branded d20 header,
  theme/motion controls, and two-part site footer. Restore the actual original
  `LandingHero` illustrated map/d20 SVG, arched frame, caption, split large serif
  heading with burgundy italic “at the table,” and decorative divider. “Gather
  your party” and session-focused copy lead to one prominent **Host a session**
  button (`home-host-session`). Use the original composition and spacing, with
  the open-session feed reachable by natural scrolling. On mobile, map and text
  stack. The d20 is decorative artwork.
- Session cards restore the original CampaignLibrary framed folio/book-cover
  presentation: atmospheric covers, original gold mountain line art, serif session
  titles, and parchment/theme-aware lower metadata surfaces. Reuse the existing
  cover CSS and adapted presentational markup, showing only real host names,
  participant counts, and **Join** / **Open**; no edition, campaign, archive, or
  saved-adventure badges/placeholders. No additional join CTA.
  Hero and card entrances are finite and honor `data-motion` and the saved override.
  Empty copy is exactly **No sessions are live right now.** Connection/error
  feedback uses the original quiet badge style beside the heading, accessible,
  with retry when useful.
- Host opens a compact modal on the feed with **Session name** and **Your name**.
  Limits are 1–150 and 1–100 characters respectively. No edition or campaign
  prerequisite. Its decorative eyebrow is “Gather your party.” Preserve entries
  on failure; Cancel, Escape, and navigation protect meaningful entries. Guard
  Back and duplicate requests while busy.
- The roster page contains **Back to Home**, the original serif dashboard
  title/host treatment, and a warm, quietly double-framed **At the table** panel
  with bordered roster chips, participant count, and join/leave/host-end controls.
  End requires a concise confirmation. A short host-expiry/server-restart note
  belongs in hosting, not on the homepage.
- `/` and `/sessions` are feed aliases; `/sessions/host` is a direct dialog link.
  Native **Home** / **Dice roller** links reuse `workspace-nav` and tab styles.
  All session routes select Home, with `aria-current="page"` only on the feed;
  Dice roller is selected/current on exact `/dice` and `/dice/`. Nested dice routes
  are unavailable. Deep reloads, Back/Forward, and native new tabs work.
  Dice has its own view using the existing tray heading, local-only badge/history
  note, themed local 3D assets, and reduced-motion fallback. Keep the Home hero
  and feed intact. Navigation preserves session presence and host/join draft guards.
  Legacy routes show simple unavailability and Back to Home. No journal,
  sheet, campaign, battle, scenario, or help/configuration panels are active.
- Keep existing fantasy tokens, responsive wrapping, 44px primary targets,
  native dialogs/focus, keyboard links, and reduced-motion/theme preferences.
  Reuse `styles.css` and `workspace.css` for shell, dashboard, panel, roster, and
  form styling; the session feed and room share the full main-content width.
- Dice setup groups die type and a select-only **Dice color** dropdown above equal
  tiles, with each dN label above its static 3D thumbnail. **Custom color** reveals
  a labeled native body-color input; switching palettes retains the custom color
  for the current view. Options and the selected value show solid body-color
  circles beside their text; Theme default follows the app theme. Reuse the
  EditionPicker keyboard/exploration pattern. Color controls disable during throws. Use the existing
  wine selection treatment, 44px inputs, and 12/16/24px spacing.
- Place **Tray background** beside Dice color using the same labeled combobox,
  textured circle swatches, keyboard behavior, and disabled-during-throws state.
  Offer Theme default, Green felt, Burgundy felt, Midnight felt, Brown leather, and Stone tiles.
  Theme default preserves the original theme-aware tray; fixed finishes use subtle
  seeded local SVG grain (soft nonwoven felt nap / irregular leather relief), muted
  colors, and restrained directional light beneath the transparent 3D canvas and
  behind fallback dice. Grain keeps a fixed CSS-pixel scale across viewport sizes;
  swatches share the actual surfaces. Stone uses cool gray, staggered 128px floor tiles,
  quiet grout, mineral grain, and soft bevels. No animated noise or physical-behavior differences.
  Save independently of dice color/theme; never reset results or regenerate 3D
  resources for a background change. Stack controls on narrow screens.
- After dice settle, show a nonmodal **Roll total** card inside the shared 3D/fallback
  tray frame. A local gray/grayscale backdrop dims only the tray and dice. Use a
  theme-neutral surface, prominent total, compact notation, and multi-die values
  without a redundant equation. Announce notation/total once politely without moving
  focus. **Close result** (44px target) or Escape while focused inside the tray
  dismisses it; new rolls and type/count changes hide it, preserving five-roll history.
  No timeout. Appearance changes retain a valid result; reduced motion is immediate.

The campaign and former live-table specifications below are **archival** wherever
they describe removed screens. They preserve context for dormant components and
stored data; this Home and Dice roller contract takes precedence.

## Archived beginner-first campaign UX (superseded)

Design every workflow for someone who knows neither this application nor D&D.
The interface should make it clear where they are, what they can do next, and
what will happen when they act, without requiring outside instructions.

- Use recognizable navigation and literal action labels: Home, Live sessions,
  Campaigns, and Dice roller. The workspace opens without accounts; no profile,
  sign-out, invite joining, or personal library controls. Fantasy identity belongs in
  atmosphere, not at the expense of understanding.
- Explain unfamiliar terms in context, including campaign, party, dungeon master
  (DM), rules edition, health (HP), and armor class (AC). Expand abbreviations and
  use examples where they help; do not assume prior tabletop experience.
- Start with the user's goal: playing with a group or running an adventure.
  Home offers **Host a session** and **Join a session**; Campaigns opens the shared
  saved-adventure library. Choosing a rules edition belongs in campaign
  creation, with an explanation of permanence. Imported characters use that edition.
- Empty states describe what is missing and the nearby action that gets started.
  A prerequisite should provide a way forward, not only a disabled action.
  Importing a character goes directly into the selected campaign’s party.
- PDF import is the only new-character entry point in the UI. Do not offer blank
  manual creation or a manual fallback after an import error. Existing sheets and
  imported drafts remain editable.
- Keep explanations near the relevant controls, identify optional fields, and
  explain campaign-owned sheets and shared preparation spoilers. Spoilers are
  not confidential; anyone reaching this app can edit and save.
- Make the interface self-explanatory through hierarchy, familiar controls, clear
  labels, and direct next actions. Do not rely on a How to use page, instructional
  guide, or forced onboarding tour. Keep necessary context brief and local to a
  consequential choice.
- Use readable body/control text and touch-friendly controls. Prefer progressive
  disclosure over placing every tool on Home; dice have their own destination.
- Apply this approach to the future combat UX before implementing combat or the
  approved hybrid storage architecture described in `product.md`.

## Tokens and typography

Use the existing CSS variables in `apps/web/src/styles.css`. This table records
the current palette, not a second stylesheet to copy literal colors from.

| Role | Token | Light | Dark |
| --- | --- | --- | --- |
| Page | `--background` | `#f6f2eb` | `#191918` |
| Surface | `--surface` | `#fffcf7` | `#242320` |
| Primary text | `--text` | `#322b26` | `#f0e5d5` |
| Supporting text | `--muted` | `#74695e` | `#baad9d` |
| Accent | `--wine` | `#823b45` | `#dea1aa` |
| Ornament | `--gold` | `#d9bc87` | `#dec496` |
| Input surface | `--control` | `#faf6ef` | `#2b2925` |
| Dividers | `--border` | `#e1d7c8` | `#433c34` |
| Input border | `--control-border` | `#c8b9a4` | `#726352` |

- Georgia/Times serif for headings and identity; system sans-serif for controls
  and body. Fonts stay local. A new font dependency needs a concrete reason.
- Maintain hierarchy: display ~40–64px; dashboard titles ~32–46px; section
  headings ~26–33px; normal body/control text ~12–16px. Small labels/badges are
  supporting metadata, never the only way to understand an action.
- These ranges describe the current UI, not a legibility exemption. Verify
  contrast, zoom, and mobile readability; increase small text where necessary.
- Use sentence case for functional copy. Keep display names and titles intact.
  Reserve uppercase/tracking for brief decorative labels, not instructions.
- Use tabular numerals for stats and comparable roll results. Let user text wrap;
  avoid hiding a character name or an important error behind truncation.

## Layout and surfaces

- Maximum shell width is 1160px; desktop gutters 48px, mobile 18–22px.
  Reuse the existing 4/8px-oriented rhythm (8, 12, 16, 24, 32px).
- Controls generally use 7–8px radius; panels 12px; hero 16px; icon buttons
  are circular. Soft shadows indicate elevation, not every nested container.
- Landing content can be centered; forms, journals, and dashboards are left
  aligned. Put the next useful action near the content it changes.
- Cards group a campaign or character. Avoid wrapping every paragraph in a card.
  Ornament belongs in quiet margins and the seal, not behind editable content.
- Collapse campaign columns on narrow screens; stack complex form fields.
  Keep menus within the viewport and dialogs scrollable. Fix overflow at its
  source rather than hiding it across the whole page.
- Review at 1280×900 and 390×844, with narrow-width/200% zoom checks when relevant.
  Use device emulation for touch behavior, not just resize. Prefer 44px touch
  targets for primary controls; keep compact controls adequately separated.

## Components and interaction contracts

Reuse the pieces in `apps/web/src/`:

- **Button:** `Button.jsx` provides primary/secondary/text variants and ripple
  feedback. Primary = the main action, secondary = supporting action, text = quiet
  action. Use native buttons for actions and anchors for actual URL navigation.
  Provide accessible names for icons and busy/disabled states for requests.
- **Edition picker:** `EditionPicker.jsx` is the designed select-only combobox.
  Options show name, description, selected check, and default badge. Support
  keyboard exploration, selection, Escape, Tab, outside dismissal, and menu
  placement. The clicked state uses a subtle border; keyboard focus a slim ring.
  New selection controls should reuse a proven pattern rather than copy ad-hoc ARIA.
  Native selects remain valid for simple forms; style them consistently.
- **Dialog:** `Dialog.jsx` uses native modal dialog behavior. Preserve focus
  containment, Escape, a visible close action, and sensible focus restoration.
  Destructive confirmation should explain the consequence and emphasize Cancel
  when appropriate. Long editors must remain operable at mobile size and zoom.
- **Forms:** visible labels, useful autocomplete, appropriate input types and
  limits. Hints and errors should be associated with their input, not become
  part of a confusing label. Keep drafts after failed requests. Focus or announce
  actionable validation. Do not silently discard meaningful unsaved edits.
- **Archived campaigns (dormant):** clearly present shared access and campaign-owned sheets.
  Save and restore labels must describe the state
  being saved or replaced. Keep irreversible history separate from editable state.
  The Campaigns page is a saved-adventure library: folio/book-cover cards with
  charcoal covers, restrained original gold line art, serif titles, and parchment
  or charcoal metadata surfaces. Lead with edition, saved title, story summary,
    shared access and library state. Use “In library” or
  “Archived” for library state, never live activity or session-number badges.
   “Open campaign” is a native link to the source overview. Use the source title
   and player-safe synopsis, never the old shared journal summary. Explain that opening
   does not start a live game; archived entries remain openable and editable,
    but cannot accept new characters or host a new live session.
    The overview separates the library synopsis from preparation labeled
    **Spoilers, not confidential**. **Party & journal** leads to direct PDF import,
    journal editing, party sheets, and checkpoints. **Version history** is a
    separate reloadable destination for complete recovery. Keep **Overview**,
    **Planning canvas**, **Party & journal**, and **Version history** in a top
    campaign subnav on each campaign page, using native links and `aria-current`.
    A campaign may offer
    **Host session** or **Open live session** separately from **Open campaign**;
    library/archive status must remain distinct from live presence.
    Shared **Planning canvas** starts blank, with no map/grid or forced story order.
   A bounded board sits beside a point editor on desktop and stacks above it on
   narrow screens. Numbered 44px markers match a keyboard-selectable point list;
   numbers identify points, not a sequence. Pointer/touch drag, arrow keys, numeric
   percentages, and **Add point at center** offer equivalent editing paths.
   Markers remain visually in bounds at 0/100 percent; only markers suppress touch
   scrolling. Keep explicit save/dirty status, draft-preserving failures, confirmed
   deletion, and confirmed reload/discard near their actions. Source saves update
   the library title and breadcrumbs only after canonical server success.
   **Journal title** is an independent editable journal name, with a nearby hint
   that it does not rename the adventure. Campaign context uses the saved adventure
   title; snapshot previews label the journal title explicitly.
   **Campaign status** is a separate section in Party & journal. **Archive campaign**
   and **Reactivate campaign** require journal/checkpoint drafts to be saved or
   cleared, with an explicit discard-and-reload path. Send only status and the
   expected revision for this action. Keep archive state out of the journal form.
- **Archived campaign sheet dialog (dormant):** opens read-first with a compact dark identity banner,
  quiet double-line ability plaques, value-first scores, and framed listed core stats.
  Desktop keeps saving throws/senses and skills beside a wide local tabbed reference
  folio; burgundy marks the active tab. Narrow screens stack readable columns and
  wrap tabs into touch-friendly rows. Borrow sheet hierarchy, not branded art or
  red borders. All saved references, legacy text, and unmatched PDF fields remain
  reachable; no modifiers, resources, units, or rules are inferred. Edit character
   enters the editor within the campaign progress dialog; Cancel uses the mounted draft's discard
  guard. Successful saves return to canonical read view and focus Edit character.
   Campaign breadcrumbs are semantic links, with the last item marked as the current page.
  Save in place and update the canonical identity only after server success.
  Navigation/discard confirmation keeps the draft mounted; Keep editing restores
   focus and browser history. Imported drafts remain in a dialog with a persistent
   Add character footer and fixed campaign edition context.
- **Archived campaign recovery (dormant):** named checkpoints include journal title, campaign status, journal,
   and party, explicitly excluding the adventure title/source/canvas; their save
   also commits journal edits atomically. Complete automatic history previews
   source text, canvas point references, journal, and expandable read-first party
   sheets. Guarded **Revert complete campaign** names the version and replacement
   scope and explains that a new version is appended. Cancel gets initial focus.
   Conflicts retain drafts/previews; an explicit reload is required before retry.
   Journal/checkpoint drafts must be saved or discarded before party mutations.
   Show journal, checkpoint, party, and status action feedback near the relevant
   controls; dialog failures remain visible in their dialog. Checkpoint-list
   loading/failure is independent of journal and party use. Retain previously
   loaded checkpoints on failure and offer **Retry loading checkpoints** locally;
   show the empty state only after a successful empty result. Campaign refresh
   failures have their own **Retry campaign refresh** action and retain drafts.
- **Archived campaign-based live tables (superseded):** Home provides direct Host/Join actions; the session directory
   lists open tables on this app, not network-wide discovery. Hosting selects a
   saved active campaign and display name; an already-hosted campaign links to its
   existing table. Join explains that presence does not assign a character. The
   table shows host/participant roles, saved journal, and expandable party sheets.
   Preparation is omitted here but remains openly reachable through campaigns.
   Directory links use **View session** or **Open your session**. The presence
   actions are **Join session** and **Leave session**; only the host sees the
   confirmed **End session** action.
   Confirmation explains that ending does not save, archive, or delete campaign
   data. Campaign editing and history remain available to everyone.
   Presence follows workspace navigation, renewing every 30 seconds with a
   five-minute lease. Explain host-expiry and API-restart closure, and provide an
   actionable ended/missing-table state. Keep routine lifecycle guidance in the
   compact **How session presence works** disclosure on directory/session pages,
   and network setup in **Connect your group on the local network** on hosting
   and session pages. Keep roster and actions ahead of these details.
   Browser capability cookies, not accounts
   or display names, preserve authority on the same host URL.
   Host/join setup requires cookies and IndexedDB for cross-tab identity, including
   on ordinary LAN HTTP; do not depend on Web Locks. Keep setup automatic in the
   happy path. A pending/failed setup offers wait/retry, then closing **all** app
   tabs and clearing site data with storage/cookies enabled. Explain that this
   resets identity and host authority rather than recovering an existing table;
   end it first if possible, otherwise wait for five-minute host expiry without
   renewal. Keep these details in actionable error/recovery guidance.
- **Archived campaign/live feedback (superseded):** communicate connecting/reconnecting and refresh failures
   without blocking campaign navigation. Membership discovery retries every
   30 seconds independently of SSE events; returning to a visible page requests
   discovery and presence renewal. Temporary failures keep known memberships,
   and successful detail reads install independently of failed peers. Show
   **Retry session check** in workspace membership errors and renewal failures
   beside the affected membership. Late background responses from before a
   membership action must not undo that action.
   SSE invalidations trigger authoritative
   HTTP refreshes, including a full refresh after reconnect. Preserve dirty drafts
   and their captured revisions; show changed-elsewhere guidance and an explicit
   reload/discard path rather than silently replacing or rebasing edits. Hosting
   guidance lists only configured non-loopback URLs: `lanConfigured` does not prove
   reachability. Keep readiness, start/pause, character claims, combat, and shared
   dice out of this stage. Checkpoints and complete versions retain their existing
   scope and behavior; session lifecycle changes do not create campaign versions.

## Motion language

The user explicitly wants noticeable, satisfying motion. Give each action one
clear response; do not make controls wait for decoration to finish.

| Interaction | Current direction |
| --- | --- |
| Hover / press | Gentle lift, color emphasis, short compression (~160–250ms) |
| Pointer ripple | Starts at contact point; centered for keyboard (~580ms) |
| Menu / dialog | Short settle/reveal (~220–320ms) |
| Selection | Brief confirmation shimmer (~650ms) and updated summary |
| Theme | Strong toggle halo and radial palette reveal (~950ms), with fallback |
| Dice | Brief tumble (~650ms), then a readable result |

- Prefer transform/opacity for movement. List transition properties explicitly.
  Palette and clip-path effects need browser inspection; do not assume compositor
  performance. Use traces if jank is observed, rather than adding `will-change` everywhere.
- Animation must be interruptible, clean up after itself, and not steal focus,
  obstruct clicks, flash rapidly, or cause layout shifts. No perpetual ornament.
- Honor `data-motion` and the user's saved app override. On first visit the system
  preference supplies the default; **Enable animations / Motion on** controls
  the explicit choice. Test both the system default and the override. Disable
  ornamental movement in reduced mode while preserving information and feedback.
- Theme effects use feature detection. Unsupported browsers must retain usable
  controls and clear color changes. A screenshot alone never proves smoothness.
- Personal-sheet numbers sit on lifted circular value backgrounds, centered on
  their faces: equal width/height disks, quiet gold rims, subtle bevels, and soft
  elevated shadows on parchment/light and charcoal/dark surfaces.
  Values lead the hierarchy: large accented modifier/core numerals, prominent
  secondary scores on smaller circular backgrounds, and quiet readable labels
  and frames. The disk is behind the number, never a separate oval underneath;
  size disks and type for the printed numeric length, with breathing room around
  the actual glyph ink and optical centering rather than line-box centering.
  Three-to-six-digit numeric values retain display emphasis; reflow columns
  before crowding a disk. Keep ordinary backgrounds compact without broad extra height.
  Missing values and long listed references use body-scale text; zeros retain
  numeral emphasis. Preserve all listed text with wrapping, never truncation.
  Long listed strings use a neutral full-content treatment without stretching
  circles. Fine-pointer hover lifts the value and background together and emits
  one finite circular gold ripple; these are selectable read-only values, not
  controls. Touch and reduced app motion keep the disks entirely static; the saved full-motion
  override enables the effect even when the system requests reduced motion.

## Archived campaign feedback and copy (superseded)

The open Home page leads with Host/Join actions and uses the existing fantasy
visual language; Campaigns retains the shared folio library. Keep the header d20
seal, theme and motion controls, and direct Dice
roller destination. Earlier account-based landing and personal-library usage is
superseded. Legacy personal/profile links explain unavailability and provide a
campaign action without exposing preserved personal data.

Character imports reveal the extracted identity and actual equipment/spell counts
before editing. Inventory uses compact expandable rows, with Undo for removal.
The imported draft has its own scrolling content region and a persistent Add
character footer. Confirmed server success gives a concise character-added message
in the campaign’s party. These effects honor the app motion setting.
Expanded character references use native disclosure sections for skills, saving
throws, attacks, spells, features, and description. Rows expand for editing;
removal offers Undo. Preserve printed modifiers/markers without implied automatic
calculation. Unknown filled PDF fields remain visible for review, and the sheet
explains that details belong to the campaign and are shared with everyone using the app.

Fantasy language can give headings personality; actions and errors stay plain.

| State | Good direction |
| --- | --- |
| Empty | “No characters yet. Import a character sheet.” plus the action |
| Loading | “Loading campaigns…”; keep surrounding layout stable |
| Saving | “Saving…” and prevent duplicate submission |
| Success | “Campaign sheet saved.” or “Checkpoint saved.” announced politely |
| Validation | “Current HP cannot exceed maximum HP.” near the relevant fields |
| Failure | Explain what failed and how to retry; preserve the draft |
| Restore | Name the snapshot and explain that current campaign state is replaced |

Communicate state with text or symbols as well as color. Keep notifications near
the triggering action. Do not report success until the server confirms it.

## Review and maintenance

Use `ui-quality` for quality criteria and `frontend-review` for browser execution.
Check the affected area in both themes, with keyboard and relevant touch behavior,
including empty/loading/error states. Screenshot artifacts belong in ignored
`artifacts/`, not this guide. Record deliberate design changes here with the
implementation so future work inherits the same decisions.

## References

This is original project guidance informed by these references, not a wholesale
installation of their opinions or workflows:

- [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design): intentional hierarchy, critique, and restraint.
- [Impeccable](https://github.com/pbakaus/impeccable): focused polish, clarify, harden, and animate passes.
- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines): interaction and interface checks.
- [W3C ARIA patterns](https://www.w3.org/WAI/ARIA/apg/patterns/): accessible widget behavior.
- [web.dev animation guidance](https://web.dev/articles/animations-guide): rendering costs and motion performance.
