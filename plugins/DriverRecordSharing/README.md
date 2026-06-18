# DriverRecordSharing

## Resposta curta

Sim: use `Asynchronous`.

Nao: com a versao atual do plugin, nao precisa criar `Image`.

Configuracao recomendada para todos os steps:

- Stage: `PostOperation`
- Execution Mode: `Asynchronous`
- Deployment: `Server`
- Image: `nenhuma`

## O que o plugin faz

O plugin compartilha registros com o `systemuser` do motorista.

Hoje ele atende:

- `cr40f_reservadeveculos`
- `cr40f_servicosporpassageiro`
- `cr40f_bancodedados` via servico por passageiro
- `cr40f_trocasdecarro`
- `new_possedeveiculo`
- `cr40f_colisao_v2`
- `cr40f_recibos_v2`

Regras:

- se nao houver motorista, nao da erro
- se o funcionario estiver sem `cr40f_emailmicrosoft`, nao da erro e nao compartilha
- se existir `cr40f_emailmicrosoft` preenchido e nao existir um `systemuser` ativo correspondente, da erro
- se existir mais de um `systemuser` ativo com o mesmo email, da erro
- o plugin so concede acesso
- ele nao remove acesso antigo por enquanto

## Onde esta a DLL

Arquivo compilado:

- [Betinhos.DriverRecordSharing.dll](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\bin\Release\net462\Betinhos.DriverRecordSharing.dll)

## Passo 1: compilar

No PowerShell:

```powershell
cd "C:\Users\mendo\Desktop\vscode\App Motoristas"
dotnet build .\plugins\DriverRecordSharing\DriverRecordSharing.csproj -c Release
```

Se der erro de assinatura:

```powershell
cd "C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing"
.\generate-strong-name-key.ps1
dotnet build .\DriverRecordSharing.csproj -c Release
```

## Passo 2: abrir o PRT

No `Plugin Registration Tool`:

1. conecte no ambiente certo
2. confirme o ambiente antes de continuar

## Passo 3: se o assembly ja existe

Se voce ja registrou esse plugin antes, faca assim:

1. localize o assembly `Betinhos.DriverRecordSharing`
2. clique com o botao direito
3. clique em `Update`
4. selecione a DLL nova
5. confirme

Isso atualiza o codigo sem criar outro assembly.

## Passo 4: se o assembly ainda nao existe

1. clique em `Register`
2. clique em `Register New Assembly`
3. selecione a DLL
4. use:

- Registration Mode: `Sandbox`
- Location: `Database`

5. confirme

## Passo 5: criar os steps

Padrao para todos:

- Stage: `PostOperation`
- Execution Mode: `Asynchronous`
- Deployment: `Server`
- Run in User's Context: usuario tecnico
- Image: nao criar

### 1. Servicos - Create

- Message: `Create`
- Primary Entity: `cr40f_reservadeveculos`
- Filtering Attributes: vazio

### 2. Servicos - Update

- Message: `Update`
- Primary Entity: `cr40f_reservadeveculos`
- Filtering Attributes: `cr40f_motorista`

### 3. Servicos por passageiro - Create

- Message: `Create`
- Primary Entity: `cr40f_servicosporpassageiro`
- Filtering Attributes: vazio

### 4. Servicos por passageiro - Update

- Message: `Update`
- Primary Entity: `cr40f_servicosporpassageiro`
- Filtering Attributes: `cr40f_geral,cr40f_bancodedados`

### 5. Trocas de carro - Create

- Message: `Create`
- Primary Entity: `cr40f_trocasdecarro`
- Filtering Attributes: vazio

### 6. Trocas de carro - Update

- Message: `Update`
- Primary Entity: `cr40f_trocasdecarro`
- Filtering Attributes: `cr40f_motorista1,cr40f_motorista2`

### 7. Posse de veiculo - Create

- Message: `Create`
- Primary Entity: `new_possedeveiculo`
- Filtering Attributes: vazio

### 8. Posse de veiculo - Update

