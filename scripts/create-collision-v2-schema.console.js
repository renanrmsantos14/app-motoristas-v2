/*
Cole este script no console do Model-driven App, no ambiente DEV.

Faz:
- cria/valida solution Betinhos_Core_Clean
- cria tabelas:
  - cr40f_colisao_v2
  - cr40f_anexorecebimento_v2
  - cr40f_anexocolisao_v2
- cria colunas e relacionamentos principais
- publica
- tenta completar form principal e view publica padrao
- baixa um JSON com resultado, EntitySetName real e validacao de choices

Seguro:
- nao apaga nada
- nao altera TEST/PROD
- so cria/atualiza metadata no ambiente atual autenticado
*/
(async () => {
  const LCID = 1046;
  const FIELD_CLASSID = "{4273EDBD-AC1D-40D3-9FB2-095C621B552D}";
  const LOOKUP_CLASSID = "{270BD3DB-D9AF-4782-9025-509E298DEC0A}";
  const CHOICE_CLASSID = "{3EF39988-22BB-4F0B-BBBE-64B5A3748AEE}";
  const BOOLEAN_CLASSID = "{67FAC785-CD58-4F9F-ABB3-4B7DDC6ED5ED}";
  const SOLUTION_UNIQUE_NAME = "Betinhos_Core_Clean";
  const PUBLISHER_UNIQUE_NAME = "DefaultPublisherorg23b93544";

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
  if (!xrm) throw new Error("Xrm nao encontrado. Cole dentro do Model-driven App DEV.");

  const api = xrm.WebApi.online || xrm.WebApi;
  const clientUrl = xrm.Utility.getGlobalContext().getClientUrl().replace(/\/$/, "");
  const webApi = `${clientUrl}/api/data/v9.2`;
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
  };

  const tables = [
    {
      oldLogicalName: "cr40f_colisao",
      logicalName: "cr40f_colisao_v2",
      schemaName: "cr40f_Colisao_v2",
      displayName: "Colisao v2",
      collectionName: "Colisoes v2",
      primaryNameSchema: "cr40f_Name",
      entityDescription: "Colisao recriada com metadata limpa.",
      columns: [
        { kind: "datetime", schemaName: "cr40f_DataHora", logicalName: "cr40f_datahora", label: "Data/hora" },
        { kind: "memo", schemaName: "cr40f_Descricao", logicalName: "cr40f_descricao", label: "Descricao", maxLength: 4000 },
        { kind: "boolean", schemaName: "cr40f_HouveTerceiro", logicalName: "cr40f_houveterceiro", label: "Houve terceiro", trueLabel: "Sim", falseLabel: "Nao" },
        { kind: "string", schemaName: "cr40f_Local", logicalName: "cr40f_local", label: "Local", maxLength: 1000 },
        { kind: "string", schemaName: "cr40f_Nome", logicalName: "cr40f_nome", label: "Nome", maxLength: 1000 },
        { kind: "picklist", schemaName: "cr40f_StatusAnexo", logicalName: "cr40f_statusanexo", label: "Status dos anexos", options: [[100000000, "Sem anexo"], [100000001, "Enviando"], [100000002, "Completo"], [100000003, "Falhou"], [100000004, "Parcial"]] },
        { kind: "picklist", schemaName: "cr40f_StatusOperacional", logicalName: "cr40f_statusoperacional", label: "Status operacional", options: [[100000000, "Enviado"], [100000001, "Em analise"], [100000002, "Resolvido"], [100000003, "Cancelado"]] },
        { kind: "string", schemaName: "cr40f_TerceiroDocumento", logicalName: "cr40f_terceirodocumento", label: "Documento do terceiro", maxLength: 1000 },
        { kind: "string", schemaName: "cr40f_TerceiroNome", logicalName: "cr40f_terceironome", label: "Nome do terceiro", maxLength: 1000 },
        { kind: "memo", schemaName: "cr40f_TerceiroObservacao", logicalName: "cr40f_terceiroobservacao", label: "Observacao do terceiro", maxLength: 4000 },
        { kind: "string", schemaName: "cr40f_TerceiroPlaca", logicalName: "cr40f_terceiroplaca", label: "Placa do terceiro", maxLength: 1000 },
        { kind: "string", schemaName: "cr40f_TerceiroSeguradora", logicalName: "cr40f_terceiroseguradora", label: "Seguradora do terceiro", maxLength: 1000 },
        { kind: "phone", schemaName: "cr40f_TerceiroTelefone", logicalName: "cr40f_terceirotelefone", label: "Telefone do terceiro", maxLength: 1000 },
        { kind: "string", schemaName: "cr40f_TerceiroVeiculo", logicalName: "cr40f_terceiroveiculo", label: "Veiculo do terceiro", maxLength: 1000 },
        { kind: "picklist", schemaName: "cr40f_TipoOcorrencia", logicalName: "cr40f_tipoocorrencia", label: "Tipo da ocorrencia", options: [[100000000, "Eu bati"], [100000001, "Bateram em mim"]] },
      ],
      relationships: [
        { schemaName: "cr40f_cr40f_funcionarios_Motorista_cr40f_colisao_v2", referencedEntity: "cr40f_funcionarios", referencingEntity: "cr40f_colisao_v2", lookupSchemaName: "cr40f_Motorista", lookupLogicalName: "cr40f_motorista", lookupLabel: "Motorista", required: true },
        { schemaName: "cr40f_cr40f_veiculos_Veiculo_cr40f_colisao_v2", referencedEntity: "cr40f_veiculos", referencingEntity: "cr40f_colisao_v2", lookupSchemaName: "cr40f_Veiculo", lookupLogicalName: "cr40f_veiculo", lookupLabel: "Veiculo", required: true },
      ],
      formFields: [
        { name: "cr40f_name", label: "Nome" },
        { name: "cr40f_nome", label: "Nome" },
        { name: "cr40f_datahora", label: "Data/hora" },
        { name: "cr40f_motorista", label: "Motorista", classid: LOOKUP_CLASSID },
        { name: "cr40f_veiculo", label: "Veiculo", classid: LOOKUP_CLASSID },
        { name: "cr40f_tipoocorrencia", label: "Tipo da ocorrencia", classid: CHOICE_CLASSID },
        { name: "cr40f_houveterceiro", label: "Houve terceiro", classid: BOOLEAN_CLASSID },
        { name: "cr40f_local", label: "Local" },
        { name: "cr40f_terceironome", label: "Nome do terceiro" },
        { name: "cr40f_terceirotelefone", label: "Telefone do terceiro" },
        { name: "cr40f_terceiroplaca", label: "Placa do terceiro" },
        { name: "cr40f_terceiroveiculo", label: "Veiculo do terceiro" },
        { name: "cr40f_terceiroseguradora", label: "Seguradora do terceiro" },
        { name: "cr40f_terceirodocumento", label: "Documento do terceiro" },
        { name: "cr40f_statusoperacional", label: "Status operacional", classid: CHOICE_CLASSID },
        { name: "cr40f_statusanexo", label: "Status dos anexos", classid: CHOICE_CLASSID },
        { name: "cr40f_descricao", label: "Descricao" },
        { name: "cr40f_terceiroobservacao", label: "Observacao do terceiro" },
      ],
      viewFields: [
        { name: "cr40f_name", width: "180" },
        { name: "cr40f_datahora", width: "140" },
        { name: "cr40f_motorista", width: "170" },
        { name: "cr40f_veiculo", width: "150" },
        { name: "cr40f_tipoocorrencia", width: "150" },
        { name: "cr40f_houveterceiro", width: "120" },
        { name: "cr40f_statusoperacional", width: "150" },
        { name: "cr40f_statusanexo", width: "150" },
      ],
      validationChoices: [
        { logicalName: "cr40f_houveterceiro", type: "boolean", options: [[1, "Sim"], [0, "Nao"]] },
        { logicalName: "cr40f_statusanexo", type: "picklist", options: [[100000000, "Sem anexo"], [100000001, "Enviando"], [100000002, "Completo"], [100000003, "Falhou"], [100000004, "Parcial"]] },
        { logicalName: "cr40f_statusoperacional", type: "picklist", options: [[100000000, "Enviado"], [100000001, "Em analise"], [100000002, "Resolvido"], [100000003, "Cancelado"]] },
        { logicalName: "cr40f_tipoocorrencia", type: "picklist", options: [[100000000, "Eu bati"], [100000001, "Bateram em mim"]] },
      ],
    },
    {
      oldLogicalName: "cr40f_anexorecebimento",
      logicalName: "cr40f_anexorecebimento_v2",
      schemaName: "cr40f_AnexoRecebimento_v2",
      displayName: "Anexo de Recebimento v2",
      collectionName: "Anexos de Recebimento v2",
      primaryNameSchema: "cr40f_Name",
      entityDescription: "Anexo de recebimento recriado com metadata limpa.",
      columns: [
        { kind: "datetime", schemaName: "cr40f_DataEnvio", logicalName: "cr40f_dataenvio", label: "Data de envio" },
        { kind: "string", schemaName: "cr40f_Nome", logicalName: "cr40f_nome", label: "Nome", maxLength: 1000 },
        { kind: "string", schemaName: "cr40f_NomeArquivo", logicalName: "cr40f_nomearquivo", label: "Nome do arquivo", maxLength: 1000 },
        { kind: "memo", schemaName: "cr40f_Observacao", logicalName: "cr40f_observacao", label: "Observacao", maxLength: 4000 },
        { kind: "integer", schemaName: "cr40f_Ordem", logicalName: "cr40f_ordem", label: "Ordem", min: 0, max: 2147483647 },
        { kind: "url", schemaName: "cr40f_ShareLink", logicalName: "cr40f_sharelink", label: "Share link", maxLength: 1000 },
        { kind: "picklist", schemaName: "cr40f_Status", logicalName: "cr40f_status", label: "Status", options: [[100000000, "Pendente"], [100000001, "Enviado"], [100000002, "Falhou"], [100000003, "Invalido"]] },
        { kind: "picklist", schemaName: "cr40f_Tipo", logicalName: "cr40f_tipo", label: "Tipo", options: [[100000000, "Comprovante"], [100000001, "Foto complementar"], [100000002, "Outros"]] },
        { kind: "picklist", schemaName: "cr40f_TipoMidia", logicalName: "cr40f_tipomidia", label: "Tipo da midia", options: [[100000000, "Foto"], [100000001, "Video"]] },
        { kind: "url", schemaName: "cr40f_UrlSharePoint", logicalName: "cr40f_urlsharepoint", label: "URL SharePoint", maxLength: 1000 },
      ],
      relationships: [
        { schemaName: "cr40f_cr40f_reservadeveculos_Reserva_cr40f_anexorecebimento_v2", referencedEntity: "cr40f_reservadeveculos", referencingEntity: "cr40f_anexorecebimento_v2", lookupSchemaName: "cr40f_Reserva", lookupLogicalName: "cr40f_reserva", lookupLabel: "Reserva", required: true },
        { schemaName: "cr40f_cr40f_funcionarios_EnviadoPor_cr40f_anexorecebimento_v2", referencedEntity: "cr40f_funcionarios", referencingEntity: "cr40f_anexorecebimento_v2", lookupSchemaName: "cr40f_EnviadoPor", lookupLogicalName: "cr40f_enviadopor", lookupLabel: "Enviado por", required: false },
      ],
      formFields: [
        { name: "cr40f_name", label: "Nome" },
        { name: "cr40f_nome", label: "Nome" },
        { name: "cr40f_nomearquivo", label: "Nome do arquivo" },
        { name: "cr40f_reserva", label: "Reserva", classid: LOOKUP_CLASSID },
        { name: "cr40f_enviadopor", label: "Enviado por", classid: LOOKUP_CLASSID },
        { name: "cr40f_dataenvio", label: "Data de envio" },
        { name: "cr40f_status", label: "Status", classid: CHOICE_CLASSID },
        { name: "cr40f_tipo", label: "Tipo", classid: CHOICE_CLASSID },
        { name: "cr40f_tipomidia", label: "Tipo da midia", classid: CHOICE_CLASSID },
        { name: "cr40f_ordem", label: "Ordem" },
        { name: "cr40f_sharelink", label: "Share link" },
        { name: "cr40f_urlsharepoint", label: "URL SharePoint" },
        { name: "cr40f_observacao", label: "Observacao" },
      ],
      viewFields: [
        { name: "cr40f_name", width: "180" },
        { name: "cr40f_reserva", width: "170" },
        { name: "cr40f_enviadopor", width: "170" },
        { name: "cr40f_dataenvio", width: "140" },
        { name: "cr40f_status", width: "120" },
        { name: "cr40f_tipo", width: "140" },
        { name: "cr40f_tipomidia", width: "130" },
        { name: "cr40f_nomearquivo", width: "220" },
      ],
      validationChoices: [
        { logicalName: "cr40f_status", type: "picklist", options: [[100000000, "Pendente"], [100000001, "Enviado"], [100000002, "Falhou"], [100000003, "Invalido"]] },
        { logicalName: "cr40f_tipo", type: "picklist", options: [[100000000, "Comprovante"], [100000001, "Foto complementar"], [100000002, "Outros"]] },
        { logicalName: "cr40f_tipomidia", type: "picklist", options: [[100000000, "Foto"], [100000001, "Video"]] },
      ],
    },
    {
      oldLogicalName: "cr40f_anexocolisao",
      logicalName: "cr40f_anexocolisao_v2",
      schemaName: "cr40f_AnexoColisao_v2",
      displayName: "Anexo de Colisao v2",
      collectionName: "Anexos de Colisao v2",
      primaryNameSchema: "cr40f_Name",
      entityDescription: "Anexo de colisao recriado com metadata limpa.",
      columns: [
        { kind: "datetime", schemaName: "cr40f_DataEnvio", logicalName: "cr40f_dataenvio", label: "Data de envio" },
        { kind: "string", schemaName: "cr40f_Nome", logicalName: "cr40f_nome", label: "Nome", maxLength: 1000 },
        { kind: "string", schemaName: "cr40f_NomeArquivo", logicalName: "cr40f_nomearquivo", label: "Nome do arquivo", maxLength: 1000 },
        { kind: "integer", schemaName: "cr40f_Ordem", logicalName: "cr40f_ordem", label: "Ordem", min: 0, max: 2147483647 },
        { kind: "url", schemaName: "cr40f_ShareLink", logicalName: "cr40f_sharelink", label: "Share link", maxLength: 1000 },
        { kind: "picklist", schemaName: "cr40f_Status", logicalName: "cr40f_status", label: "Status", options: [[100000000, "Pendente"], [100000001, "Enviado"], [100000002, "Falhou"], [100000003, "Invalido"]] },
        { kind: "picklist", schemaName: "cr40f_Tipo", logicalName: "cr40f_tipo", label: "Tipo", options: [[100000000, "Cena"], [100000001, "Dano Betinhos"], [100000002, "Dano terceiro"], [100000003, "Documento/placa"], [100000004, "Extra"]] },
        { kind: "picklist", schemaName: "cr40f_TipoMidia", logicalName: "cr40f_tipomidia", label: "Tipo da midia", required: true, options: [[100000000, "Foto"], [100000001, "Video"]] },
        { kind: "url", schemaName: "cr40f_UrlSharePoint", logicalName: "cr40f_urlsharepoint", label: "URL SharePoint", maxLength: 1000 },
      ],
      relationships: [
        { schemaName: "cr40f_cr40f_colisao_v2_Colisao_cr40f_anexocolisao_v2", referencedEntity: "cr40f_colisao_v2", referencingEntity: "cr40f_anexocolisao_v2", lookupSchemaName: "cr40f_Colisao", lookupLogicalName: "cr40f_colisao", lookupLabel: "Colisao", required: true },
        { schemaName: "cr40f_cr40f_funcionarios_EnviadoPor_cr40f_anexocolisao_v2", referencedEntity: "cr40f_funcionarios", referencingEntity: "cr40f_anexocolisao_v2", lookupSchemaName: "cr40f_EnviadoPor", lookupLogicalName: "cr40f_enviadopor", lookupLabel: "Enviado por", required: false },
      ],
      formFields: [
        { name: "cr40f_name", label: "Nome" },
        { name: "cr40f_nome", label: "Nome" },
        { name: "cr40f_colisao", label: "Colisao", classid: LOOKUP_CLASSID },
        { name: "cr40f_enviadopor", label: "Enviado por", classid: LOOKUP_CLASSID },
        { name: "cr40f_dataenvio", label: "Data de envio" },
        { name: "cr40f_nomearquivo", label: "Nome do arquivo" },
        { name: "cr40f_status", label: "Status", classid: CHOICE_CLASSID },
        { name: "cr40f_tipo", label: "Tipo", classid: CHOICE_CLASSID },
        { name: "cr40f_tipomidia", label: "Tipo da midia", classid: CHOICE_CLASSID },
        { name: "cr40f_ordem", label: "Ordem" },
        { name: "cr40f_sharelink", label: "Share link" },
        { name: "cr40f_urlsharepoint", label: "URL SharePoint" },
      ],
      viewFields: [
        { name: "cr40f_name", width: "180" },
        { name: "cr40f_colisao", width: "170" },
        { name: "cr40f_enviadopor", width: "170" },
        { name: "cr40f_dataenvio", width: "140" },
        { name: "cr40f_status", width: "120" },
        { name: "cr40f_tipo", width: "150" },
        { name: "cr40f_tipomidia", width: "130" },
        { name: "cr40f_nomearquivo", width: "220" },
      ],
      validationChoices: [
        { logicalName: "cr40f_status", type: "picklist", options: [[100000000, "Pendente"], [100000001, "Enviado"], [100000002, "Falhou"], [100000003, "Invalido"]] },
        { logicalName: "cr40f_tipo", type: "picklist", options: [[100000000, "Cena"], [100000001, "Dano Betinhos"], [100000002, "Dano terceiro"], [100000003, "Documento/placa"], [100000004, "Extra"]] },
        { logicalName: "cr40f_tipomidia", type: "picklist", options: [[100000000, "Foto"], [100000001, "Video"]] },
      ],
    },
  ];

  const result = {
    generatedAt: new Date().toISOString(),
    environment: clientUrl,
    solution: { uniqueName: SOLUTION_UNIQUE_NAME, created: false, existed: false, addWarnings: [] },
    tables: {},
    nameMap: { tables: {}, columns: {} },
    steps: [],
  };

  function log(...args) {
    console.log("[collision-v2]", ...args);
  }

  function step(message, extra) {
    const item = { at: new Date().toISOString(), message, extra: extra ?? null };
    result.steps.push(item);
    log(message, extra ?? "");
  }

  function label(text) {
    return { LocalizedLabels: [{ Label: text, LanguageCode: LCID }] };
  }

  function required(value = "None") {
    return { Value: value, CanBeChanged: true, ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings" };
  }

  function option(value, text) {
    return { Value: value, Label: label(text) };
  }

  function isCustomizationBusy(status, text) {
    if (Number(status) !== 429) return false;
    const haystack = String(text || "");
    return (
      haystack.includes("0x80071151") ||
      haystack.includes("EntityCustomization") ||
      haystack.includes("previous [EntityCustomization] running")
    );
  }

  async function request(method, path, body, ok404 = false, retries = 10) {
    let attempt = 0;
    while (true) {
      const response = await fetch(encodeURI(`${webApi}${path}`), {
        method,
        credentials: "same-origin",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      if (ok404 && response.status === 404) return null;
      if (response.ok) return text ? JSON.parse(text) : null;

      if (isCustomizationBusy(response.status, text) && attempt < retries) {
        attempt += 1;
        const waitMs = Math.min(15000 * attempt, 60000);
        step(`entity customization busy, retry ${attempt}/${retries} in ${Math.round(waitMs / 1000)}s`, {
          method,
          path,
        });
        await wait(waitMs);
        continue;
      }

      throw new Error(`${method} ${path}\n${response.status} ${response.statusText}\n${text}`);
    }
  }

  function parseXml(xml) {
    const doc = parser.parseFromString(xml, "text/xml");
    const err = doc.querySelector("parsererror");
    if (err) throw new Error(`XML invalido: ${err.textContent}`);
    return doc;
  }

  function makeLabelsNode(doc, description) {
    const labels = doc.createElement("labels");
    const node = doc.createElement("label");
    node.setAttribute("description", description);
    node.setAttribute("languagecode", String(LCID));
    labels.appendChild(node);
    return labels;
  }

  function makeControlCell(doc, field) {
    const cell = doc.createElement("cell");
    cell.setAttribute("id", `{${crypto.randomUUID()}}`);
    cell.setAttribute("locklevel", "0");
    cell.setAttribute("colspan", "1");
    cell.setAttribute("rowspan", field.name.includes("observacao") || field.name.includes("descricao") ? "2" : "1");
    cell.appendChild(makeLabelsNode(doc, field.label));

    const control = doc.createElement("control");
    control.setAttribute("id", field.name);
    control.setAttribute("classid", field.classid || FIELD_CLASSID);
    control.setAttribute("datafieldname", field.name);
    control.setAttribute("disabled", "false");
    cell.appendChild(control);
    return cell;
  }

  function makeEmptyCell(doc) {
    const cell = doc.createElement("cell");
    cell.setAttribute("id", `{${crypto.randomUUID()}}`);
    cell.setAttribute("locklevel", "0");
    cell.setAttribute("colspan", "1");
    cell.setAttribute("rowspan", "1");
    cell.setAttribute("showlabel", "false");
    return cell;
  }

  function makeRow(doc, fields) {
    const row = doc.createElement("row");
    row.appendChild(makeControlCell(doc, fields[0]));
    row.appendChild(fields[1] ? makeControlCell(doc, fields[1]) : makeEmptyCell(doc));
    return row;
  }

  function addAttributesToFetch(fetchxml, entityName, fields) {
    const doc = parseXml(fetchxml);
    const entityNode = doc.querySelector(`entity[name="${entityName}"]`) || doc.querySelector("entity");
    if (!entityNode) throw new Error(`FetchXML sem entity ${entityName}.`);
    for (const field of fields) {
      if (entityNode.querySelector(`attribute[name="${field.name}"]`)) continue;
      const attr = doc.createElement("attribute");
      attr.setAttribute("name", field.name);
      entityNode.appendChild(attr);
    }
    return serializer.serializeToString(doc);
  }

  function addCellsToLayout(layoutxml, fields) {
    const doc = parseXml(layoutxml);
    const row = doc.querySelector("grid row");
    if (!row) throw new Error("LayoutXML sem grid row.");
    for (const field of fields) {
      if (row.querySelector(`cell[name="${field.name}"]`)) continue;
      const cell = doc.createElement("cell");
      cell.setAttribute("name", field.name);
      cell.setAttribute("width", field.width || "150");
      row.appendChild(cell);
    }
    return serializer.serializeToString(doc);
  }

  function addCellsToLayoutJson(layoutjson, fields) {
    if (!layoutjson) return layoutjson;
    let json;
    try {
      json = JSON.parse(layoutjson);
    } catch {
      return layoutjson;
    }
    const cells = json?.Rows?.[0]?.Cells;
    if (!Array.isArray(cells)) return layoutjson;
    for (const field of fields) {
      if (cells.some((cell) => cell.Name === field.name)) continue;
      cells.push({
        Name: field.name,
        Width: Number(field.width || 150),
        RelatedEntityName: "",
        DisableMetaDataBinding: false,
        LabelId: "",
        IsHidden: false,
        DisableSorting: false,
        AddedBy: "",
        Desc: "",
        CellType: "",
        ImageProviderWebresource: "",
        ImageProviderFunctionName: "",
      });
    }
    return JSON.stringify(json);
  }

  function updateFormXml(formxml, config) {
    const doc = parseXml(formxml);
    const tab = doc.querySelector("tabs tab");
    if (!tab) throw new Error(`FormXML ${config.logicalName} sem tab.`);

    let section = doc.querySelector("tabs tab columns column sections section");
    if (!section) throw new Error(`FormXML ${config.logicalName} sem section.`);
    section.setAttribute("columns", "2");
    if (!section.getAttribute("id")) section.setAttribute("id", `{${crypto.randomUUID()}}`);

    let rows = section.querySelector(":scope > rows");
    if (!rows) {
      rows = doc.createElement("rows");
      section.appendChild(rows);
    }

    const existingNames = new Set([...doc.querySelectorAll("control[datafieldname]")].map((node) => node.getAttribute("datafieldname")));
    const missingFields = config.formFields.filter((field) => !existingNames.has(field.name));
    for (let i = 0; i < missingFields.length; i += 2) {
      rows.appendChild(makeRow(doc, missingFields.slice(i, i + 2)));
    }

    return serializer.serializeToString(doc);
  }

  function publishRequest(entities) {
    return {
      ParameterXml: `<importexportxml><entities>${entities.map((name) => `<entity>${name}</entity>`).join("")}</entities><nodes/><securityroles/><settings/><workflows/></importexportxml>`,
      getMetadata: () => ({
        boundParameter: null,
        parameterTypes: { ParameterXml: { typeName: "Edm.String", structuralProperty: 1 } },
        operationType: 0,
        operationName: "PublishXml",
      }),
    };
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function entity(logicalName) {
    return request("GET", `/EntityDefinitions(LogicalName='${logicalName}')?$select=LogicalName,SchemaName,EntitySetName,MetadataId,PrimaryIdAttribute,PrimaryNameAttribute`, null, true);
  }

  async function attribute(table, logicalName) {
    return request("GET", `/EntityDefinitions(LogicalName='${table}')/Attributes(LogicalName='${logicalName}')?$select=LogicalName,SchemaName,AttributeType`, null, true);
  }

  async function manyToOne(referencingEntity) {
    const resultData = await request(
      "GET",
      `/EntityDefinitions(LogicalName='${referencingEntity}')/ManyToOneRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute,ReferencingEntityNavigationPropertyName`
    );
    return resultData?.value ?? [];
  }

  async function ensureSolution() {
    const existing = await request("GET", `/solutions?$select=solutionid,uniquename,friendlyname&$filter=uniquename eq '${SOLUTION_UNIQUE_NAME}'&$top=1`);
    if (existing?.value?.length) {
      result.solution.existed = true;
      step(`solution exists ${SOLUTION_UNIQUE_NAME}`);
      return existing.value[0];
    }

    const publisher = await request("GET", `/publishers?$select=publisherid,uniquename&$filter=uniquename eq '${PUBLISHER_UNIQUE_NAME}'&$top=1`);
    if (!publisher?.value?.length) throw new Error(`Publisher nao encontrado: ${PUBLISHER_UNIQUE_NAME}`);

    step(`create solution ${SOLUTION_UNIQUE_NAME}`);
    await request("POST", "/solutions", {
      uniquename: SOLUTION_UNIQUE_NAME,
      friendlyname: "Betinhos Core Clean",
      version: "1.0.0.0",
      "publisherid@odata.bind": `/publishers(${publisher.value[0].publisherid})`,
    });
    result.solution.created = true;
    const created = await request("GET", `/solutions?$select=solutionid,uniquename,friendlyname&$filter=uniquename eq '${SOLUTION_UNIQUE_NAME}'&$top=1`);
    return created.value[0];
  }

  async function addTableToSolution(table) {
    const meta = await entity(table.logicalName);
    if (!meta?.MetadataId) {
      result.solution.addWarnings.push(`MetadataId ausente para ${table.logicalName}`);
      return;
    }
    try {
      await request("POST", "/AddSolutionComponent", {
        ComponentId: meta.MetadataId,
        ComponentType: 1,
        SolutionUniqueName: SOLUTION_UNIQUE_NAME,
        AddRequiredComponents: false,
      });
    } catch (error) {
      result.solution.addWarnings.push(`${table.logicalName}: ${error.message}`);
    }
  }

  async function createEntity(table) {
    if (await entity(table.logicalName)) {
      step(`table exists ${table.logicalName}`);
      return;
    }
    step(`create table ${table.logicalName}`);
    await request("POST", "/EntityDefinitions", {
      "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
      SchemaName: table.schemaName,
      DisplayName: label(table.displayName),
      DisplayCollectionName: label(table.collectionName),
      Description: label(table.entityDescription),
      OwnershipType: "UserOwned",
      IsActivity: false,
      HasActivities: false,
      HasNotes: false,
      Attributes: [{
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        AttributeType: "String",
        AttributeTypeName: { Value: "StringType" },
        SchemaName: table.primaryNameSchema,
        RequiredLevel: required("ApplicationRequired"),
        MaxLength: 120,
        FormatName: { Value: "Text" },
        DisplayName: label("Nome"),
        Description: label("Identificador legivel do registro."),
        IsPrimaryName: true,
      }],
    });
    await wait(5000);
  }

  function buildAttribute(column) {
    const base = {
      SchemaName: column.schemaName,
      DisplayName: label(column.label),
      Description: label(column.label),
      RequiredLevel: required(column.required ? "ApplicationRequired" : "None"),
    };

    switch (column.kind) {
      case "string":
        return { "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata", ...base, MaxLength: column.maxLength, FormatName: { Value: "Text" } };
      case "url":
        return { "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata", ...base, MaxLength: column.maxLength, FormatName: { Value: "Url" } };
      case "phone":
        return { "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata", ...base, MaxLength: column.maxLength, FormatName: { Value: "Phone" } };
      case "memo":
        return { "@odata.type": "Microsoft.Dynamics.CRM.MemoAttributeMetadata", ...base, MaxLength: column.maxLength, FormatName: { Value: "TextArea" } };
      case "integer":
        return { "@odata.type": "Microsoft.Dynamics.CRM.IntegerAttributeMetadata", ...base, MinValue: column.min ?? 0, MaxValue: column.max ?? 2147483647, Format: "None" };
      case "datetime":
        return { "@odata.type": "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata", ...base, DateTimeBehavior: { Value: "UserLocal" }, Format: "DateAndTime" };
      case "boolean":
        return {
          "@odata.type": "Microsoft.Dynamics.CRM.BooleanAttributeMetadata",
          ...base,
          DefaultValue: false,
          OptionSet: {
            TrueOption: option(1, column.trueLabel || "Sim"),
            FalseOption: option(0, column.falseLabel || "Nao"),
          },
        };
      case "picklist":
        return {
          "@odata.type": "Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
          ...base,
          OptionSet: {
            IsGlobal: false,
            OptionSetType: "Picklist",
            Options: column.options.map(([value, text]) => option(value, text)),
          },
        };
      default:
        throw new Error(`Tipo nao suportado: ${column.kind}`);
    }
  }

  async function createColumn(table, column) {
    if (await attribute(table.logicalName, column.logicalName)) {
      step(`column exists ${table.logicalName}.${column.logicalName}`);
      return;
    }
    step(`create column ${table.logicalName}.${column.logicalName}`);
    await request("POST", `/EntityDefinitions(LogicalName='${table.logicalName}')/Attributes`, buildAttribute(column));
    await wait(3000);
  }

  async function ensureRelationship(rel) {
    const relationships = await manyToOne(rel.referencingEntity);
    const existing = relationships.find((item) => String(item.SchemaName).toLowerCase() === rel.schemaName.toLowerCase());
    if (existing) {
      step(`relationship exists ${rel.schemaName}`);
      return;
    }
    step(`create relationship ${rel.schemaName}`);
    await request("POST", "/RelationshipDefinitions", {
      "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
      SchemaName: rel.schemaName,
      ReferencedEntity: rel.referencedEntity,
      ReferencingEntity: rel.referencingEntity,
      Lookup: {
        "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
        SchemaName: rel.lookupSchemaName,
        DisplayName: label(rel.lookupLabel),
        RequiredLevel: required(rel.required ? "ApplicationRequired" : "None"),
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
    await wait(4000);
  }

  async function retrieveMainForm(entityName) {
    const query = [
      "?$select=formid,name,objecttypecode,type,formactivationstate,formxml",
      `&$filter=objecttypecode eq '${entityName}' and type eq 2`,
      "&$orderby=formactivationstate desc,name asc",
      "&$top=10",
    ].join("");
    const response = await api.retrieveMultipleRecords("systemform", query);
    return response.entities.find((item) => Number(item.formactivationstate) === 1) || response.entities[0] || null;
  }

  async function retrieveDefaultView(entityName) {
    const query = [
      "?$select=savedqueryid,name,returnedtypecode,fetchxml,layoutxml,layoutjson,isdefault,querytype",
      `&$filter=returnedtypecode eq '${entityName}' and querytype eq 0`,
      "&$orderby=isdefault desc,name asc",
      "&$top=10",
    ].join("");
    const response = await api.retrieveMultipleRecords("savedquery", query);
    return response.entities.find((item) => item.isdefault) || response.entities[0] || null;
  }

  async function waitForArtifacts(entityName, tries = 12, delay = 5000) {
    for (let index = 0; index < tries; index += 1) {
      const form = await retrieveMainForm(entityName);
      const view = await retrieveDefaultView(entityName);
      if (form && view) return { form, view };
      await wait(delay);
    }
    return { form: await retrieveMainForm(entityName), view: await retrieveDefaultView(entityName) };
  }

  async function updateMainForm(table) {
    const form = await retrieveMainForm(table.logicalName);
    if (!form?.formid || !form.formxml) {
      result.tables[table.logicalName].form = { updated: false, reason: "main form not found" };
      return;
    }
    const nextXml = updateFormXml(form.formxml, table);
    await api.updateRecord("systemform", form.formid, { formxml: nextXml });
    result.tables[table.logicalName].form = { updated: true, formid: form.formid, name: form.name };
  }

  async function updateDefaultView(table) {
    const view = await retrieveDefaultView(table.logicalName);
    if (!view?.savedqueryid || !view.fetchxml || !view.layoutxml) {
      result.tables[table.logicalName].view = { updated: false, reason: "default public view not found" };
      return;
    }
    const nextFetch = addAttributesToFetch(view.fetchxml, table.logicalName, table.viewFields);
    const nextLayout = addCellsToLayout(view.layoutxml, table.viewFields);
    const nextLayoutJson = addCellsToLayoutJson(view.layoutjson, table.viewFields);
    await api.updateRecord("savedquery", view.savedqueryid, {
      fetchxml: nextFetch,
      layoutxml: nextLayout,
      layoutjson: nextLayoutJson,
    });
    result.tables[table.logicalName].view = { updated: true, savedqueryid: view.savedqueryid, name: view.name };
  }

  async function readPicklistMetadata(entityName, logicalName) {
    return request(
      "GET",
      `/EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${logicalName}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName,SchemaName&$expand=OptionSet($select=Options)`,
      null,
      false
    );
  }

  async function readBooleanMetadata(entityName, logicalName) {
    return request(
      "GET",
      `/EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${logicalName}')/Microsoft.Dynamics.CRM.BooleanAttributeMetadata?$select=LogicalName,SchemaName&$expand=OptionSet`,
      null,
      false
    );
  }

  function extractLabel(optionNode) {
    const labels = optionNode?.Label?.LocalizedLabels ?? [];
    return labels.find((item) => Number(item.LanguageCode) === LCID)?.Label || "";
  }

  async function validateChoices(table) {
    const rows = [];
    for (const field of table.validationChoices) {
      let metadata;
      if (field.type === "boolean") metadata = await readBooleanMetadata(table.logicalName, field.logicalName);
      else metadata = await readPicklistMetadata(table.logicalName, field.logicalName);

      for (const [value, expectedLabel] of field.options) {
        let actualLabel = "";
        if (field.type === "boolean") {
          if (Number(value) === 1) actualLabel = extractLabel(metadata?.OptionSet?.TrueOption);
          if (Number(value) === 0) actualLabel = extractLabel(metadata?.OptionSet?.FalseOption);
        } else {
          const optionNode = metadata?.OptionSet?.Options?.find((item) => Number(item.Value) === Number(value));
          actualLabel = extractLabel(optionNode);
        }
        rows.push({
          field: field.logicalName,
          value,
          expectedLabel,
          actualLabel,
          ok: String(actualLabel || "").trim().length > 0,
        });
      }
    }
    return rows;
  }

  function downloadJson(filename, data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  try {
    step(`start ${clientUrl}`);
    await ensureSolution();

    for (const table of tables) {
      result.tables[table.logicalName] = {
        oldLogicalName: table.oldLogicalName,
        createdOrValidated: false,
        columns: [],
        relationships: [],
        form: null,
        view: null,
        validationChoices: [],
      };

      await createEntity(table);
    }

    step("publish after table create");
    await api.execute(publishRequest(tables.map((item) => item.logicalName)));
    await wait(12000);

    for (const table of tables) {
      for (const column of table.columns) {
        await createColumn(table, column);
        result.tables[table.logicalName].columns.push(column.logicalName);
      }
    }

    step("publish after column create");
    await api.execute(publishRequest(tables.map((item) => item.logicalName)));
    await wait(12000);

    for (const table of tables) {
      for (const relationship of table.relationships) {
        await ensureRelationship(relationship);
        result.tables[table.logicalName].relationships.push(relationship.schemaName);
      }
    }

    step("publish after relationship create");
    await api.execute(publishRequest(tables.map((item) => item.logicalName)));
    await wait(15000);

    for (const table of tables) {
      await addTableToSolution(table);
    }

    for (const table of tables) {
      const artifacts = await waitForArtifacts(table.logicalName);
      result.tables[table.logicalName].artifactsFound = { form: Boolean(artifacts.form), view: Boolean(artifacts.view) };
      await updateMainForm(table);
      await updateDefaultView(table);
    }

    step("publish after form/view update");
    await api.execute(publishRequest(tables.map((item) => item.logicalName)));
    await wait(10000);

    for (const table of tables) {
      const meta = await entity(table.logicalName);
      result.tables[table.logicalName].createdOrValidated = true;
      result.tables[table.logicalName].entitySetName = meta?.EntitySetName || "";
      result.tables[table.logicalName].primaryIdAttribute = meta?.PrimaryIdAttribute || "";
      result.tables[table.logicalName].primaryNameAttribute = meta?.PrimaryNameAttribute || "";
      result.nameMap.tables[table.oldLogicalName] = {
        newLogicalName: table.logicalName,
        newEntitySetName: meta?.EntitySetName || "",
      };
      const validation = await validateChoices(table);
      result.tables[table.logicalName].validationChoices = validation;
    }

    console.table(
      Object.entries(result.tables).map(([logicalName, info]) => ({
        logicalName,
        entitySetName: info.entitySetName,
        columns: info.columns.length,
        relationships: info.relationships.length,
        formUpdated: info.form?.updated ?? false,
        viewUpdated: info.view?.updated ?? false,
      }))
    );

    for (const [logicalName, info] of Object.entries(result.tables)) {
      console.group(`[choices] ${logicalName}`);
      console.table(info.validationChoices);
      console.groupEnd();
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `collision-v2-schema-result-${stamp}.json`;
    downloadJson(filename, result);
    step(`ok ${filename}`);
  } catch (error) {
    result.error = {
      message: String(error?.message || error),
      stack: String(error?.stack || ""),
    };
    console.error("[collision-v2][error]", error);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJson(`collision-v2-schema-error-${stamp}.json`, result);
    throw error;
  }
})();
