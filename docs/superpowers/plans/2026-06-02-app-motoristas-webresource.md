# App Motoristas Webresource Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `App Betinhos Motoristas.msapp` as a standalone Dataverse web resource: one HTML file containing HTML, CSS, and JS.

**Architecture:** Treat the Canvas App as source-of-truth for behavior, not for generated markup. Port the app into a small JS runtime with explicit state, screen router, Dataverse API layer, Flow API layer, and reusable UI components. Keep a modular source during development, then bundle into one upload-ready HTML.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Dataverse `Xrm.WebApi`, Model-driven app query parameters, browser camera APIs, canvas signature capture, Power Automate HTTP/custom connector replacement where required.

---

## Inventory Extracted

**Source package**
- Original: `App Betinhos Motoristas.msapp`
- Extracted folder: `extracted-msapp`
- MSApp structure: `2.4.0`
- Power Apps doc version: `1.349`
- Last saved UTC: `2026-06-02 16:58:02`
- Layout: `1366x768`, landscape, desktop/tablet, scale-to-fit off
- Parser errors: `0`
- Binding errors: `0`

**Screens**
- `Src/TelaInicial.pa.yaml`
- `Src/TelaServicos.pa.yaml` / extracted console showed `TelaServiços`
- `Src/TelaDetalhes.pa.yaml`
- `Src/TelaVoucher.pa.yaml`
- `Src/TelaAssinaturaPassageiro.pa.yaml`
- `Src/TelaFinalizar.pa.yaml`
- `Src/TelaFotoManutencao.pa.yaml` / extracted console showed `TelaFotoManutenção`
- `Src/TelaPreviewFotoManutencao.pa.yaml` / extracted console showed `TelaPreviewFotoManutenção`
- `Src/TelaHistorico.pa.yaml` / extracted console showed `TelaHistórico`
- `Src/TelaDetalhesHistorico.pa.yaml`
- `Src/TelaCanceladonoLocal.pa.yaml`

**Control volume**
- Screens: `11`
- Containers: `281`
- Buttons: `55` total (`ButtonCanvas` + classic `button`)
- Text labels: `190` total (`TextCanvas` + classic labels)
- Inputs: `10`
- Combo boxes: `7`
- Galleries: `2`
- Spinner controls: `11`
- Camera: `1`
- Pen input: `1`
- HTML viewer: `1`

**Dataverse tables**
- `Cliente` -> `cr40f_clientes1s` / `cr40f_clientes1`
- `Banco de Dados` -> `cr40f_bancodedadoses` / `cr40f_bancodedados`
- `Funcionarios` -> `cr40f_funcionarioses` / `cr40f_funcionarios`
- `Geral` -> `cr40f_reservadeveculoses` / `cr40f_reservadeveculos`
- `Veiculos` -> `cr40f_veiculoses` / `cr40f_veiculos`
- `Manutencoes` -> `cr40f_manutencoeses` / `cr40f_manutencoes`
- `Trocas de Carro` -> `cr40f_trocasdecarros` / `cr40f_trocasdecarro`
- `Servicos por Passageiro` -> `cr40f_servicosporpassageiros` / `cr40f_servicosporpassageiro`
- `Posse de Veiculos` -> `new_possedeveiculos` / `new_possedeveiculo`

**Power Automate flows**
- `FlowGerarVoucherAppMotoristas`
  - Trigger: manual run through `shared_logicflows`
  - Input fields: `GUID SERVICO`, `Assinatura Passageiro`, `Desvio`, `KmInicial`, `KmFinal`, `HorarioInicial`, `EsperaInicial`, `EsperaFinal`, `Pedagio`, `Estacionamento`, `Combustivel`, `Hospedagem`, `Outros`, `Observacao`, `HorarioFinal`, `DatadeAssinatura`
  - Response: `{ id: string }`
