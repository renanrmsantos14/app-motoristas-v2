# DriverRecordSharing

Este README foi escrito para quem:

- nunca criou plugin Dataverse
- nunca usou Plugin Registration Tool
- quer um passo a passo sem assumir experiência prévia

## Primeiro: o que é esse Plugin Registration Tool?

O `Plugin Registration Tool`:

- é um programa do Windows
- não fica dentro da tela normal do Power Apps / Dataverse
- serve para enviar sua DLL para o Dataverse
- serve para cadastrar os steps do plugin

Ou seja:

- você compila o código aqui na sua máquina
- depois abre esse programa
- depois manda a DLL para o ambiente

## Onde fica esse Plugin Registration Tool?

Na sua máquina, neste momento, eu **não encontrei** a ferramenta instalada.

Eu também **não encontrei** o comando `pac`, que é uma das formas de abrir ferramentas do Power Platform.

Então, para você, hoje, a resposta prática é:

- o Plugin Registration Tool **não está instalado ou não está acessível no PATH**

## Então como conseguir essa ferramenta?

Você tem 3 caminhos possíveis. Use nesta ordem:

### Opção 1. Pedir para quem administra o Dataverse da empresa

Peça exatamente isto:

> Preciso do Plugin Registration Tool do Dataverse para registrar um assembly/plugin C# no ambiente.

Se a pessoa já trabalha com Dynamics / Dataverse, ela provavelmente já tem.

### Opção 2. Instalar pelo Power Platform CLI / SDK Tools

Se sua TI permitir, normalmente essa ferramenta vem por um destes caminhos:

1. Power Platform CLI
2. SDK / ferramentas de desenvolvimento do Dataverse
3. extensão/ferramentas do Power Platform para Visual Studio

Se você não sabe qual usar, o mais seguro para você é:

- pedir para a TI ou para quem já publica plugin no ambiente
- ou me pedir depois um passo a passo só de instalação da ferramenta

### Opção 3. Alguém registrar para você

Se você conseguir compilar a DLL, outra pessoa com a ferramenta pode:

- abrir o Plugin Registration Tool
- conectar no ambiente
- registrar seu plugin

## O que este plugin faz?

Quando um serviço `cr40f_reservadeveculos` recebe um motorista no campo `cr40f_motorista`, o plugin:

1. lê o funcionário
2. pega o email Microsoft do funcionário
3. localiza o `systemuser` correspondente
4. compartilha o serviço com esse usuário
5. compartilha os registros filhos de `cr40f_servicosporpassageiro`
6. compartilha os passageiros em `cr40f_bancodedados`

Versão atual:

- cria acesso
- não remove acesso antigo ainda

## O que você precisa antes de publicar

Você precisa de 4 coisas:

1. o código do plugin
2. o .NET funcionando
3. a DLL compilada
4. o Plugin Registration Tool

Hoje você já tem:

- o código do plugin
- o projeto C#

Você ainda precisa garantir:

- acesso ao Plugin Registration Tool
- acesso ao ambiente Dataverse correto

## Parte 1: gerar a DLL

### Passo 1. Abrir PowerShell

Abra o PowerShell.

### Passo 2. Ir para a pasta do repositório

```powershell
cd "C:\Users\mendo\Desktop\vscode\App Motoristas"
```

### Passo 3. Restaurar pacotes

```powershell
dotnet restore .\plugins\DriverRecordSharing\DriverRecordSharing.csproj
```

### Passo 4. Compilar

```powershell
dotnet build .\plugins\DriverRecordSharing\DriverRecordSharing.csproj -c Release
```

Se der certo, a DLL fica aqui:

- [Betinhos.DriverRecordSharing.dll](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\bin\Release\net462\Betinhos.DriverRecordSharing.dll)

## Parte 2: entender o que acontece depois

Depois de gerar a DLL, você **não publica pelo maker portal comum**.

Você precisa abrir o `Plugin Registration Tool`.

Dentro dele, você vai:

1. conectar no ambiente Dataverse
2. registrar a DLL
3. registrar os steps
4. salvar

## Parte 3: quando você tiver o Plugin Registration Tool

Quando alguém te passar a ferramenta ou instalar na sua máquina, faça assim.

## Parte 4: abrir o Plugin Registration Tool

1. abra o programa `Plugin Registration Tool`
2. faça login
3. escolha o ambiente Dataverse correto

Importante:

- confirme se é DEV, TESTE ou PRODUÇÃO
- não publique no ambiente errado

## Parte 5: registrar a DLL

### Passo 1. Abrir cadastro de assembly

No Plugin Registration Tool:

1. clique em `Register`
2. clique em `Register New Assembly`

### Passo 2. Selecionar a DLL

Escolha este arquivo:

