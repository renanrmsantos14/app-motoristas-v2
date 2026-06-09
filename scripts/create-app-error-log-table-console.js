(async () => {
  const TABLE = {
    logicalName: "new_appmotoristaslog",
    schemaName: "new_AppMotoristasLog",
    displayName: "Log App Motoristas",
    displayCollectionName: "Logs App Motoristas"
  };

  const COLUMNS = [
    { type: "datetime", schemaName: "new_OccurredAt", label: "Data/hora do erro" },
    { type: "string", schemaName: "new_Severity", label: "Severidade", maxLength: 30 },
    { type: "string", schemaName: "new_Source", label: "Origem", maxLength: 120 },
    { type: "string", schemaName: "new_Action", label: "Acao", maxLength: 180 },
    { type: "string", schemaName: "new_Phase", label: "Fase", maxLength: 120 },
    { type: "string", schemaName: "new_Component", label: "Componente", maxLength: 180 },
    { type: "string", schemaName: "new_Screen", label: "Tela", maxLength: 120 },
    { type: "string", schemaName: "new_DetailId", label: "ID do item", maxLength: 120 },
    { type: "string", schemaName: "new_DetailType", label: "Tipo do item", maxLength: 80 },
    { type: "memo", schemaName: "new_Message", label: "Mensagem", maxLength: 20000 },
    { type: "memo", schemaName: "new_Stack", label: "Stack trace", maxLength: 100000 },
    { type: "string", schemaName: "new_ErrorName", label: "Nome do erro", maxLength: 220 },
    { type: "string", schemaName: "new_ErrorCode", label: "Codigo do erro", maxLength: 120 },
    { type: "string", schemaName: "new_AppVersion", label: "Versao do app", maxLength: 60 },
    { type: "string", schemaName: "new_BuiltAt", label: "Build", maxLength: 80 },
    { type: "string", schemaName: "new_SessionId", label: "Sessao", maxLength: 120 },
    { type: "string", schemaName: "new_UserId", label: "ID do usuario", maxLength: 120 },
    { type: "string", schemaName: "new_UserName", label: "Nome do usuario", maxLength: 300 },
    { type: "string", schemaName: "new_UserEmail", label: "Email do usuario", maxLength: 300 },
    { type: "string", schemaName: "new_UserDomainName", label: "Dominio do usuario", maxLength: 300 },
    { type: "string", schemaName: "new_AppName", label: "Nome do app", maxLength: 120 },
    { type: "memo", schemaName: "new_Url", label: "URL", maxLength: 4000 },
    { type: "memo", schemaName: "new_Referrer", label: "URL anterior", maxLength: 4000 },
    { type: "memo", schemaName: "new_UserAgent", label: "User agent", maxLength: 4000 },
    { type: "string", schemaName: "new_Language", label: "Idioma do navegador", maxLength: 80 },
    { type: "string", schemaName: "new_Platform", label: "Plataforma", maxLength: 160 },
    { type: "string", schemaName: "new_TimeZone", label: "Fuso horario", maxLength: 120 },
    { type: "string", schemaName: "new_Viewport", label: "Viewport", maxLength: 80 },
    { type: "string", schemaName: "new_VisibilityState", label: "Visibilidade da pagina", maxLength: 40 },
    { type: "string", schemaName: "new_ConnectionType", label: "Tipo de conexao", maxLength: 80 },
    { type: "string", schemaName: "new_ClientUrl", label: "URL Dataverse", maxLength: 500 },
    { type: "string", schemaName: "new_IsOffline", label: "Offline", maxLength: 20 },
    { type: "memo", schemaName: "new_PayloadJson", label: "Payload JSON", maxLength: 100000 },
    { type: "memo", schemaName: "new_RawJson", label: "Erro bruto JSON", maxLength: 100000 }
  ];

  const pickXrm = () => {
    try {
      if (window.Xrm?.Utility?.getGlobalContext) return window.Xrm;
      if (window.parent?.Xrm?.Utility?.getGlobalContext) return window.parent.Xrm;
    } catch {
      return window.Xrm ?? null;
    }
    return null;
  };

  const xrm = pickXrm();
  if (!xrm) throw new Error("Xrm nao encontrado. Cole este script dentro do Model-driven App/Power Apps.");

  const clientUrl = xrm.Utility.getGlobalContext().getClientUrl().replace(/\/$/, "");
  const apiUrl = `${clientUrl}/api/data/v9.2`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0"
  };

  async function request(path, options = {}) {
    const response = await fetch(`${apiUrl}/${path}`, {
      credentials: "same-origin",
      headers,
      ...options
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message = data?.error?.message || text || response.statusText;
      const error = new Error(`${response.status} ${response.statusText}: ${message}`);
      error.response = data;
      throw error;
    }
    return data;
  }

  function label(value) {
    return {
      LocalizedLabels: [{ Label: value, LanguageCode: 1046 }],
      UserLocalizedLabel: { Label: value, LanguageCode: 1046 }
    };
  }

  async function tableExists() {
    try {
      const result = await request(`EntityDefinitions(LogicalName='${TABLE.logicalName}')?$select=LogicalName,EntitySetName`);
      return result;
    } catch (error) {
      if (String(error.message).startsWith("404 ")) return null;
      throw error;
    }
  }

  async function columnExists(logicalName) {
    try {
      await request(`EntityDefinitions(LogicalName='${TABLE.logicalName}')/Attributes(LogicalName='${logicalName}')?$select=LogicalName`);
      return true;
    } catch (error) {
      if (String(error.message).startsWith("404 ")) return false;
      throw error;
    }
  }

  function logicalName(schemaName) {
    return schemaName.replace(/^new_/, "new_").toLowerCase();
  }

  function buildColumn(column) {
    const common = {
      SchemaName: column.schemaName,
      DisplayName: label(column.label),
      Description: label(column.label),
      RequiredLevel: {
        Value: "None",
        CanBeChanged: true,
        ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings"
      }
    };

    if (column.type === "datetime") {
      return {
        "@odata.type": "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata",
        ...common,
        Format: "DateAndTime",
        DateTimeBehavior: { Value: "UserLocal" }
      };
    }

    if (column.type === "memo") {
      return {
        "@odata.type": "Microsoft.Dynamics.CRM.MemoAttributeMetadata",
        ...common,
        FormatName: { Value: "TextArea" },
        MaxLength: column.maxLength
      };
    }

    return {
      "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
      ...common,
      FormatName: { Value: "Text" },
      MaxLength: column.maxLength
    };
  }

  async function createTable() {
    await request("EntityDefinitions", {
      method: "POST",
      body: JSON.stringify({
        "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
        SchemaName: TABLE.schemaName,
        DisplayName: label(TABLE.displayName),
        DisplayCollectionName: label(TABLE.displayCollectionName),
        Description: label("Erros tecnicos capturados pelo App Motoristas."),
        OwnershipType: "UserOwned",
        IsActivity: false,
        HasActivities: false,
        HasNotes: true,
        Attributes: [{
          "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
          AttributeType: "String",
          AttributeTypeName: { Value: "StringType" },
          SchemaName: "new_name",
          DisplayName: label("Nome"),
          Description: label("Resumo do erro"),
          IsPrimaryName: true,
          RequiredLevel: {
            Value: "ApplicationRequired",
            CanBeChanged: true,
            ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings"
          },
          FormatName: { Value: "Text" },
          MaxLength: 160
        }]
      })
    });
  }

  async function createColumn(column) {
    await request(`EntityDefinitions(LogicalName='${TABLE.logicalName}')/Attributes`, {
      method: "POST",
      body: JSON.stringify(buildColumn(column))
    });
  }

  async function publishAll() {
    await request("PublishAllXml", { method: "POST", body: "{}" });
  }

  async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  function cleanGuid(value = "") {
    return value.replace(/[{}]/g, "").toLowerCase();
  }

  async function getCurrentUser() {
    const settings = xrm.Utility.getGlobalContext().userSettings;
    const userId = cleanGuid(settings?.userId ?? "");
    const fallback = {
      id: userId,
      name: settings?.userName ?? "",
      email: "",
      domainName: ""
    };
    if (!userId) return fallback;
    try {
      const user = await xrm.WebApi.retrieveRecord("systemuser", userId, "?$select=internalemailaddress,fullname,domainname");
      return {
        id: userId,
        name: user.fullname ?? fallback.name,
        email: user.internalemailaddress ?? "",
        domainName: user.domainname ?? ""
      };
    } catch {
      return fallback;
    }
  }

  async function createSmokeLog() {
    const user = await getCurrentUser();
    const payload = {
      new_name: "Smoke test - log app motoristas",
      new_occurredat: new Date().toISOString(),
      new_severity: "info",
      new_source: "console-install",
      new_action: "create-app-error-log-table-console",
      new_message: "Tabela de log criada/validada.",
      new_appname: "App Motoristas",
      new_userid: user.id,
      new_username: user.name,
      new_useremail: user.email,
      new_userdomainname: user.domainName,
      new_url: location.href,
      new_referrer: document.referrer,
      new_useragent: navigator.userAgent,
      new_language: navigator.language,
      new_platform: navigator.platform,
      new_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      new_viewport: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio || 1}`,
      new_visibilitystate: document.visibilityState,
      new_connectiontype: navigator.connection?.effectiveType ?? navigator.connection?.type ?? "",
      new_clienturl: clientUrl,
      new_isoffline: navigator.onLine ? "false" : "true",
      new_rawjson: JSON.stringify({ createdBy: "console", table: TABLE.logicalName })
    };

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      try {
        return await xrm.WebApi.createRecord(TABLE.logicalName, payload);
      } catch (error) {
        if (attempt === 6) throw error;
        await sleep(5000);
      }
    }
  }

  const summary = {
    table: TABLE.logicalName,
    createdTable: false,
    createdColumns: [],
    existingColumns: [],
    smokeLogId: ""
  };

  const existingTable = await tableExists();
  if (!existingTable) {
    console.log("[AppMotoristas:LogSetup] criando tabela", TABLE.logicalName);
    await createTable();
    summary.createdTable = true;
    await sleep(8000);
  } else {
    console.log("[AppMotoristas:LogSetup] tabela ja existe", existingTable);
  }

  for (const column of COLUMNS) {
    const name = logicalName(column.schemaName);
    if (await columnExists(name)) {
      summary.existingColumns.push(name);
      continue;
    }
    console.log("[AppMotoristas:LogSetup] criando coluna", name);
    await createColumn(column);
    summary.createdColumns.push(name);
    await sleep(1200);
  }

  console.log("[AppMotoristas:LogSetup] publicando customizacoes");
  await publishAll();
  await sleep(10000);

  const smoke = await createSmokeLog();
  summary.smokeLogId = smoke?.id ?? "";
  console.log("[AppMotoristas:LogSetup] pronto", summary);
  return summary;
})();
