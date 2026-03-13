# AGENTS.md

This file is for agentic coding tools working in `mcsr-pb-display`.

## Repo Snapshot

- Package manager: `bun` (usually the latest version)
- Monorepo with `packages/api` and `packages/extension`
- API: Elysia + Drizzle + libsql/Turso + Wrangler
- Extension: Svelte 5 + Vite + UnoCSS + shadcn-svelte
- Lint/format authority: root `eslint.config.js`
- Editor defaults live in `.vscode/settings.json`

## Rule Files

- No `.cursorrules`
- No `.cursor/rules/`
- No `.github/copilot-instructions.md`
- Follow repo config and existing source patterns instead
- If those files are added later, update this document too

## Important Paths

- `package.json` - root scripts and workspaces
- `packages/api/package.json` - API scripts
- `packages/extension/package.json` - extension scripts
- `packages/api/.env.example`
- `packages/extension/.env.example`
- `packages/api/src/db/schema.ts` - Drizzle schema
- `packages/api/src/types/user.ts` - shared response types
- `packages/api/src/index.ts` - main worker/app entry
- `packages/extension/src/popup.ts` - popup entry
- `packages/extension/src/content/index.ts` - content script entry
- `packages/extension/src/Popup.svelte` - popup root

## Setup

- Install from repo root with `bun install`
- Do not commit `.env*` files or `*.db`; they are gitignored
- API local env is derived from `packages/api/.env.example`
- Extension local env is derived from `packages/extension/.env.example`
- API requires `DATABASE_URL_LOCAL`, `DATABASE_AUTH_TOKEN`, `AUTH_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
- Optional API proxy vars: `MC_API_OVERRIDE`, `PROXY_TOKEN`
- Extension requires `VITE_API_URL`
- API chooses local vs remote DB by `NODE_ENV === 'development'`

## Commands

### Root

- Lint everything (auto-fixes): `bun run lint`
- Update dependencies: `bun run update`
- There is no root build or test script

### Extension (`packages/extension`)

- Dev watch build: `bun run dev` (don't run, suggest at max)
- Production build: `bun run build` (don't run, suggest at max)
- Type/Svelte check: `bun run check`

### API (`packages/api`)

- Dev server with watch: `bun run dev` (don't run, suggest at max)
- Local preview via Wrangler: `bun run preview` (don't run, suggest at max)
- Drizzle CLI passthrough: `bun run db` (don't run, suggest at max)
- Push schema directly: `bun run db push` (don't run, suggest at max)
- Open Drizzle Studio: `bun run db studio` (don't run, suggest at max)

### Tests

- No `*.test.*` or `*.spec.*` files are checked in today
- No Vitest/Jest/Playwright config exists
- Don't test

## Verified Status

- `bun run build` succeeds in `packages/extension`
- `bun run check` succeeds in `packages/extension`
- Root `bun run lint` currently fails on existing `e18e/prefer-static-regex` errors in `packages/api/src/util/minecraft.ts` and `packages/api/src/util/url.ts`
- Do not assume those existing lint failures were caused by your change

## Formatting

- ESLint, not Prettier, is the formatter here
- `.vscode/settings.json` disables Prettier and format-on-save
- `source.fixAll.eslint` is `explicit`
- `source.organizeImports` is `never`
- Use 2-space indentation
- Use single quotes
- Omit semicolons
- Keep trailing commas in multiline literals and parameter lists
- Preserve existing blank-line grouping and ASCII usage; do not reflow files gratuitously
- Comment non-obvious behavior only; avoid narrating obvious code
- Run lint after stylistic edits because `eslint --fix` is authoritative

## Imports

- Prefer `import type` for type-only imports
- Usual order is: type imports, Node built-ins, third-party packages, local imports
- Separate logical groups with one blank line
- In extension code, prefer `$lib` and `@api` aliases over long relative paths
- In API code, relative imports are the common pattern
- Do not auto-organize imports blindly; the editor settings intentionally avoid it
- Preserve manual ordering when touching a file unless a clear cleanup is needed

## Types

- Both packages compile with `strict: true`; keep new code fully type-safe
- Prefer new code in TypeScript even though the extension enables `allowJs` and `checkJs`
- Prefer `interface` for exported object shapes and API payloads; prefer `type` for unions and helper compositions
- Add explicit types on exported functions, stores, and reusable helpers
- Avoid `any`; narrow unknown external JSON immediately
- Reuse shared API types from `packages/api/src/types` instead of redefining shapes
- Use `null` for intentionally absent serialized response data, and `undefined` for optional internal state or cache misses

## Naming

- Use `camelCase` for variables, functions, and object properties
- Use `PascalCase` for components, interfaces, types, and classes
- Use `UPPER_SNAKE_CASE` for true constants
- Use uppercase snake case for env vars
- Svelte component filenames stay `PascalCase.svelte`
- Drizzle tables use `PascalCase` objects like `Users`
- DB columns stay snake_case in SQL while TS properties stay camelCase
- Lowercase Twitch logins before comparing, caching, or persisting them

## Control Flow And Error Handling

- Prefer early-return guard clauses for invalid params, missing auth, and bad payloads
- Single-line guards without braces are common and accepted; use braces for multi-line or nested branches
- Wrap third-party network calls in `try/catch` when failure is a real branch
- Use `AbortController` and timeouts around remote fetches that can hang
- Clear timers and controllers in `finally`
- Use `console.error` for unexpected operational failures; `no-console` is only a warning
- Convert recoverable UI failures into user-facing messages
- Prefer graceful degradation and stale cached data over blank states when possible
- Use `void` for intentional fire-and-forget async work and catch inside that branch

## Backend Conventions

- Follow the fluent Elysia chaining style used in `packages/api/src/index.ts` and `packages/api/src/user.ts`
- Keep route/plugin singletons short and lowercase (`auth`, `user`, `db`)
- Keep cache invalidation close to mutations such as link/unlink flows
- Respect existing throttling helpers before adding new ranked, Twitch, Xbox, or Minecraft API calls
- Keep API response messages short and specific
- Preserve response shapes unless you update both API and extension together
- Keep shared contract changes synchronized with `UserResponse` and `RankedInfo`

## Frontend And Extension Conventions

- Use Svelte 5 runes (`$state`, `$derived`, `$props`, snippets`) instead of mixing old patterns unless necessary
- Keep popup/content entry files thin and move reusable logic into helpers, stores, or components
- Reuse existing utilities like `formatTime`, `cn`, `Button`, and `Card`
- Use the existing `browser` shim pattern in entry files when `browser` may be undefined at build time
- Be careful with Twitch DOM mutation code: avoid duplicate badge injection and keep handled markers intact
- Prefer inline UnoCSS utility classes over custom CSS unless custom CSS clearly improves clarity
- Match the existing popup UI style rather than introducing a new design language

## Working Rules For Agents

- Read relevant documentations for tools and libraries before in use
- Inspect the relevant `package.json` before assuming a script exists
- Prefer small, targeted changes that match nearby code
- Do not edit generated output in `dist`, `build`, or similar folders
- Update `.env.example` files if you introduce a required env var
- Make sure to use the current caching and throttling helpers for new features
- If Cursor or Copilot rule files are added later, mirror them here
