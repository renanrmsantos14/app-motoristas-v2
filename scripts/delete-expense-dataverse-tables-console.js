/*
Cole no console do Model-driven App, no ambiente correto.

Padrao:
1. Faz relatorio das tabelas de despesas encontradas.
2. Mostra contagem aproximada de registros.
3. Tenta listar dependencias de cada tabela.
4. Pergunta confirmacao por tabela.
5. So apaga se voce digitar X.

Nada e apagado automaticamente.
*/
(async () => {
  const CONFIG = {
    dryRunDefault: true,
    pageSize: 5000,
    knownExpenseTables: [
      "cr40f_anexodespesa",
      "cr40f_despesa",
      "cr40f_categoriadespesa",
      "cr40f_politicadespesa",
      "cr40f_pagamento",
      "cr40f_pendenciadespesa",
      "cr40f_transacaofinanceira",
      "cr40f_contafinanceira",
      "cr40f_cartaomotorista",
      "cr40f_solicitacaosincronizacao"
    ],
    deleteOrder: [
      "cr40f_anexodespesa",
      "cr40f_pendenciadespesa",
      "cr40f_transacaofinanceira",
      "cr40f_cartaomotorista",
      "cr40f_solicitacaosincronizacao",
      "cr40f_despesa",
      "cr40f_pagamento",
      "cr40f_contafinanceira",
      "cr40f_categoriadespesa",
      "cr40f_politicadespesa"
    ]
  };

  const xrm = pickXrm();
  if (!xrm) throw new Error("Xrm nao encontrado. Abra o Model-driven App no ambiente correto e cole de novo.");

  const clientUrl = xrm.Utility.getGlobalContext().getClientUrl().replace(/\/$/, "");
  const api = `${clientUrl}/api/data/v9.2`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0"
  };
  const startedAt = performance.now();
  let stepNumber = 0;

  function elapsed() {
    return `${((performance.now() - startedAt) / 1000).toFixed(1)}s`;
  }

  function feedback(message, details = null, level = "log") {
    stepNumber += 1;
    const prefix = `[${elapsed()} | etapa ${String(stepNumber).padStart(2, "0")}] ${message}`;
    if (details === null || details === undefined) {
      console[level](prefix);
      return;
    }
    console[level](prefix, details);
  }

  function feedbackTable(message, rows) {
    feedback(message);
    console.table(rows);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function pickXrm() {
    try {
      if (window.Xrm?.Utility?.getGlobalContext) return window.Xrm;
      if (window.parent?.Xrm?.Utility?.getGlobalContext) return window.parent.Xrm;
    } catch {
      return window.Xrm ?? null;
    }
    return null;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${api}/${path.replace(/^\//, "")}`, {
      credentials: "same-origin",
      headers: { ...headers, ...(options.headers || {}) },
      ...options
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) {
      const message = data?.error?.message || text || response.statusText;
      const error = new Error(`${options.method || "GET"} ${path} -> HTTP ${response.status}: ${message}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function cleanGuid(value) {
    return String(value ?? "").replace(/[{}]/g, "").toLowerCase();
  }

  function getLabel(labelObject) {
    return String(labelObject?.UserLocalizedLabel?.Label ?? labelObject?.LocalizedLabels?.[0]?.Label ?? "");
  }

  async function getAllEntities() {
    const result = await request(
      "EntityDefinitions?$select=LogicalName,SchemaName,EntitySetName,MetadataId,PrimaryIdAttribute,DisplayName,DisplayCollectionName,IsCustomEntity,IsManaged"
    );
    return result.value ?? [];
  }

  function isExpenseCandidate(entity) {
    return CONFIG.knownExpenseTables.includes(entity.LogicalName);
  }

  async function countRows(entity) {
    if (!entity.EntitySetName) return { ok: false, count: null, reason: "Sem EntitySetName." };
    if (!entity.PrimaryIdAttribute) return { ok: false, count: null, reason: "Sem PrimaryIdAttribute." };
    try {
      feedback(`Contando registros: ${entity.LogicalName}`);
      const result = await request(`${entity.EntitySetName}?$select=${entity.PrimaryIdAttribute}&$top=1&$count=true`, {
        headers: { Prefer: `odata.maxpagesize=${CONFIG.pageSize}` }
      });
      return { ok: true, count: Number(result["@odata.count"] ?? 0), reason: "" };
    } catch (error) {
      return { ok: false, count: null, reason: error.message };
    }
  }

  async function retrieveDependencies(entity) {
    if (!entity.MetadataId) return { ok: false, dependencies: [], reason: "Sem MetadataId." };
    const path = `RetrieveDependenciesForDelete(ObjectId=${entity.MetadataId},ComponentType=1)`;
    try {
      feedback(`Lendo dependencias: ${entity.LogicalName}`);
      const result = await request(path);
      return { ok: true, dependencies: result.EntityCollection?.Entities ?? result.value ?? [], reason: "" };
    } catch (error) {
      return { ok: false, dependencies: [], reason: error.message };
    }
  }

  async function deleteTable(entity) {
    feedback(`Apagando metadata da tabela: ${entity.LogicalName}`);
    await request(`EntityDefinitions(LogicalName='${entity.LogicalName}')`, { method: "DELETE" });
  }

  async function requestOptional(path, options = {}) {
    try {
      return { ok: true, data: await request(path, options), error: "" };
    } catch (error) {
      return { ok: false, data: null, error: error.message, raw: error.data ?? null };
    }
  }

  async function queryByGuid(entitySetName, select, guidField, guidValue) {
    const guid = cleanGuid(guidValue);
    const attempts = [
      `${entitySetName}?$select=${select}&$filter=${guidField} eq ${guid}`,
      `${entitySetName}?$select=${select}&$filter=${guidField} eq '${guid}'`
    ];
    for (const path of attempts) {
      const result = await requestOptional(path);
      if (result.ok) return result.data?.value ?? [];
    }
    return [];
  }

  async function listAppModuleComponentsByObjectId(objectId) {
    const guid = cleanGuid(objectId);
    feedback(`Buscando appmodulecomponents por objectid: ${guid}`);
    const rows = await queryByGuid(
      "appmodulecomponents",
      "appmodulecomponentid,componenttype,objectid",
      "objectid",
      guid
    );
    feedback(`Appmodulecomponents encontrados: ${rows.length}`, rows.map((row) => ({
      appmodulecomponentid: row.appmodulecomponentid,
      componenttype: row.componenttype,
      objectid: row.objectid
    })));
    return rows;
  }

  function buildAppModuleComponentPayloads(row) {
    const id = cleanGuid(row.appmodulecomponentid);
    const objectId = cleanGuid(row.objectid);
    const componentType = Number(row.componenttype);
    return [
      {
        "@odata.type": "Microsoft.Dynamics.CRM.appmodulecomponent",
        appmodulecomponentid: id,
        componenttype: componentType,
        objectid: objectId
      },
      {
        "@odata.type": "Microsoft.Dynamics.CRM.appmodulecomponent",
        appmodulecomponentid: id
      },
      {
        "@odata.id": `${api}/appmodulecomponents(${id})`
      }
    ];
  }

  async function removeAppModuleComponentRowsByObjectId(appIds, objectId, componentTypes, label) {
    const expectedTypes = new Set(componentTypes.map((value) => Number(value)));
    const rows = (await listAppModuleComponentsByObjectId(objectId)).filter((row) =>
      row.appmodulecomponentid &&
      (!expectedTypes.size || expectedTypes.has(Number(row.componenttype)))
    );
    const removed = [];
    const failures = [];
    if (!rows.length) {
      feedback(`Nenhuma linha appmodulecomponent para fallback: ${label}`);
      return { removed, failures, rows };
    }
    feedback(`Fallback por appmodulecomponentid: ${label}`, rows.map((row) => ({
      appmodulecomponentid: row.appmodulecomponentid,
      componenttype: row.componenttype,
      objectid: row.objectid
    })));
    for (const appId of appIds) {
      for (const row of rows) {
        const id = cleanGuid(row.appmodulecomponentid);
        const removal = await removeAppComponent(
          appId,
          buildAppModuleComponentPayloads(row),
          `${label} via appmodulecomponent ${id}`
        );
        if (removal.ok) {
          removed.push({ appId, appmodulecomponentid: id, componenttype: row.componenttype, objectid: row.objectid });
          feedback(`appmodulecomponent aceito para remocao: ${label}`, { appId, appmodulecomponentid: id, componenttype: row.componenttype });
        } else {
          failures.push({
            appId,
            appmodulecomponentid: id,
            componenttype: row.componenttype,
            objectid: row.objectid,
            errors: removal.failures.map((failure) => failure.error)
          });
          feedback(`Falha ao remover appmodulecomponent por action: ${label}`, {
            appId,
            appmodulecomponentid: id,
            errors: removal.failures.map((failure) => failure.error)
          }, "warn");
        }
      }
    }
    return { removed, failures, rows };
  }

  function buildAppComponentPayloads(entity, objectId, componentType) {
    const cleanObjectId = cleanGuid(objectId);
    if (Number(componentType) === 1) {
      return [
        {
          metadataid: cleanObjectId,
          "@odata.type": "Microsoft.Dynamics.CRM.entity"
        },
        {
          MetadataId: cleanObjectId,
          "@odata.type": "Microsoft.Dynamics.CRM.entity"
        },
        {
          entityid: cleanObjectId,
          "@odata.type": "Microsoft.Dynamics.CRM.entity"
        },
        {
          "@odata.id": `${api}/EntityDefinitions(${cleanObjectId})`
        },
        {
          "@odata.type": "Microsoft.Dynamics.CRM.appmodulecomponent",
          objectid: cleanObjectId,
          componenttype: 1
        }
      ];
    }
    if (Number(componentType) === 62) {
      return [
        {
          sitemapid: cleanObjectId,
          "@odata.type": "Microsoft.Dynamics.CRM.sitemap"
        }
      ];
    }
    return [
      {
        "@odata.type": "Microsoft.Dynamics.CRM.appmodulecomponent",
        objectid: cleanObjectId,
        componenttype: Number(componentType)
      }
    ];
  }

  async function removeAppComponent(appId, componentPayloads, label) {
    const cleanAppId = cleanGuid(appId);
    const payloads = componentPayloads.map((component) => ({
      AppId: cleanAppId,
      Components: [component]
    }));

    const failures = [];
    const accepted = [];
    for (const [index, payload] of payloads.entries()) {
      feedback(`Tentando RemoveAppComponents: ${label}`, {
        appId: cleanAppId,
        component: payload.Components[0],
        tentativa: index + 1
      });
      const result = await requestOptional("RemoveAppComponents", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (result.ok) {
        accepted.push({ appId: cleanAppId, component: payload.Components[0], tentativa: index + 1 });
        feedback(`RemoveAppComponents aceito: ${label}`, {
          appId: cleanAppId,
          component: payload.Components[0],
          tentativa: index + 1
        });
        continue;
      }
      failures.push({ appId: cleanAppId, component: payload.Components[0], tentativa: index + 1, error: result.error, raw: result.raw });
      feedback(`RemoveAppComponents falhou: ${label}`, {
        appId: cleanAppId,
        component: payload.Components[0],
        tentativa: index + 1,
        error: result.error
      }, "warn");
    }

    return { ok: accepted.length > 0, accepted, failures };
  }

  function stripEntityFromSiteMapXml(xml, entityLogicalName) {
    if (!xml || !entityLogicalName) return { changed: false, xml };
    const parser = new DOMParser();
    const documentXml = parser.parseFromString(xml, "text/xml");
    if (documentXml.querySelector("parsererror")) return { changed: false, xml };

    const target = normalize(entityLogicalName);
    let changed = false;
    for (const subArea of Array.from(documentXml.getElementsByTagName("SubArea"))) {
      const entity = normalize(subArea.getAttribute("Entity"));
      if (entity === target) {
        subArea.parentNode?.removeChild(subArea);
        changed = true;
      }
    }

    for (const group of Array.from(documentXml.getElementsByTagName("Group"))) {
      if (!group.getElementsByTagName("SubArea").length) {
        group.parentNode?.removeChild(group);
        changed = true;
      }
    }

    for (const area of Array.from(documentXml.getElementsByTagName("Area"))) {
      if (!area.getElementsByTagName("Group").length && !area.getElementsByTagName("SubArea").length) {
        area.parentNode?.removeChild(area);
        changed = true;
      }
    }

    return { changed, xml: new XMLSerializer().serializeToString(documentXml) };
  }

  async function removeEntityFromSitemap(sitemapId, entityLogicalName) {
    const id = String(sitemapId ?? "").replace(/[{}]/g, "");
    feedback(`Lendo sitemap: ${id}`);
    const record = await request(`sitemaps(${id})?$select=sitemapid,sitemapname,sitemapxml`);
    const update = stripEntityFromSiteMapXml(record.sitemapxml, entityLogicalName);
    if (!update.changed) {
      feedback(`Sitemap sem SubArea da tabela: ${entityLogicalName}`, { sitemapId: id, sitemapName: record.sitemapname ?? "" });
      return { changed: false, sitemapId: id, sitemapName: record.sitemapname ?? "" };
    }
    feedback(`Atualizando sitemap, removendo tabela: ${entityLogicalName}`, { sitemapId: id, sitemapName: record.sitemapname ?? "" });
    await request(`sitemaps(${id})`, {
      method: "PATCH",
      body: JSON.stringify({ sitemapxml: update.xml })
    });
    return { changed: true, sitemapId: id, sitemapName: record.sitemapname ?? "" };
  }

  async function removeBlockingAppAndSitemapReferences(entity, deps) {
    const blockers = deps.ok ? deps.dependencies.map(summarizeDependency) : [];
    const appIds = [...new Set(blockers.filter((item) => Number(item.dependentComponentType) === 80).map((item) => item.dependentComponentObjectId).filter(Boolean))];
    const sitemapIds = [...new Set(blockers.filter((item) => Number(item.dependentComponentType) === 62).map((item) => item.dependentComponentObjectId).filter(Boolean))];
    feedback(`Limpando app/sitemap: ${entity.LogicalName}`, { appIds, sitemapIds });
    const result = {
      appComponents: { removed: [], failures: [] },
      appModuleComponentRows: [],
      appModuleComponentRowsRemoved: [],
      appModuleComponentRowFailures: [],
      sitemapUpdates: [],
      sitemapFailures: []
    };

    result.appModuleComponentRows.push(...await listAppModuleComponentsByObjectId(entity.MetadataId));

    for (const appId of appIds) {
      const removal = await removeAppComponent(
        appId,
        buildAppComponentPayloads(entity, entity.MetadataId, 1),
        `${entity.LogicalName} no app`
      );
      if (removal.ok) {
        result.appComponents.removed.push({ appId, objectId: entity.MetadataId, componentType: 1 });
      } else {
        result.appComponents.failures.push(...removal.failures);
      }
    }
    await publishAndWait(`${entity.LogicalName} apos RemoveAppComponents da tabela`);
    let blockersAfterEntityAction = getAppAndSitemapBlockers(await retrieveDependencies(entity));
    if (blockersAfterEntityAction.some((item) => Number(item.dependentComponentType) === 80)) {
      feedbackTable(`Componente de tabela ainda preso no app: ${entity.LogicalName}`, blockersAfterEntityAction);
      const entityComponentFallback = await removeAppModuleComponentRowsByObjectId(
        appIds,
        entity.MetadataId,
        [1],
        `${entity.LogicalName} no app`
      );
      result.appModuleComponentRowsRemoved.push(...entityComponentFallback.removed);
      result.appModuleComponentRowFailures.push(...entityComponentFallback.failures);
    } else {
      feedback(`Componente de tabela saiu do app: ${entity.LogicalName}`);
    }

    for (const sitemapId of sitemapIds) {
      try {
        const update = await removeEntityFromSitemap(sitemapId, entity.LogicalName);
        result.sitemapUpdates.push(update);
      } catch (error) {
        result.sitemapFailures.push({ sitemapId, error: error.message, raw: error.data ?? null });
      }
      result.appModuleComponentRows.push(...await listAppModuleComponentsByObjectId(sitemapId));
      for (const appId of appIds) {
        const removal = await removeAppComponent(
          appId,
          buildAppComponentPayloads(entity, sitemapId, 62),
          `${entity.LogicalName} no sitemap`
        );
        if (removal.ok) {
          result.appComponents.removed.push({ appId, objectId: sitemapId, componentType: 62 });
        } else {
          result.appComponents.failures.push(...removal.failures);
        }
      }
      const sitemapComponentFallback = await removeAppModuleComponentRowsByObjectId(
        appIds,
        sitemapId,
        [62],
        `${entity.LogicalName} no sitemap`
      );
      result.appModuleComponentRowsRemoved.push(...sitemapComponentFallback.removed);
      result.appModuleComponentRowFailures.push(...sitemapComponentFallback.failures);
    }

    return result;
  }

  function getAppAndSitemapBlockers(deps) {
    const blockers = deps.ok ? deps.dependencies.map(summarizeDependency) : [];
    return blockers.filter((item) => [80, 62].includes(Number(item.dependentComponentType)));
  }

  async function waitForAppAndSitemapBlockersToClear(entity, attempts = 3) {
    let lastBlockers = [];
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const deps = await retrieveDependencies(entity);
      lastBlockers = getAppAndSitemapBlockers(deps);
      if (!lastBlockers.length) {
        feedback(`Bloqueio de app/sitemap removido: ${entity.LogicalName}`, { attempt });
        return [];
      }
      feedbackTable(`Bloqueio de app/sitemap ainda existe: ${entity.LogicalName} tentativa ${attempt}/${attempts}`, lastBlockers);
      await publishAndWait(`${entity.LogicalName} tentativa ${attempt}/${attempts}`);
    }
    const finalDeps = await retrieveDependencies(entity);
    lastBlockers = getAppAndSitemapBlockers(finalDeps);
    if (!lastBlockers.length) {
      feedback(`Bloqueio de app/sitemap removido apos publish final: ${entity.LogicalName}`);
      return [];
    }
    feedbackTable(`Bloqueio de app/sitemap persistiu apos publish final: ${entity.LogicalName}`, lastBlockers);
    return lastBlockers;
  }

  function getWorkflowBlockers(deps) {
    const blockers = deps.ok ? deps.dependencies.map(summarizeDependency) : [];
    return blockers.filter((item) => Number(item.dependentComponentType) === 29);
  }

  async function getWorkflowRecord(workflowId) {
    const id = cleanGuid(workflowId);
    const paths = [
      `workflows(${id})?$select=workflowid,name,uniquename,category,type,statecode,statuscode,ismanaged`,
      `workflows(${id})?$select=workflowid,name,statecode,statuscode,ismanaged`,
      `workflows(${id})`
    ];
    for (const path of paths) {
      const result = await requestOptional(path);
      if (result.ok) return result.data ?? {};
    }
    return null;
  }

  async function tryDeactivateWorkflow(workflowId) {
    const id = cleanGuid(workflowId);
    const attempts = [
      {
        label: "PATCH statecode/statuscode",
        path: `workflows(${id})`,
        options: {
          method: "PATCH",
          body: JSON.stringify({ statecode: 0, statuscode: 1 })
        }
      },
      {
        label: "bound SetState",
        path: `workflows(${id})/Microsoft.Dynamics.CRM.SetState`,
        options: {
          method: "POST",
          body: JSON.stringify({ State: 0, Status: 1 })
        }
      },
      {
        label: "unbound SetState",
        path: "SetState",
        options: {
          method: "POST",
          body: JSON.stringify({
            EntityMoniker: {
              "@odata.type": "Microsoft.Dynamics.CRM.workflow",
              workflowid: id
            },
            State: 0,
            Status: 1
          })
        }
      }
    ];

    const failures = [];
    for (const attempt of attempts) {
      feedback(`Tentando desativar workflow/processo: ${id}`, { tentativa: attempt.label });
      const result = await requestOptional(attempt.path, attempt.options);
      if (result.ok) {
        feedback(`Workflow/processo desativado: ${id}`, { tentativa: attempt.label });
        return { ok: true, attempt: attempt.label, failures };
      }
      failures.push({ attempt: attempt.label, error: result.error, raw: result.raw });
      feedback(`Falha ao desativar workflow/processo: ${id}`, { tentativa: attempt.label, error: result.error }, "warn");
    }
    return { ok: false, attempt: "", failures };
  }

  async function deleteWorkflowBlocker(workflowId) {
    const id = cleanGuid(workflowId);
    const workflow = await getWorkflowRecord(id);
    const details = workflow ? {
      workflowid: workflow.workflowid ?? id,
      name: workflow.name ?? "",
      uniquename: workflow.uniquename ?? "",
      category: workflow.category ?? "",
      type: workflow.type ?? "",
      statecode: workflow.statecode ?? "",
      statuscode: workflow.statuscode ?? "",
      ismanaged: workflow.ismanaged ?? ""
    } : { workflowid: id, name: "(nao foi possivel ler registro)" };

    feedback("Workflow/processo bloqueador encontrado", details);
    if (workflow?.ismanaged === true) {
      return { ok: false, id, details, error: "Workflow/processo gerenciado. Nao pode ser apagado por este console." };
    }

    let deletion = await requestOptional(`workflows(${id})`, { method: "DELETE" });
    if (deletion.ok) {
      feedback(`Workflow/processo apagado: ${id}`, details);
      return { ok: true, id, details, deactivated: false };
    }

    feedback(`Delete direto falhou para workflow/processo: ${id}`, { error: deletion.error }, "warn");
    const deactivation = await tryDeactivateWorkflow(id);
    if (deactivation.ok) {
      await publishAndWait(`desativacao de workflow/processo ${id}`);
      deletion = await requestOptional(`workflows(${id})`, { method: "DELETE" });
      if (deletion.ok) {
        feedback(`Workflow/processo apagado apos desativar: ${id}`, details);
        return { ok: true, id, details, deactivated: true, deactivationAttempt: deactivation.attempt };
      }
    }

    return {
      ok: false,
      id,
      details,
      error: deletion.error,
      raw: deletion.raw,
      deactivationFailures: deactivation.failures
    };
  }

  async function removeWorkflowDependencies(entity, deps, reason) {
    const blockers = getWorkflowBlockers(deps);
    const workflowIds = [...new Set(blockers.map((item) => item.dependentComponentObjectId).filter(Boolean).map(cleanGuid))];
    const result = { found: workflowIds.length, deleted: [], failures: [], remaining: [] };
    if (!workflowIds.length) {
      feedback(`Sem workflow/processo bloqueador: ${entity.LogicalName}`, { reason });
      return result;
    }

    feedbackTable(`Workflows/processos bloqueadores: ${entity.LogicalName}`, blockers);
    for (const workflowId of workflowIds) {
      const deletion = await deleteWorkflowBlocker(workflowId);
      if (deletion.ok) {
        result.deleted.push(deletion);
      } else {
        result.failures.push(deletion);
        feedback(`Falha ao apagar workflow/processo bloqueador: ${workflowId}`, { error: deletion.error }, "warn");
      }
    }

    await publishAndWait(`${entity.LogicalName} apos limpar workflows/processos`);
    const depsAfter = await retrieveDependencies(entity);
    result.remaining = getWorkflowBlockers(depsAfter);
    if (result.remaining.length) {
      feedbackTable(`Workflow/processo ainda bloqueia: ${entity.LogicalName}`, result.remaining);
    } else {
      feedback(`Workflow/processo nao bloqueia mais: ${entity.LogicalName}`);
    }
    return result;
  }

  async function getRelationshipsForEntity(entityLogicalName) {
    feedback(`Buscando relacionamentos: ${entityLogicalName}`);
    const paths = [
      `RelationshipDefinitions/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata?$select=MetadataId,SchemaName,ReferencedEntity,ReferencingEntity,IsCustomRelationship,IsManaged&$filter=ReferencedEntity eq '${entityLogicalName}' or ReferencingEntity eq '${entityLogicalName}'`,
      `RelationshipDefinitions/Microsoft.Dynamics.CRM.ManyToManyRelationshipMetadata?$select=MetadataId,SchemaName,Entity1LogicalName,Entity2LogicalName,IsCustomRelationship,IsManaged&$filter=Entity1LogicalName eq '${entityLogicalName}' or Entity2LogicalName eq '${entityLogicalName}'`
    ];
    const relationships = [];
    for (const path of paths) {
      try {
        const result = await request(path);
        relationships.push(...(result.value ?? []));
      } catch (error) {
        console.warn("Falha ao listar relacionamentos:", entityLogicalName, error.message);
      }
    }
    return relationships;
  }

  async function deleteRelationshipsForEntity(entity) {
    const relationships = await getRelationshipsForEntity(entity.LogicalName);
    const deleteCandidates = relationships.filter((relationship) =>
      relationship.MetadataId &&
      relationship.IsCustomRelationship !== false &&
      relationship.IsManaged !== true
    );
    const deleted = [];
    const failures = [];
    if (deleteCandidates.length) {
      feedbackTable(`Relacionamentos para remover: ${entity.LogicalName}`, deleteCandidates.map((relationship) => ({
        schemaName: relationship.SchemaName,
        referencedEntity: relationship.ReferencedEntity ?? relationship.Entity1LogicalName ?? "",
        referencingEntity: relationship.ReferencingEntity ?? relationship.Entity2LogicalName ?? ""
      })));
    }
    for (const relationship of deleteCandidates) {
      try {
        feedback(`Removendo relacionamento: ${relationship.SchemaName}`);
        await request(`RelationshipDefinitions(${relationship.MetadataId})`, { method: "DELETE" });
        deleted.push(relationship.SchemaName);
      } catch (error) {
        failures.push({ schemaName: relationship.SchemaName, error: error.message, raw: error.data ?? null });
      }
    }
    return { deleted, failures };
  }

  async function listRecordIds(entity) {
    const ids = [];
    let nextPath = `${entity.EntitySetName}?$select=${entity.PrimaryIdAttribute}&$top=500`;
    let page = 0;
    while (nextPath) {
      page += 1;
      feedback(`Lendo pagina ${page} de registros: ${entity.LogicalName}`);
      const result = await request(nextPath);
      for (const row of result.value ?? []) {
        const id = row[entity.PrimaryIdAttribute];
        if (id) ids.push(id);
      }
      nextPath = result["@odata.nextLink"] ? result["@odata.nextLink"].replace(`${api}/`, "") : "";
    }
    return ids;
  }

  async function deleteRecords(entity) {
    if (!entity.EntitySetName || !entity.PrimaryIdAttribute) return { deleted: 0, failed: 0, failures: [] };
    const ids = await listRecordIds(entity);
    feedback(`Registros para apagar: ${entity.LogicalName}`, { total: ids.length });
    let deleted = 0;
    const failures = [];
    for (const [index, id] of ids.entries()) {
      try {
        await request(`${entity.EntitySetName}(${id})`, { method: "DELETE" });
        deleted += 1;
        if (deleted === 1 || deleted % 50 === 0 || deleted === ids.length) {
          feedback(`Apagando registros: ${entity.LogicalName}`, { deleted, total: ids.length, currentIndex: index + 1 });
        }
      } catch (error) {
        failures.push({ id, error: error.message, raw: error.data ?? null });
        feedback(`Falha ao apagar registro: ${entity.LogicalName}`, { id, error: error.message }, "warn");
      }
    }
    feedback(`Fim da limpeza de registros: ${entity.LogicalName}`, { deleted, failed: failures.length });
    return { deleted, failed: failures.length, failures };
  }

  async function publishAll() {
    feedback("Publicando customizacoes.");
    await request("PublishAllXml", { method: "POST", body: JSON.stringify({}) });
  }

  async function publishAndWait(reason) {
    feedback(`Publicando e aguardando propagacao: ${reason}`);
    await publishAll();
    await sleep(3000);
  }

  function sortForDelete(left, right) {
    const leftIndex = CONFIG.deleteOrder.indexOf(left.LogicalName);
    const rightIndex = CONFIG.deleteOrder.indexOf(right.LogicalName);
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  }

  function summarizeDependency(dep) {
    return {
      dependentComponentType: dep.dependentcomponenttype ?? dep.DependentComponentType ?? "",
      dependentComponentObjectId: dep.dependentcomponentobjectid ?? dep.DependentComponentObjectId ?? "",
      requiredComponentType: dep.requiredcomponenttype ?? dep.RequiredComponentType ?? "",
      requiredComponentObjectId: dep.requiredcomponentobjectid ?? dep.RequiredComponentObjectId ?? ""
    };
  }

  console.clear();
  console.log("Ambiente:", clientUrl);
  console.warn("Relatorio primeiro. Nenhuma tabela sera apagada sem confirmacao por prompt.");

  feedback("Carregando metadata das tabelas.");
  const entities = (await getAllEntities()).filter(isExpenseCandidate).sort(sortForDelete);
  if (!entities.length) {
    console.warn("Nenhuma tabela candidata de despesas encontrada.");
    return;
  }

  const report = [];
  for (const entity of entities) {
    feedback(`Montando relatorio: ${entity.LogicalName}`);
    const [rows, deps] = await Promise.all([countRows(entity), retrieveDependencies(entity)]);
    report.push({
      logicalName: entity.LogicalName,
      schemaName: entity.SchemaName,
      entitySetName: entity.EntitySetName,
      primaryIdAttribute: entity.PrimaryIdAttribute,
      displayName: getLabel(entity.DisplayName),
      displayCollectionName: getLabel(entity.DisplayCollectionName),
      isCustomEntity: entity.IsCustomEntity,
      isManaged: entity.IsManaged,
      rowCount: rows.ok ? rows.count : `ERRO: ${rows.reason}`,
      dependencies: deps.ok ? deps.dependencies.length : `ERRO: ${deps.reason}`,
      dependencySample: deps.dependencies.slice(0, 5).map(summarizeDependency)
    });
  }

  feedbackTable("Relatorio resumido.", report.map(({ dependencySample, ...row }) => row));
  console.log("Relatorio completo:", report);

  const continueText = prompt("X");
  if (continueText !== "X") {
    console.warn("Cancelado. Nada apagado.");
    return;
  }

  const results = [];
  for (const entity of entities) {
    console.time(`tempo:${entity.LogicalName}`);
    const row = report.find((item) => item.logicalName === entity.LogicalName);
    console.group(`Revisao: ${entity.LogicalName}`);
    console.table([row]);
    console.log("Dependencias exemplo:", row?.dependencySample ?? []);
    console.groupEnd();

    const expected = "X";
    const answer = prompt(entity.LogicalName);

    if (answer !== expected) {
      results.push({ table: entity.LogicalName, action: "SKIPPED", detail: "Confirmacao diferente." });
      feedback(`Tabela pulada: ${entity.LogicalName}`);
      console.timeEnd(`tempo:${entity.LogicalName}`);
      continue;
    }

    try {
      feedback(`Inicio da delecao confirmada: ${entity.LogicalName}`);
      const rowDelete = await deleteRecords(entity);
      const depsBeforeMetadataCleanup = await retrieveDependencies(entity);
      const appCleanup = await removeBlockingAppAndSitemapReferences(entity, depsBeforeMetadataCleanup);
      const remainingAppBlockers = await waitForAppAndSitemapBlockersToClear(entity);
      if (remainingAppBlockers.length) {
        throw new Error(`Ainda existem ${remainingAppBlockers.length} bloqueios de app/sitemap. Metadata da tabela nao sera apagada nesta tentativa.`);
      }
      const workflowCleanupBeforeRelationships = await removeWorkflowDependencies(
        entity,
        await retrieveDependencies(entity),
        "antes de remover relacionamentos"
      );
      const relationshipDelete = await deleteRelationshipsForEntity(entity);
      const workflowCleanupAfterRelationships = await removeWorkflowDependencies(
        entity,
        await retrieveDependencies(entity),
        "depois de remover relacionamentos"
      );
      const remainingWorkflowBlockers = getWorkflowBlockers(await retrieveDependencies(entity));
      if (remainingWorkflowBlockers.length) {
        throw new Error(`Ainda existem ${remainingWorkflowBlockers.length} bloqueios de workflow/processo. Metadata da tabela nao sera apagada nesta tentativa.`);
      }
      await deleteTable(entity);
      results.push({
        table: entity.LogicalName,
        action: "DELETED",
        rowsDeleted: rowDelete.deleted,
        rowFailures: rowDelete.failed,
        appComponentsRemoved: appCleanup.appComponents.removed.length,
        appComponentFailures: appCleanup.appComponents.failures.length,
        appModuleComponentRowsFound: appCleanup.appModuleComponentRows.length,
        appModuleComponentRowsRemoved: appCleanup.appModuleComponentRowsRemoved.length,
        appModuleComponentRowFailures: appCleanup.appModuleComponentRowFailures.length,
        sitemapUpdates: appCleanup.sitemapUpdates.filter((item) => item.changed).length,
        sitemapFailures: appCleanup.sitemapFailures.length,
        workflowBlockersFound: workflowCleanupBeforeRelationships.found + workflowCleanupAfterRelationships.found,
        workflowsDeleted: workflowCleanupBeforeRelationships.deleted.length + workflowCleanupAfterRelationships.deleted.length,
        workflowFailures: workflowCleanupBeforeRelationships.failures.length + workflowCleanupAfterRelationships.failures.length,
        relationshipsDeleted: relationshipDelete.deleted.length,
        relationshipFailures: relationshipDelete.failures.length,
        detail: "Linhas apagadas. Delete EntityDefinitions enviado."
      });
      console.warn("Apagada:", entity.LogicalName);
      feedback(`Tabela apagada: ${entity.LogicalName}`);
    } catch (error) {
      const depsAfterFailure = await retrieveDependencies(entity);
      const blockers = depsAfterFailure.ok ? depsAfterFailure.dependencies.map(summarizeDependency) : depsAfterFailure.reason;
      results.push({
        table: entity.LogicalName,
        action: "FAILED",
        detail: error.message,
        blockers,
        raw: error.data ?? null
      });
      console.table(Array.isArray(blockers) ? blockers : [{ blockers }]);
      console.error("Falhou:", entity.LogicalName, error);
      feedback(`Tabela falhou: ${entity.LogicalName}`, { error: error.message }, "error");
    }
    console.timeEnd(`tempo:${entity.LogicalName}`);
  }

  try {
    await publishAll();
    console.log("PublishAllXml executado.");
  } catch (error) {
    console.warn("PublishAllXml falhou. Publique manualmente depois.", error);
  }

  console.table(results.map(({ raw, ...row }) => row));
  console.log("Resultado completo:", results);
})();
