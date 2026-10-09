# Shared packages

Put a shared package here only when multiple apps need it. Each package should
have its own `package.json` with a unique `@dndharness/` name. npm workspaces
links these packages during installation from the repository root.

Edition metadata is stored in PostgreSQL and served by `apps/api`. Shared
code should be extracted only when another app actually needs it.
