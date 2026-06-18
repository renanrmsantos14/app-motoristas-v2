# DriverRecordSharing

## Objetivo

Voce ja tem o plugin registrado.

Agora o que voce precisa fazer e:

1. compilar a DLL nova
2. atualizar o assembly no Plugin Registration Tool
3. deixar os steps do jeito certo
4. testar

## Decisao recomendada agora

Use assim:

- `cr40f_reservadeveculos`: `Synchronous`
- `cr40f_servicosporpassageiro`: `Asynchronous`
- `cr40f_trocasdecarro`: `Asynchronous`
- `new_possedeveiculo`: `Asynchronous`
- `cr40f_colisao_v2`: `Asynchronous`
- `cr40f_recibos_v2`: `Asynchronous`

E nao crie `Image`.

Resumo:

- `Stage`: `PostOperation`
- `Deployment`: `Server`
- `Image`: `nenhuma`

## Regra do plugin

O plugin hoje funciona assim:

- se nao houver motorista, nao da erro
- se o funcionario estiver sem `cr40f_emailmicrosoft`, nao da erro e nao compartilha
- se existir email Microsoft preenchido e nao existir um `systemuser` ativo correspondente, da erro
- se existir mais de um `systemuser` ativo com o mesmo email, da erro
- ele so concede acesso
- ele nao remove acesso antigo por enquanto

## Onde esta a DLL

DLL compilada:

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

Se der certo, use esta DLL:

- [Betinhos.DriverRecordSharing.dll](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\bin\Release\net462\Betinhos.DriverRecordSharing.dll)

## Parte 2: atualizar o assembly no PRT

### Passo 5. Abrir o Plugin Registration Tool

Abra o `Plugin Registration Tool`.

### Passo 6. Conectar no ambiente certo

Antes de mexer em qualquer coisa:

1. confirme o ambiente
2. confirme que e o mesmo ambiente em que voce testou os registros

### Passo 7. Atualizar o assembly existente

Como voce ja registrou esse plugin antes, faca exatamente assim:

1. localize o assembly `Betinhos.DriverRecordSharing`
2. clique com o botao direito em cima dele
3. clique em `Update`
4. selecione a DLL nova
5. confirme

Importante:

- nao precisa criar outro assembly
- isso substitui o codigo do assembly atual

## Parte 3: arrumar os steps

## Regra importante

Voce pode:

- editar os steps existentes
- ou apagar e recriar

Se os seus steps atuais estiverem confusos, o mais limpo para voce e:

1. anotar quais steps existem
2. apagar os que estiverem errados
3. recriar exatamente como abaixo

## Configuracao base

Para todos os steps:

- Event Pipeline Stage of Execution: `PostOperation`
- Deployment: `Server`
- Run in User's Context: usuario tecnico
- Image: nao criar

### Importante sobre o campo Execution Mode

Use:

- `Synchronous` so para `cr40f_reservadeveculos`
- `Asynchronous` para o resto

## Parte 4: criar ou corrigir cada step

### Step 1. Servicos - Create

Preencha:

- Message: `Create`
- Primary Entity: `cr40f_reservadeveculos`
- Filtering Attributes: deixar vazio
- Execution Mode: `Synchronous`

Depois clique em `Register New Step`.

### Step 2. Servicos - Update

Preencha:

- Message: `Update`
- Primary Entity: `cr40f_reservadeveculos`
- Filtering Attributes: `cr40f_motorista`
- Execution Mode: `Synchronous`

Depois clique em `Register New Step`.

### Step 3. Servicos por passageiro - Create

Preencha:

- Message: `Create`
- Primary Entity: `cr40f_servicosporpassageiro`
- Filtering Attributes: deixar vazio
- Execution Mode: `Asynchronous`

Depois clique em `Register New Step`.

### Step 4. Servicos por passageiro - Update

Preencha:

- Message: `Update`
- Primary Entity: `cr40f_servicosporpassageiro`
- Filtering Attributes: `cr40f_geral,cr40f_bancodedados`
- Execution Mode: `Asynchronous`

Depois clique em `Register New Step`.

### Step 5. Trocas de carro - Create

Preencha:

- Message: `Create`
- Primary Entity: `cr40f_trocasdecarro`
- Filtering Attributes: deixar vazio
- Execution Mode: `Asynchronous`

Depois clique em `Register New Step`.

### Step 6. Trocas de carro - Update

Preencha:

- Message: `Update`
- Primary Entity: `cr40f_trocasdecarro`
- Filtering Attributes: `cr40f_motorista1,cr40f_motorista2`
- Execution Mode: `Asynchronous`

Depois clique em `Register New Step`.

### Step 7. Posse de veiculo - Create

Preencha:

