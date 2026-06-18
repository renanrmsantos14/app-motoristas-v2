# DriverRecordSharing

README para quem nunca criou plugin Dataverse.

## O que este plugin faz

Ele compartilha registros com o `systemuser` do motorista.

Hoje ele cobre:

- `cr40f_reservadeveculos`
- `cr40f_servicosporpassageiro`
- `cr40f_bancodedados` indiretamente, via servico por passageiro
- `cr40f_trocasdecarro`
- `new_possedeveiculo`
- `cr40f_colisao_v2`
- `cr40f_recibos_v2`

Regra atual:

- se nao houver motorista: nao da erro
- se houver motorista mas o funcionario estiver sem `cr40f_emailmicrosoft`: nao da erro e nao compartilha
- se houver email Microsoft preenchido e nao existir `systemuser` ativo correspondente: da erro
- se houver mais de um `systemuser` ativo com o mesmo email: da erro
- o plugin so cria ou reforca acesso
- ele nao remove acesso antigo por enquanto

## O que voce precisa

Voce precisa de:

1. `dotnet`
2. a DLL compilada
3. o `Plugin Registration Tool`
4. permissao para registrar plugin no ambiente certo

## Onde fica a DLL

Depois do build:

- [Betinhos.DriverRecordSharing.dll](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\bin\Release\net462\Betinhos.DriverRecordSharing.dll)

## Passo 1: compilar

No PowerShell:

```powershell
cd "C:\Users\mendo\Desktop\vscode\App Motoristas"
dotnet build .\plugins\DriverRecordSharing\DriverRecordSharing.csproj -c Release
```

Se der erro de assinatura, rode antes:

```powershell
cd "C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing"
.\generate-strong-name-key.ps1
```

## Passo 2: abrir o Plugin Registration Tool

No PRT:

1. conecte no ambiente correto
2. confirme se esta no ambiente certo antes de registrar

## Passo 3: registrar a DLL

1. clique em `Register`
2. clique em `Register New Assembly`
3. selecione a DLL
4. preencha:

- Registration Mode: `Sandbox`
- Location: `Database`

5. confirme

Depois voce deve enxergar:

- `Betinhos.DriverRecordSharing.ServiceDriverSharePlugin`

## Passo 4: registrar os steps

Use sempre este padrao:

- Stage: `PostOperation`
- Execution Mode: `Asynchronous`
- Deployment: `Server`
- Run in User's Context: usuario tecnico

### Step 1. Servicos - Create

- Message: `Create`
- Primary Entity: `cr40f_reservadeveculos`
- Filtering Attributes: vazio

### Step 2. Servicos - Update

- Message: `Update`
- Primary Entity: `cr40f_reservadeveculos`
- Filtering Attributes: `cr40f_motorista`

### Step 3. Servicos por passageiro - Create

- Message: `Create`
- Primary Entity: `cr40f_servicosporpassageiro`
- Filtering Attributes: vazio

### Step 4. Servicos por passageiro - Update

- Message: `Update`
- Primary Entity: `cr40f_servicosporpassageiro`
- Filtering Attributes: `cr40f_geral,cr40f_bancodedados`

### Step 5. Trocas de carro - Create

- Message: `Create`
- Primary Entity: `cr40f_trocasdecarro`
- Filtering Attributes: vazio

### Step 6. Trocas de carro - Update

- Message: `Update`
- Primary Entity: `cr40f_trocasdecarro`
- Filtering Attributes: `cr40f_motorista1,cr40f_motorista2`

### Step 7. Posse de veiculo - Create

- Message: `Create`
- Primary Entity: `new_possedeveiculo`
- Filtering Attributes: vazio

### Step 8. Posse de veiculo - Update

- Message: `Update`
- Primary Entity: `new_possedeveiculo`
- Filtering Attributes: `new_motorista`

### Step 9. Colisoes - Create

