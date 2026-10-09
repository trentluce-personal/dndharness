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

## Feedback and copy

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
