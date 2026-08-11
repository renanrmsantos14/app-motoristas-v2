# Comandos do ciclo de troca

Os webresources `new_exchange_lifecycle_commands.js` e `new_exchange_lifecycle_dialog.html` implementam os três comandos do formulário da tabela `cr40f_trocasdecarro`.

## Configuração no Model-Driven App (DEV)

Adicione a biblioteca `new_exchange_lifecycle_commands.js` ao formulário e crie os comandos abaixo na command bar do formulário e da grid:

| Rótulo | Função | Visibilidade |
|---|---|---|
| Concluir agora | `BetinhosExchangeLifecycle.concluir` | `cr40f_statusdatroca` igual a Programada ou Confirmada; usuário tem Write em `cr40f_trocasdecarro` |
| Cancelar troca | `BetinhosExchangeLifecycle.cancelar` | `cr40f_statusdatroca` igual a Programada ou Confirmada; usuário tem Write em `cr40f_trocasdecarro` |
| Reverter troca | `BetinhosExchangeLifecycle.reverter` | status Concluída e `new_revertida` diferente de true; usuário tem Write em `cr40f_trocasdecarro` |

Passe `PrimaryControl` como primeiro parâmetro da função. Remova o comando nativo Delete das trocas e deixe a tabela `new_possedeveiculo` como somente leitura no aplicativo e nos perfis de segurança. O status da troca deve permanecer visível e somente leitura.

Após publicar, valide no DEV em formulário e grid: foco inicial no motivo, `Esc` fecha o diálogo, motivo vazio é rejeitado, segundo clique não dispara outra chamada, erro do servidor permanece visível e sucesso atualiza o registro.

As funções abrem o diálogo com `Xrm.Navigation.navigateTo` e executam a Custom API com `Xrm.WebApi.online.execute`; a proteção de status, privilégio e imutabilidade continua server-side.
