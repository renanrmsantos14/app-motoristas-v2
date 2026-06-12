/**
 * Cole no console do Model-driven App, dentro do ambiente alvo.
 *
 * Ajusta Dataverse para cidade no registro de gasto:
 * - valida tabela cr40f_cidade;
 * - cria relacionamento/lookup cr40f_despesaoperacional.cr40f_cidade se faltar;
 * - completa formulario principal e view padrao de cr40f_cidade;
 * - completa formulario principal e view padrao de cr40f_despesaoperacional;
 * - publica e valida.
 *
 * Nao apaga tabelas. Backup de formxml/fetchxml/layoutxml sai no console.
 */
(async () => {
  const LCID_PT_BR = "1046";
  const api = Xrm.WebApi.online || Xrm.WebApi;
  const ctx = Xrm.Utility.getGlobalContext();
  const base = ctx.getClientUrl().replace(/\/$/, "");
  const webApi = `${base}/api/data/v9.2`;
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const FIELD_CLASSID = "{4273EDBD-AC1D-40D3-9FB2-095C621B552D}";
  const LOOKUP_CLASSID = "{270BD3DB-D9AF-4782-9025-509E298DEC0A}";
  const CHOICE_CLASSID = "{3EF39988-22BB-4F0B-BBBE-64B5A3748AEE}";
  const BOOLEAN_CLASSID = "{67FAC785-CD58-4F9F-ABB3-4B7DDC6ED5ED}";

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0"
  };

  const cityForm = {
    entity: "cr40f_cidade",
    title: "Cidades",
    fields: [
      { name: "cr40f_name", label: "Cidade" },
      { name: "cr40f_nome", label: "Nome" },
      { name: "cr40f_uf", label: "UF" },
      { name: "cr40f_pais", label: "Pais" },
      { name: "cr40f_codigo_ibge", label: "Codigo IBGE" },
      { name: "cr40f_nome_uf", label: "Nome UF" },
      { name: "cr40f_regiao", label: "Regiao" },
      { name: "cr40f_ativa", label: "Ativa", classid: BOOLEAN_CLASSID }
    ],
    viewFields: [
      { name: "cr40f_name", width: "220" },
      { name: "cr40f_nome", width: "220" },
      { name: "cr40f_uf", width: "80" },
      { name: "cr40f_pais", width: "120" },
      { name: "cr40f_codigo_ibge", width: "120" },
      { name: "cr40f_nome_uf", width: "150" },
      { name: "cr40f_regiao", width: "120" },
      { name: "cr40f_ativa", width: "80" }
    ]
  };

  const expenseForm = {
    entity: "cr40f_despesaoperacional",
    title: "Despesa Operacional",
    fields: [
      { name: "cr40f_nome", label: "Nome" },
      { name: "cr40f_datagasto", label: "Data do gasto" },
      { name: "cr40f_valor", label: "Valor" },
      { name: "cr40f_categoria", label: "Categoria", classid: LOOKUP_CLASSID },
      { name: "cr40f_formapagamento", label: "Forma de pagamento", classid: LOOKUP_CLASSID },
      { name: "cr40f_cidade", label: "Cidade", classid: LOOKUP_CLASSID },
      { name: "cr40f_motorista", label: "Motorista", classid: LOOKUP_CLASSID },
      { name: "cr40f_veiculo", label: "Veiculo", classid: LOOKUP_CLASSID },
      { name: "cr40f_estabelecimento", label: "Estabelecimento" },
      { name: "cr40f_kminformado", label: "KM informado" },
      { name: "cr40f_litros", label: "Litros" },
      { name: "cr40f_statusoperacional", label: "Status operacional", classid: CHOICE_CLASSID },
      { name: "cr40f_statusfinanceiro", label: "Status financeiro", classid: CHOICE_CLASSID },
      { name: "cr40f_statusanexo", label: "Status dos anexos", classid: CHOICE_CLASSID },
      { name: "cr40f_origem", label: "Origem", classid: CHOICE_CLASSID },
      { name: "cr40f_observacao", label: "Observacao do motorista" }
    ],
    viewFields: [
      { name: "cr40f_nome", width: "220" },
      { name: "cr40f_datagasto", width: "130" },
      { name: "cr40f_valor", width: "110" },
      { name: "cr40f_categoria", width: "160" },
      { name: "cr40f_formapagamento", width: "170" },
      { name: "cr40f_cidade", width: "170" },
      { name: "cr40f_motorista", width: "170" },
      { name: "cr40f_veiculo", width: "150" },
      { name: "cr40f_estabelecimento", width: "180" },
      { name: "cr40f_statusoperacional", width: "150" },
      { name: "cr40f_statusfinanceiro", width: "150" },
      { name: "cr40f_statusanexo", width: "140" }
    ]
  };

  const requiredTables = [cityForm.entity, expenseForm.entity];
  const requiredCityFields = cityForm.fields.map((field) => field.name);
  const requiredExpenseFields = expenseForm.fields.map((field) => field.name);

  function log(...args) {
    console.log("[Cidades/Despesas]", ...args);
  }

  async function request(method, path, body, ok404 = false) {
    const response = await fetch(encodeURI(`${webApi}${path}`), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    if (ok404 && response.status === 404) return null;
    if (!response.ok) throw new Error(`${method} ${path}\n${response.status} ${response.statusText}\n${text}`);
    return text ? JSON.parse(text) : null;
  }

  function label(text) {
    return { LocalizedLabels: [{ Label: text, LanguageCode: Number(LCID_PT_BR) }] };
  }

  function required(isRequired) {
    return {
      Value: isRequired ? "ApplicationRequired" : "None",
      CanBeChanged: true,
      ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings"
    };
  }

  async function entity(logicalName) {
    return request("GET", `/EntityDefinitions(LogicalName='${logicalName}')?$select=LogicalName,EntitySetName`, null, true);
  }

  async function attribute(table, logicalName) {
    return request("GET", `/EntityDefinitions(LogicalName='${table}')/Attributes(LogicalName='${logicalName}')?$select=LogicalName,SchemaName`, null, true);
  }

  async function manyToOne(referencingEntity) {
    const result = await request(
      "GET",
      `/EntityDefinitions(LogicalName='${referencingEntity}')/ManyToOneRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute,ReferencingEntityNavigationPropertyName`
    );
    return result?.value ?? [];
  }

  async function ensureTablesAndFields() {
    for (const table of requiredTables) {
      if (!(await entity(table))) throw new Error(`Tabela nao encontrada: ${table}`);
    }
    const cityMissing = [];
    for (const field of requiredCityFields) {
      if (!(await attribute(cityForm.entity, field))) cityMissing.push(field);
    }
    if (cityMissing.length) throw new Error(`Tabela cr40f_cidade sem campos esperados: ${cityMissing.join(", ")}`);
  }

  async function ensureCityRelationship() {
    const existingAttr = await attribute(expenseForm.entity, "cr40f_cidade");
    if (existingAttr) {
      log("Lookup ja existe: cr40f_despesaoperacional.cr40f_cidade");
      return false;
    }

    log("Criando lookup: cr40f_despesaoperacional.cr40f_cidade -> cr40f_cidade");
    await request("POST", "/RelationshipDefinitions", {
      "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
      SchemaName: "cr40f_cidade_cr40f_despesaoperacional_cidade",
      ReferencedEntity: "cr40f_cidade",
      ReferencingEntity: "cr40f_despesaoperacional",
      ReferencingEntityNavigationPropertyName: "cr40f_Cidade",
      Lookup: {
        "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
        SchemaName: "cr40f_Cidade",
        DisplayName: label("Cidade"),
        RequiredLevel: required(false)
      },
      CascadeConfiguration: {
        Assign: "NoCascade",
        Delete: "RemoveLink",
        Merge: "NoCascade",
        Reparent: "NoCascade",
        Share: "NoCascade",
        Unshare: "NoCascade"
      }
    });
    return true;
  }

  function parseXml(xml) {
    const doc = parser.parseFromString(xml, "text/xml");
    const err = doc.querySelector("parsererror");
    if (err) throw new Error(`XML invalido: ${err.textContent}`);
    return doc;
  }

  function labelsNode(doc, description) {
    const labels = doc.createElement("labels");
    const label = doc.createElement("label");
    label.setAttribute("description", description);
    label.setAttribute("languagecode", LCID_PT_BR);
    labels.appendChild(label);
    return labels;
  }

  function makeCell(doc, field) {
    const cell = doc.createElement("cell");
    cell.setAttribute("id", `{${crypto.randomUUID()}}`);
    cell.setAttribute("locklevel", "0");
    cell.setAttribute("colspan", "1");
    cell.setAttribute("rowspan", field.name === "cr40f_observacao" ? "3" : "1");
    cell.appendChild(labelsNode(doc, field.label));

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
    row.appendChild(makeCell(doc, fields[0]));
    row.appendChild(fields[1] ? makeCell(doc, fields[1]) : makeEmptyCell(doc));
    return row;
  }

  function updateFormXml(formxml, config) {
    const doc = parseXml(formxml);
    const tab = doc.querySelector("tabs tab");
    if (!tab) throw new Error(`FormXML ${config.entity} sem tab.`);

    let tabLabels = tab.querySelector(":scope > labels");
    if (!tabLabels) {
      tabLabels = labelsNode(doc, config.title);
      tab.insertBefore(tabLabels, tab.firstChild);
    }
    const tabLabel = tabLabels.querySelector(`label[languagecode="${LCID_PT_BR}"]`) || tabLabels.querySelector("label");
    if (tabLabel) tabLabel.setAttribute("description", config.title);

    const section = doc.querySelector("tabs tab columns column sections section");
    if (!section) throw new Error(`FormXML ${config.entity} sem section.`);
    section.setAttribute("columns", "2");
    if (!section.getAttribute("id")) section.setAttribute("id", `{${crypto.randomUUID()}}`);

    let rows = section.querySelector(":scope > rows");
    if (!rows) {
      rows = doc.createElement("rows");
      section.appendChild(rows);
    }

    const missing = config.fields.filter((field) => !doc.querySelector(`control[datafieldname="${field.name}"]`));
    for (let index = 0; index < missing.length; index += 2) {
      rows.appendChild(makeRow(doc, missing.slice(index, index + 2)));
    }

    const xml = serializer.serializeToString(doc);
    const stillMissing = config.fields.map((field) => field.name).filter((field) => !xml.includes(`datafieldname="${field}"`));
    if (stillMissing.length) throw new Error(`FormXML gerado sem campos ${config.entity}: ${stillMissing.join(", ")}`);
    return xml;
  }

  async function retrieveMainForm(entityName) {
    const query = [
      "?$select=formid,name,objecttypecode,type,formactivationstate,formxml",
      `&$filter=objecttypecode eq '${entityName}' and type eq 2`,
      "&$orderby=formactivationstate desc,name asc",
      "&$top=5"
    ].join("");
    const result = await api.retrieveMultipleRecords("systemform", query);
    const form = result.entities.find((item) => Number(item.formactivationstate) === 1) || result.entities[0];
    if (!form?.formid) throw new Error(`Nenhum formulario principal encontrado para ${entityName}.`);
    return form;
  }

  async function updateMainForm(config) {
    const form = await retrieveMainForm(config.entity);
    console.group(`[backup formxml] ${config.entity} / ${form.name} / ${form.formid}`);
    console.log(form.formxml);
    console.groupEnd();

    const nextXml = updateFormXml(form.formxml, config);
    await api.updateRecord("systemform", form.formid, { formxml: nextXml });
    return { form, expectedFields: config.fields.map((field) => field.name), nextXml };
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
        ImageProviderFunctionName: ""
      });
    }
    return JSON.stringify(json);
  }

  async function retrieveDefaultView(entityName) {
    const query = [
      "?$select=savedqueryid,name,returnedtypecode,fetchxml,layoutxml,layoutjson,isdefault,querytype",
      `&$filter=returnedtypecode eq '${entityName}' and querytype eq 0`,
      "&$orderby=isdefault desc,name asc",
      "&$top=10"
    ].join("");
    const result = await api.retrieveMultipleRecords("savedquery", query);
    const view = result.entities.find((item) => item.isdefault) || result.entities[0];
    if (!view?.savedqueryid) throw new Error(`Nenhuma view publica encontrada para ${entityName}.`);
    return view;
  }

  async function updateDefaultView(config) {
    const view = await retrieveDefaultView(config.entity);
    console.group(`[backup view] ${config.entity} / ${view.name} / ${view.savedqueryid}`);
    console.log({ fetchxml: view.fetchxml, layoutxml: view.layoutxml, layoutjson: view.layoutjson });
    console.groupEnd();

    const nextFetch = addAttributesToFetch(view.fetchxml, config.entity, config.viewFields);
    const nextLayout = addCellsToLayout(view.layoutxml, config.viewFields);
    const nextLayoutJson = addCellsToLayoutJson(view.layoutjson, config.viewFields);
    await api.updateRecord("savedquery", view.savedqueryid, {
      fetchxml: nextFetch,
      layoutxml: nextLayout,
      layoutjson: nextLayoutJson
    });
    return { view, expectedFields: config.viewFields.map((field) => field.name) };
  }

  function publishRequest(entities) {
    return {
      ParameterXml: `<importexportxml><entities>${entities.map((entityName) => `<entity>${entityName}</entity>`).join("")}</entities><nodes/><securityroles/><settings/><workflows/></importexportxml>`,
      getMetadata: () => ({
        boundParameter: null,
        parameterTypes: { ParameterXml: { typeName: "Edm.String", structuralProperty: 1 } },
        operationType: 0,
        operationName: "PublishXml"
      })
    };
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  await ensureTablesAndFields();
  const createdLookup = await ensureCityRelationship();
  if (createdLookup) {
    log("Aguardando metadata do lookup.");
    await wait(15000);
  }

  const expenseMissing = [];
  for (const field of requiredExpenseFields) {
    if (!(await attribute(expenseForm.entity, field))) expenseMissing.push(field);
  }
  if (expenseMissing.length) throw new Error(`Tabela cr40f_despesaoperacional sem campos esperados: ${expenseMissing.join(", ")}`);

  const relationships = await manyToOne(expenseForm.entity);
  const cityRelationship = relationships.find((item) =>
    String(item.ReferencingAttribute).toLowerCase() === "cr40f_cidade" &&
    String(item.ReferencedEntity).toLowerCase() === cityForm.entity
  );
  if (!cityRelationship?.ReferencingEntityNavigationPropertyName) {
    throw new Error("Lookup cr40f_cidade existe, mas navigation property nao foi resolvida.");
  }
  log("Navigation property Cidade:", cityRelationship.ReferencingEntityNavigationPropertyName);

  const formResults = [];
  formResults.push(await updateMainForm(cityForm));
  formResults.push(await updateMainForm(expenseForm));

  const viewResults = [];
  viewResults.push(await updateDefaultView(cityForm));
  viewResults.push(await updateDefaultView(expenseForm));

  await api.execute(publishRequest(requiredTables));
  await wait(5000);

  const summary = [];
  for (const item of formResults) {
    const check = await api.retrieveRecord("systemform", item.form.formid, "?$select=formxml,name,objecttypecode");
    const missing = item.expectedFields.filter((field) => !String(check.formxml || "").includes(`datafieldname="${field}"`));
    if (missing.length) throw new Error(`Formulario ${check.objecttypecode} sem campos apos salvar/publicar: ${missing.join(", ")}`);
    summary.push({ alvo: `form ${check.objecttypecode}`, nome: check.name, ok: true, campos: item.expectedFields.length });
  }

  for (const item of viewResults) {
    const check = await api.retrieveRecord("savedquery", item.view.savedqueryid, "?$select=fetchxml,layoutxml,name,returnedtypecode");
    const missingFetch = item.expectedFields.filter((field) => !String(check.fetchxml || "").includes(`name="${field}"`));
    const missingLayout = item.expectedFields.filter((field) => !String(check.layoutxml || "").includes(`name="${field}"`));
    if (missingFetch.length || missingLayout.length) {
      throw new Error(`View ${check.returnedtypecode} incompleta. Fetch: ${missingFetch.join(", ") || "ok"} | Layout: ${missingLayout.join(", ") || "ok"}`);
    }
    summary.push({ alvo: `view ${check.returnedtypecode}`, nome: check.name, ok: true, campos: item.expectedFields.length });
  }

  console.table(summary);
  console.log("Feito: Cidades e Despesa Operacional com campos/formularios/views ajustados e publicados.");
})();
