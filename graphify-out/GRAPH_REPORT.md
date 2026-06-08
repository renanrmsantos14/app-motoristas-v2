# Graph Report - App Motoristas  (2026-06-08)

## Corpus Check
- 69 files · ~834,564 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 768 nodes · 1111 edges · 37 communities (31 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8308b65e`
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

## God Nodes (most connected - your core abstractions)
1. `AppPreviewFlagsMap` - 86 edges
2. `ControlCount` - 27 edges
3. `TopParent` - 23 edges
4. `TopParent` - 23 edges
5. `TopParent` - 23 edges
6. `TopParent` - 23 edges
7. `TopParent` - 23 edges
8. `TopParent` - 23 edges
9. `dataverseLog()` - 20 edges
10. `updateOne()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `getInitialDetail()` --calls--> `findDetailByParams()`  [EXTRACTED]
  src/App.tsx → src/lib/localWorkflow.ts
- `HistoryScreen()` --calls--> `useAgendaSearch()`  [EXTRACTED]
  src/screens/HistoryScreen.tsx → src/hooks/useAgendaSearch.ts

## Communities (37 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (88): addDateHeaders(), addHistoryDateHeaders(), applyExchangePossessionRemote(), AppResourceFlowEnv, assertFlowSuccess(), bind(), buildExchangeFields(), buildFields() (+80 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (86): AppPreviewFlagsMap, adaptivepaging, aibuilderserviceenrollment, allowmultiplescreensincanvaspages, appinsightserrortracing, appinstrumentationcorrelationtracing, autocreateenvironmentvariables, behaviorpropertyui (+78 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (41): agendaMock, historyMock, tiles, cancelDetailLocally(), clearMaintenancePhotos(), detailsToClipboardText(), finalizeDetailLocally(), findDetailByParams() (+33 more)

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
Cohesion: 0.16
Nodes (15): useAgendaSearch(), ServicesMenu(), ServicesMenuProps, HistoryScreen(), HistoryScreenProps, ServicesScreen(), ServicesScreenProps, AgendaCard() (+7 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (19): dependencies, motion, react, react-dom, devDependencies, @types/react, @types/react-dom, typescript (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (14): DetailActionButton(), DetailsField(), QuestionsBox(), buildWhatsAppUrl(), DetailsMenu(), DetailsMenuProps, DetailsScreen(), DetailsScreenProps (+6 more)

### Community 16 - "Community 16"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+10 more)

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (12): SystemIcon(), SystemIconName, FormMenu(), FormMenuProps, MaintenancePhotoScreen(), MaintenancePhotoScreenProps, titleByKind, TorchMediaTrackCapabilities (+4 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (15): formatTimeUntil(), getFirstName(), getNextServiceItem(), getRelativeDateFromTimeLabel(), getServiceDate(), getServiceDateFromAgendaItem(), InitialScreen(), InitialScreenProps (+7 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (11): hours, minutes, readVoucherDraft(), VoucherErrorKey, VoucherErrors, VoucherScreen(), VoucherScreenProps, VoucherInputRow() (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.21
Nodes (9): DetailActionButtonProps, iconByType, PowerIcon(), TileButtonProps, AgendaType, DetailAction, Screen, Tile (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.15
Nodes (4): FinalizeScreen(), FinalizeScreenProps, MaintenanceErrorKey, MaintenanceErrors

### Community 22 - "Community 22"
Cohesion: 0.17
Nodes (11): App Motoristas, code:bash (npm install), code:env (VITE_FLOW_GERAR_VOUCHER_URL=https://...), code:txt ([AppMotoristas:Dataverse]), Comandos, Dataverse, Debug, Flows (+3 more)

### Community 23 - "Community 23"
Cohesion: 0.20
Nodes (9): AppShell(), AppShellProps, LocalCancelScreen(), LocalCancelScreenProps, MaintenancePhotoPreviewScreen(), MaintenancePhotoPreviewScreenProps, titleByKind, DetailData (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.20
Nodes (9): AppName, BackgroundColor, IconColor, IconName, LogoFileName, PublishDataLocally, PublishResourcesLocally, PublishTarget (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.25
Nodes (7): AnalysisOptions, DataflowAnalysisEnabled, DataflowAnalysisFlagStateToggledByUser, DocVersion, LastSavedDateTimeUTC, MinVersionToLoad, MSAppStructureVersion

### Community 26 - "Community 26"
Cohesion: 0.29
Nodes (6): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, include

## Knowledge Gaps
- **499 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+494 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppPreviewFlagsMap` connect `Community 1` to `Community 9`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `ControlCount` connect `Community 10` to `Community 9`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `DetailData` connect `Community 23` to `Community 0`, `Community 2`, `Community 13`, `Community 15`, `Community 17`, `Community 19`, `Community 20`, `Community 21`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _499 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06275946275946276 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.023255813953488372 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07020408163265306 - nodes in this community are weakly interconnected._