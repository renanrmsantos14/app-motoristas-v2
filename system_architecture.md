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

## Trocas e posse de veiculos

- O ciclo operacional escreve por Custom APIs: `new_RegistrarTrocaDeCarro`, `new_AtualizarTrocaDeCarro`, `new_ConfirmarTrocaMotorista`, `new_ConcluirTrocaDeCarro`, `new_CancelarTrocaDeCarro` e `new_ReverterTrocaDeCarro`.
- `new_RegistrarTrocaDeCarro` cria troca/Geral e conclui a operacao imediata na mesma transacao. A chave `new_idempotencykey` e o `new_requesthash` protegem reenvios.
- `ExchangeConflictValidator` valida janela e sobreposicao no PreValidation. `ExchangePossessionFinalizer` rejeita lacuna com `POSSESSION_CHAIN_GAP`; nao cria posse sintetica.
- `LifecycleAuthorization` aceita mutacoes internas apenas quando existe uma Custom API conhecida na cadeia de contexto. Escrita direta e delete continuam bloqueados.
- Edicao, confirmacao, cancelamento e reversao carregam RowVersion antes do comando. Divergencia retorna `EXCHANGE_CONCURRENCY_CONFLICT` sem sobrescrita.
- A Tela Operacional nao permite forcar conflito, preserva o snapshot de veiculos da troca e coleta motivo/data efetiva em dialogo auditavel.
- O App Motoristas confirma o participante autenticado pela API, pagina consultas e exige funcionario ativo. Codigos de dominio viram mensagens seguras.
- Fotos e assinaturas de rascunho ficam no IndexedDB por ate sete dias, limitadas a 25 MB. `localStorage` recebe apenas o estado sem blobs/base64.
- O pipeline `scripts/push-dev.ps1` exporta backup antes do deploy e bloqueia a publicacao se testes, TypeScript, builds, testes .NET ou validacao final falharem.
