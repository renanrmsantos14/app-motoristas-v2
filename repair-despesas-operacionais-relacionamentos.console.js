/**
 * Repair script for Despesas Operacionais relationships.
 * Paste in Model-driven App browser console as DEV/ADM.
 *
 * It creates only missing lookup relationships and validates all navigation
 * properties needed by App Motoristas.
 */
(async () => {
  const LCID_PT_BR = 1046;
  const ctx = Xrm.Utility.getGlobalContext();
  const base = ctx.getClientUrl().replace(/\/$/, "");
  const api = `${base}/api/data/v9.2`;

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
  };

  const relationships = [
    {
      label: "Despesa.Motorista",
      schemaName: "cr40f_funcionarios_cr40f_despesaoperacional_motorista",
      referencedEntity: "cr40f_funcionarios",
      referencingEntity: "cr40f_despesaoperacional",
      lookupSchemaName: "cr40f_Motorista",
      referencingAttribute: "cr40f_motorista",
      navigationName: "cr40f_Motorista",
      displayName: "Motorista",
      required: true,
    },
    {
      label: "Despesa.Veiculo",
      schemaName: "cr40f_veiculos_cr40f_despesaoperacional_veiculo",
      referencedEntity: "cr40f_veiculos",
      referencingEntity: "cr40f_despesaoperacional",
      lookupSchemaName: "cr40f_Veiculo",
      referencingAttribute: "cr40f_veiculo",
      navigationName: "cr40f_Veiculo",
      displayName: "Veículo",
    },
    {
      label: "Despesa.Reserva",
      schemaName: "cr40f_reservadeveculos_cr40f_despesaoperacional_reserva",
      referencedEntity: "cr40f_reservadeveculos",
      referencingEntity: "cr40f_despesaoperacional",
      lookupSchemaName: "cr40f_Reserva",
      referencingAttribute: "cr40f_reserva",
      navigationName: "cr40f_Reserva",
      displayName: "Serviço/Reserva",
    },
    {
      label: "Despesa.Categoria",
      schemaName: "cr40f_categoriadespesaoperacional_cr40f_despesaoperacional_categoria",
      referencedEntity: "cr40f_categoriadespesaoperacional",
      referencingEntity: "cr40f_despesaoperacional",
      lookupSchemaName: "cr40f_Categoria",
      referencingAttribute: "cr40f_categoria",
      navigationName: "cr40f_Categoria",
      displayName: "Categoria",
      required: true,
    },
    {
      label: "Despesa.FormaPagamento",
      schemaName: "cr40f_formapagamentodespesa_cr40f_despesaoperacional_formapagamento",
      referencedEntity: "cr40f_formapagamentodespesa",
      referencingEntity: "cr40f_despesaoperacional",
      lookupSchemaName: "cr40f_FormaPagamento",
      referencingAttribute: "cr40f_formapagamento",
      navigationName: "cr40f_FormaPagamento",
      displayName: "Forma de pagamento",
      required: true,
    },
    {
      label: "AnexoDespesa.Despesa",
      schemaName: "cr40f_despesaoperacional_cr40f_anexodespesaoperacional_despesa",
      referencedEntity: "cr40f_despesaoperacional",
      referencingEntity: "cr40f_anexodespesaoperacional",
      lookupSchemaName: "cr40f_Despesa",
      referencingAttribute: "cr40f_despesa",
      navigationName: "cr40f_Despesa",
      displayName: "Despesa operacional",
      required: true,
    },
    {
      label: "AnexoDespesa.EnviadoPor",
      schemaName: "cr40f_funcionarios_cr40f_anexodespesaoperacional_enviadopor",
      referencedEntity: "cr40f_funcionarios",
      referencingEntity: "cr40f_anexodespesaoperacional",
      lookupSchemaName: "cr40f_EnviadoPor",
      referencingAttribute: "cr40f_enviadopor",
      navigationName: "cr40f_EnviadoPor",
      displayName: "Enviado por",
    },
  ];

  const attributes = [
    { table: "cr40f_categoriadespesaoperacional", type: "boolean", schema: "cr40f_Ativa", logical: "cr40f_ativa", label: "Ativa", defaultValue: true },
    { table: "cr40f_categoriadespesaoperacional", type: "boolean", schema: "cr40f_ExigeVeiculo", logical: "cr40f_exigeveiculo", label: "Exige veículo" },
    { table: "cr40f_categoriadespesaoperacional", type: "boolean", schema: "cr40f_ExigeReserva", logical: "cr40f_exigereserva", label: "Exige serviço/reserva" },
    { table: "cr40f_categoriadespesaoperacional", type: "boolean", schema: "cr40f_ExigeKM", logical: "cr40f_exigekm", label: "Exige KM" },
    { table: "cr40f_categoriadespesaoperacional", type: "boolean", schema: "cr40f_ExigeLitros", logical: "cr40f_exigelitros", label: "Exige litros" },
    { table: "cr40f_categoriadespesaoperacional", type: "integer", schema: "cr40f_Ordem", logical: "cr40f_ordem", label: "Ordem", min: 0, max: 9999 },
    { table: "cr40f_formapagamentodespesa", type: "boolean", schema: "cr40f_Ativa", logical: "cr40f_ativa", label: "Ativa", defaultValue: true },
    { table: "cr40f_formapagamentodespesa", type: "string", schema: "cr40f_Tipo", logical: "cr40f_tipo", label: "Tipo", maxLength: 80 },
    { table: "cr40f_formapagamentodespesa", type: "integer", schema: "cr40f_Ordem", logical: "cr40f_ordem", label: "Ordem", min: 0, max: 9999 },
    { table: "cr40f_despesaoperacional", type: "datetime", schema: "cr40f_DataGasto", logical: "cr40f_datagasto", label: "Data do gasto", required: true },
    { table: "cr40f_despesaoperacional", type: "money", schema: "cr40f_Valor", logical: "cr40f_valor", label: "Valor", required: true },
    { table: "cr40f_despesaoperacional", type: "integer", schema: "cr40f_KMInformado", logical: "cr40f_kminformado", label: "KM informado", min: 0, max: 2000000 },
    { table: "cr40f_despesaoperacional", type: "decimal", schema: "cr40f_Litros", logical: "cr40f_litros", label: "Litros", min: 0, max: 100000, precision: 2 },
    { table: "cr40f_despesaoperacional", type: "string", schema: "cr40f_Estabelecimento", logical: "cr40f_estabelecimento", label: "Estabelecimento", maxLength: 200 },
    { table: "cr40f_despesaoperacional", type: "memo", schema: "cr40f_Observacao", logical: "cr40f_observacao", label: "Observação do motorista", maxLength: 4000 },
    { table: "cr40f_despesaoperacional", type: "picklist", schema: "cr40f_StatusOperacional", logical: "cr40f_statusoperacional", label: "Status operacional", required: true, options: [[100000000, "Enviado"], [100000001, "Precisa corrigir"], [100000002, "Validado"], [100000003, "Recusado"], [100000004, "Cancelado"]] },
    { table: "cr40f_despesaoperacional", type: "picklist", schema: "cr40f_StatusFinanceiro", logical: "cr40f_statusfinanceiro", label: "Status financeiro", required: true, options: [[100000000, "Não reembolsável"], [100000001, "Aguardando pagamento"], [100000002, "Pago"], [100000003, "Cancelado"]] },
    { table: "cr40f_despesaoperacional", type: "picklist", schema: "cr40f_StatusAnexo", logical: "cr40f_statusanexo", label: "Status dos anexos", options: [[100000000, "Sem anexo"], [100000001, "Enviando"], [100000002, "Completo"], [100000003, "Falhou"], [100000004, "Parcial"]] },
    { table: "cr40f_despesaoperacional", type: "picklist", schema: "cr40f_Origem", logical: "cr40f_origem", label: "Origem", required: true, options: [[100000000, "App Motoristas"], [100000001, "Model-driven"], [100000002, "Flow"], [100000003, "Importação"]] },
    { table: "cr40f_anexodespesaoperacional", type: "string", schema: "cr40f_NomeArquivo", logical: "cr40f_nomearquivo", label: "Nome do arquivo", maxLength: 255, required: true },
    { table: "cr40f_anexodespesaoperacional", type: "string", schema: "cr40f_UrlSharePoint", logical: "cr40f_urlsharepoint", label: "URL SharePoint/OneDrive", maxLength: 1000, required: true },
    { table: "cr40f_anexodespesaoperacional", type: "string", schema: "cr40f_ShareLink", logical: "cr40f_sharelink", label: "Share link", maxLength: 1000 },
    { table: "cr40f_anexodespesaoperacional", type: "integer", schema: "cr40f_Ordem", logical: "cr40f_ordem", label: "Ordem", min: 0, max: 9999 },
    { table: "cr40f_anexodespesaoperacional", type: "datetime", schema: "cr40f_DataEnvio", logical: "cr40f_dataenvio", label: "Data de envio" },
    { table: "cr40f_anexodespesaoperacional", type: "picklist", schema: "cr40f_Status", logical: "cr40f_status", label: "Status", required: true, options: [[100000000, "Pendente"], [100000001, "Enviado"], [100000002, "Falhou"], [100000003, "Inválido"]] },
    { table: "cr40f_anexodespesaoperacional", type: "picklist", schema: "cr40f_Tipo", logical: "cr40f_tipo", label: "Tipo", required: true, options: [[100000000, "Comprovante"], [100000001, "Foto complementar"], [100000002, "Outros"]] },
  ];

  const log = (...args) => console.log("[Repair Despesas]", ...args);
  const warn = (...args) => console.warn("[Repair Despesas]", ...args);

  function label(text) {
    return {
      LocalizedLabels: [{ Label: text, LanguageCode: LCID_PT_BR }],
    };
  }

  function required(isRequired) {
    return {
      Value: isRequired ? "ApplicationRequired" : "None",
      CanBeChanged: true,
      ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings",
    };
  }

  function option(value, text) {
    return { Value: value, Label: label(text) };
  }

  async function request(method, path, body, ok404 = false) {
    const response = await fetch(encodeURI(`${api}${path}`), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    if (ok404 && response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`${method} ${path}\n${response.status} ${response.statusText}\n${text}`);
    }
    return text ? JSON.parse(text) : null;
  }

  async function entity(logicalName) {
    return request(
      "GET",
      `/EntityDefinitions(LogicalName='${logicalName}')?$select=LogicalName,EntitySetName`,
      null,
      true,
    );
  }

  async function attribute(table, logicalName) {
    return request(
      "GET",
      `/EntityDefinitions(LogicalName='${table}')/Attributes(LogicalName='${logicalName}')?$select=LogicalName,SchemaName`,
      null,
      true,
    );
  }

  async function manyToOne(referencingEntity) {
    const result = await request(
      "GET",
      `/EntityDefinitions(LogicalName='${referencingEntity}')/ManyToOneRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute,ReferencingEntityNavigationPropertyName`,
    );
    return result?.value ?? [];
  }

  async function publishAll() {
    log("Publicando customizações.");
    await request("POST", "/PublishAllXml", {});
  }

  async function wait(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  async function createRelationship(config) {
    log(`Criando relacionamento: ${config.label}`);
    await request("POST", "/RelationshipDefinitions", {
      "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
      SchemaName: config.schemaName,
      ReferencedEntity: config.referencedEntity,
      ReferencingEntity: config.referencingEntity,
      ReferencingEntityNavigationPropertyName: config.navigationName,
      Lookup: {
        "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
        SchemaName: config.lookupSchemaName,
        DisplayName: label(config.displayName),
        RequiredLevel: required(Boolean(config.required)),
      },
      CascadeConfiguration: {
        Assign: "NoCascade",
        Delete: "RemoveLink",
        Merge: "NoCascade",
        Reparent: "NoCascade",
        Share: "NoCascade",
        Unshare: "NoCascade",
      },
    });
  }

  function buildAttribute(config) {
    const base = {
      SchemaName: config.schema,
      DisplayName: label(config.label),
      RequiredLevel: required(Boolean(config.required)),
    };
    if (config.type === "string") {
      return {
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        ...base,
        MaxLength: config.maxLength ?? 200,
        FormatName: { Value: "Text" },
      };
    }
    if (config.type === "memo") {
      return {
        "@odata.type": "Microsoft.Dynamics.CRM.MemoAttributeMetadata",
        ...base,
        MaxLength: config.maxLength ?? 4000,
        FormatName: { Value: "TextArea" },
      };
    }
    if (config.type === "integer") {
      return {
        "@odata.type": "Microsoft.Dynamics.CRM.IntegerAttributeMetadata",
        ...base,
        MinValue: config.min ?? 0,
        MaxValue: config.max ?? 2147483647,
        Format: "None",
      };
    }
    if (config.type === "money") {
      return {
        "@odata.type": "Microsoft.Dynamics.CRM.MoneyAttributeMetadata",
        ...base,
        MinValue: 0,
        MaxValue: 100000000000,
        Precision: 2,
        PrecisionSource: 1,
      };
    }
    if (config.type === "decimal") {
      return {
        "@odata.type": "Microsoft.Dynamics.CRM.DecimalAttributeMetadata",
        ...base,
        MinValue: config.min ?? 0,
        MaxValue: config.max ?? 100000,
        Precision: config.precision ?? 2,
      };
    }
    if (config.type === "datetime") {
      return {
        "@odata.type": "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata",
        ...base,
        DateTimeBehavior: { Value: "UserLocal" },
        Format: "DateAndTime",
      };
    }
    if (config.type === "boolean") {
      return {
        "@odata.type": "Microsoft.Dynamics.CRM.BooleanAttributeMetadata",
        ...base,
        DefaultValue: Boolean(config.defaultValue),
        OptionSet: {
          TrueOption: option(1, "Sim"),
          FalseOption: option(0, "Não"),
        },
      };
    }
    if (config.type === "picklist") {
      return {
        "@odata.type": "Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
        ...base,
        OptionSet: {
          "@odata.type": "Microsoft.Dynamics.CRM.OptionSetMetadata",
          IsGlobal: false,
          OptionSetType: "Picklist",
          Options: config.options.map(([value, text]) => option(value, text)),
        },
      };
    }
    throw new Error(`Tipo de campo não suportado: ${config.type}`);
  }

  async function createAttribute(config) {
    log(`Criando campo: ${config.table}.${config.logical}`);
    await request("POST", `/EntityDefinitions(LogicalName='${config.table}')/Attributes`, buildAttribute(config));
  }

  for (const table of [
    "cr40f_despesaoperacional",
    "cr40f_anexodespesaoperacional",
    "cr40f_categoriadespesaoperacional",
    "cr40f_formapagamentodespesa",
    "cr40f_funcionarios",
    "cr40f_veiculos",
    "cr40f_reservadeveculos",
  ]) {
    if (!(await entity(table))) throw new Error(`Tabela ausente: ${table}`);
  }

  const createdAttributes = [];
  for (const config of attributes) {
    if (await attribute(config.table, config.logical)) {
      log(`OK campo: ${config.table}.${config.logical}`);
      continue;
    }
    await createAttribute(config);
    createdAttributes.push(`${config.table}.${config.logical}`);
  }

  if (createdAttributes.length) {
    await publishAll();
    await wait(10000);
  }

  const created = [];
  const warnings = [];
  for (const config of relationships) {
    const existing = await manyToOne(config.referencingEntity);
    const byAttribute = existing.find(item =>
      String(item.ReferencingAttribute ?? "").toLowerCase() === config.referencingAttribute &&
      String(item.ReferencedEntity ?? "").toLowerCase() === config.referencedEntity
    );
    const bySchema = existing.find(item => String(item.SchemaName ?? "").toLowerCase() === config.schemaName);

    if (byAttribute?.ReferencingEntityNavigationPropertyName) {
      log(`OK: ${config.label}`, byAttribute.ReferencingEntityNavigationPropertyName);
      continue;
    }

    if (bySchema && !byAttribute) {
      warnings.push({
        label: config.label,
        problem: "SchemaName existe, mas ReferencingAttribute/ReferencedEntity não batem.",
        relationship: bySchema,
      });
      warn(`Conflito: ${config.label}`, bySchema);
      continue;
    }

    if (byAttribute && !byAttribute.ReferencingEntityNavigationPropertyName) {
      warnings.push({
        label: config.label,
        problem: "Relacionamento existe sem navigation property utilizável.",
        relationship: byAttribute,
      });
      warn(`Relacionamento sem navigation property: ${config.label}`, byAttribute);
      continue;
    }

    await createRelationship(config);
    created.push(config.label);
  }

  if (created.length) {
    await publishAll();
    await wait(10000);
  }

  const finalCheck = [];
  for (const config of relationships) {
    const existing = await manyToOne(config.referencingEntity);
    const found = existing.find(item =>
      String(item.ReferencingAttribute ?? "").toLowerCase() === config.referencingAttribute &&
      String(item.ReferencedEntity ?? "").toLowerCase() === config.referencedEntity
    );
    finalCheck.push({
      label: config.label,
      ok: Boolean(found?.ReferencingEntityNavigationPropertyName),
      attribute: found?.ReferencingAttribute ?? "",
      navigation: found?.ReferencingEntityNavigationPropertyName ?? "",
      schema: found?.SchemaName ?? "",
    });
  }

  console.table(finalCheck);
  const missing = finalCheck.filter(item => !item.ok);
  if (missing.length) {
    throw new Error(`Ainda faltam relacionamentos: ${JSON.stringify({ missing, warnings }, null, 2)}`);
  }

  log("Concluído.", { created, warnings, finalCheck });
})();
