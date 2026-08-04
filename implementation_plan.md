# Auditoria integral do fluxo de trocas de carro

## Plano aprovado de reconstrução — 03/08/2026

Decisão operacional aprovada:

- agendar nunca movimenta posse;
- conclusão usa horário efetivo informado ou horário atual do servidor;
- registro retroativo só é aceito quando nenhuma transição posterior torna a cadeia impossível;
- concluir a Geral solicita a conclusão completa da Troca; status e posses são gravados na mesma transação;
- conflitos são validados pelos pares exatos motorista-veículo/base-veículo, nunca por correspondência ampla com `OR`.

Arquitetura alvo:

1. Plugin síncrono é a única autoridade para concluir troca e movimentar posse.
2. Criação de Troca garante uma Geral vinculada na mesma transação.
3. Segundo aceite — ou primeiro em operação com base — solicita conclusão dentro da própria transação do aceite.
4. Alteração de participantes, veículos ou tipo zera os aceites anteriores.
5. Posse aberta recebe chaves exclusivas por motorista e veículo para bloquear concorrência real no Dataverse.
6. App e Tela deixam de fechar/criar posses diretamente.
7. Troca comum aceita transferência unilateral quando o motorista 2 não possui veículo.

Data da auditoria: 03/08/2026

Escopo validado:

- Tela Funções Operacionais: planejamento, criação de Troca, criação da Geral e finalização sem App.
- App Motoristas: identificação do motorista, exibição, confirmação e finalização da Troca.
- Plugin `Betinhos.DriverRecordSharing`: compartilhamento, sincronização Troca/Geral, previsão de veículo e integridade de Posse.
- Dataverse DEV e PROD: metadata, registros, auditoria, logs do App, webresource publicado e etapas do plugin.

## Correção do diagnóstico anterior

O plano anterior estava incompleto. Estes dois pontos, isoladamente, não são a causa principal:

- A Tela cria a Troca como `Confirmada (100000001)`.
- A Tela não envia diretamente `new_foiprogramado = true`.

Quando a Geral é criada, o plugin atual converte a Troca para `Programada (202410000)` e força `new_foiprogramado = true`. Isso foi confirmado no código e nos históricos do Dataverse. Alterar apenas esses dois campos mascararia os defeitos reais abaixo.

## Causas confirmadas

### P0 — plugin registrado em duplicidade em PROD

- Contrato esperado: 17 etapas ativas.
- DEV: 17 etapas ativas.
- PROD: 34 etapas ativas para o mesmo `plugintype`.
- Troca `Create` e `Update`: duas etapas síncronas iguais.
- Geral `Create` e `Update`: duas etapas síncronas iguais.
- Posse `Create` e `Update`: uma etapa síncrona nova e uma etapa assíncrona antiga.
- O primeiro conjunto foi criado em 30/06/2026; o segundo, em 30/07/2026. Os dois continuam habilitados.

Impacto: a mesma mudança dispara compartilhamento e sincronizações mais de uma vez. Em Posse, uma validação também continua sendo executada depois do commit pela etapa assíncrona antiga. O ambiente PROD não corresponde ao DEV nem ao contrato dos scripts de validação.

### P0 — três verdades podem divergir

O processo mantém estado em três lugares:

1. `cr40f_trocasdecarro`: status, participantes, veículos fotografados e flags de confirmação.
2. `cr40f_reservadeveiculos` (Geral): status operacional e vínculo com a Troca.
3. `new_possedeveiculo`: posse efetiva de cada veículo.

O plugin sincroniza status entre Troca e Geral nos dois sentidos, mas não aplica a transição de Posse quando alguém altera somente o status. Portanto, marcar Troca ou Geral como concluída pode concluir as duas telas e deixar a Posse antiga intacta.

DEV provou esse caminho em `OT-0239` e `OT-0240`: após erros do App, houve alteração apenas de status para `Concluída`; a Posse não acompanhou.

### P0 — finalização imediata da Tela não é transacional

Em `Tela Funções Operacionais/src/lib/api.ts`, a sequência é:

1. criar a Troca já como `Concluída`;
2. fechar posses em chamadas independentes;
3. criar novas posses em paralelo;
4. retornar sucesso.