- `FlowSalvarFotosManutencao|AppMotoristas`
  - Trigger: manual run through `shared_logicflows`
  - Input fields: `GUID Geral`, `Foto Nota Fiscal`, `Foto 1`, `Foto 2`, `Foto 3`
  - Response: `{ status: string }`

**Entry behavior**
- Reads URL params:
  - `servicoId`
  - `tipo`
- Resolves logged-in driver:
  - Power Fx: `LookUp(Funcionarios, 'Email Microsoft' = User().Email)`
- Start screen:
  - If `servicoId` exists: `TelaServicos`
  - Else: `TelaInicial`

**Main operational behavior**
- `TelaServicos`
  - Builds driver agenda.
  - Consolidates service, maintenance, and vehicle-swap records into `colAgenda`.
  - Builds searchable UI collection `colAgendaUI`.
- `TelaDetalhes`
  - Shows selected item details.
  - Handles service actions.
  - Handles vehicle swap completion.
  - Updates `Trocas de Carro`, `Posse de Veiculos`, and `Geral`.
- `TelaVoucher`
  - Validates KM and time fields.
  - Allows missing passenger signature with warning.
  - Calls `FlowGerarVoucherAppMotoristas`.
  - Patches `Geral` to `Concluido`.
- `TelaAssinaturaPassageiro`
  - Captures `PenInputPas.Image`.
  - Converts signature image to JSON/base64-like payload.
- `TelaFinalizar`
  - Finalizes maintenance.
  - Patches `Manutencoes`.
  - Patches related `Geral`.
  - Sends four maintenance images through `FlowSalvarFotosManutencao|AppMotoristas`.
- `TelaFotoManutencao`
  - Uses camera device list.
  - Switches front/back camera.
  - Captures image stream.
- `TelaPreviewFotoManutencao`
  - Stores captured image into one of four slots: `NOTAFISCAL`, `FOTO1`, `FOTO2`, `FOTO3`.
- `TelaCanceladonoLocal`
  - If observation is blank: returns to services.
  - If observation exists: patches `Geral` with final observation and status `Requer Analise`.
- `TelaHistorico`
  - Builds finalized service history.
  - Uses `ForAll` plus collection mutation; port carefully.

**AppChecker warnings**
- `79` missing accessible labels.
- `15` missing tab stops.
- `12` cross-screen event dependencies.
- `6` delegation warnings.
- `4` `ForAll` with mutation warnings.
- `2` unused variables.
- `2` delegation warnings on unsupported column operations.
- `1` missing alternative input for pen control.
- `1` helpful control setting warning.
- `1` read-only collection initialized but never updated.

**Assets**
- `Resources/myhnyueu.jpg`
- `Assets/Images/bd7d5f28-81c5-4c0e-9c19-59e59e1d22cf.png`
- `Resources/PublishInfo.json`

---

## Target File Structure

During development:

- Create: `src/index.html`
  - Webresource shell, root containers, modal host, toast host.
- Create: `src/styles.css`
  - Responsive layout, theme, cards, buttons, forms, camera/signature surfaces.
- Create: `src/app.js`
  - App bootstrap, route handling, query param handling, user context, screen registration.
- Create: `src/state.js`
  - Global state equivalent for `var*`, `gParam*`, and collections.
- Create: `src/dataverse.js`
  - `Xrm.WebApi` wrappers, entity set names, selects, expands, patches.
- Create: `src/flows.js`
  - Voucher and maintenance-photo flow calls.
- Create: `src/screens/home.js`
  - `TelaInicial`.
- Create: `src/screens/services.js`
  - `TelaServicos`, agenda loading, filtering, search.
- Create: `src/screens/detail.js`
  - `TelaDetalhes`, service/maintenance/swap detail actions.
- Create: `src/screens/voucher.js`
  - Voucher form, validation, flow call, final status patch.
- Create: `src/screens/signature.js`
  - Signature canvas replacement for `PenInputPas`.
- Create: `src/screens/finalize.js`
  - Maintenance finalization and photo flow.
- Create: `src/screens/camera.js`
  - Camera capture and preview.
