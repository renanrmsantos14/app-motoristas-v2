# App Motoristas

Reconstrução web do App Betinhos Motoristas em `React + TypeScript + Vite`.

## Objetivo

- Desenvolver em stack moderna
- Publicar um único arquivo HTML para Web Resource
- Aproximar o visual e os fluxos do export `.pa.yaml`

## Comandos

```bash
npm install
npm run build
```

## Saída final

- `dist/webresource-app-motoristas.html`

## Observação

Fidelidade total ao runtime do Canvas App não existe fora do Canvas.  
Esta base busca a maior semelhança possível em layout, navegação e fluxo.

## Dataverse

O app usa `Xrm.WebApi` quando aberto como Web Resource no Model-driven/Power Apps.

Tabelas custom usadas:

- `cr40f_reservadeveculoses` (`Geral`)
- `cr40f_funcionarioses` (`Funcionarios`)
- `cr40f_manutencoeses` (`Manutencoes`)
- `cr40f_trocasdecarros` (`Trocas de Carro`)
- `new_possedeveiculos` (`Posse de Veiculo`)
- `cr40f_servicosporpassageiros` (`Servicos por Passageiro`)

Campos custom usados seguem a regra: somente `cr40f_*` e `new_*`.

## Flows

O React Web Resource nao consegue chamar diretamente o conector Canvas `shared_logicflows`.
Para producao, exponha os fluxos como trigger HTTP ou Custom API e configure:

```env
VITE_FLOW_GERAR_VOUCHER_URL=https://...
VITE_FLOW_SALVAR_FOTOS_MANUTENCAO_URL=https://...
```

Payload `VITE_FLOW_GERAR_VOUCHER_URL`:

- `text`: GUID Geral
- `text_1`: assinatura passageiro
- `text_2`: desvio
- `text_3`: km inicial
- `text_4`: km final
- `text_5`: horario inicial
- `text_6`: espera inicial
- `text_7`: espera final
- `text_8`: pedagio
- `text_9`: estacionamento
- `text_10`: combustivel
- `text_11`: hospedagem
- `text_12`: outros
- `text_13`: observacao
- `text_14`: horario final
- `text_15`: data da assinatura

Payload `VITE_FLOW_SALVAR_FOTOS_MANUTENCAO_URL`:

- `text`: GUID Geral
- `text_1`: foto nota fiscal
- `text_2`: foto 1
- `text_3`: foto 2
- `text_4`: foto 3

## Debug

Logs de conexao e operacoes Dataverse aparecem no console com prefixo:

```txt
[AppMotoristas:Dataverse]
```