Falha depois do passo 1 deixa Troca concluída com Posse parcial. Falha no meio do passo 3 pode criar apenas uma das duas novas posses.

Além disso, a rotina fecha toda posse aberta que coincida com qualquer motorista **ou** qualquer veículo da operação. Ela não exige os pares exatos esperados. Assim, pode encerrar registros não relacionados e esconder a divergência em vez de bloqueá-la.

### P0 — devolução imediata sem App não cria posse de base

`finalizedPossessionsFromPreview()` retorna nenhuma nova posse para `Devolução à base`. A Tela fecha conflitos e não cria o registro aberto do veículo na base.

Consequências:

- o veículo deixa de ter uma posse aberta;
- uma retirada posterior pode não encontrá-lo na base;
- o App passa a bloquear com “veículo da retirada não possui posse aberta na base” ou precisa sintetizar histórico.

Os logs de PROD registram repetidamente esse erro em retiradas. A versão atual do App contorna ausência de base criando uma posse fechada sintética e a nova posse do motorista, mas isso não corrige o histórico original.

### P0 — transferência para motorista sem carro não existe no modelo atual

A Tela exige, para o tipo `Troca`, que os dois motoristas tenham veículo previsto. O App também exige uma posse aberta exata para os dois lados antes de finalizar.

Portanto, o caso “motorista A entrega o carro para motorista B, que estava sem carro e não tem nada para dar baixa” não é suportado. O registro `OT-1149` de PROD contém a observação operacional explícita de que foi necessário usar `Devolução à base` + `Retirada da base` como contorno.

Esse é o motivo de o motorista sem posse não aparecer/participar corretamente: o fluxo foi modelado apenas como permuta de duas posses, não como transferência unilateral.

### P0 — PROD já teve posses duplicadas reais

Os logs do App em PROD registram:

- `OT-1145`: “Motorista da devolução possui mais de uma posse de veículo aberta”.
- `OS-7427`: “Motorista possui mais de uma posse de veículo aberta”.
- `OT-1149`: “Motorista da devolução não possui posse de veículo aberta”.

Hoje, a consulta de PROD não encontrou motorista ou veículo com mais de uma posse aberta; a inconsistência histórica foi alterada posteriormente. Isso não elimina a causa que permitiu o estado.

### P0 — divergência persistida em PROD

A posse aberta `PV-1134` está vinculada à devolução `OT-1149`, mas possui motorista preenchido. Uma posse produzida por devolução deveria ser de base (`new_motorista = null`).

O webresource publicado em PROD é a versão `2.1.635` e contém a regra correta de criar a posse da devolução com motorista nulo. Logo, o registro atual diverge do contrato publicado. A auditoria mostra uma sequência operacional com contorno e múltiplas alterações de status; a correção desse registro precisa reconstruir a intenção real antes de editar motorista ou vínculo da Troca.

### P1 — uma troca planejada vencida altera todo o futuro

Tela e plugin aplicam todas as Trocas `Programada`/`Confirmada` anteriores à data consultada para prever o veículo futuro. Eles não exigem:

- confirmação concluída;
- janela ainda válida;
- dependência anterior efetivamente executada;
- Posse resultante existente.

Uma troca antiga e não realizada contamina a previsão de todos os serviços posteriores. Uma segunda troca pode ser encadeada sobre um veículo que nunca chegou ao motorista.

### P1 — confirmação parcial fica presa

No App, a primeira confirmação é salva fora da transação final. Se o segundo motorista não consegue concluir por divergência de Posse:

- a primeira flag continua verdadeira;
- o item desaparece para o primeiro motorista;
- não existe desfazer, expirar ou resolução operacional segura;
- a Troca continua `Programada` para o outro lado.

`OT-0238` em DEV reproduz esse estado: motorista 1 confirmado, motorista 2 pendente e Geral ainda programada.

### P1 — alteração de participantes não reinicia confirmações

As flags `new_concluidomotorista1/2` são independentes dos lookups dos motoristas. O plugin reage à troca de participantes para compartilhamento, mas não zera nem revalida as confirmações anteriores.

Editar motorista, veículo ou tipo depois da primeira confirmação pode reaproveitar uma confirmação dada para outra configuração da Troca.