- Message: `Create`
- Primary Entity: `new_possedeveiculo`
- Filtering Attributes: deixar vazio
- Execution Mode: `Asynchronous`

Depois clique em `Register New Step`.

### Step 8. Posse de veiculo - Update

Preencha:

- Message: `Update`
- Primary Entity: `new_possedeveiculo`
- Filtering Attributes: `new_motorista`
- Execution Mode: `Asynchronous`

Depois clique em `Register New Step`.

### Step 9. Colisoes - Create

Preencha:

- Message: `Create`
- Primary Entity: `cr40f_colisao_v2`
- Filtering Attributes: deixar vazio
- Execution Mode: `Asynchronous`

Depois clique em `Register New Step`.

### Step 10. Colisoes - Update

Preencha:

- Message: `Update`
- Primary Entity: `cr40f_colisao_v2`
- Filtering Attributes: `cr40f_motorista`
- Execution Mode: `Asynchronous`

Depois clique em `Register New Step`.

### Step 11. Recibos - Create

Preencha:

- Message: `Create`
- Primary Entity: `cr40f_recibos_v2`
- Filtering Attributes: deixar vazio
- Execution Mode: `Asynchronous`

Depois clique em `Register New Step`.

### Step 12. Recibos - Update

Preencha:

- Message: `Update`
- Primary Entity: `cr40f_recibos_v2`
- Filtering Attributes: `cr40f_motorista`
- Execution Mode: `Asynchronous`

Depois clique em `Register New Step`.

## Parte 5: precisa criar Image?

Nao.

Nao crie:

- `Pre Image`
- `Post Image`

Motivo:

- o plugin atual nao precisa
- ele pega o valor atual do proprio registro
- adicionar image aqui so complica sua configuracao

## Parte 6: o que revisar antes de fechar o PRT

Confira se ficou assim:

1. assembly atualizado
2. `cr40f_reservadeveculos Create` em `Synchronous`
3. `cr40f_reservadeveculos Update` em `Synchronous`
4. todos os outros steps em `Asynchronous`
5. todos em `PostOperation`
6. todos com `Deployment = Server`
7. nenhum com image
8. `Update` com os filtros certos

## Parte 7: como testar agora

### Teste 1. Servico novo com motorista

1. abra o sistema
2. crie um `cr40f_reservadeveculos`
3. preencha `cr40f_motorista`
4. salve

Esperado:

- se houver problema de email Microsoft ou `systemuser`, o save do servico pode acusar erro porque este step esta `Synchronous`
- se estiver tudo certo, o servico salva e o acesso e concedido

### Teste 2. Servico existente sem motorista

1. abra um servico existente
2. preencha `cr40f_motorista`
3. salve

Esperado:

- se estiver tudo certo, o motorista ganha acesso ao servico

### Teste 3. Trocar motorista do servico

1. abra um servico que ja tenha motorista
2. troque o `cr40f_motorista`
3. salve

Esperado:

- o novo motorista ganha acesso
- o antigo continua com acesso por enquanto

### Teste 4. Validar filhos do servico

Depois do teste do servico, confirme se o motorista tambem ganhou acesso a:

- `cr40f_servicosporpassageiro`
- passageiros relacionados em `cr40f_bancodedados`

### Teste 5. Funcionario sem email Microsoft

1. escolha um funcionario sem `cr40f_emailmicrosoft`
2. preencha no servico
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
- o servico principal acusa o problema na hora, porque esta `Synchronous`

## Parte 8: como validar o compartilhamento real

Validacao forte:

1. abra o registro
2. rode o script de consulta do `principalobjectaccess`
3. confirme se existe uma linha para o `systemuser` do motorista

Se aparecer `poaCount: 1` ou mais no registro certo, o compartilhamento real aconteceu.

## Parte 9: se der erro

Cheque nesta ordem:

1. a DLL certa foi compilada?
2. o assembly certo foi atualizado?
3. os dois steps de `cr40f_reservadeveculos` ficaram `Synchronous`?
4. os demais ficaram `Asynchronous`?
5. todos ficaram `PostOperation`?
6. voce nao criou image sem precisar?
7. os filtros de `Update` estao corretos?
8. o usuario tecnico tem permissao?
9. o funcionario tem `cr40f_emailmicrosoft`?
10. existe um `systemuser` ativo com exatamente esse email?
11. existe mais de um `systemuser` ativo com esse email?

## Arquivos principais

- [README.md](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\README.md)
- [ServiceDriverSharePlugin.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\ServiceDriverSharePlugin.cs)
- [DriverResolver.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\DriverResolver.cs)
- [PluginConfig.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\PluginConfig.cs)
- [ServicePassengerRepository.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\ServicePassengerRepository.cs)
