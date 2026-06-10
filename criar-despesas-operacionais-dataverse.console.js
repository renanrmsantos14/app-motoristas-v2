/**
 * Console script for Model-driven App.
 * Creates the operational expenses ERP base:
 * - cr40f_despesaoperacional
 * - cr40f_anexodespesaoperacional
 * - cr40f_categoriadespesaoperacional
 * - cr40f_formapagamentodespesa
 *
 * Paste in browser console while inside the target Dataverse environment.
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

  const log = (...args) => console.log("[Despesas Operacionais]", ...args);
  const warn = (...args) => console.warn("[Despesas Operacionais]", ...args);

  function label(text) {
    return {
      LocalizedLabels: [{ Label: text, LanguageCode: LCID_PT_BR }],
    };
  }

  function required(value = "None") {
    return { Value: value, CanBeChanged: true, ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings" };
  }

  function option(value, text) {
    return { Value: value, Label: label(text) };
  }

  async function request(method, path, body, ok404 = false) {
    const res = await fetch(`${api}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (ok404 && res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`${method} ${path}\n${res.status} ${res.statusText}\n${text}`);
    }
    if (!text) return null;
    return JSON.parse(text);
  }

  async function entity(logicalName) {
    return request(
      "GET",
      `/EntityDefinitions(LogicalName='${logicalName}')?$select=LogicalName,SchemaName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute`,
      null,
      true,
    );
  }

  async function attribute(entityLogicalName, attributeLogicalName) {
    return request(
      "GET",
      `/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attributeLogicalName}')?$select=LogicalName`,
      null,
      true,
    );
  }

  async function createEntity({ logicalName, schemaName, displayName, collectionName, primaryNameSchema = "cr40f_Nome" }) {
    if (await entity(logicalName)) {
      log(`Tabela já existe: ${logicalName}`);
      return;
    }

    log(`Criando tabela: ${logicalName}`);
    await request("POST", "/EntityDefinitions", {
      "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
      SchemaName: schemaName,
      DisplayName: label(displayName),
      DisplayCollectionName: label(collectionName),
      Description: label(`Criado por script para ${displayName}.`),
      OwnershipType: "UserOwned",
      IsActivity: false,
      HasActivities: false,
      HasNotes: false,
      Attributes: [{
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        AttributeType: "String",
        AttributeTypeName: { Value: "StringType" },
        SchemaName: primaryNameSchema,
        RequiredLevel: required("ApplicationRequired"),
        MaxLength: 120,
        FormatName: { Value: "Text" },
        DisplayName: label("Nome"),
        Description: label("Identificador legível do registro."),
        IsPrimaryName: true,
      }],
    });
  }

  async function createAttribute(entityLogicalName, logicalName, metadata) {
    if (await attribute(entityLogicalName, logicalName)) {
      log(`Campo já existe: ${entityLogicalName}.${logicalName}`);
      return;
    }
    log(`Criando campo: ${entityLogicalName}.${metadata.SchemaName}`);
    await request("POST", `/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes`, metadata);
  }

  async function createString(entityName, logicalName, schemaName, displayName, maxLength = 200, req = "None") {
    return createAttribute(entityName, logicalName, {
      "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
      SchemaName: schemaName,
      DisplayName: label(displayName),
      RequiredLevel: required(req),
      MaxLength: maxLength,
      FormatName: { Value: "Text" },
    });
  }

  async function createMemo(entityName, logicalName, schemaName, displayName, maxLength = 4000, req = "None") {
    return createAttribute(entityName, logicalName, {
      "@odata.type": "Microsoft.Dynamics.CRM.MemoAttributeMetadata",
      SchemaName: schemaName,
      DisplayName: label(displayName),
      RequiredLevel: required(req),
      MaxLength: maxLength,
      FormatName: { Value: "TextArea" },
    });
  }

  async function createInteger(entityName, logicalName, schemaName, displayName, min = 0, max = 2147483647, req = "None") {
    return createAttribute(entityName, logicalName, {
      "@odata.type": "Microsoft.Dynamics.CRM.IntegerAttributeMetadata",
      SchemaName: schemaName,
      DisplayName: label(displayName),
      RequiredLevel: required(req),
      MinValue: min,
      MaxValue: max,
      Format: "None",
    });
  }

  async function createDecimal(entityName, logicalName, schemaName, displayName, precision = 6, req = "None") {
    return createAttribute(entityName, logicalName, {
      "@odata.type": "Microsoft.Dynamics.CRM.DecimalAttributeMetadata",
      SchemaName: schemaName,
      DisplayName: label(displayName),
      RequiredLevel: required(req),
      MinValue: -90_000_000_000,
      MaxValue: 90_000_000_000,
      Precision: precision,
    });
  }

  async function createMoney(entityName, logicalName, schemaName, displayName, req = "None") {
    return createAttribute(entityName, logicalName, {
      "@odata.type": "Microsoft.Dynamics.CRM.MoneyAttributeMetadata",
      SchemaName: schemaName,
      DisplayName: label(displayName),
      RequiredLevel: required(req),
      MinValue: 0,
      MaxValue: 100000000000,
      Precision: 2,
      PrecisionSource: 1,
    });
  }

  async function createDateTime(entityName, logicalName, schemaName, displayName, req = "None") {
    return createAttribute(entityName, logicalName, {
      "@odata.type": "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata",
      SchemaName: schemaName,
      DisplayName: label(displayName),
      RequiredLevel: required(req),
      DateTimeBehavior: { Value: "UserLocal" },
      Format: "DateAndTime",
    });
  }

  async function createBoolean(entityName, logicalName, schemaName, displayName, defaultValue = false, req = "None") {
    return createAttribute(entityName, logicalName, {
      "@odata.type": "Microsoft.Dynamics.CRM.BooleanAttributeMetadata",
      SchemaName: schemaName,
      DisplayName: label(displayName),
      RequiredLevel: required(req),
      DefaultValue: defaultValue,
      OptionSet: {
        TrueOption: option(1, "Sim"),
        FalseOption: option(0, "Não"),
      },
    });
  }

  async function createPicklist(entityName, logicalName, schemaName, displayName, options, req = "None") {
    return createAttribute(entityName, logicalName, {
      "@odata.type": "Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
      SchemaName: schemaName,
      DisplayName: label(displayName),
      RequiredLevel: required(req),
      OptionSet: {
        "@odata.type": "Microsoft.Dynamics.CRM.OptionSetMetadata",
        IsGlobal: false,
        OptionSetType: "Picklist",
        Options: options.map(([value, text]) => option(value, text)),
      },
    });
  }

  async function relationshipExists(schemaName) {
    const result = await request(
      "GET",
      `/RelationshipDefinitions(SchemaName='${schemaName}')?$select=SchemaName`,
      null,
      true,
    );
    return Boolean(result);
  }

  async function createLookup({ schemaName, referencedEntity, referencingEntity, lookupSchemaName, navigationName = lookupSchemaName, displayName, req = "None" }) {
    if (await relationshipExists(schemaName)) {
      log(`Relação já existe: ${schemaName}`);
      return;
    }
    log(`Criando lookup: ${referencingEntity}.${lookupSchemaName} -> ${referencedEntity}`);
    await request("POST", "/RelationshipDefinitions", {
      "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
      SchemaName: schemaName,
      ReferencedEntity: referencedEntity,
      ReferencingEntity: referencingEntity,
      ReferencingEntityNavigationPropertyName: navigationName,
      Lookup: {
        "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
        SchemaName: lookupSchemaName,
        DisplayName: label(displayName),
        RequiredLevel: required(req),
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

  async function publishAll() {
    log("Publicando customizações...");
    await request("POST", "/PublishAllXml", {});
  }

  async function wait(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  async function getEntitySet(logicalName) {
    const e = await entity(logicalName);
    if (!e?.EntitySetName) throw new Error(`EntitySetName não encontrado para ${logicalName}`);
    return e.EntitySetName;
  }

  async function recordExistsByName(entitySetName, nameField, name) {
    const safe = String(name).replace(/'/g, "''");
    const result = await request("GET", `/${entitySetName}?$select=${nameField}&$filter=${nameField} eq '${safe}'&$top=1`);
    return Boolean(result?.value?.length);
  }

  async function createSeed(entitySetName, nameField, name, payload) {
    if (await recordExistsByName(entitySetName, nameField, name)) {
      log(`Seed já existe: ${entitySetName} / ${name}`);
      return;
    }
    log(`Criando seed: ${entitySetName} / ${name}`);
    await request("POST", `/${entitySetName}`, payload);
  }

  const existingRequired = ["cr40f_funcionarios", "cr40f_veiculos", "cr40f_reservadeveculos"];
  for (const table of existingRequired) {
    if (!(await entity(table))) {
      throw new Error(`Tabela obrigatória não encontrada: ${table}`);
    }
  }

  await createEntity({
    logicalName: "cr40f_categoriadespesaoperacional",
    schemaName: "cr40f_CategoriaDespesaOperacional",
    displayName: "Categoria de Despesa Operacional",
    collectionName: "Categorias de Despesa Operacional",
  });

  await createEntity({
    logicalName: "cr40f_formapagamentodespesa",
    schemaName: "cr40f_FormaPagamentoDespesa",
    displayName: "Forma de Pagamento de Despesa",
    collectionName: "Formas de Pagamento de Despesa",
  });

  await createEntity({
    logicalName: "cr40f_despesaoperacional",
    schemaName: "cr40f_DespesaOperacional",
    displayName: "Despesa Operacional",
    collectionName: "Despesas Operacionais",
  });

  await createEntity({
    logicalName: "cr40f_anexodespesaoperacional",
    schemaName: "cr40f_AnexoDespesaOperacional",
    displayName: "Anexo de Despesa Operacional",
    collectionName: "Anexos de Despesa Operacional",
  });

  await publishAll();
  await wait(5000);

  await createBoolean("cr40f_categoriadespesaoperacional", "cr40f_ativa", "cr40f_Ativa", "Ativa", true);
  await createBoolean("cr40f_categoriadespesaoperacional", "cr40f_exigeveiculo", "cr40f_ExigeVeiculo", "Exige veículo", false);
  await createBoolean("cr40f_categoriadespesaoperacional", "cr40f_exigereserva", "cr40f_ExigeReserva", "Exige serviço/reserva", false);
  await createBoolean("cr40f_categoriadespesaoperacional", "cr40f_exigekm", "cr40f_ExigeKM", "Exige KM", false);
  await createBoolean("cr40f_categoriadespesaoperacional", "cr40f_exigelitros", "cr40f_ExigeLitros", "Exige litros", false);
  await createInteger("cr40f_categoriadespesaoperacional", "cr40f_ordem", "cr40f_Ordem", "Ordem", 0, 9999);
  await createString("cr40f_categoriadespesaoperacional", "cr40f_grupodre", "cr40f_GrupoDRE", "Grupo DRE", 120);

  await createBoolean("cr40f_formapagamentodespesa", "cr40f_ativa", "cr40f_Ativa", "Ativa", true);
  await createString("cr40f_formapagamentodespesa", "cr40f_tipo", "cr40f_Tipo", "Tipo", 80);
  await createInteger("cr40f_formapagamentodespesa", "cr40f_ordem", "cr40f_Ordem", "Ordem", 0, 9999);

  await createDateTime("cr40f_despesaoperacional", "cr40f_datagasto", "cr40f_DataGasto", "Data do gasto", "ApplicationRequired");
  await createMoney("cr40f_despesaoperacional", "cr40f_valor", "cr40f_Valor", "Valor", "ApplicationRequired");
  await createInteger("cr40f_despesaoperacional", "cr40f_kminformado", "cr40f_KMInformado", "KM informado", 0, 2000000);
  await createDecimal("cr40f_despesaoperacional", "cr40f_litros", "cr40f_Litros", "Litros", 2);
  await createString("cr40f_despesaoperacional", "cr40f_estabelecimento", "cr40f_Estabelecimento", "Estabelecimento", 200);
  await createMemo("cr40f_despesaoperacional", "cr40f_observacao", "cr40f_Observacao", "Observação do motorista", 4000);
  await createMemo("cr40f_despesaoperacional", "cr40f_observacaointerna", "cr40f_ObservacaoInterna", "Observação interna", 4000);
  await createString("cr40f_despesaoperacional", "cr40f_protocolo", "cr40f_Protocolo", "Protocolo", 80);
  await createString("cr40f_despesaoperacional", "cr40f_hashdeduplicacao", "cr40f_HashDeduplicacao", "Hash de deduplicação", 200);
  await createBoolean("cr40f_despesaoperacional", "cr40f_possivelduplicidade", "cr40f_PossivelDuplicidade", "Possível duplicidade", false);
  await createDecimal("cr40f_despesaoperacional", "cr40f_latitude", "cr40f_Latitude", "Latitude", 8);
  await createDecimal("cr40f_despesaoperacional", "cr40f_longitude", "cr40f_Longitude", "Longitude", 8);
  await createMemo("cr40f_despesaoperacional", "cr40f_payloadorigem", "cr40f_PayloadOrigem", "Payload de origem", 10000);
  await createPicklist("cr40f_despesaoperacional", "cr40f_statusoperacional", "cr40f_StatusOperacional", "Status operacional", [
    [100000000, "Enviado"],
    [100000001, "Precisa corrigir"],
    [100000002, "Validado"],
    [100000003, "Recusado"],
    [100000004, "Cancelado"],
  ], "ApplicationRequired");
  await createPicklist("cr40f_despesaoperacional", "cr40f_statusfinanceiro", "cr40f_StatusFinanceiro", "Status financeiro", [
    [100000000, "Não reembolsável"],
    [100000001, "Aguardando pagamento"],
    [100000002, "Pago"],
    [100000003, "Cancelado"],
  ], "ApplicationRequired");
  await createPicklist("cr40f_despesaoperacional", "cr40f_statusanexo", "cr40f_StatusAnexo", "Status dos anexos", [
    [100000000, "Sem anexo"],
    [100000001, "Enviando"],
    [100000002, "Completo"],
    [100000003, "Falhou"],
    [100000004, "Parcial"],
  ]);
  await createPicklist("cr40f_despesaoperacional", "cr40f_origem", "cr40f_Origem", "Origem", [
    [100000000, "App Motoristas"],
    [100000001, "Model-driven"],
    [100000002, "Flow"],
    [100000003, "Importação"],
  ], "ApplicationRequired");

  await createString("cr40f_anexodespesaoperacional", "cr40f_nomearquivo", "cr40f_NomeArquivo", "Nome do arquivo", 255, "ApplicationRequired");
  await createString("cr40f_anexodespesaoperacional", "cr40f_urlsharepoint", "cr40f_UrlSharePoint", "URL SharePoint/OneDrive", 1000, "ApplicationRequired");
  await createString("cr40f_anexodespesaoperacional", "cr40f_sharelink", "cr40f_ShareLink", "Share link", 1000);
  await createString("cr40f_anexodespesaoperacional", "cr40f_driveitemid", "cr40f_DriveItemId", "Drive item ID", 255);
  await createString("cr40f_anexodespesaoperacional", "cr40f_folderid", "cr40f_FolderId", "Folder ID", 255);
  await createString("cr40f_anexodespesaoperacional", "cr40f_mimetype", "cr40f_MimeType", "MIME type", 120);
  await createString("cr40f_anexodespesaoperacional", "cr40f_hasharquivo", "cr40f_HashArquivo", "Hash do arquivo", 200);
  await createInteger("cr40f_anexodespesaoperacional", "cr40f_tamanhobytes", "cr40f_TamanhoBytes", "Tamanho em bytes", 0, 2147483647);
  await createInteger("cr40f_anexodespesaoperacional", "cr40f_ordem", "cr40f_Ordem", "Ordem", 0, 9999);
  await createDateTime("cr40f_anexodespesaoperacional", "cr40f_dataenvio", "cr40f_DataEnvio", "Data de envio");
  await createMemo("cr40f_anexodespesaoperacional", "cr40f_motivoinvalidacao", "cr40f_MotivoInvalidacao", "Motivo de invalidação", 4000);
  await createMemo("cr40f_anexodespesaoperacional", "cr40f_payloadflow", "cr40f_PayloadFlow", "Payload do Flow", 10000);
  await createPicklist("cr40f_anexodespesaoperacional", "cr40f_status", "cr40f_Status", "Status", [
    [100000000, "Pendente"],
    [100000001, "Enviado"],
    [100000002, "Falhou"],
    [100000003, "Inválido"],
  ], "ApplicationRequired");
  await createPicklist("cr40f_anexodespesaoperacional", "cr40f_tipo", "cr40f_Tipo", "Tipo", [
    [100000000, "Comprovante"],
    [100000001, "Foto complementar"],
    [100000002, "Outros"],
  ], "ApplicationRequired");

  await createLookup({
    schemaName: "cr40f_funcionarios_cr40f_despesaoperacional_motorista",
    referencedEntity: "cr40f_funcionarios",
    referencingEntity: "cr40f_despesaoperacional",
    lookupSchemaName: "cr40f_Motorista",
    displayName: "Motorista",
    req: "ApplicationRequired",
  });
  await createLookup({
    schemaName: "cr40f_veiculos_cr40f_despesaoperacional_veiculo",
    referencedEntity: "cr40f_veiculos",
    referencingEntity: "cr40f_despesaoperacional",
    lookupSchemaName: "cr40f_Veiculo",
    displayName: "Veículo",
  });
  await createLookup({
    schemaName: "cr40f_reservadeveculos_cr40f_despesaoperacional_reserva",
    referencedEntity: "cr40f_reservadeveculos",
    referencingEntity: "cr40f_despesaoperacional",
    lookupSchemaName: "cr40f_Reserva",
    displayName: "Serviço/Reserva",
  });
  await createLookup({
    schemaName: "cr40f_categoriadespesaoperacional_cr40f_despesaoperacional_categoria",
    referencedEntity: "cr40f_categoriadespesaoperacional",
    referencingEntity: "cr40f_despesaoperacional",
    lookupSchemaName: "cr40f_Categoria",
    displayName: "Categoria",
    req: "ApplicationRequired",
  });
  await createLookup({
    schemaName: "cr40f_formapagamentodespesa_cr40f_despesaoperacional_formapagamento",
    referencedEntity: "cr40f_formapagamentodespesa",
    referencingEntity: "cr40f_despesaoperacional",
    lookupSchemaName: "cr40f_FormaPagamento",
    displayName: "Forma de pagamento",
    req: "ApplicationRequired",
  });
  await createLookup({
    schemaName: "cr40f_despesaoperacional_cr40f_anexodespesaoperacional_despesa",
    referencedEntity: "cr40f_despesaoperacional",
    referencingEntity: "cr40f_anexodespesaoperacional",
    lookupSchemaName: "cr40f_Despesa",
    displayName: "Despesa operacional",
    req: "ApplicationRequired",
  });
  await createLookup({
    schemaName: "cr40f_funcionarios_cr40f_anexodespesaoperacional_enviadopor",
    referencedEntity: "cr40f_funcionarios",
    referencingEntity: "cr40f_anexodespesaoperacional",
    lookupSchemaName: "cr40f_EnviadoPor",
    displayName: "Enviado por",
  });

  await publishAll();
  await wait(8000);

  const categoriaSet = await getEntitySet("cr40f_categoriadespesaoperacional");
  const pagamentoSet = await getEntitySet("cr40f_formapagamentodespesa");

  const categorias = [
    ["Combustível", true, false, true, true, 10, "Frota"],
    ["Pedágio", false, false, false, false, 20, "Operacional"],
    ["Estacionamento", false, false, false, false, 30, "Operacional"],
    ["Lavagem", true, false, false, false, 40, "Frota"],
    ["Manutenção emergencial", true, false, false, false, 50, "Frota"],
    ["Alimentação", false, false, false, false, 60, "Equipe"],
    ["Hospedagem", false, false, false, false, 70, "Equipe"],
    ["Outros", false, false, false, false, 999, "Outros"],
  ];

  for (const [nome, exigeVeiculo, exigeReserva, exigeKm, exigeLitros, ordem, grupo] of categorias) {
    await createSeed(categoriaSet, "cr40f_nome", nome, {
      cr40f_nome: nome,
      cr40f_ativa: true,
      cr40f_exigeveiculo: exigeVeiculo,
      cr40f_exigereserva: exigeReserva,
      cr40f_exigekm: exigeKm,
      cr40f_exigelitros: exigeLitros,
      cr40f_ordem: ordem,
      cr40f_grupodre: grupo,
    });
  }

  const formasPagamento = [
    ["Cartão empresa", "Cartão", 10],
    ["Cartão motorista", "Cartão", 20],
    ["Dinheiro motorista", "Dinheiro", 30],
    ["Pix motorista", "Pix", 40],
    ["Tag CTF", "Tag", 50],
    ["Sem Parar", "Tag", 60],
    ["Outros", "Outros", 999],
  ];

  for (const [nome, tipo, ordem] of formasPagamento) {
    await createSeed(pagamentoSet, "cr40f_nome", nome, {
      cr40f_nome: nome,
      cr40f_ativa: true,
      cr40f_tipo: tipo,
      cr40f_ordem: ordem,
    });
  }

  await publishAll();

  const result = {
    ok: true,
    createdOrChecked: [
      "cr40f_despesaoperacional",
      "cr40f_anexodespesaoperacional",
      "cr40f_categoriadespesaoperacional",
      "cr40f_formapagamentodespesa",
    ],
    nextUseInApp: {
      expenseTable: await getEntitySet("cr40f_despesaoperacional"),
      attachmentTable: await getEntitySet("cr40f_anexodespesaoperacional"),
      categoryTable: categoriaSet,
      paymentMethodTable: pagamentoSet,
    },
  };

  log("Concluído.", result);
  return result;
})().catch(err => {
  console.error("[Despesas Operacionais] Falhou:", err);
  throw err;
});