### P1 — identificação do App depende de e-mail mutável e não único

O App procura `cr40f_funcionarios` por `cr40f_emailmicrosoft` com `$top=1`. Não filtra:

- `statecode = 0`;
- `cr40f_status = Ativo`;
- função = Motorista;
- unicidade do e-mail.

Em DEV, a auditoria provou que o e-mail do funcionário Renan foi temporariamente alterado para o usuário Teste. O App então executou Trocas de Renan como Teste. O backfill do plugin concede acesso ao novo usuário, mas não revoga o usuário anterior quando o e-mail muda; o compartilhamento antigo permaneceu.

### P1 — seleção de motorista da Tela é mais ampla que a regra de negócio

A Tela carrega qualquer funcionário com `statecode = 0`. Ela não exige `cr40f_status = Ativo` nem função Motorista. Assim, administrador, afastado ou registro semanticamente inválido pode entrar na Troca.

O teste “tem App” verifica apenas e-mail + `systemuser` habilitado. Isso não comprova licença, papel de segurança nem acesso real ao App.

### P1 — inicialização usa histórico incompleto

A Tela decide que uma retirada é a primeira posse usando apenas:

- Trocas atualmente `Programada`/`Confirmada` carregadas;
- posses atualmente abertas carregadas.

Trocas concluídas e posses fechadas não são carregadas. Motorista com histórico antigo, mas sem posse atual, pode ser classificado incorretamente como “primeira posse” e finalizado imediatamente sem Geral.

### P1 — criação agendada pode deixar órfão

A Tela cria primeiro a Troca e depois a Geral. Se a Geral falhar:

- sobra uma Troca `Confirmada` sem Geral;
- o App não a mostra, pois exibe somente `Programada`;
- o previsor do plugin ainda considera `Confirmada` como evento futuro.

Isso cria uma mudança fantasma de veículo sem executor visível.

### P1 — timestamps de Posse não têm um contrato único

- O App usa o instante real da finalização.
- A Tela, na finalização imediata, usa o fim da janela agendada.
- A Tela considera “aberta” qualquer posse com fim nulo, mesmo se o início estiver no futuro.
- O plugin considera início e fim ao prever uma data.

Uma finalização imediata futura pode fazer a Tela tratar a nova posse como atual antes do início, enquanto o plugin ainda usa a posse anterior para datas anteriores.

### P2 — carregamento da Geral associada pode omitir registro

O App busca até 120 Gerais de Troca, sem recorte temporal nem ordenação determinística. Com crescimento da tabela, a Geral da Troca atual pode ficar fora do lote. Também não há garantia de uma única Geral por Troca.

### P2 — proteção contra corrida não é absoluta

O plugin síncrono bloqueia duplicata sequencial de Posse por motorista e por veículo. Porém, a regra é “consultar e depois validar”; sem chave única ou mecanismo serializado, duas criações simultâneas ainda podem atravessar a consulta antes de qualquer uma ser visível.

## Estado atual confirmado

### DEV

- 17 etapas ativas do plugin: quantidade esperada.
- 3 posses abertas; nenhuma duplicata atual por motorista ou veículo.
- `OT-0238` permanece programada e parcialmente confirmada.
- `OT-0239` e `OT-0240` foram concluídas por alteração de status sem transição de Posse.

### PROD

- 34 etapas ativas do plugin: conjunto duplicado.
- Nenhuma Troca `Programada` ativa no momento da consulta.
- Nenhuma duplicata atual de posse aberta por motorista ou veículo.
- Há histórico de duplicata, ausência de posse e contornos manuais nos logs/auditoria.
- `PV-1134` continua semanticamente incompatível com a devolução `OT-1149` à qual está vinculada.

## Cobertura e validação local

- App Motoristas: 84/84 testes passaram.
- App Motoristas: TypeScript estrito passou.
- Tela Funções Operacionais: 14/14 testes passaram.
- Tela Funções Operacionais: TypeScript falhou em `tests/logic.test.ts:43`; o fixture usa número em campo tipado como `boolean | null`.
- Testes .NET do plugin: o build ocorreu, mas **nenhum teste foi executado**. O Windows bloqueou o assembly por política de Controle de Aplicativo, embora `dotnet test` tenha retornado código 0.
- Os testes da Tela cobrem majoritariamente lógica de preview; não cobrem a sequência real de gravações Dataverse de `scheduleSwap()`.
- Os testes do plugin existentes não cobrem integridade de Posse, sincronização Troca/Geral nem duplicidade de etapas registradas.

