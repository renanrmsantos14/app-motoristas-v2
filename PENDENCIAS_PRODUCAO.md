# Pendencias para o App Motoristas ficar 100% producao

## Estado atual

O app ja tem uma base funcional de integracao Dataverse via `Xrm.WebApi`.

Implementado:

- Leitura remota de agenda e historico.
- Resolucao do motorista atual por `systemuser` e `cr40f_funcionarios`.
- Carga de servicos, manutencoes e trocas.
- Passageiros por `cr40f_servicosporpassageiros` e `cr40f_bancodedados`.
- Finalizacao de servico simples.
- Finalizacao por voucher via Flow HTTP.
- Rascunho de voucher em `new_rascunhovoucher`.
- Cancelamento no local como `Requer Analise`.
- Finalizacao de manutencao com Flow de fotos.
- Status real de manutencao como `Realizado = 202410002`.
- Finalizacao de troca e tentativa de atualizar posse de veiculo.
- Trava de fila: so finaliza o primeiro item pendente.
- Logs de debug com prefixo `[AppMotoristas:Dataverse]`.

Evidencia local:

- Auditoria de selects custom: OK.
- Auditoria de campos custom de escrita: OK.
- `systemuser` nao aparece no JSON custom, mas funcionou no console real.

## Bloqueadores para declarar 100%

### 1. Build ainda nao foi gerado

O source foi corrigido, mas o Dataverse so usa o bundle publicado.

Comando real:

```bash
npm run build
```

Saida esperada:

```txt
dist/webresource-app-motoristas.html
```

Sem isso, o Dataverse pode continuar rodando versao antiga com erros ja corrigidos.

### 2. Web Resource precisa ser atualizado no Dataverse

O console mostra uso de:

```txt
new_app-motoristas-v2
```

Precisa publicar o HTML gerado como esse Web Resource ou confirmar o nome correto atual.

Checklist:

- Gerar `dist/webresource-app-motoristas.html`.
- Subir o HTML no Web Resource correto.
- Publicar customizacoes.
- Limpar cache/abrir com cache bust.
- Confirmar no console que o bundle novo carregou.

### 3. URLs dos Flows precisam estar configuradas

Variaveis obrigatorias:

```env
VITE_FLOW_GERAR_VOUCHER_URL=https://...
VITE_FLOW_SALVAR_FOTOS_MANUTENCAO_URL=https://...
```

Sem elas:

- Voucher nao finaliza.
- Manutencao nao envia fotos.

### 4. Flows HTTP precisam aceitar chamada do Web Resource

Validar nos Flows:

- Trigger HTTP ou Custom API publicado.
- Metodo `POST`.
- Body JSON.
- Permissao/auth compativel com Web Resource.
- Retorno JSON.
- Sem bloqueio de CORS se for URL HTTP direta.

Retorno esperado:

Voucher:

- Pode retornar `{ "id": "..." }` ou objeto sem status.
- Se retornar `status`, deve ser `Sucesso`, `success` ou `ok`.

Fotos manutencao:

- Deve retornar `status: "Sucesso"`.
- Pode retornar links:
  - `new_linkdanotafiscal`
  - `new_linkdafotofinal1`
  - `new_linkdafotofinal2`
  - `new_linkdafotofinal3`

### 5. Teste real no Dataverse ainda falta

Precisa testar em producao ou ambiente real:

- Abrir Web Resource.
- Conferir carga da agenda.
- Conferir servicos Tenaris/Tennaris com botao voucher.
- Conferir servicos nao Tenaris com botao finalizar.
- Abrir detalhes.
- Marcar visualizacao.
- Salvar rascunho voucher.
- Finalizar voucher.
- Finalizar servico simples.
- Cancelar no local.
- Finalizar manutencao com fotos.
- Finalizar troca por motorista 1.
- Finalizar troca por motorista 2.
- Confirmar posse do veiculo.
- Conferir historico.

### 6. Build/testes automatizados nao foram rodados

Comandos pendentes:

```bash
npm run build
npm test
```

Riscos sem isso:

- Erro TypeScript.
- Erro de encoding.
- Erro de bundle single-file.
- Regressao em validacoes locais.

## Riscos tecnicos restantes

### 1. Navigation properties de `@odata.bind`

Campos usados:

```txt
cr40f_Realizado_por_nome@odata.bind
new_Veiculo@odata.bind
new_TrocadeCarroRelacionada@odata.bind
new_Motorista@odata.bind
```

Risco:

- O logical name do campo existe, mas o nome da navigation property pode divergir.

Como validar:

- Finalizar manutencao real.
- Finalizar troca real.
- Se der erro, console deve mostrar `message` e `errorCode`.

### 2. Posse de veiculo precisa teste real

Logica implementada:

- Troca: fecha posses dos dois motoristas e cria posses invertidas.
- Retirada da base: fecha posse base do veiculo 2 e cria posse para motorista 1.
- Devolucao a base: fecha posse do motorista 1 e cria posse do veiculo 1 sem motorista.

Risco:

- Regra operacional pode precisar ajuste fino conforme dados reais.
- Duplicidade de posse pode depender de outro campo obrigatorio nao mapeado.

### 3. Historico de manutencao depende de status da OM

Regra atual:

- Agenda esconde manutencao `Realizado`.
- Historico mostra manutencao `Realizado`.

Isso replica o YAML.

Risco:

- Se o Flow de fotos falhar, o app nao marca `Realizado`.
- Isso e intencional para evitar sumir da agenda com upload quebrado.

### 4. Cache do Model-driven pode mascarar correcao

Mesmo apos publicar:

- Service worker pode servir HTML antigo.
- Browser pode manter cache.
- Power Apps pode demorar a refletir publicacao.

Mitigacao:

- Usar hard refresh.
- Limpar cache.
- Abrir em aba anonima.
- Confirmar no console se logs novos aparecem.

### 5. `systemuser` nao entra no JSON custom

Auditoria local acusa:

```txt
current user systemuser
missing: internalemailaddress, fullname
```

Isso e falso positivo porque `systemuser` e tabela padrao fora do export custom.

Evidencia real:

- Console retornou `internalemailaddress` e `fullname`.

## Checklist de conclusao

Para declarar objetivo atingido:

- `npm run build` passa.
- `npm test` passa ou riscos sao aceitos explicitamente.
- `dist/webresource-app-motoristas.html` gerado.
- Web Resource correto atualizado.
- App abre no Dataverse sem erro de console bloqueante.
- Agenda carrega do Dataverse.
- Historico carrega do Dataverse.
- Voucher finaliza e grava status.
- Servico simples finaliza e grava status.
- Cancelamento grava `Requer Analise`.
- Manutencao grava dados, chama Flow, grava links/status e atualiza Geral.
- Troca grava motorista atual.
- Troca concluida pelos dois motoristas atualiza posse.
- Logs de debug mostram operacoes com sucesso.

## Proximo melhor passo

Rodar:

```bash
npm run build
```

Depois publicar o HTML gerado no Web Resource `new_app-motoristas-v2` e testar novamente pelo console.
