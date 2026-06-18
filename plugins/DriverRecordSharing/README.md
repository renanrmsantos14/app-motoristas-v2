# DriverRecordSharing

Plugin Dataverse em C# para compartilhar:
- `cr40f_reservadeveculos`
- `cr40f_servicosporpassageiro`
- `cr40f_bancodedados`

Versão atual:
- cria acesso para motorista novo
- não remove acesso antigo ainda

## O que este plugin faz

Quando um serviço (`cr40f_reservadeveculos`) recebe um motorista em `cr40f_motorista`, o plugin:

1. lê o funcionário escolhido
2. pega `cr40f_emailmicrosoft`
3. procura um `systemuser` com mesmo `internalemailaddress`
4. compartilha o serviço com esse usuário
5. compartilha os registros filhos de `cr40f_servicosporpassageiro`
6. compartilha os passageiros ligados em `cr40f_bancodedados`

## Antes de começar

Você vai precisar de:

1. acesso ao ambiente Dataverse
2. permissão para abrir o Plugin Registration Tool
3. um usuário técnico no Dataverse para rodar o plugin
4. .NET instalado na máquina
5. este projeto aberto na pasta:
   - [plugins/DriverRecordSharing](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing)

## Parte 1: gerar a DLL

### Passo 1. Abrir terminal na pasta do projeto

Use PowerShell na raiz do repositório:

```powershell
cd "C:\Users\mendo\Desktop\vscode\App Motoristas"
```

### Passo 2. Restaurar pacotes

```powershell
dotnet restore .\plugins\DriverRecordSharing\DriverRecordSharing.csproj
```

Se der certo, ele baixa os pacotes necessários.

### Passo 3. Compilar

```powershell
dotnet build .\plugins\DriverRecordSharing\DriverRecordSharing.csproj -c Release
```

Se der certo, a DLL fica aqui:

- [Betinhos.DriverRecordSharing.dll](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\bin\Release\net462\Betinhos.DriverRecordSharing.dll)

## Parte 2: abrir o Plugin Registration Tool

Você precisa do Plugin Registration Tool conectado no ambiente correto do Dataverse.

Se você já tem a ferramenta:
1. abra a ferramenta
2. faça login
3. escolha o ambiente correto

Se você não tem a ferramenta:
1. peça para quem administra o ambiente ou a solution te passar o Plugin Registration Tool
2. normalmente ele vem no pacote `Power Platform Tools` / `SDK Tools`

## Parte 3: registrar a DLL

### Passo 1. Registrar assembly

No Plugin Registration Tool:

1. clique em `Register`
2. clique em `Register New Assembly`
3. selecione a DLL:
   - [Betinhos.DriverRecordSharing.dll](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\bin\Release\net462\Betinhos.DriverRecordSharing.dll)

### Passo 2. Preencher dados do assembly

Na tela de cadastro do assembly, deixe assim:

- Registration Mode: `Sandbox`
- Data Source: `Database`

Depois confirme.

Se der certo, vai aparecer a classe:

- `Betinhos.DriverRecordSharing.ServiceDriverSharePlugin`

## Parte 4: registrar o step de Create

Esse step serve para quando o serviço já nasce com motorista preenchido.

### Passo 1. Criar step

1. selecione a classe `Betinhos.DriverRecordSharing.ServiceDriverSharePlugin`
2. clique em `Register New Step`

### Passo 2. Preencher o step

Preencha assim:

- Message: `Create`
- Primary Entity: `cr40f_reservadeveculos`
- Stage: `PostOperation`
- Execution Mode: `Asynchronous`
- Filtering Attributes: deixar vazio
- Run in User's Context: usuário técnico

Depois salve.

## Parte 5: registrar o step de Update

Esse step serve para quando o motorista muda depois que o serviço já existe.

### Passo 1. Criar step

1. selecione a mesma classe `Betinhos.DriverRecordSharing.ServiceDriverSharePlugin`
2. clique em `Register New Step`

### Passo 2. Preencher o step

Preencha assim:

- Message: `Update`
- Primary Entity: `cr40f_reservadeveculos`
- Stage: `PostOperation`
- Execution Mode: `Asynchronous`
- Filtering Attributes: `cr40f_motorista`
- Run in User's Context: usuário técnico

Depois salve.

## Parte 6: adicionar a Pre Image no step de Update

A Pre Image serve para o plugin saber qual era o motorista antigo.

### Passo 1. Abrir o step de Update

1. localize o step `Update` que você acabou de criar
2. abra o cadastro dele

### Passo 2. Adicionar imagem

Adicione uma Pre Image com:

