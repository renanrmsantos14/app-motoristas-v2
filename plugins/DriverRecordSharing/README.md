# DriverRecordSharing

## Objetivo

Esta versao esta preparada para:

- conceder acesso quando o motorista entra
- manter acesso quando o motorista continua igual
- retirar acesso quando o motorista sai ou e trocado
- compartilhar a `cr40f_manutencoes` vinculada no `cr40f_om` do servico

Para isso, agora existe uma exigencia nova:

- todo step `Update` precisa de `Pre Image`

Sem `Pre Image`, o plugin nao consegue saber quem era o motorista antigo e nao consegue revogar acesso com seguranca.

## Como a versao de producao funciona

Regras:

- se nao houver motorista, nao da erro
- se o funcionario estiver sem `cr40f_emailmicrosoft`, nao da erro e nao compartilha
- se houver email Microsoft preenchido e nao existir um `systemuser` ativo correspondente, da erro
- se houver mais de um `systemuser` ativo com o mesmo email, da erro
- se o motorista mudar, o plugin concede acesso ao novo e revoga do antigo

## Decisao recomendada de execucao

Use assim:

- `cr40f_reservadeveculos`: `Synchronous`
- `cr40f_servicosporpassageiro`: `Asynchronous`
- `cr40f_trocasdecarro`: `Asynchronous`
- `new_possedeveiculo`: `Asynchronous`
- `cr40f_colisao_v2`: `Asynchronous`
- `cr40f_recibos_v2`: `Asynchronous`

Padrao:

- Stage: `PostOperation`
- Deployment: `Server`
- `Create`: sem image
- `Update`: com `Pre Image`

## Onde esta a DLL

- [Betinhos.DriverRecordSharing.dll](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\bin\Release\net462\Betinhos.DriverRecordSharing.dll)

## Parte 1: compilar agora

### Passo 1. Abrir PowerShell

Abra o PowerShell.

### Passo 2. Ir para a pasta do projeto

```powershell
cd "C:\Users\mendo\Desktop\vscode\App Motoristas"
```

### Passo 3. Gerar a chave, se precisar

Se voce ja gerou antes, pode pular.

```powershell
cd "C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing"
.\generate-strong-name-key.ps1
```

### Passo 4. Compilar

```powershell
cd "C:\Users\mendo\Desktop\vscode\App Motoristas"
dotnet build .\plugins\DriverRecordSharing\DriverRecordSharing.csproj -c Release
```

## Parte 2: atualizar o assembly existente

### Passo 5. Abrir o Plugin Registration Tool

Abra o `Plugin Registration Tool`.

### Passo 6. Conectar no ambiente certo

Antes de mexer:

1. confirme o ambiente
2. confirme que e exatamente o ambiente onde os servicos estao sendo usados

### Passo 7. Atualizar o assembly

Como o assembly ja existe:

1. localize `Betinhos.DriverRecordSharing`
2. clique com o botao direito
3. clique em `Update`
4. selecione a DLL nova
5. confirme

Importante:

- nao precisa criar outro assembly
- isso atualiza o codigo do assembly atual

## Parte 3: ajustar os steps

Se seus steps atuais estiverem errados ou incompletos, o caminho mais limpo e:

1. revisar os steps existentes
2. apagar os errados
3. recriar igual a este README

## Configuracao base

Para todos os steps:

- Event Pipeline Stage of Execution: `PostOperation`
- Deployment: `Server`
- Run in User's Context: usuario tecnico

## Parte 4: criar ou corrigir os steps

### 1. Servicos - Create

- Message: `Create`
- Primary Entity: `cr40f_reservadeveculos`
- Filtering Attributes: deixar vazio
- Execution Mode: `Synchronous`
- Image: nao criar

### 2. Servicos - Update

- Message: `Update`
- Primary Entity: `cr40f_reservadeveculos`
- Filtering Attributes: `cr40f_motorista`
- Execution Mode: `Synchronous`
- Image: criar `Pre Image`

