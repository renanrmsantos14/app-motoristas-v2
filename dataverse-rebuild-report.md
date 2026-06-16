# Dataverse Rebuild Report

Status: schema `_v2` criado e validado no DEV. Refs tecnicas do app trocadas para os novos `EntitySetName`.

## Tabelas antigas

- `cr40f_anexorecebimento`
  - EntitySetName: `cr40f_anexorecebimentos`
- `cr40f_anexocolisao`
  - EntitySetName: `cr40f_anexocolisaos`
- `cr40f_colisao`
  - EntitySetName: `cr40f_colisaos`

## Tabelas novas

- `cr40f_anexorecebimento_v2`
  - EntitySetName: `cr40f_anexorecebimento_v2s`
  - PrimaryIdAttribute: `cr40f_anexorecebimento_v2id`
- `cr40f_anexocolisao_v2`
  - EntitySetName: `cr40f_anexocolisao_v2s`
  - PrimaryIdAttribute: `cr40f_anexocolisao_v2id`
- `cr40f_colisao_v2`
  - EntitySetName: `cr40f_colisao_v2s`
  - PrimaryIdAttribute: `cr40f_colisao_v2id`

Criacao executada no DEV por script de console autenticado. Resultado validou tabelas, colunas, relacionamentos, form, view e labels de choice.

## Campos antigos principais

- `cr40f_anexorecebimento`: `cr40f_dataenvio`, `cr40f_enviadopor`, `cr40f_nome`, `cr40f_nomearquivo`, `cr40f_observacao`, `cr40f_ordem`, `cr40f_reserva`, `cr40f_sharelink`, `cr40f_status`, `cr40f_tipo`, `cr40f_tipomidia`, `cr40f_urlsharepoint`
- `cr40f_anexocolisao`: `cr40f_colisao`, `cr40f_dataenvio`, `cr40f_enviadopor`, `cr40f_nome`, `cr40f_nomearquivo`, `cr40f_ordem`, `cr40f_sharelink`, `cr40f_status`, `cr40f_tipo`, `cr40f_tipomidia`, `cr40f_urlsharepoint`
- `cr40f_colisao`: `cr40f_datahora`, `cr40f_descricao`, `cr40f_houveterceiro`, `cr40f_local`, `cr40f_motorista`, `cr40f_nome`, `cr40f_statusanexo`, `cr40f_statusoperacional`, `cr40f_terceirodocumento`, `cr40f_terceironome`, `cr40f_terceiroobservacao`, `cr40f_terceiroplaca`, `cr40f_terceiroseguradora`, `cr40f_terceirotelefone`, `cr40f_terceiroveiculo`, `cr40f_tipoocorrencia`, `cr40f_veiculo`

## Campos novos

Criados conforme [create-collision-v2-schema.console.js](/C:/Users/mendo/Desktop/vscode/App%20Motoristas/scripts/create-collision-v2-schema.console.js).
Observacao: campos internos mantidos com nomes antigos sempre que possivel; sufixo `_v2` ficou nas tabelas novas.

## Choices recriados

Recriados e validados no DEV. Valores e labels esperados bateram no resultado `collision-v2-schema-result-2026-06-16T14-55-34-548Z.json`.

## Referencias antigas encontradas

Arquivo completo: `backup/code-references-before.txt`.

Refs ativas principais:

- `src/lib/dataverse.ts`
- `src/lib/collisions.ts`
- `src/App.tsx`
- `tests/collisions.test.ts`
- scripts de auditoria/reparo Dataverse
- exports antigos em `tmp/AppBetinhos_*`
- builds em `dist/*`

## Referencias antigas substituidas

Troca feita no runtime em [src/lib/dataverse.ts](/C:/Users/mendo/Desktop/vscode/App%20Motoristas/src/lib/dataverse.ts):

- `cr40f_anexorecebimentos` -> `cr40f_anexorecebimento_v2s`
- `cr40f_anexocolisaos` -> `cr40f_anexocolisao_v2s`
- `cr40f_colisaos` -> `cr40f_colisao_v2s`
- mapa de logical name alinhado para `cr40f_anexorecebimento_v2`, `cr40f_anexocolisao_v2`, `cr40f_colisao_v2`

Mapa consolidado salvo em [dataverse-name-map.json](/C:/Users/mendo/Desktop/vscode/App%20Motoristas/dataverse-name-map.json).

## Validacoes locais

- `npm test`: passou, 42/42 testes.
- `npm run build`: passou, gerou `dist/webresource-app-motoristas.html` versao `2.1.280`.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: falhou por erros preexistentes fora deste patch:
  - `src/screens/ReceiptScreen.tsx`: `detail` declarado e nao usado
  - `src/screens/VoucherScreen.tsx`: incompatibilidade de tipo em `ref`

## Riscos restantes

- Dados antigos ainda nao foram migrados para as tabelas `_v2`.
- Qualquer flow, plugin, JS externo, view/app model-driven ou automacao fora deste repo ainda pode apontar para nomes antigos.
- `pac` nao esta disponivel no PATH para auditoria/export automatizada de solution.

## Proximos passos para deploy

1. Rodar validacoes locais do app.
2. Migrar/copiar dados antigos para `_v2`, se este app ainda precisar ler historico.
3. Exportar `Betinhos_Core_Clean`.
4. Auditar solution exportada para garantir que forms/views/relationships `_v2` vieram no pacote.
5. Revisar flows/plugins/webresources externos para trocar refs antigas restantes.