- Message: `Update`
- Primary Entity: `new_possedeveiculo`
- Filtering Attributes: `new_motorista`

### 9. Colisoes - Create

- Message: `Create`
- Primary Entity: `cr40f_colisao_v2`
- Filtering Attributes: vazio

### 10. Colisoes - Update

- Message: `Update`
- Primary Entity: `cr40f_colisao_v2`
- Filtering Attributes: `cr40f_motorista`

### 11. Recibos - Create

- Message: `Create`
- Primary Entity: `cr40f_recibos_v2`
- Filtering Attributes: vazio

### 12. Recibos - Update

- Message: `Update`
- Primary Entity: `cr40f_recibos_v2`
- Filtering Attributes: `cr40f_motorista`

## Precisa de Image?

Nao.

Motivo:

- o plugin atual roda em `PostOperation`
- ele busca o valor atual no proprio registro quando precisa
- ele nao depende de comparar valor antigo x novo para funcionar

Entao:

- `Pre Image`: nao precisa
- `Post Image`: nao precisa

Se voce criar image por engano, nao costuma quebrar. So nao e necessario.

## Por que Asynchronous?

Porque e mais seguro operacionalmente para esse caso.

Vantagens:

- nao trava a tela do usuario esperando o compartilhamento
- reduz risco de lentidao no salvar
- o acesso entra alguns segundos depois

Tradeoff:

- o motorista nao recebe acesso no exato milissegundo do save
- normalmente entra logo depois

## Permissoes do usuario tecnico

Esse usuario precisa:

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

Na pratica, ele precisa conseguir `GrantAccess` e `ModifyAccess`.

## Como testar

### Teste 1. Servico novo com motorista

1. crie um `cr40f_reservadeveculos`
2. preencha `cr40f_motorista`
3. salve
4. espere alguns segundos

Esperado:

- o motorista recebe acesso ao servico
- recebe acesso aos `cr40f_servicosporpassageiro`
- recebe acesso aos passageiros relacionados

### Teste 2. Servico existente sem motorista

1. abra o servico
2. preencha `cr40f_motorista`
3. salve
4. espere alguns segundos

Esperado:

- o motorista passa a ver o servico

### Teste 3. Troca de motorista

1. abra um servico que ja tenha motorista
2. troque o `cr40f_motorista`
3. salve
4. espere alguns segundos

Esperado:

- o novo motorista recebe acesso
- o antigo continua com acesso por enquanto

### Teste 4. Funcionario sem email Microsoft

1. selecione um funcionario com `cr40f_emailmicrosoft` vazio
2. salve

Esperado:

- salva normal
- nao compartilha
- nao bloqueia

### Teste 5. Email Microsoft inconsistente

1. use um funcionario com `cr40f_emailmicrosoft` preenchido
2. garanta que nao exista `systemuser` ativo correspondente
3. salve

Esperado:

- o plugin falha
- isso avisa que o cadastro esta inconsistente

## Como validar o compartilhamento real

Validacao forte:

1. abra o registro
2. rode o script de consulta do `principalobjectaccess`
3. confirme que existe linha para o `systemuser` do motorista

Se aparecer `poaCount: 1` ou mais no registro certo, o compartilhamento aconteceu de verdade.

## Se der erro

Confira:

1. a DLL foi compilada?
2. o assembly foi atualizado no PRT?
3. os steps estao em `PostOperation`?
4. os steps estao `Asynchronous`?
5. voce nao colocou filtro errado no `Update`?
6. o usuario tecnico tem permissao?
7. o funcionario tem `cr40f_emailmicrosoft`?
8. existe um `systemuser` ativo com exatamente esse email?
9. existe mais de um `systemuser` ativo com esse email?

## Arquivos principais

- [README.md](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\README.md)
- [ServiceDriverSharePlugin.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\ServiceDriverSharePlugin.cs)
- [DriverResolver.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\DriverResolver.cs)
- [PluginConfig.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\PluginConfig.cs)
- [ServicePassengerRepository.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\ServicePassengerRepository.cs)