### 3. Servicos por passageiro - Create

- Message: `Create`
- Primary Entity: `cr40f_servicosporpassageiro`
- Filtering Attributes: deixar vazio
- Execution Mode: `Asynchronous`
- Image: nao criar

### 4. Servicos por passageiro - Update

- Message: `Update`
- Primary Entity: `cr40f_servicosporpassageiro`
- Filtering Attributes: `cr40f_geral,cr40f_bancodedados`
- Execution Mode: `Asynchronous`
- Image: criar `Pre Image`

### 5. Trocas de carro - Create

- Message: `Create`
- Primary Entity: `cr40f_trocasdecarro`
- Filtering Attributes: deixar vazio
- Execution Mode: `Asynchronous`
- Image: nao criar

### 6. Trocas de carro - Update

- Message: `Update`
- Primary Entity: `cr40f_trocasdecarro`
- Filtering Attributes: `cr40f_motorista1,cr40f_motorista2`
- Execution Mode: `Asynchronous`
- Image: criar `Pre Image`

### 7. Posse de veiculo - Create

- Message: `Create`
- Primary Entity: `new_possedeveiculo`
- Filtering Attributes: deixar vazio
- Execution Mode: `Asynchronous`
- Image: nao criar

### 8. Posse de veiculo - Update

- Message: `Update`
- Primary Entity: `new_possedeveiculo`
- Filtering Attributes: `new_motorista`
- Execution Mode: `Asynchronous`
- Image: criar `Pre Image`

### 9. Colisoes - Create

- Message: `Create`
- Primary Entity: `cr40f_colisao_v2`
- Filtering Attributes: deixar vazio
- Execution Mode: `Asynchronous`
- Image: nao criar

### 10. Colisoes - Update

- Message: `Update`
- Primary Entity: `cr40f_colisao_v2`
- Filtering Attributes: `cr40f_motorista`
- Execution Mode: `Asynchronous`
- Image: criar `Pre Image`

### 11. Recibos - Create

- Message: `Create`
- Primary Entity: `cr40f_recibos_v2`
- Filtering Attributes: deixar vazio
- Execution Mode: `Asynchronous`
- Image: nao criar

### 12. Recibos - Update

- Message: `Update`
- Primary Entity: `cr40f_recibos_v2`
- Filtering Attributes: `cr40f_motorista`
- Execution Mode: `Asynchronous`
- Image: criar `Pre Image`

## Parte 5: como criar a Pre Image

Isto agora e obrigatorio em todo step `Update`.

### Para adicionar a image:

1. localize o step `Update`
2. clique com o botao direito nele
3. clique em `Register New Image`

### Preencha assim:

- Image Type: `Pre Image`
- Name: `pre`
- Entity Alias: `pre`

Depois, no campo de atributos, use exatamente os atributos abaixo.

### Update de Servicos

- `cr40f_motorista`

### Update de Servicos por passageiro

- `cr40f_geral`
- `cr40f_bancodedados`

### Update de Trocas de carro

- `cr40f_motorista1`
- `cr40f_motorista2`

### Update de Posse de veiculo

- `new_motorista`

### Update de Colisoes

- `cr40f_motorista`

### Update de Recibos

- `cr40f_motorista`

Importante:

- o alias tem que ser exatamente `pre`
- os nomes dos atributos tem que estar exatamente iguais

## Parte 6: o que revisar antes de fechar o PRT

Confira:

1. o assembly foi atualizado
2. `cr40f_reservadeveculos Create` esta em `Synchronous`
3. `cr40f_reservadeveculos Update` esta em `Synchronous`
4. os outros steps estao em `Asynchronous`
5. todos estao em `PostOperation`
6. todos estao com `Deployment = Server`
7. todos os `Create` estao sem image
8. todos os `Update` estao com `Pre Image`
9. toda `Pre Image` usa alias `pre`
10. os filtros de `Update` estao corretos

