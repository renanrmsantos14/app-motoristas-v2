# Auditoria App Motoristas - 2026-06-11

Escopo: codigo React/TypeScript atual, fluxos Dataverse/Flow, tabelas referenciadas, UX/acessibilidade por implementacao, build/deploy e residuos de producao.

Status atualizado apos execucao de correcoes prioritarias:

- `npm.cmd test`: 38 testes passaram.
- `npx.cmd tsc --noEmit`: passou.
- `npm run build`: nao rodado, porque `scripts/build-react-singlefile.cjs` regrava `dist` e incrementa versao por padrao.

Correcoes aplicadas nesta etapa:

- Detalhes nao usam mais `dangerouslySetInnerHTML`; parser seguro permite texto, `<br>` e links `http(s)`.
- Uploads de despesa, colisao e manutencao esperam todos os arquivos com `Promise.allSettled` antes de status completo/parcial/falha.
- Captura de video revoga `blob:` temporario; previews passam a usar URL criada/revogada pela tela de preview.
- Persistencia local nao quebra o app se `localStorage` falhar.
- Reset local usa modal do app e remove somente chaves conhecidas.
- Fallbacks mojibake foram removidos; leitura de campos usa chave normalizada e ainda repara dados legados corrompidos.

Ainda pendente:

- Validar tabelas novas de colisao no Dataverse real.
- Migrar midia local grande para IndexedDB/TTL se o modo local continuar relevante.
- Acessibilidade completa de formularios.
- CSS consolidation e redaction forte do logger.

## Alterar Primeiro

1. Sanitizar HTML em detalhes.
   - Evidencia: `src/components/details/DetailsField.tsx:138` usa `dangerouslySetInnerHTML`.
   - Origem: `src/lib/dataverse.ts:1623` marca passageiros como `html: true`; quando `buildPassengersHtml()` falha ou nao retorna, cai no campo bruto `cr40f_passageirosetelefonedecontato`.
   - Risco: XSS/stored HTML vindo do Dataverse ou dado legado.
   - Alteracao: remover `dangerouslySetInnerHTML`; renderizar passageiros como estrutura React. Para legado, converter apenas quebras de linha/`<br>` permitidos e bloquear `javascript:`, eventos inline e tags fora de allowlist. Criar teste com `<img onerror>` e `javascript:`.

2. Trocar uploads paralelos `Promise.all` por `Promise.allSettled`.
   - Evidencia: despesa em `src/App.tsx:958`, colisao em `src/App.tsx:1080`, solicitacao/manutencao em `src/lib/dataverse.ts:616` e `src/lib/dataverse.ts:2412`.
   - Risco: uma falha rejeita cedo, mas outros uploads continuam; status pode virar falha/parcial antes do resto terminar.
   - Alteracao: esperar todos os arquivos, salvar status completo/parcial/falhou, gravar lista de arquivos que falharam e permitir reenvio.

3. Reduzir risco de midia em memoria/localStorage.
   - Evidencia: `src/App.tsx:463` persiste `store` local com `signatures` e `photos`; `src/screens/MaintenancePhotoScreen.tsx:261` e `:312` criam object URLs; `src/lib/photoOrientation.ts:225` tambem cria blob URL.
   - Risco: quota de localStorage, vazamento de memoria em fluxo com videos, dados sensiveis locais.
   - Alteracao: IndexedDB ou memoria temporaria para midia; TTL/limite de tamanho; revogar object URLs ao substituir, confirmar, apagar e desmontar.

4. Validar tabelas novas de colisao no Dataverse real.
   - Evidencia: `src/lib/dataverse.ts:129-154` referencia `cr40f_colisaos` e `cr40f_anexocolisaos`; `assertCollisionSchemaReadyRemote()` existe em `src/lib/dataverse.ts:1259`.
   - Achado: metadata local `dataverse-metadata-prefix-2026-06-01T11-28-09-842Z.json` e `docs/dataverse-schema-index.json` nao contem `cr40f_colis*`.
   - Alteracao: rodar validacao no ambiente real, atualizar metadata/docs, confirmar navigation properties e choices.

## Alto

5. Trocar reset destrutivo por modal e limpar so chaves do app.
   - Evidencia: `src/screens/InitialScreen.tsx:369` usa `window.confirm`; `:377-378` executa `localStorage.clear()` e `sessionStorage.clear()`.
   - Risco: apaga dados de outras webresources no mesmo origin.
   - Alteracao: modal do design system; `removeItem(STORAGE_KEY)` e chaves conhecidas do logger, nao `clear()`.