- Create: `src/screens/history.js`
  - `TelaHistorico` and `TelaDetalhesHistorico`.
- Create: `src/screens/cancel-local.js`
  - `TelaCanceladonoLocal`.
- Create: `src/components.js`
  - Buttons, cards, fields, loading, empty states, toast, modal.
- Create: `src/utils.js`
  - Date, money, text, GUID, base64, choice-label helpers.
- Create: `src/build-single-html.ps1`
  - Bundles `src/index.html`, `src/styles.css`, and JS modules into `dist/new_app_motoristas.html`.
- Create: `dist/new_app_motoristas.html`
  - Final upload-ready webresource.
- Create: `docs/APP_MOTORISTAS_INVENTARIO.md`
  - Stable inventory and field map.

Final deliverable:

- `dist/new_app_motoristas.html`

---

## Migration Order

### Task 1: Freeze Inventory

**Files:**
- Read: `extracted-msapp/Header.json`
- Read: `extracted-msapp/Properties.json`
- Read: `extracted-msapp/References/DataSources.json`
- Read: `extracted-msapp/Src/*.pa.yaml`
- Create: `docs/APP_MOTORISTAS_INVENTARIO.md`

- [ ] Step 1: Create a table of screens, source YAML paths, primary behavior, Dataverse dependencies, and Flow dependencies.
- [ ] Step 2: Create a table of all Dataverse logical names and entity set names.
- [ ] Step 3: Create a table of all option-set labels used by formulas.
- [ ] Step 4: Create a table of all Power Fx collections:
  - `colAgenda`
  - `colAgendaUI`
  - `colAgendaServicos`
  - `colAgendaManut`
  - `colTrocasFiltradas`
  - `colGuidProgramados`
  - `colAgendaTrocas`
  - `colAgendaServicosFinalizados`
  - `colAgendaServicosFinalizadosFiltrado`
  - `colCameras`
- [ ] Step 5: Verify the extracted text encoding before copying labels into UI.

Run:

```powershell
rg -n "ClearCollect\(|Collect\(|Set\(|Patch\(|UpdateIf\(|FlowGerarVoucher|FlowSalvarFotos" .\extracted-msapp\Src
```

Expected:

```txt
Output lists all collection, state, patch, and flow formulas used by the app.
```

### Task 2: Build Dataverse API Layer

**Files:**
- Create: `src/dataverse.js`
- Create: `src/utils.js`

- [ ] Step 1: Define entity metadata map.

```js
export const ENTITIES = {
  clientes: { set: "cr40f_clientes1s", id: "cr40f_clientes1id" },
  bancoDados: { set: "cr40f_bancodedadoses", id: "cr40f_bancodedadosid" },
  funcionarios: { set: "cr40f_funcionarioses", id: "cr40f_funcionariosid" },
  geral: { set: "cr40f_reservadeveculoses", id: "cr40f_reservadeveculosid" },
  veiculos: { set: "cr40f_veiculoses", id: "cr40f_veiculosid" },
  manutencoes: { set: "cr40f_manutencoeses", id: "cr40f_manutencoesid" },
  trocasCarro: { set: "cr40f_trocasdecarros", id: "cr40f_trocasdecarroid" },
  servicosPassageiro: { set: "cr40f_servicosporpassageiros", id: "cr40f_servicosporpassageiroid" },
  posseVeiculos: { set: "new_possedeveiculos", id: "new_possedeveiculoid" }
};
```

- [ ] Step 2: Add `retrieveMultiple`, `retrieveOne`, `update`, `create`, and `deleteRecord` wrappers.
- [ ] Step 3: Add OData escaping helpers for GUID and text.
- [ ] Step 4: Test inside Model-driven context with a read-only call to logged-in employee.

### Task 3: Build App State And Router

**Files:**
- Create: `src/state.js`
- Create: `src/app.js`
- Create: `src/index.html`

- [ ] Step 1: Mirror critical Power Fx variables.

