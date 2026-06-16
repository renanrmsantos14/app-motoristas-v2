/*
 * App Betinhos / App Motoristas - backup colisao rebuild
 *
 * Uso:
 * 1. Abra o DEV model-driven app no navegador.
 * 2. Abra DevTools > Console.
 * 3. Cole este arquivo inteiro e pressione Enter.
 * 4. Ele baixa um JSON: dataverse-collision-rebuild-backup-YYYY-MM-DDTHH-mm-ss.json
 *
 * Seguro: apenas GET. Nao cria, atualiza, publica ou deleta nada.
 */
(async () => {
  "use strict";

  const tables = [
    { logicalName: "cr40f_anexorecebimento", entitySetName: "cr40f_anexorecebimentos" },
    { logicalName: "cr40f_anexocolisao", entitySetName: "cr40f_anexocolisaos" },
    { logicalName: "cr40f_colisao", entitySetName: "cr40f_colisaos" },
  ];

  const choiceColumns = [
    "cr40f_status",
    "cr40f_tipo",
    "cr40f_tipomidia",
    "cr40f_houveterceiro",
    "cr40f_statusanexo",
    "cr40f_statusoperacional",
    "cr40f_tipoocorrencia",
  ];

  const api = Xrm?.WebApi?.online || Xrm?.WebApi;
  if (!api) throw new Error("Xrm.WebApi nao encontrado. Abra dentro do model-driven DEV.");

  const clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();
  const apiRoot = `${clientUrl.replace(/\/$/, "")}/api/data/v9.2`;

  async function webApiGet(pathOrUrl) {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${apiRoot}${pathOrUrl}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
      },
      credentials: "same-origin",
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`GET ${url} falhou: ${response.status} ${response.statusText} ${text}`);
    }
    return text ? JSON.parse(text) : {};
  }

  async function readAll(entitySetName) {
    const rows = [];
    let next = `${apiRoot}/${entitySetName}?$top=5000`;
    while (next) {
      const page = await webApiGet(next);
      rows.push(...(page.value || []));
      next = page["@odata.nextLink"] || null;
    }
    return rows;
  }

  async function describeTable(logicalName) {
    const encoded = logicalName.replace(/'/g, "''");
    const metadata = await webApiGet(
      `/EntityDefinitions(LogicalName='${encoded}')` +
        "?$select=LogicalName,SchemaName,EntitySetName,DisplayName,PrimaryIdAttribute,PrimaryNameAttribute" +
        "&$expand=Attributes($select=LogicalName,SchemaName,AttributeType,RequiredLevel,DisplayName),ManyToOneRelationships($select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity)"
    );

    const choices = {};
    for (const column of choiceColumns) {
      const attr = (metadata.Attributes || []).find((item) => item.LogicalName === column);
      if (!attr) continue;
      const attributeType = attr.AttributeType;
      if (!["Picklist", "Boolean", "State", "Status"].includes(attributeType)) continue;
      try {
        const detail = await webApiGet(
          `/EntityDefinitions(LogicalName='${encoded}')/Attributes(LogicalName='${column}')`
        );
        choices[column] = detail;
      } catch (error) {
        choices[column] = { error: String(error?.message || error) };
      }
    }

    return { metadata, choices };
  }

  const result = {
    generatedAt: new Date().toISOString(),
    environment: clientUrl,
    source: "model-driven browser console",
    exportStatus: "ok",
    tables: {},
  };

  for (const table of tables) {
    console.log("[backup] metadata", table.logicalName);
    const description = await describeTable(table.logicalName);
    console.log("[backup] data", table.entitySetName);
    const records = await readAll(table.entitySetName);
    result.tables[table.logicalName] = {
      logicalName: table.logicalName,
      entitySetName: table.entitySetName,
      recordCount: records.length,
      metadata: description.metadata,
      choices: description.choices,
      records,
    };
  }

  const json = JSON.stringify(result, null, 2);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `dataverse-collision-rebuild-backup-${stamp}.json`;
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  console.log("[backup] ok", filename, result);
})();
