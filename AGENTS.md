# dndharness

This project is a locally run application for friends and family to play
through a D&D campaign. Read README.md for current setup and usage.
Read `docs/product.md` for audience, LAN-hosted play intent, compatibility goals,
agreed domain relationships, and scope. It distinguishes product goals from
implemented capabilities; `docs/design.md` records the approved experience.

## Project status

The frontend uses React, Vite, plain JavaScript, and npm. See README.md for
development and build commands. The API uses Express and PostgreSQL, with
versioned SQL migrations and an open shared campaign workspace. Live sessions use
browser capabilities and in-memory presence. Docker Compose runs all three.
Confirm major architecture and dependency choices with the user before adding them.
This is an npm-workspace monorepo: runnable apps live in `apps/`, and shared
packages belong in `packages/` when multiple apps need them. Install from the
root using the single root lockfile. Keep runtime configuration separate from
local tooling so each app can later be containerized independently.

## Design principles

- Start with the smallest working feature and expand only when needed.
- Keep edition-specific content in data, separate from shared UI and campaign state.
- Use stable edition IDs; derive edition options from data rather than UI conditionals.
- Add edition-specific rule logic only when real gameplay requires it. Metadata
  selection alone does not constitute support for an edition's gameplay rules.
- Prefer small, composable pieces. Avoid speculative engines, plugin systems,
  generic abstraction layers, and dependencies without a current use case.

## Development

- Keep changes focused on the requested feature and preserve unrelated work.
- Prefer local operation; ask before introducing hosted services.
- Keep credentials and personal campaign data out of Git.
- Update the README when setup or usage changes.
- Use `verification` to select focused checks and report acceptance-linked evidence.
  `npm run test:web` runs existing Node logic tests; `npm run build` checks frontend
  builds. No component test runner or lint tool is configured. API checks and
  database/browser isolation requirements are defined in that skill; never run
  destructive checks against campaign data. Use `regression-debugging` for failures.
- For frontend appearance or interaction changes, load the `frontend-review`
  skill and inspect the running app with `npm run browser -- ...`. Read captured
  screenshots as images; a successful build alone is not visual verification.
- Browser tooling is a root development dependency, not a web runtime dependency.
  Keep browser artifacts and profiles out of Git.
- Use `web-feature` for nontrivial web features and `ui-quality` for UI controls,
  forms, responsive layouts, and interaction quality. The approved visual and
  motion conventions are in `docs/design.md`.
- For substantial features with separable aspects, load `feature-dispatch` and
  use focused agents in parallel when available. Agree shared contracts and
  exclusive file ownership first; the coordinating agent owns integration and
  final verification. Small or inseparable edits stay with one implementer.
  The default `dispatcher` is read-only and delegates all edits and runtime
  checks, including integration and documentation. Workers follow their scoped
  assignment without spawning more agents; they do not re-dispatch the feature.
- For nontrivial changes to accounts, permissions, migrations, campaign saves,
  or shared controls, use one independent `app-reviewer` pass when available.
  Give it the acceptance criteria, scope, and verification evidence. Small edits
  need only focused self-review; avoid overlapping implementation agents.

## OpenCode

OpenCode automatically loads this file. Repository settings are in
opencode.json; authenticate GitHub Copilot through `/connect`, not through
credentials in tracked files. Select an available model with `/models`.
The project-local `/small-feature` and `/dispatch-feature` commands live in
`.opencode/commands/`. The default `dispatcher` primary agent coordinates work
using the `feature-dispatch` skill and existing focused subagents; it cannot
edit files and only has narrow Git-inspection shell access.
The frontend review skill lives in `.opencode/skills/frontend-review/`.
Additional skills are `ui-quality`, `web-feature`, `verification`, and
`regression-debugging`; the read-only reviewer is
`.opencode/agents/app-reviewer.md`. Restart OpenCode after editing these files.

Use the repo-local CLI installed by scripts/install-opencode.ps1. Its version
and archive checksum are pinned; do not enable automatic updates or commit
the downloaded executable. See README.md for setup and PATH behavior.