```js
export const state = {
  loading: false,
  statusMsg: "",
  erroApp: "",
  gParamServicoId: "",
  gParamTipo: "",
  gParamConsumed: false,
  motoristaUser: null,
  servicoSelecionado: null,
  detalheAtual: null,
  agenda: [],
  agendaUI: [],
  assinaturaPassageiro: "",
  assinou: false,
  fotosManutencao: {
    notaFiscal: null,
    foto1: null,
    foto2: null,
    foto3: null
  }
};
```

- [ ] Step 2: Implement routes matching Canvas screens.
- [ ] Step 3: Read URL params `servicoId` and `tipo`.
- [ ] Step 4: Resolve current user from Dataverse employee table.
- [ ] Step 5: Start on services screen when `servicoId` exists.

### Task 4: Port Agenda Loading

**Files:**
- Create: `src/screens/services.js`
- Modify: `src/dataverse.js`
- Modify: `src/state.js`

- [ ] Step 1: Port `TelaServicos.OnVisible` into JS functions:
  - `loadServiceAgenda()`
  - `loadMaintenanceAgenda()`
  - `loadSwapAgenda()`
  - `buildAgendaUI()`
- [ ] Step 2: Replace `ClearCollect` with array assignment.
- [ ] Step 3: Replace `AddColumns` with `.map`.
- [ ] Step 4: Replace `Filter` with OData first when delegable, JS filter second only for small derived sets.
- [ ] Step 5: Preserve sort by `DtOrdem`.

Risk:

```txt
Do not copy Power Apps delegation behavior blindly.
Large Dataverse tables need OData filters.
```

### Task 5: Port Detail Screen

**Files:**
- Create: `src/screens/detail.js`
- Modify: `src/components.js`
- Modify: `src/dataverse.js`

- [ ] Step 1: Render one detail view for `SERVICO`.
- [ ] Step 2: Render one detail view for `MANUTENCAO`.
- [ ] Step 3: Render one detail view for `TROCA`.
- [ ] Step 4: Port cancel-in-place navigation to `cancel-local.js`.
- [ ] Step 5: Port vehicle-swap completion exactly:
  - Patch current driver completion flag.
  - Re-fetch `Trocas de Carro`.
  - Decide `_executarFluxoCompleto`.
  - Patch `Status da Troca de Carro` to concluded only when allowed.
  - Patch `Posse de Veiculos`.
  - Patch related `Geral` finalization date.
  - Refresh local `agenda` and `agendaUI`.

### Task 6: Port Voucher Flow

**Files:**
- Create: `src/screens/voucher.js`
- Create: `src/flows.js`
- Modify: `src/dataverse.js`

- [ ] Step 1: Implement voucher form fields:
  - KM initial
  - KM final
  - initial time
  - final time
  - waiting initial
  - waiting final
  - toll
  - parking
  - fuel
  - lodging
  - others
  - deviation
  - observation
- [ ] Step 2: Port validations:
  - service GUID required
  - KM initial required
  - KM final required
  - KM final greater than KM initial
  - initial time required
- [ ] Step 3: Keep missing signature as warning, not blocker.
- [ ] Step 4: Call voucher Flow.
- [ ] Step 5: Patch `Geral`:
  - `Status de Operacao` = concluded
  - `Rascunho Voucher` = blank
  - `Data de Finalizacao` = now
- [ ] Step 6: Navigate to final screen.

### Task 7: Port Signature Capture

**Files:**
- Create: `src/screens/signature.js`
- Modify: `src/screens/voucher.js`

- [ ] Step 1: Replace Power Apps `PenInputPas` with `<canvas>`.
- [ ] Step 2: Add pointer events for mouse and touch.
- [ ] Step 3: Add clear button.
- [ ] Step 4: Save `canvas.toDataURL("image/png")` into `state.assinaturaPassageiro`.
- [ ] Step 5: Add accessible text fallback for signature because AppChecker flagged missing alternative input.

### Task 8: Port Maintenance Photo Flow

