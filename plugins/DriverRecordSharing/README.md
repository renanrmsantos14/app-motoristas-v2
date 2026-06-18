# DriverRecordSharing

Plugin Dataverse em C# para compartilhar `cr40f_reservadeveculos`, `cr40f_servicosporpassageiro` e `cr40f_bancodedados` com motorista correto via `GrantAccessRequest` e `ModifyAccessRequest`.

## Build

```powershell
dotnet restore .\plugins\DriverRecordSharing\DriverRecordSharing.csproj
dotnet build .\plugins\DriverRecordSharing\DriverRecordSharing.csproj -c Release
```

Saida esperada:
- assembly `Betinhos.DriverRecordSharing.dll`
- pasta `bin\Release\net462\`

## O que plugin faz

- `Create` de `cr40f_reservadeveculos`
  - se `cr40f_motorista` vier preenchido, resolve `systemuser` por `cr40f_funcionarios.cr40f_emailmicrosoft -> systemuser.internalemailaddress`
  - compartilha serviço
  - compartilha linhas de `cr40f_servicosporpassageiro`
  - compartilha passageiros de `cr40f_bancodedados`
- `Update` de `cr40f_reservadeveculos`
  - compara `cr40f_motorista` novo vs pre-image `pre`
  - concede acesso ao novo motorista
  - não revoga acesso do antigo por enquanto

## Registro no Plugin Registration Tool

Assembly:
- Isolation Mode: `Sandbox`
- Location: `Database`

Steps:
1. `Create`
   - Message: `Create`
   - Primary Entity: `cr40f_reservadeveculos`
   - Stage: `PostOperation`
   - Execution Mode: `Asynchronous`
   - Filtering Attributes: nenhum
   - Run in User's Context: usuário técnico
2. `Update`
   - Message: `Update`
   - Primary Entity: `cr40f_reservadeveculos`
   - Stage: `PostOperation`
   - Execution Mode: `Asynchronous`
   - Filtering Attributes: `cr40f_motorista`
   - Pre Image alias: `pre`
   - Pre Image columns: `cr40f_motorista`
   - Run in User's Context: usuário técnico

## Permissões do usuário técnico

Necessárias para executar plugin:
- Ler `cr40f_reservadeveculos`
- Ler `cr40f_funcionarios`
- Ler `cr40f_servicosporpassageiro`
- Ler `cr40f_bancodedados`
- Ler `systemuser`
- Compartilhar registros das tabelas acima
- Reatribuição não é necessária
- Permissão para executar `GrantAccess`, `ModifyAccess` e `RevokeAccess`

## Role Motorista

Role do motorista deve ficar mínima:
- `Read` Basic/User nas tabelas necessárias
- `Write` Basic/User apenas onde app realmente atualiza
- sem `Share`
- sem `Assign`
- sem `Delete`
- sem `Read` Organization em `cr40f_reservadeveculos`, `cr40f_servicosporpassageiro`, `cr40f_bancodedados`
- sem acesso ao app interno operacional

Compartilhamento vira fonte real de acesso aos registros.

## Plano de teste

1. Criar motorista de teste com `cr40f_emailmicrosoft` igual ao `systemuser.internalemailaddress`.
2. Confirmar que antes do compartilhamento ele não vê serviço nem passageiro.
3. Criar ou atualizar um `cr40f_reservadeveculos` com `cr40f_motorista`.
4. Confirmar acesso ao serviço.
5. Confirmar acesso às linhas de `cr40f_servicosporpassageiro`.
6. Confirmar acesso aos passageiros ligados.
7. Trocar motorista e confirmar ganho de acesso do novo.
8. Confirmar que o motorista antigo mantém acesso por enquanto.
9. Validar depois a fase 2 de revogação em plugin separado ou nova versão.

## Riscos

- Crescimento de `PrincipalObjectAccess` com volume alto de compartilhamentos.
- Se `cr40f_emailmicrosoft` divergir de `systemuser.internalemailaddress`, plugin falha de forma explícita.
- Serviços sem linhas em `cr40f_servicosporpassageiro` só compartilham o registro principal.
- Sem revogação nesta versão, acessos antigos acumulam até fase 2.
