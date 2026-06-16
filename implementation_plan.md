# Plano: rebuild Dataverse `_v2`

Status: bloqueado antes de alteracao DEV.

## Evidencia ja coletada

- MCP Dataverse encontrou as tabelas antigas:
  - `cr40f_anexorecebimento`
  - `cr40f_anexocolisao`
  - `cr40f_colisao`
- MCP confirmou que as tabelas `_v2` ainda nao existem:
  - `cr40f_anexorecebimento_v2`
  - `cr40f_anexocolisao_v2`
  - `cr40f_colisao_v2`
- Export antigo disponivel:
  - `tmp/AppBetinhos_165_unpacked_check/customizations.xml`
  - `tmp/AppBetinhos_164_unpacked/customizations.xml`
- `pac` nao apareceu no PATH.
- Auth Web API via `MSAL.PS` silencioso travou em 20s.
- MCP atual nao expoe leitura de dados (`read_query`) nem operacoes de solution/export/publish.

## Backups criados

- `backup/dataverse-schema-before.json`
- `backup/dataverse-choices-before.json`
- `backup/dataverse-relationships-before.json`
- `backup/dataverse-data-before.json`
- `backup/code-references-before.txt`

## Bloqueio

Nao executar criacao de tabelas ainda. A instrucao exige exportar registros antigos se houver dados antes de qualquer alteracao. Nesta sessao nao ha ferramenta funcional para ler/exportar registros:

- MCP Dataverse exposto: `search`, `describe`, `create_table`, `update_table`, `create_record`, `update_record`, deletes.
- Sem `read_query`/data query.
- Sem `pac`.
- Token Web API nao foi obtido silenciosamente.

## Execucao quando desbloquear auth/dados

1. Exportar registros de:
   - `cr40f_anexorecebimentos`
   - `cr40f_anexocolisaos`
   - `cr40f_colisaos`
2. Atualizar `backup/dataverse-data-before.json` com dados reais.
3. Criar ou validar solution limpa `Betinhos_Core_Clean`.
4. Criar as tabelas em DEV:
   - `cr40f_colisao_v2`
   - `cr40f_anexorecebimento_v2`
   - `cr40f_anexocolisao_v2`
5. Recriar colunas e choices com labels pt-BR/base language e valores numericos preservados.
6. Criar relacionamentos:
   - `cr40f_colisao_v2` -> `cr40f_anexocolisao_v2`
   - `cr40f_reservadeveculos` -> `cr40f_anexorecebimento_v2`
   - `cr40f_funcionarios` -> `cr40f_colisao_v2`
   - `cr40f_veiculos` -> `cr40f_colisao_v2`
   - `cr40f_funcionarios` -> anexos via `cr40f_enviadopor`
7. Publicar customizacoes.
8. Recuperar metadata das tabelas novas e confirmar `EntitySetName` real.
9. Gerar `dataverse-name-map.json` com EntitySetName real.
10. Trocar referencias tecnicas no source vivo:
    - `src/lib/dataverse.ts`
    - `src/lib/collisions.ts`
    - `src/App.tsx`
    - `tests/collisions.test.ts`
    - scripts/artefatos relevantes
11. Rodar:
    - `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`
    - `npm test`
    - `npm run build`
12. Exportar solution limpa e auditar `customizations.xml` para options sem labels.

