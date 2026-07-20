# Repository Guidelines

## Project Structure & Module Organization

This repository contains the App Motoristas React webresource for Power Platform/Dataverse.

- `src/` holds app source. Screens live in `src/screens/`, UI in `src/components/`, flow helpers in `src/app/`, Dataverse/domain logic in `src/lib/`, and shared types in `src/types.ts`.
- `tests/` contains Node test runner specs named `*.test.ts`.
- `scripts/` contains build, deploy, QA, Dataverse schema, and maintenance utilities.
- `public/screens/` stores generated demo screenshots.
- `dist/` is generated output for the single-file webresource; do not edit it manually.
- `docs/`, `system_architecture.md`, and audit files provide context.

## Graphify Context Gate

Before any Codex file or code change, query the existing `graphify-out/graph.json` with Graphify using terms from the requested change. Use the returned nodes and source locations as implementation context. If the Graphify CLI is unavailable or blocked, state the exact reason, inspect the existing graph JSON directly, and only then continue with targeted source reads. Do not rebuild the graph before a change unless it is missing or stale; rebuild it after relevant code changes.

## Build, Test, and Development Commands

- `npm run dev` starts the local dev wrapper.
- `npm test` runs all tests with Node's built-in test runner and TypeScript stripping.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` runs the strict type gate.
- `npm run build` builds the single-file webresource into `dist/`.
- `npm run preview` serves the built output locally.
- `npm run push -- -DeviceCode` deploys to Dataverse when normal auth is blocked.
- `npm run demo:capture` regenerates screenshots in `public/screens/`.

## Coding Style & Naming Conventions

Use TypeScript and React functional components. Keep two-space indentation and prefer explicit domain names. Components use `PascalCase`, hooks/helpers use `camelCase`, and fixed configuration constants use `SCREAMING_SNAKE_CASE`.

Keep Dataverse logical names, Flow payload keys, and choice values exact. Verify schema names from source, metadata, or live Dataverse before changing payloads.

## Testing Guidelines

Tests use `node --test` and live in `tests/*.test.ts`. Name tests after protected behavior, for example `expenses.test.ts` or `media.test.ts`. Add focused coverage for validation rules, Dataverse payload builders, workflow transitions, and camera/media helpers. Before handoff, run `npm test` plus the strict `tsc` command.

## Commit & Pull Request Guidelines

Recent history uses concise imperative messages, often with `feat:`, `fix:`, or `perf:`. Keep commits scoped, for example `fix: preserva selecoes ao voltar da camera`.

Pull requests should include the user-facing change, validation commands, Dataverse/Flow impact, and screenshots for UI changes. Call out generated `dist/` or `public/screens/` updates.

## Security & Configuration Tips

Never commit secrets, tokens, Flow URLs, or personal data. Redact phone numbers, emails, SharePoint links, base64 payloads, and auth headers in logs. Verify environment URLs and webresource names before publishing.
