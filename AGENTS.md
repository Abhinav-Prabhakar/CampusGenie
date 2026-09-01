<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repository Guidelines

## Project Structure & Module Organization

Campus Genie is a focused Next.js App Router application. The Navigator UI and route handlers live in `src/app/`; the Databricks REST adapter, Genie conversation logic, and opportunity normalization live in `src/lib/`. Lakehouse provisioning and synthetic SQL data are in `backend/`, while deterministic adapter and golden-question tests are in `tests/`. Before changing Next.js APIs or conventions, consult the matching guide in `node_modules/next/dist/docs/` as required above.

## Build, Test, and Development Commands

- `npm ci` installs the locked dependency set from `package-lock.json`.
- `npm run dev` starts the local Next.js development server.
- `npm run build` creates a production build and catches type or integration errors.
- `npm run start` serves the completed production build.
- `npm run lint` runs ESLint with Next.js and TypeScript rules.
- `npm test` runs the Node test suite with TypeScript stripping.

## Coding Style & Naming Conventions

Use TypeScript with strict-mode-compatible types, React functional components, and two-space indentation. Use PascalCase for components, camelCase for utilities, and Next.js filenames such as `page.tsx` and `route.ts`. Prefer the configured `@/` alias for imports from `src/`. Keep credentials and Databricks HTTP access in server route or data-layer modules.

## Testing Guidelines

Tests use Node’s built-in test runner. Name files `tests/*.test.mjs`; import pure TypeScript modules directly and inject `fetch` into the Databricks client. Before submitting, run `npm run lint`, `npm test`, and `npm run build`, then manually verify the core question, one refinement, an empty result, and the unavailable state.

## Commit & Pull Request Guidelines

Write short, imperative commit subjects. Existing history uses both plain subjects (`Resolve Databricks CLI for Genie auth`) and Conventional Commit prefixes (`feat: add ...`); use `feat:`, `fix:`, or `docs:` when helpful. Pull requests should explain the user-visible impact, list verification performed, link relevant issues, and include screenshots or recordings for UI changes.

## Security & Configuration

Keep Databricks hosts, tokens, Genie space IDs, and other credentials in `.env.local`; never commit secrets. Document new environment variables with safe placeholders and avoid logging authentication values or student data.
