# Comunicados para motoristas

## Objetivo e separação

Este módulo permite que a operação escreva e dispare manualmente mensagens aos motoristas do App Motoristas. É independente do cadastro antigo chamado **Comunicados** no Back-End. O web resource de gestão fica no projeto irmão `Tela Gestão de Comunicados`; o recebimento fica neste aplicativo. Ambos usam a identidade Betinhos existente: azul escuro, branco, tipografia e componentes compatíveis com as telas atuais.

## Regra de produto

| Tipo | No aplicativo | Conclusão | Acompanhamento na gestão |
| --- | --- | --- | --- |
| Informativo | Menu principal > Comunicados. Permanece pendente até ser aberto. | Abrir registra leitura. | Não aberto, visualizado/lido e data. |
| Exige ciência | Menu principal > Comunicados e destaque em Serviços. | Abrir, ler, escrever observação opcional e desenhar assinatura. | Pendente, visualizado, ciência assinada, nome, assinatura, observação e data. |

O aviso continua visível no app enquanto estiver pendente. O aplicativo atualiza a lista ao entrar nas telas e periodicamente. O push do Power Apps avisa sobre o novo comunicado; a pendência registrada no Dataverse é a referência caso o push falhe ou as notificações do aparelho estejam desligadas. Ciência não bloqueia toda a navegação nem conclui um serviço real: o card em Serviços leva à mesma tela do comunicado.

O nome do assinante é derivado do cadastro do motorista associado ao usuário Microsoft autenticado; o motorista não edita esse nome. Uma ciência já registrada não pode ser alterada. Um comunicado disparado também não pode ser editado. A observação é opcional, com até 1.000 caracteres. O desenho da assinatura é obrigatório para ciência e guardado como traços normalizados em JSON.

## Fluxo operacional

1. No **App Betinhos Interno > Operacional > Comunicados para Motoristas**, clicar em **Novo comunicado**.
2. Informar título e mensagem; escolher **Informativo** ou **Exige ciência**.
3. Escolher **Todos os motoristas com acesso ao app** ou **Selecionar motoristas**. A gestão mostra a quantidade apta e, em Todos, a quantidade excluída por cadastro sem acesso. Motoristas sem vínculo Microsoft único não podem ser selecionados.
4. Salvar como rascunho se ainda não for enviar. Revisar a prévia e confirmar **Disparar comunicado**. O disparo é manual e cria um destinatário por motorista apto, com cópia do título e da mensagem.
5. Acompanhar cada motorista na gestão: abertura/leitura ou assinatura; conferir o status de push. Se o push falhar, usar **Reenviar push**. A leitura/ciência registrada continua válida mesmo se o push falhar.

Em Todos, o backend consulta os funcionários ativos de vínculo admitido e somente cria destinatários para quem tem e-mail Microsoft exclusivo e exatamente um usuário ativo correspondente. Se ninguém for apto, o disparo é recusado. Na seleção individual, qualquer destinatário sem vínculo válido recusa a operação inteira para evitar envio parcial inesperado. A gestão apresenta a mesma regra antes de confirmar, mas o plugin a impõe novamente no servidor.

## Modelo de dados e segurança

- `new_comunicadomotorista`: cabeçalho do comunicado, organização proprietária; título, mensagem, tipo, escopo, IDs selecionados, estado, autor e instante do disparo.
- `new_comunicadodestinatario`: registro individual, de propriedade do usuário Microsoft destinatário; cópia imutável de título/mensagem/tipo, motorista associado, momentos de abertura/leitura/ciência, nome, observação, assinatura e estado do push.
- Chave alternativa `new_chaveunica` combina comunicado e motorista para impedir duplicata.
- Relacionamentos ligam destinatário ao cabeçalho e ao funcionário; exclusão em cascata foi evitada.
- O papel `Acesso-Motoristas` recebe somente leitura básica dos destinatários próprios. A gestão usa permissões administrativas da equipe interna. Custom APIs validam o usuário logado e o motorista antes de registrar abertura/ciência; o cliente não grava assinatura, leitura ou destinatários diretamente.
- Assinatura é evidência de ciência operacional, com nome e data do usuário autenticado. Não é apresentada como assinatura digital certificada.

As quatro ações do plugin são `new_DispararComunicadoMotorista`, `new_AbrirComunicadoMotorista`, `new_RegistrarCienciaComunicado` e `new_ReenviarPushComunicado`. A criação dos destinatários e a mudança de estado do cabeçalho ocorrem na ação transacional de disparo. Repetir um disparo já concluído é recusado. A ciência valida assinatura, observação, autoria e estado anterior; a abertura de informativo registra leitura. O Flow `Flow Push Comunicados | Motoristas` observa destinatários pendentes, usa Power Apps Notification V2 e grava enviado/falhou no registro.

## Entregas e arquivos

1. **Schema e APIs:** `scripts/provision-comunicados.ps1` e `plugins/DriverRecordSharing/ComunicadoCommandPlugin.cs`.
2. **Permissão e push:** `scripts/grant-comunicados-role.ps1` e `scripts/provision-comunicados-push-flow.ps1`.
3. **Aplicativo:** `src/screens/ComunicadosScreen.tsx`, `src/components/comunicados/SignaturePad.tsx`, `src/lib/comunicados.ts`, navegação, tela inicial e Serviços.
4. **Gestão:** projeto irmão `Tela Gestão de Comunicados`, com web resource HTML independente `new_gestaocomunicadosmotoristas`; `scripts/add-gestao-comunicados-to-app.ps1` o coloca no menu Operacional.
5. **Validação:** `tests/comunicados.test.ts`, checagem TypeScript, build, teste do plugin, smoke das APIs e conferência remota de web resources, Flow, papel e sitemap.

## Publicação e aceite

Em outro ambiente, executar primeiro o preflight de metadata, compilar o plugin, provisionar schema/APIs, publicar plugin e Flow, conceder papel, publicar os dois web resources e adicionar a entrada do sitemap. Os scripts usam a solução `AppBetinhos` e devem ser apontados explicitamente para o ambiente correto. `dist/` é gerado; não se edita manualmente.

Aceite funcional com contas reais de teste:

- Informativo seletivo aparece apenas ao motorista escolhido; após abrir, a gestão mostra data de leitura e o indicador pendente desaparece.
- Exige ciência aparece em Comunicados e Serviços; abrir sozinho não conclui; assinatura com observação conclui e mostra nome e data corretos na gestão.
- Motorista diferente não consegue ler nem assinar o registro de outro, inclusive por chamada direta da API.
- Disparar o mesmo cabeçalho duas vezes não cria duplicatas. Falha de push fica registrada e pode ser reenviada sem duplicar o comunicado.
- Conferir recebimento de push com aplicativo instalado, sessão e permissões de notificação em aparelho Android/iOS. Publicação do Flow, sem execução real em aparelho, não comprova esse último item.

## Estado do DEV em 24/09/2026

Schema, APIs, papel, Flow ativo, web resources e item do menu foram publicados no DEV. O carregamento autenticado da gestão foi observado no navegador. Na leitura inicial havia 32 motoristas ativos no escopo e 21 sem vínculo Microsoft válido; a gestão informa o número excluído antes do disparo. Os testes locais e smoke de validação das APIs passaram. Ainda é necessário um envio controlado e a verificação do push/abertura/assinatura em aparelho com motorista de teste para comprovar o ciclo ponta a ponta.