6. Melhorar acessibilidade de formularios.
   - Evidencia: varios `<label>` sem `htmlFor/id` em `ExpenseScreen`, `CollisionScreen`, `MaintenanceRequestScreen`, `FinalizeScreen`; erros sem `aria-describedby`.
   - Risco: leitor de tela nao associa campo, erro e instrucao.
   - Alteracao: IDs estaveis, `htmlFor`, `aria-describedby`, foco no resumo de erro, focus trap nos modais.

7. Remover mojibake do source.
   - Evidencia: fallback literals em `src/lib/dataverse.ts:2178-2187`, `:2239` e `src/lib/localWorkflow.ts:138-158`.
   - Risco: contraria regra "zero mojibake"; aumenta gambiarra de chave.
   - Alteracao: normalizar nomes de campos (`normalize("NFD")`, remover acento, lowercase) e mapear por chave canonica.

8. Consolidar CSS.
   - Evidencia: `src/styles.css` tem 8476 linhas e 996 ocorrencias de `!important`; blocos minificados em `src/styles.css:7525-7533`.
   - Risco: ajuste visual vira cascata fragil; mobile quebra por override concorrente.
   - Alteracao: separar por tela/componente, remover patches minificados, criar tokens e classes finais por fluxo.

9. Revisar privacidade do logger.
   - Evidencia: `src/lib/appErrorLogger.ts:206-217` grava URL, referrer e payload; `:323-330` intercepta `console.error`.
   - Risco: log pode capturar dados de passageiro, telefone, paths OneDrive/SharePoint e payload operacional.
   - Alteracao: redaction central para telefone, email, query strings, links SharePoint/Flow, base64 e nomes sensiveis.

10. Atualizar Graphify.
   - Evidencia: `graphify-out/GRAPH_REPORT.md` foi gerado no commit `e4c96a2b`; HEAD atual e `06b76c9488159a964d421ff65a34075aa2294dfb` com muitas alteracoes nao commitadas.
   - Alteracao: regenerar `graphify-out` depois que o diff atual estabilizar.

## Medio

11. Quebrar `App.tsx` e `dataverse.ts`.
   - Evidencia: `src/App.tsx` tem 1850 linhas; `src/lib/dataverse.ts` tem 2509 linhas.
   - Alteracao: extrair hooks/servicos por fluxo: `useRemoteOperation`, `useMediaDrafts`, `useExpenseSubmit`, `useCollisionSubmit`, `useMaintenanceSubmit`, `dataverse/agenda`, `dataverse/media`, `dataverse/schema`.

12. Fortalecer testes de fluxo.
   - Ja cobre: payloads, validacoes, media util, mapa, local workflow.
   - Coberto nesta etapa: sanitize HTML e normalizacao de campo/mojibake.
   - Falta teste automatizado: reset local, allSettled/partial upload, object URL revoke, schema de colisao mockado, erro de Flow com retorno nao JSON, foco/acessibilidade basica.

13. SEO.
   - Aplicabilidade baixa: e webresource de Model-driven, nao site publico.
   - Alteracao minima se for publicar standalone: manifest, meta description, icons finais, noindex quando interno, robots/canonical so se virar site publico.

## Tabelas Referenciadas

- `cr40f_reservadeveculoses`
- `cr40f_funcionarioses`
- `cr40f_veiculoses`
- `cr40f_clientes1s`
- `cr40f_bancodedadoses`
- `cr40f_manutencoeses`
- `cr40f_trocasdecarros`
- `cr40f_servicosporpassageiros`
- `new_possedeveiculos`
- `new_fotomanutencao`
- `cr40f_despesaoperacionals`
- `cr40f_anexodespesaoperacionals`
- `cr40f_categoriadespesaoperacionals`
- `cr40f_formapagamentodespesas`
- `cr40f_colisaos`
- `cr40f_anexocolisaos`
- `systemusers`
- `environmentvariabledefinitions`
- `environmentvariablevalues`

## Ordem Recomendada Restante

1. Validacao Dataverse real para colisao.
2. Testes de upload parcial/status e reset local.
3. IndexedDB/TTL para midia local grande, se o modo local continuar relevante.
4. Acessibilidade de formularios.
5. CSS consolidation.
6. Logger redaction.
7. Refactor controlado de `App.tsx`/`dataverse.ts`.