- Message: `Create`
- Primary Entity: `cr40f_colisao_v2`
- Filtering Attributes: vazio

### Step 10. Colisoes - Update

- Message: `Update`
- Primary Entity: `cr40f_colisao_v2`
- Filtering Attributes: `cr40f_motorista`

### Step 11. Recibos - Create

- Message: `Create`
- Primary Entity: `cr40f_recibos_v2`
- Filtering Attributes: vazio

### Step 12. Recibos - Update

- Message: `Update`
- Primary Entity: `cr40f_recibos_v2`
- Filtering Attributes: `cr40f_motorista`

## Passo 5: precisa de Pre Image?

Com esta configuracao recomendada, `PostOperation + Asynchronous`, o plugin nao depende de `Pre Image` para funcionar.

Se quiser manter `Pre Image`, nao atrapalha.

## Passo 6: permissoes do usuario tecnico

O usuario tecnico que executa o plugin precisa conseguir:

- ler `cr40f_reservadeveculos`
- ler `cr40f_servicosporpassageiro`
- ler `cr40f_bancodedados`
- ler `cr40f_trocasdecarro`
- ler `new_possedeveiculo`
- ler `cr40f_colisao_v2`
- ler `cr40f_recibos_v2`
- ler `cr40f_funcionarios`
- ler `systemuser`
- compartilhar registros

Na pratica, ele precisa de `GrantAccess` e `ModifyAccess`.

## Passo 7: como testar

### Cenario 1. Servico novo ja com motorista

1. crie um `cr40f_reservadeveculos`
2. preencha `cr40f_motorista`
3. salve
4. espere alguns segundos

Resultado esperado:

- o motorista recebe acesso ao servico
- o motorista recebe acesso aos itens de `cr40f_servicosporpassageiro`
- o motorista recebe acesso aos passageiros ligados

### Cenario 2. Servico existente sem motorista, depois com motorista

1. abra um servico existente
2. preencha `cr40f_motorista`
3. salve
4. espere alguns segundos

Resultado esperado:

- o motorista passa a enxergar o servico

### Cenario 3. Troca de motorista

1. abra um servico que ja tenha motorista
2. troque o `cr40f_motorista`
3. salve
4. espere alguns segundos

Resultado esperado:

- o novo motorista recebe acesso
- o antigo continua com acesso por enquanto

### Cenario 4. Funcionario sem email Microsoft

1. preencha um motorista cujo `cr40f_emailmicrosoft` esteja vazio
2. salve

Resultado esperado:

- salva normal
- nao compartilha
- nao bloqueia o usuario

### Cenario 5. Email Microsoft invalido

1. preencha um motorista cujo `cr40f_emailmicrosoft` exista
2. garanta que nao exista `systemuser` ativo com esse email
3. salve

Resultado esperado:

- o plugin da erro
- isso serve para avisar que o cadastro esta inconsistente

## Como validar acesso real

Validacao forte:

1. abra o registro como admin
2. rode o script de `principalobjectaccess`
3. confirme que existe linha para o `systemuser` do motorista

Se existir `poaCount: 1` ou mais para o item certo, o compartilhamento real aconteceu.

## Se der erro

Confira nesta ordem:

1. a DLL compilou?
2. o assembly registrado e o mais novo?
3. os steps estao em `PostOperation`?
4. os steps estao `Asynchronous`?
5. o ambiente do PRT e o certo?
6. o usuario tecnico tem permissao de compartilhar?
7. o funcionario tem `cr40f_emailmicrosoft`?
8. existe `systemuser` ativo com exatamente esse email?
9. existe mais de um `systemuser` ativo com esse email?

## Arquivos principais

- [ServiceDriverSharePlugin.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\ServiceDriverSharePlugin.cs)
- [DriverResolver.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\DriverResolver.cs)
- [PluginConfig.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\PluginConfig.cs)
- [ServicePassengerRepository.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\ServicePassengerRepository.cs)
