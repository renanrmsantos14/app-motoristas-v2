# System Architecture

## App shell

- `src/App.tsx` is the orchestration layer only: state wiring, remote/local side effects, and screen selection.
- `src/app/bootstrap.ts` owns local bootstrap concerns: mock-backed initial store, deep-link params, draft key generation, and pending-detail resolution.
- `src/app/navigation.ts` owns screen depth, motion presets, and auto-refresh eligibility rules.
- `src/app/detailFlow.ts` owns service receive/voucher/finalize routing rules and receive-proof checks.

## Expenses domain

- `src/lib/expenses.ts` is a barrel only. Keep feature consumers importing from it.
- `src/lib/expenses.types.ts` owns the domain contracts.
- `src/lib/expenses.defaults.ts` owns local fallback catalogs used before Dataverse reference data loads.
- `src/lib/expenses.reference.ts` owns lookup, search, parsing, validation, and field normalization.
- `src/lib/expenses.payload.ts` owns Dataverse payload assembly only.

## Refactor guardrails

- When `src/App.tsx` grows, extract pure rules/helpers into `src/app/*` first instead of adding more top-level utilities there.
- When expense behavior changes, prefer updating `expenses.reference.ts` or `expenses.payload.ts` instead of branching logic inside screens.
- Run `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`, `npm test`, and `npm run build` after structural changes.
