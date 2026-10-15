# dndharness design guide

## Product and direction

A local D&D table for friends and family: accounts, edition-linked characters,
campaigns, saved chapters, and dice. Keep it understandable to a first-time player
and useful to a DM during a session. Start with the smallest useful feature.

The approved direction is **classy, warm fantasy with expressive interactions**.
Preserve the parchment/burgundy/gold and charcoal themes, serif headings, d20
seal, and restrained ornament. This is the user's chosen identity; a third-party
skill's dislike of cream backgrounds, italic headings, or cards is not a reason
to redesign it. Extend the existing visual vocabulary before inventing another.

## Beginner-first UX

Design every workflow for someone who knows neither this application nor D&D.
The interface should make it clear where they are, what they can do next, and
what will happen when they act, without requiring outside instructions.

- Use recognizable navigation and literal action labels: Home, Characters,
  Campaigns, and Dice roller. Profile and sign-out are account controls in the
  top-right header, separate from gameplay navigation. Fantasy identity belongs in
  atmosphere, not at the expense of understanding.
- Explain unfamiliar terms in context, including campaign, party, dungeon master
  (DM), rules edition, health (HP), and armor class (AC). Expand abbreviations and
  use examples where they help; do not assume prior tabletop experience.
- Start with the user's goal: playing with a group or running an adventure.
  Account setup comes first; choosing a rules edition belongs in character or
  campaign creation, with guidance to ask the DM and an explanation of permanence.
- Empty states describe what is missing and the nearby action that gets started.
  A prerequisite should provide a way forward, not only a disabled action.
  Importing a character while joining preserves the invite code and returns to join.
- PDF import is the only new-character entry point in the UI. Do not offer blank
  manual creation or a manual fallback after an import error. Existing sheets and
  imported drafts remain editable.
- Keep explanations near the relevant controls, identify optional fields, and
  distinguish personal sheets from campaign copies and private from shared data.
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
- **Campaigns:** distinguish personal sheets from campaign copies and present
  the DM/player role clearly. Save and restore labels must describe the state
  being saved or replaced. Keep irreversible history separate from editable state.
  The Campaigns page is a saved-adventure library: folio/book-cover cards with
  charcoal covers, restrained original gold line art, serif titles, and parchment
  or charcoal metadata surfaces. Lead with edition, saved title, story summary,
   DM display name and role. Use “In library” or
  “Archived” for library state, never live activity or session-number badges.
   “Open campaign” is a native link to the source overview. Use the source title
   and player-safe synopsis, never the old shared journal summary. Explain that opening
  does not start a live game; archived entries remain openable and editable under
   existing permissions, but cannot accept new characters. Home retains its layout.
   The overview separates the member-visible profile from DM-only storyline and
   guidance fields. A quiet **Existing play progress** link leads to preserved
   journals, party records, and checkpoints, rather than making them the default view.
   Private **Planning canvas** starts blank, with no map/grid or forced story order.
   A bounded board sits beside a point editor on desktop and stacks above it on
   narrow screens. Numbered 44px markers match a keyboard-selectable point list;
   numbers identify points, not a sequence. Pointer/touch drag, arrow keys, numeric
   percentages, and **Add point at center** offer equivalent editing paths.
   Markers remain visually in bounds at 0/100 percent; only markers suppress touch
   scrolling. Keep explicit save/dirty status, draft-preserving failures, confirmed
   deletion, and confirmed reload/discard near their actions. Source saves update
   the library title and breadcrumbs only after canonical server success.
- **Personal sheet page:** opens read-first with a compact dark identity banner,
  quiet double-line ability plaques, value-first scores, and framed listed core stats.
  Desktop keeps saving throws/senses and skills beside a wide local tabbed reference
  folio; burgundy marks the active tab. Narrow screens stack readable columns and
  wrap tabs into touch-friendly rows. Borrow sheet hierarchy, not branded art or
  red borders. All saved references, legacy text, and unmatched PDF fields remain
  reachable; no modifiers, resources, units, or rules are inferred. Edit character
  enters the editor on the same URL; Cancel editing uses the mounted draft's discard
  guard. Successful saves return to canonical read view and focus Edit character.
  Breadcrumbs are semantic links
  (Home → Characters → saved name), with the last item marked as the current page.
  Save in place and update the canonical identity only after server success.
  Navigation/discard confirmation keeps the draft mounted; Keep editing restores
  focus and browser history. Campaign copies and import review remain dialogs.

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

## Feedback and copy

The signed-out landing page uses an original SVG adventurer's map, compass, and
central d20 seal beside the headline and account actions. Map/entrance motion is
finite, never delays controls, and follows the app motion preference. Below a
compass-style divider, Try your luck is explicitly labeled as a dice roller with
no account required. Keep functional labels literal and map ornament off the text.

Character imports reveal the extracted identity and actual equipment/spell counts
before editing. Inventory uses compact expandable rows, with Undo for removal.
The imported draft has its own scrolling content region and a persistent Add
character footer. Confirmed server success gives a concise character-added message
with an Open character sheet action. These effects honor the app motion setting.
Expanded character references use native disclosure sections for skills, saving
throws, attacks, spells, features, and description. Rows expand for editing;
removal offers Undo. Preserve printed modifiers/markers without implied automatic
calculation. Unknown filled PDF fields remain visible for review, and the sheet
explains that details are party-visible when copied into a campaign.

Fantasy language can give headings personality; actions and errors stay plain.

| State | Good direction |
| --- | --- |
| Empty | “No characters yet. Create your first character.” plus the action |
| Loading | “Loading campaigns…”; keep surrounding layout stable |
| Saving | “Saving…” and prevent duplicate submission |
| Success | “Profile saved.” or “Chapter saved.” announced politely |
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