## Parte 7: permissoes do usuario tecnico

Esse usuario precisa conseguir:

- ler `cr40f_reservadeveculos`
- ler `cr40f_manutencoes`
- ler `cr40f_servicosporpassageiro`
- ler `cr40f_bancodedados`
- ler `cr40f_trocasdecarro`
- ler `new_possedeveiculo`
- ler `cr40f_colisao_v2`
- ler `cr40f_recibos_v2`
- ler `cr40f_funcionarios`
- ler `systemuser`
- compartilhar registros
- revogar compartilhamento

Na pratica, precisa ter capacidade de `GrantAccess`, `ModifyAccess` e `RevokeAccess`.

## Parte 8: como testar agora

### Teste 1. Criar servico ja com motorista

1. crie um `cr40f_reservadeveculos`
2. preencha `cr40f_motorista`
3. salve

Esperado:

- se existir problema de email Microsoft ou `systemuser`, o save pode falhar na hora
- se estiver tudo certo, o motorista recebe acesso
- se o servico tiver `cr40f_om`, o motorista tambem recebe acesso a `cr40f_manutencoes`

### Teste 2. Pegar servico sem motorista e atribuir

1. abra um servico existente sem motorista
2. preencha `cr40f_motorista`
3. salve

Esperado:

- o motorista ganha acesso ao servico
- se o servico tiver `cr40f_om`, o motorista ganha acesso a essa manutencao

### Teste 3. Trocar motorista do servico

1. abra um servico com motorista
2. troque `cr40f_motorista`
3. salve

Esperado:

- o novo motorista ganha acesso
- o antigo perde acesso
- se o servico tiver `cr40f_om`, o novo motorista ganha acesso a manutencao e o antigo perde

### Teste 4. Confirmar filhos do servico

No mesmo teste do servico, confirme tambem:

- o novo motorista recebeu acesso aos `cr40f_servicosporpassageiro`
- o novo motorista recebeu acesso aos passageiros relacionados
- o antigo perdeu esses acessos quando deixou de ser o motorista

### Teste 5. Funcionario sem email Microsoft

1. escolha um funcionario com `cr40f_emailmicrosoft` vazio
2. coloque no servico
3. salve

Esperado:

- salva normal
- nao compartilha
- nao bloqueia

### Teste 6. Email Microsoft inconsistente

1. escolha um funcionario com `cr40f_emailmicrosoft` preenchido
2. garanta que nao exista `systemuser` ativo correspondente
3. tente salvar o servico

Esperado:

- o plugin falha
- o servico principal acusa o problema na hora

## Parte 9: como validar o compartilhamento real

Validacao forte:

1. abra o registro
2. rode o script de consulta do `principalobjectaccess`
3. confirme se existe linha para o `systemuser` do motorista atual

No teste de troca:

1. valide que o novo motorista aparece
2. valide que o antigo deixou de aparecer

## Parte 10: se der erro

Cheque nesta ordem:

1. a DLL certa foi compilada?
2. o assembly certo foi atualizado?
3. os steps de `cr40f_reservadeveculos` estao `Synchronous`?
4. os demais estao `Asynchronous`?
5. todos estao em `PostOperation`?
6. todos os `Update` receberam `Pre Image`?
7. o alias da image esta exatamente `pre`?
8. os atributos da image estao corretos?
9. os filtros de `Update` estao corretos?
10. o usuario tecnico tem permissao?
11. o funcionario tem `cr40f_emailmicrosoft`?
12. existe um `systemuser` ativo com exatamente esse email?
13. existe mais de um `systemuser` ativo com esse email?

## Arquivos principais

- [README.md](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\README.md)
- [ServiceDriverSharePlugin.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\ServiceDriverSharePlugin.cs)
- [DriverResolver.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\DriverResolver.cs)
- [PluginConfig.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\PluginConfig.cs)
- [ServicePassengerRepository.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\ServicePassengerRepository.cs)
