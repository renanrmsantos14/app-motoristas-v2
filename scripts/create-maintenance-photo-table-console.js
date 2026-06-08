/*
Cole este script no console do Model-driven App, no ambiente correto.
Ele cria a tabela Dataverse `new_fotomanutencao` para armazenar links de fotos de manutenção.
Pré-requisito: estar em uma página com `Xrm.Utility.getGlobalContext()` disponível.
*/
(async () => {
  const xrm = window.Xrm || window.parent?.Xrm;
  if (!xrm?.Utility?.getGlobalContext) throw new Error("Xrm não encontrado. Abra no Model-driven App.");

  const clientUrl = xrm.Utility.getGlobalContext().getClientUrl();
  const api = `${clientUrl}/api/data/v9.2`;
  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0"
  };

  async function request(path, options = {}) {
    const response = await fetch(`${api}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) }
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${options.method || "GET"} ${path} falhou: HTTP ${response.status} ${text}`);
    }
    return text ? JSON.parse(text) : {};
  }

  async function entityExists(logicalName) {
    const result = await request(`/EntityDefinitions(LogicalName='${logicalName}')?$select=LogicalName`);
    return Boolean(result.LogicalName);
  }

  async function attributeExists(entityLogicalName, attributeLogicalName) {
    try {
      const result = await request(`/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attributeLogicalName}')?$select=LogicalName`);
      return Boolean(result.LogicalName);
    } catch (error) {
      if (String(error.message).includes("HTTP 404")) return false;
      throw error;
    }
  }

  async function createStringAttribute(entityLogicalName, schemaName, displayName, maxLength = 4000, requiredLevel = "None") {
    const logicalName = schemaName.toLowerCase();
    if (await attributeExists(entityLogicalName, logicalName)) return;
    await request(`/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes`, {
      method: "POST",
      body: JSON.stringify({
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        "SchemaName": schemaName,
        "DisplayName": { "LocalizedLabels": [{ "Label": displayName, "LanguageCode": 1046 }] },
        "RequiredLevel": { "Value": requiredLevel, "CanBeChanged": true, "ManagedPropertyLogicalName": "canmodifyrequirementlevelsettings" },
        "MaxLength": maxLength,
        "FormatName": { "Value": "Text" }
      })
    });
  }

  async function createIntegerAttribute(entityLogicalName, schemaName, displayName) {
    const logicalName = schemaName.toLowerCase();
    if (await attributeExists(entityLogicalName, logicalName)) return;
    await request(`/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes`, {
      method: "POST",
      body: JSON.stringify({
        "@odata.type": "Microsoft.Dynamics.CRM.IntegerAttributeMetadata",
        "SchemaName": schemaName,
        "DisplayName": { "LocalizedLabels": [{ "Label": displayName, "LanguageCode": 1046 }] },
        "RequiredLevel": { "Value": "None", "CanBeChanged": true, "ManagedPropertyLogicalName": "canmodifyrequirementlevelsettings" },
        "MinValue": 0,
        "MaxValue": 100000
      })
    });
  }

  async function publish() {
    await request("/PublishAllXml", { method: "POST", body: JSON.stringify({}) });
  }

  const tableLogicalName = "new_fotomanutencao";
  const tableSchemaName = "new_FotoManutencao";

  let createdTable = false;
  try {
    await entityExists(tableLogicalName);
  } catch (error) {
    if (!String(error.message).includes("HTTP 404")) throw error;
    await request("/EntityDefinitions", {
      method: "POST",
      body: JSON.stringify({
        "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
        "SchemaName": tableSchemaName,
        "DisplayName": { "LocalizedLabels": [{ "Label": "Foto de Manutenção", "LanguageCode": 1046 }] },
        "DisplayCollectionName": { "LocalizedLabels": [{ "Label": "Fotos de Manutenção", "LanguageCode": 1046 }] },
        "Description": { "LocalizedLabels": [{ "Label": "Links de fotos de pré-manutenção, pós-manutenção e nota fiscal.", "LanguageCode": 1046 }] },
        "OwnershipType": "UserOwned",
        "IsActivity": false,
        "HasActivities": false,
        "HasNotes": false,
        "Attributes": [{
          "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
          "AttributeType": "String",
          "AttributeTypeName": { "Value": "StringType" },
          "SchemaName": "new_name",
          "DisplayName": { "LocalizedLabels": [{ "Label": "Nome", "LanguageCode": 1046 }] },
          "Description": { "LocalizedLabels": [{ "Label": "Nome da foto de manutenção", "LanguageCode": 1046 }] },
          "IsPrimaryName": true,
          "RequiredLevel": { "Value": "ApplicationRequired", "CanBeChanged": true, "ManagedPropertyLogicalName": "canmodifyrequirementlevelsettings" },
          "MaxLength": 200,
          "FormatName": { "Value": "Text" }
        }]
      })
    });
    createdTable = true;
    await publish();
  }

  await createStringAttribute(tableLogicalName, "new_TipoFoto", "Tipo da Foto", 100, "ApplicationRequired");
  await createStringAttribute(tableLogicalName, "new_Origem", "Origem", 100, "ApplicationRequired");
  await createStringAttribute(tableLogicalName, "new_Link", "Link", 4000, "ApplicationRequired");
  await createStringAttribute(tableLogicalName, "new_Caminho", "Caminho", 1000);
  await createStringAttribute(tableLogicalName, "new_NomeArquivo", "Nome do Arquivo", 300);
  await createIntegerAttribute(tableLogicalName, "new_Ordem", "Ordem");
  await publish();

  if (!(await attributeExists(tableLogicalName, "new_manutencao"))) {
    await request("/RelationshipDefinitions", {
      method: "POST",
      body: JSON.stringify({
        "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
        "SchemaName": "new_cr40f_manutencoes_new_fotomanutencao_Manutencao",
        "ReferencedEntity": "cr40f_manutencoes",
        "ReferencingEntity": tableLogicalName,
        "Lookup": {
          "SchemaName": "new_Manutencao",
          "DisplayName": { "LocalizedLabels": [{ "Label": "Manutenção", "LanguageCode": 1046 }] },
          "RequiredLevel": { "Value": "ApplicationRequired", "CanBeChanged": true, "ManagedPropertyLogicalName": "canmodifyrequirementlevelsettings" }
        },
        "CascadeConfiguration": {
          "Assign": "Cascade",
          "Delete": "Cascade",
          "Merge": "Cascade",
          "Reparent": "Cascade",
          "Share": "Cascade",
          "Unshare": "Cascade"
        }
      })
    });
    await publish();
  }

  console.log("Tabela pronta:", {
    createdTable,
    tableLogicalName,
    appEntityName: "new_fotomanutencao",
    lookupBindField: "new_Manutencao@odata.bind",
    expectedBindValue: "/cr40f_manutencoeses(<GUID_DA_MANUTENCAO>)"
  });
})();