- Image Type: `Pre Image`
- Name / Alias: `pre`
- Attributes:
  - `cr40f_motorista`

Depois salve.

Importante:
- o alias tem que ser exatamente `pre`
- o campo tem que ser exatamente `cr40f_motorista`

## Parte 7: preparar o usuário técnico

O plugin deve rodar com um usuário técnico. Não use usuário pessoal de administrador.

Esse usuário técnico precisa conseguir:

- ler `cr40f_reservadeveculos`
- ler `cr40f_funcionarios`
- ler `cr40f_servicosporpassageiro`
- ler `cr40f_bancodedados`
- ler `systemuser`
- compartilhar registros necessários

Na prática, quem administra segurança no ambiente precisa garantir que esse usuário consiga executar:

- `GrantAccess`
- `ModifyAccess`

Observação:
- a versão atual não usa revogação
- então `RevokeAccess` não é necessário agora

## Parte 8: conferir o motorista de teste

Antes de testar, confira se existe um funcionário correto.

Você precisa de um registro em `cr40f_funcionarios` com:

- `cr40f_emailmicrosoft` preenchido

E precisa existir um `systemuser` com:

- `internalemailaddress` exatamente igual

Exemplo:

- `cr40f_funcionarios.cr40f_emailmicrosoft = fabio.souza@betinhos.onmicrosoft.com`
- `systemuser.internalemailaddress = fabio.souza@betinhos.onmicrosoft.com`

Se os dois forem diferentes, o plugin falha.

## Parte 9: testar na prática

### Teste 1. Motorista sem acesso inicial

1. entre com o usuário do motorista
2. confirme que ele não vê todos os serviços e passageiros livremente

### Teste 2. Compartilhar um serviço

1. entre com usuário administrativo/operacional
2. abra um registro de `cr40f_reservadeveculos`
3. preencha `cr40f_motorista`
4. salve

Como o step é assíncrono:
- o plugin não roda exatamente no mesmo segundo
- espere alguns segundos

### Teste 3. Validar acesso

Depois:

1. entre como motorista
2. veja se ele passou a enxergar:
   - o serviço
   - os registros de `cr40f_servicosporpassageiro`
   - os passageiros ligados

### Teste 4. Trocar motorista

1. troque o `cr40f_motorista` para outro funcionário
2. salve
3. espere alguns segundos
4. valide se o novo motorista ganhou acesso

Importante:
- o motorista antigo ainda continua com acesso
- isso é esperado nesta versão

## Parte 10: como saber se deu erro

Se não funcionar, olhe:

1. se o step está `Enabled`
2. se está no ambiente certo
3. se o `Primary Entity` está certo:
   - `cr40f_reservadeveculos`
4. se o `Filtering Attributes` do Update está certo:
   - `cr40f_motorista`
5. se a Pre Image existe com alias:
   - `pre`
6. se o usuário técnico tem permissão suficiente
7. se `cr40f_emailmicrosoft` bate exatamente com `systemuser.internalemailaddress`

## Parte 11: segurança recomendada para role Motorista

A role do motorista deve ser mínima.

Recomendado:

- `Read` básico/user apenas no necessário
- `Write` apenas no que o app realmente usa
- sem `Share`
- sem `Assign`
- sem `Delete`
- sem `Read Organization` em:
  - `cr40f_reservadeveculos`
  - `cr40f_servicosporpassageiro`
  - `cr40f_bancodedados`
- sem acesso ao app interno operacional

Ideia:
- o motorista não ganha acesso geral
- ele só vê o que o plugin compartilhou

## Parte 12: arquivos importantes

Projeto:
- [DriverRecordSharing.csproj](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\DriverRecordSharing.csproj)

Classe principal:
- [ServiceDriverSharePlugin.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\ServiceDriverSharePlugin.cs)

Configuração de nomes lógicos:
- [PluginConfig.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\PluginConfig.cs)

Resolver de usuário:
- [DriverResolver.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\DriverResolver.cs)

Grant / Modify access:
- [DataverseAccessHelper.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\DataverseAccessHelper.cs)

Busca de filhos:
- [ServicePassengerRepository.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\ServicePassengerRepository.cs)

## Resumo curto

Ordem certa:

1. rodar `dotnet restore`
2. rodar `dotnet build`
3. abrir Plugin Registration Tool
4. registrar assembly em `Sandbox` + `Database`
5. criar step `Create`
6. criar step `Update`
7. adicionar Pre Image `pre` no Update
8. configurar usuário técnico
9. testar com um motorista real

## Limitações desta versão

- não remove acesso antigo
- acessos antigos podem acumular
- se não existir `systemuser` correspondente ao email do funcionário, o plugin falha