**Files:**
- Create: `src/screens/camera.js`
- Create: `src/screens/finalize.js`
- Modify: `src/flows.js`
- Modify: `src/dataverse.js`

- [ ] Step 1: Replace Power Apps camera with `navigator.mediaDevices.getUserMedia`.
- [ ] Step 2: Support front/back camera switching.
- [ ] Step 3: Capture four slots:
  - `NOTAFISCAL`
  - `FOTO1`
  - `FOTO2`
  - `FOTO3`
- [ ] Step 4: Convert images to base64 without Data URL prefix.
- [ ] Step 5: Patch `Manutencoes`.
- [ ] Step 6: Patch related `Geral`.
- [ ] Step 7: Call `FlowSalvarFotosManutencao|AppMotoristas`.

### Task 9: Port History

**Files:**
- Create: `src/screens/history.js`
- Modify: `src/dataverse.js`

- [ ] Step 1: Port finalized services query.
- [ ] Step 2: Avoid `ForAll` mutation behavior from Canvas.
- [ ] Step 3: Build history rows with pure `.map`.
- [ ] Step 4: Add search/filter.
- [ ] Step 5: Add detail view.

### Task 10: UI Styling

**Files:**
- Create: `src/styles.css`
- Modify: `src/components.js`

- [ ] Step 1: Recreate the app visual system, not the Power Apps generated DOM.
- [ ] Step 2: Use mobile-first layout.
- [ ] Step 3: Keep primary driver workflow fast:
  - agenda
  - detail
  - voucher
  - signature
  - finalize
  - camera
- [ ] Step 4: Add loading and error states for every async action.
- [ ] Step 5: Add toasts replacing `Notify`.

### Task 11: Bundle Single Webresource

**Files:**
- Create: `src/build-single-html.ps1`
- Create: `dist/new_app_motoristas.html`

- [ ] Step 1: Inline CSS into `<style>`.
- [ ] Step 2: Inline JS into `<script type="module">` or bundled classic script if Dataverse host blocks module loading.
- [ ] Step 3: Inline small assets as base64.
- [ ] Step 4: Keep final upload file as a single `.html`.

### Task 12: Verification

**Files:**
- Read: `dist/new_app_motoristas.html`

- [ ] Step 1: Run static syntax check.

```powershell
node --check .\dist\new_app_motoristas.html
```

Expected:

```txt
This may fail because HTML is not JS. If it fails, extract script block or use a build-time JS check.
```

- [ ] Step 2: Run local browser smoke test.
- [ ] Step 3: Test inside Model-driven app with:
  - no query params
  - `?servicoId=<guid>&tipo=SERVICO`
  - service finalization
  - voucher generation
  - missing signature warning
  - maintenance photo upload
  - vehicle swap completion
  - cancel on local
  - history
- [ ] Step 4: Confirm Dataverse field schema against live environment before upload.

---

## Hard Risks

- Flow calls from a standalone webresource may not work through Power Apps connector auth. Safer path: expose the flows through Dataverse custom action, command, or authenticated HTTP endpoint.
- Choice values must be verified live. Labels from `.msapp` are not enough for `Xrm.WebApi` payloads.
- Lookup binding names must be verified live. Display names from YAML are not enough.
- Camera API requires HTTPS or trusted host. Dataverse webresource is HTTPS, local file is not enough.
- Signature and photo payload size can exceed flow limits.
- The app has cross-screen dependencies in Power Apps. In JS, state ownership must be explicit.
- Console extraction showed mojibake for accents. Verify file encoding before copying user-facing text.

## Recommended Execution Strategy

Build this in slices:

1. Shell + current user + home.
2. Agenda read-only.
3. Detail read-only.
4. Service voucher without signature.
5. Signature.
6. Maintenance photo flow.
7. Vehicle swap.
8. History.
9. Single-file bundle.
10. Dataverse upload validation.

Do not start with pixel-perfect UI. Start with behavior parity. Then polish.