- [Betinhos.DriverRecordSharing.dll](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\bin\Release\net462\Betinhos.DriverRecordSharing.dll)

### Passo 3. Preencher os dados

Preencha assim:

- Registration Mode: `Sandbox`
- Data Source / Location: `Database`

Depois confirme.

Se deu certo, você verá a classe:

- `Betinhos.DriverRecordSharing.ServiceDriverSharePlugin`

## Parte 6: registrar o step de Create

Esse step serve para quando o serviço já nasce com motorista preenchido.

### Preencha assim:

- Message: `Create`
- Primary Entity: `cr40f_reservadeveculos`
- Stage: `PostOperation`
- Execution Mode: `Asynchronous`
- Filtering Attributes: deixar vazio
- Run in User's Context: usuário técnico

Depois salve.

## Parte 7: registrar o step de Update

Esse step serve para quando o motorista muda em um serviço já existente.

### Preencha assim:

- Message: `Update`
- Primary Entity: `cr40f_reservadeveculos`
- Stage: `PostOperation`
- Execution Mode: `Asynchronous`
- Filtering Attributes: `cr40f_motorista`
- Run in User's Context: usuário técnico

Depois salve.

## Parte 8: adicionar a Pre Image no step de Update

Isso é obrigatório para o plugin saber qual era o motorista antes.

No step `Update`, adicione:

- Image Type: `Pre Image`
- Alias / Name: `pre`
- Attributes:
  - `cr40f_motorista`

Importante:

- `pre` tem que ser exatamente `pre`
- `cr40f_motorista` tem que ser exatamente esse nome

## Parte 9: usuário técnico

O plugin não deve rodar com seu usuário pessoal.

Ele deve rodar com um usuário técnico.

Esse usuário técnico precisa conseguir:

- ler `cr40f_reservadeveculos`
- ler `cr40f_funcionarios`
- ler `cr40f_servicosporpassageiro`
- ler `cr40f_bancodedados`
- ler `systemuser`
- compartilhar registros

Como esta versão só cria acesso, o mais importante aqui é:

- `GrantAccess`
- `ModifyAccess`

## Parte 10: conferir os dados antes do teste

Antes de testar, confira se existe correspondência entre:

- `cr40f_funcionarios.cr40f_emailmicrosoft`
- `systemuser.internalemailaddress`

Eles precisam ser iguais.

Exemplo:

- `fabio.souza@betinhos.onmicrosoft.com`
- `fabio.souza@betinhos.onmicrosoft.com`

Se forem diferentes:

- o plugin não encontra o usuário
- o compartilhamento falha

## Parte 11: teste simples

### Teste 1. Serviço com motorista

1. abra um registro de `cr40f_reservadeveculos`
2. preencha `cr40f_motorista`
3. salve

Como o plugin é assíncrono:

- ele pode demorar alguns segundos

### Teste 2. Validar acesso

Depois, entre como o motorista e confira se ele vê:

- o serviço
- os itens de `cr40f_servicosporpassageiro`
- os passageiros ligados

### Teste 3. Trocar motorista

1. troque o motorista
2. salve
3. espere alguns segundos
4. confira se o novo motorista ganhou acesso

Nesta versão:

- o motorista antigo continua com acesso

Isso é esperado.

## Parte 12: se der erro

Cheque nesta ordem:

1. a DLL foi compilada?
2. o Plugin Registration Tool está no ambiente certo?
3. o assembly foi registrado em `Sandbox`?
4. a Location/Data Source está `Database`?
5. o step `Create` existe?
6. o step `Update` existe?
7. o `Filtering Attributes` do Update está `cr40f_motorista`?
8. a Pre Image existe com alias `pre`?
9. o usuário técnico tem permissão?
10. o email do funcionário bate com o `systemuser`?

## Arquivos importantes

Projeto:
- [DriverRecordSharing.csproj](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\DriverRecordSharing.csproj)

Classe principal:
- [ServiceDriverSharePlugin.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\ServiceDriverSharePlugin.cs)

Configuração:
- [PluginConfig.cs](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\PluginConfig.cs)

README:
- [README.md](C:\Users\mendo\Desktop\vscode\App Motoristas\plugins\DriverRecordSharing\README.md)

## Resumo direto

Você ainda não está na etapa de “clicar em publicar”.

Sua ordem é:

1. conseguir o Plugin Registration Tool
2. compilar a DLL
3. abrir a ferramenta
4. conectar no Dataverse
5. registrar assembly
6. criar os 2 steps
7. testar

## Próximo passo recomendado

Se você quiser, eu posso fazer agora o próximo README também:

1. `COMO_INSTALAR_PLUGIN_REGISTRATION_TOOL.md`

ou posso te passar aqui, direto, o texto exato para você mandar para a TI pedir a ferramenta.
