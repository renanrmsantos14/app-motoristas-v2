# Receipt Rebuild Report

Status: receipt `_v2` criado e validado no DEV. Runtime unificado para gravar apenas em `cr40f_recibos_v2`.

## Tabelas novas

- `cr40f_recibopersonalizado_v2`
  - EntitySetName: `cr40f_recibopersonalizado_v2s`
  - PrimaryIdAttribute: `cr40f_recibopersonalizado_v2id`
- `cr40f_recibos_v2`
  - EntitySetName: `cr40f_recibos_v2s`
  - PrimaryIdAttribute: `cr40f_recibos_v2id`

## Decisao de unificacao

No source live, a funcionalidade de recibo ja gravava apenas em `DATAVERSE.recibos`.
Nao existe uso runtime de uma entidade `cr40f_recibopersonalizado`.

Unificacao aplicada:

- `DATAVERSE.recibos` -> `cr40f_recibos_v2s`
- logical name runtime -> `cr40f_recibos_v2`

Tela/rota `reciboPersonalizado` continua existindo como nome funcional da UX, mas persiste na tabela unica `cr40f_recibos_v2`.

## Validacao do resultado enviado

Arquivo validado: `receipt-v2-schema-result-2026-06-16T16-55-19-427Z.json`

Confirmado:

- `cr40f_recibopersonalizado_v2s`
- `cr40f_recibos_v2s`
- choice `cr40f_status_geracao` com labels:
  - `100000000` -> `Gerado`
  - `100000001` -> `Salvo no OneDrive`
  - `100000002` -> `Falha`

## Arquivos gerados

- [create-receipt-v2-schema.console.js](/C:/Users/mendo/Desktop/vscode/App%20Motoristas/scripts/create-receipt-v2-schema.console.js)
- [receipt-name-map.json](/C:/Users/mendo/Desktop/vscode/App%20Motoristas/receipt-name-map.json)

## Riscos restantes

- `AppBetinhos` ainda pode carregar componentes antigos `cr40f_recibopersonalizado` e `cr40f_recibos`.
- Flows, apps model-driven, sitemap e views fora deste repo ainda podem apontar para tabelas antigas.

## Proximo passo recomendado

1. Publicar webresource com runtime apontando para `cr40f_recibos_v2`.
2. Revisar/exportar solution sem depender de `cr40f_recibopersonalizado`.
3. Opcional: apagar legado de recibo para sobrar apenas `cr40f_recibos_v2`.
