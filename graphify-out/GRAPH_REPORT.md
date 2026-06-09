# Graph Report - App Motoristas  (2026-06-09)

## Corpus Check
- 82 files · ~845,825 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 933 nodes · 1466 edges · 52 communities (47 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e4c96a2b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]

## God Nodes (most connected - your core abstractions)
1. `AppPreviewFlagsMap` - 86 edges
2. `ControlCount` - 27 edges
3. `TopParent` - 23 edges
4. `TopParent` - 23 edges
5. `TopParent` - 23 edges
6. `TopParent` - 23 edges
7. `TopParent` - 23 edges
8. `TopParent` - 23 edges
9. `dataverseLog()` - 21 edges
10. `updateOne()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `getInitialDetail()` --calls--> `findDetailByParams()`  [EXTRACTED]
  src/App.tsx → src/lib/localWorkflow.ts
- `HistoryScreen()` --calls--> `useAgendaSearch()`  [EXTRACTED]
  src/screens/HistoryScreen.tsx → src/hooks/useAgendaSearch.ts
- `getCameraVideoConstraints()` --calls--> `isLandscapeViewport()`  [EXTRACTED]
  src/screens/MaintenancePhotoScreen.tsx → src/lib/photoOrientation.ts
- `MaintenancePhotoScreen()` --calls--> `getViewportOrientationAngle()`  [EXTRACTED]
  src/screens/MaintenancePhotoScreen.tsx → src/lib/photoOrientation.ts

## Communities (52 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (34): AppResourceFlowEnv, buildPassengerMessage(), cancelServiceRemote(), CATEGORY, cleanODataGuid(), cleanPhoneDigits(), DataverseRecord, ENTITY_COLLECTION_ALIASES (+26 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (86): AppPreviewFlagsMap, adaptivepaging, aibuilderserviceenrollment, allowmultiplescreensincanvaspages, appinsightserrortracing, appinstrumentationcorrelationtracing, autocreateenvironmentvariables, behaviorpropertyui (+78 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (24): cancelDetailLocally(), clearMaintenancePhotos(), deleteMaintenancePhoto(), detailsToClipboardText(), finalizeDetailLocally(), LocalStore, makeHistoryItem(), parseLocalNumber() (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (33): CustomGroupControlTemplateName, FirstParty, Id, IsComponentDefinition, IsCustomGroupControlTemplate, IsPremiumPcfControl, LastModifiedTimestamp, Name (+25 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (33): CustomGroupControlTemplateName, FirstParty, Id, IsComponentDefinition, IsCustomGroupControlTemplate, IsPremiumPcfControl, LastModifiedTimestamp, Name (+25 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (33): CustomGroupControlTemplateName, FirstParty, Id, IsComponentDefinition, IsCustomGroupControlTemplate, IsPremiumPcfControl, LastModifiedTimestamp, Name (+25 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (33): CustomGroupControlTemplateName, FirstParty, Id, IsComponentDefinition, IsCustomGroupControlTemplate, IsPremiumPcfControl, LastModifiedTimestamp, Name (+25 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (33): CustomGroupControlTemplateName, FirstParty, Id, IsComponentDefinition, IsCustomGroupControlTemplate, IsPremiumPcfControl, LastModifiedTimestamp, Name (+25 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (33): CustomGroupControlTemplateName, FirstParty, Id, IsComponentDefinition, IsCustomGroupControlTemplate, IsPremiumPcfControl, LastModifiedTimestamp, Name (+25 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (29): AnalysisLoadTime, AppCopilotSchemaName, AppCreationSource, AppDescription, Author, BindingErrorCount, ConnectionString, ContainsThirdPartyPcfControls (+21 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (27): ControlCount, button, camera, circle, gallery, galleryTemplate, groupContainer, htmlViewer (+19 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (25): 1. Build ainda nao foi gerado, 1. Navigation properties de `@odata.bind`, 2. Posse de veiculo precisa teste real, 2. Web Resource precisa ser atualizado no Dataverse, 3. Historico de manutencao depende de status da OM, 3. URLs dos Flows precisam estar configuradas, 4. Cache do Model-driven pode mascarar correcao, 4. Flows HTTP precisam aceitar chamada do Web Resource (+17 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (25): App Motoristas Webresource Implementation Plan, code:powershell (rg -n "ClearCollect\(|Collect\(|Set\(|Patch\(|UpdateIf\(|Flo), code:txt (Output lists all collection, state, patch, and flow formulas), code:js (export const ENTITIES = {), code:js (export const state = {), code:txt (Do not copy Power Apps delegation behavior blindly.), code:powershell (node --check .\dist\new_app_motoristas.html), code:txt (This may fail because HTML is not JS. If it fails, extract s) (+17 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (18): PullState, PullToRefresh(), PullToRefreshProps, useAgendaSearch(), ServicesMenu(), ServicesMenuProps, HistoryScreen(), HistoryScreenProps (+10 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (21): dependencies, motion, react, react-dom, devDependencies, @types/react, @types/react-dom, typescript (+13 more)

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (20): DetailActionButton(), DetailActionButtonProps, DetailsField(), QuestionsBox(), buildWhatsAppUrl(), getXrmNavigation(), openExternalUrl(), DetailsMenu() (+12 more)

### Community 16 - "Community 16"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+10 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (12): FlowSubmitButton(), FlowSubmitButtonProps, FlowSubmitState, SystemIcon(), SystemIconName, FormMenu(), FormMenuProps, LocalCancelScreen() (+4 more)

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (16): BuildInfo, formatTimeUntil(), getFirstName(), getNextServiceItem(), getRelativeDateFromTimeLabel(), getServiceDate(), getServiceDateFromAgendaItem(), InitialScreen() (+8 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (12): hours, minutes, readVoucherDraft(), splitTime(), VoucherErrorKey, VoucherErrors, VoucherScreen(), VoucherScreenProps (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.25
Nodes (6): iconByType, PowerIcon(), TileButtonProps, Screen, Tile, TileIcon

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (7): FinalizeScreen(), FinalizeScreenProps, isIosDevice(), MaintenanceErrorKey, MaintenanceErrors, MaintenanceFinalizeDraft, MaintenancePhotoGrid()

### Community 22 - "Community 22"
Cohesion: 0.17
Nodes (11): App Motoristas, code:bash (npm install), code:env (VITE_FLOW_GERAR_VOUCHER_URL=https://...), code:txt ([AppMotoristas:Dataverse]), Comandos, Dataverse, Debug, Flows (+3 more)

### Community 23 - "Community 23"
Cohesion: 0.27
Nodes (8): AppShell(), AppShellProps, getTitleByKind(), isIosDevice(), MaintenancePhotoPreviewScreen(), MaintenancePhotoPreviewScreenProps, titleByKind, MaintenancePhotoKind

### Community 24 - "Community 24"
Cohesion: 0.20
Nodes (9): AppName, BackgroundColor, IconColor, IconName, LogoFileName, PublishDataLocally, PublishResourcesLocally, PublishTarget (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.25
Nodes (7): AnalysisOptions, DataflowAnalysisEnabled, DataflowAnalysisFlagStateToggledByUser, DocVersion, LastSavedDateTimeUTC, MinVersionToLoad, MSAppStructureVersion

### Community 26 - "Community 26"
Cohesion: 0.29
Nodes (6): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, include

### Community 27 - "Community 27"
Cohesion: 0.47
Nodes (4): Avatar(), getFirstName(), InitialMenu(), XrmWindow

### Community 37 - "Community 37"
Cohesion: 0.14
Nodes (21): AppErrorLogContext, BuildInfo, enqueue(), flushAppErrorLogQueue(), getBaseRecord(), getBuildInfo(), getConnectionType(), getRuntimeUserContext() (+13 more)

### Community 38 - "Community 38"
Cohesion: 0.11
Nodes (20): DATAVERSE, DriverContext, findDetailByParams(), App(), drillSpring, fastFade, focusSpring, getInitialDetail() (+12 more)

### Community 39 - "Community 39"
Cohesion: 0.17
Nodes (18): bind(), buildExpenseCreatePayload(), cleanGuid(), EXPENSE_CATEGORIES, EXPENSE_ENTITY_SETS, ExpenseDraft, ExpenseFields, ExpenseValidationErrors (+10 more)

### Community 40 - "Community 40"
Cohesion: 0.14
Nodes (19): buildColumn(), cleanGuid(), clientUrl, columnExists(), COLUMNS, createColumn(), createSmokeLog(), createTable() (+11 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (20): assertFlowSuccess(), buildMaintenancePhotoFolder(), dataUrlToBase64(), describeFlowResultForLog(), finalizeMaintenanceRemote(), formatFlowDecimal(), formatFlowInteger(), getDataUrlMimeType() (+12 more)

### Community 42 - "Community 42"
Cohesion: 0.27
Nodes (19): bind(), buildMaintenanceRequestRecord(), buildPassengersHtml(), cleanGuid(), closeOpenBasePossession(), closeOpenPossessionByDriver(), createMaintenancePhotoLinkRecord(), createMaintenanceRequestRemote() (+11 more)

### Community 43 - "Community 43"
Cohesion: 0.20
Nodes (16): captureVideoFrameDataUrl(), drawRotated(), getRotationForOrientation(), getViewportOrientationAngle(), isLandscapeViewport(), normalizeAngle(), readFileAsDataUrl(), readPhotoFileAsDataUrl() (+8 more)

### Community 44 - "Community 44"
Cohesion: 0.29
Nodes (17): buildExchangeFields(), buildFields(), buildMaintenanceFields(), formatAgendaTime(), getBusinessId(), getFormatted(), getGeralId(), getItemDateMs() (+9 more)

### Community 45 - "Community 45"
Cohesion: 0.23
Nodes (13): addDateHeaders(), addHistoryDateHeaders(), applyExchangePossessionRemote(), dataverseLog(), escapeODataText(), finalizeExchangeRemote(), finalizeServiceRemote(), getCurrentUserEmail() (+5 more)

### Community 46 - "Community 46"
Cohesion: 0.18
Nodes (9): MaintenanceRequestVehicleOption, isIosDevice(), MaintenanceRequestDraft, MaintenanceRequestErrors, MaintenanceRequestFields, MaintenanceRequestPhoto, MaintenanceRequestScreen(), MaintenanceRequestScreenProps (+1 more)

### Community 47 - "Community 47"
Cohesion: 0.42
Nodes (8): attributeExists(), clientUrl, createIntegerAttribute(), createStringAttribute(), entityExists(), headers, publish(), request()

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (6): Checklist de Forms, Forms de colisao, Forms de combustivel, Forms de despesa, Serviços, Voucher

### Community 49 - "Community 49"
Cohesion: 0.43
Nodes (7): buildHttpFlowErrorMessage(), dataverseWarn(), describeFlowUrl(), describeFlowUrlForDebug(), hasSharedAccessQuery(), resolveFlowUrl(), runHttpFlow()

### Community 50 - "Community 50"
Cohesion: 0.50
Nodes (3): agendaMock, historyMock, tiles

## Knowledge Gaps
- **538 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+533 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppPreviewFlagsMap` connect `Community 1` to `Community 9`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `ControlCount` connect `Community 10` to `Community 9`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `DetailData` connect `Community 15` to `Community 0`, `Community 2`, `Community 38`, `Community 13`, `Community 17`, `Community 19`, `Community 21`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _538 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06477732793522267 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.023255813953488372 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1168091168091168 - nodes in this community are weakly interconnected._