## Ordem segura de correção

### Fase 0 — contenção e reconciliação de PROD

- [ ] Desabilitar o conjunto antigo de 17 etapas duplicadas, mantendo exatamente o contrato atual de 17 etapas. Ação externa; requer aprovação explícita e lista de GUIDs antes de executar.
- [ ] Fazer o validador de deploy falhar se encontrar quantidade diferente de 17 ou mais de uma etapa por entidade/mensagem/plugin.
- [ ] Reconstruir, pela auditoria, as posses afetadas em PROD antes de editar qualquer registro.
- [ ] Criar consulta operacional de invariantes: uma posse aberta por veículo; no máximo uma por motorista; devolução concluída termina em base; retirada concluída termina no motorista; Troca concluída gera os dois pares invertidos.

### Fase 1 — uma única operação transacional

- [ ] Mover conclusão para um único comando server-side (Custom API/plugin) usado pela Tela e pelo App.
- [ ] Dentro da mesma transação: revalidar ETag, participantes, tipo, posses atuais e janela; fechar posses; criar novas posses; atualizar flags; concluir Troca; concluir Geral.
- [ ] Bloquear conclusão direta por simples alteração de status quando a Posse resultante não existir.
- [ ] Fazer criação de Troca + Geral ser atômica; sem Geral, a Troca não pode entrar no conjunto de previsão.

### Fase 2 — completar o modelo de negócio

- [ ] Adicionar estado explícito “transferência para motorista sem posse” ou regra equivalente.
- [ ] Definir quem confirma nesse caso: entregador, recebedor ou operação. Não reutilizar a permuta de dois veículos.
- [ ] Devolução sem App deve criar posse aberta de base.
- [ ] Primeira posse deve ser decidida por histórico real, não apenas pelos registros abertos carregados.
- [ ] Definir um único timestamp de efetivação da Posse: instante real ou horário agendado, com regra clara para futuro.

### Fase 3 — impedir planos fantasmas

- [ ] Troca vencida e incompleta deve ir para `Requer análise` e parar de alterar previsão futura.
- [ ] Previsão deve depender da cadeia validada de posses, não apenas de status Programada/Confirmada.
- [ ] Alterar participantes, veículos ou tipo deve invalidar confirmações anteriores.
- [ ] Criar resolução operacional de confirmação parcial: cancelar, reabrir ou refazer com auditoria.

### Fase 4 — identidade e acesso

- [ ] Resolver funcionário por identificador estável do `systemuser`, não por e-mail mutável com `$top=1`.
- [ ] Enquanto isso, exigir funcionário ativo, função Motorista e exatamente um resultado por e-mail.
- [ ] No backfill de e-mail, revogar acesso do usuário anterior depois de verificar dependências ativas.
- [ ] Na Tela, listar apenas motoristas elegíveis e mostrar o motivo exato quando não houver acesso real ao App.

### Fase 5 — matriz obrigatória de testes

- [ ] Três tipos: Troca, Devolução, Retirada.
- [ ] Quatro perfis: ambos com App, um sem App, ambos sem App, recebedor sem posse.
- [ ] Posse normal, ausente, duplicada, futura e alterada entre preview e confirmação.
- [ ] Falha após criar Troca, após criar Geral, após fechar uma posse e ao criar cada nova posse.
- [ ] Confirmações simultâneas e ETag divergente.
- [ ] Alteração de motorista/veículo/tipo após primeira confirmação.
- [ ] Troca vencida, cadeia de duas Trocas e dependência anterior não executada.
- [ ] Registro duplicado de etapas do plugin deve reprovar deploy/validação.

## Critério de aceite

O fluxo só está íntegro quando, para qualquer operação concluída, Troca, Geral e Posse representam o mesmo resultado; nenhuma etapa parcial fica persistida; e o mesmo cenário produz o mesmo estado na Tela, no App, no plugin, em DEV e em PROD.
