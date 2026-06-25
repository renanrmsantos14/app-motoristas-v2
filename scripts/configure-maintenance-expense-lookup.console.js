/**
 * Cole no console do Model-driven App, dentro do ambiente alvo.
 *
 * Cria/valida o lookup:
 * - cr40f_despesaoperacional.cr40f_manutencao -> cr40f_manutencoes
 * - adiciona o campo no formulario principal e view padrao de Despesa Operacional
 * - publica e valida metadata/form/view
 *
 * Nao apaga dados. Backups de formxml/fetchxml/layoutxml saem no console.
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
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0"
  };

  const expenseEntity = "cr40f_despesaoperacional";
  const maintenanceEntity = "cr40f_manutencoes";
  const lookupLogicalName = "cr40f_manutencao";
  const field = { name: lookupLogicalName, label: "Manutencao", classid: LOOKUP_CLASSID, width: "170" };

  function log(...args) {
    console.log("[Manutencao/Despesa]", ...args);
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

  async function ensureLookup() {
    if (!(await entity(expenseEntity))) throw new Error(`Tabela nao encontrada: ${expenseEntity}`);
    if (!(await entity(maintenanceEntity))) throw new Error(`Tabela nao encontrada: ${maintenanceEntity}`);

    const existingAttr = await attribute(expenseEntity, lookupLogicalName);
    if (existingAttr) {
      log(`Lookup ja existe: ${expenseEntity}.${lookupLogicalName}`);
      return false;
    }

    log(`Criando lookup: ${expenseEntity}.${lookupLogicalName} -> ${maintenanceEntity}`);
    await request("POST", "/RelationshipDefinitions", {
      "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
      SchemaName: "cr40f_manutencoes_cr40f_despesaoperacional_manutencao",
      ReferencedEntity: maintenanceEntity,
      ReferencingEntity: expenseEntity,
      ReferencingEntityNavigationPropertyName: "cr40f_Manutencao",
      Lookup: {
        "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
        SchemaName: "cr40f_Manutencao",
        DisplayName: label("Manutencao"),
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
    const labelNode = doc.createElement("label");
    labelNode.setAttribute("description", description);
    labelNode.setAttribute("languagecode", LCID_PT_BR);
    labels.appendChild(labelNode);
    return labels;
  }

  function makeCell(doc) {
    const cell = doc.createElement("cell");
    cell.setAttribute("id", `{${crypto.randomUUID()}}`);
    cell.setAttribute("locklevel", "0");
    cell.setAttribute("colspan", "1");
    cell.setAttribute("rowspan", "1");
    cell.appendChild(labelsNode(doc, field.label));

    const control = doc.createElement("control");
    control.setAttribute("id", field.name);
    control.setAttribute("classid", field.classid || FIELD_CLASSID);
    control.setAttribute("datafieldname", field.name);
    control.setAttribute("disabled", "false");
    cell.appendChild(control);
    return cell;
  }

  function updateFormXml(formxml) {
    const doc = parseXml(formxml);
    if (doc.querySelector(`control[datafieldname="${field.name}"]`)) return formxml;
    const rows = doc.querySelector("tabs tab columns column sections section rows");
    if (!rows) throw new Error("FormXML sem rows em section principal.");
    const row = doc.createElement("row");
    row.appendChild(makeCell(doc));
    rows.appendChild(row);
    return serializer.serializeToString(doc);
  }

  async function retrieveMainForm() {
    const query = [
      "?$select=formid,name,objecttypecode,type,formactivationstate,formxml",
      `&$filter=objecttypecode eq '${expenseEntity}' and type eq 2`,
      "&$orderby=formactivationstate desc,name asc",
      "&$top=5"
    ].join("");
    const result = await api.retrieveMultipleRecords("systemform", query);
    const form = result.entities.find((item) => Number(item.formactivationstate) === 1) || result.entities[0];
    if (!form?.formid || !form.formxml) throw new Error(`Formulario principal nao encontrado para ${expenseEntity}.`);
    return form;
  }

  async function updateMainForm() {
    const form = await retrieveMainForm();
    console.group(`[backup formxml] ${expenseEntity} / ${form.name} / ${form.formid}`);
    console.log(form.formxml);
    console.groupEnd();
    const nextXml = updateFormXml(form.formxml);
    if (nextXml !== form.formxml) await api.updateRecord("systemform", form.formid, { formxml: nextXml });
    return form.formid;
  }

  function addAttributeToFetch(fetchxml) {
    const doc = parseXml(fetchxml);
    const entityNode = doc.querySelector(`entity[name="${expenseEntity}"]`) || doc.querySelector("entity");
    if (!entityNode) throw new Error(`FetchXML sem entity ${expenseEntity}.`);
    if (!entityNode.querySelector(`attribute[name="${field.name}"]`)) {
      const attr = doc.createElement("attribute");
      attr.setAttribute("name", field.name);
      entityNode.appendChild(attr);
    }
    return serializer.serializeToString(doc);
  }

  function addCellToLayout(layoutxml) {
    const doc = parseXml(layoutxml);
    const row = doc.querySelector("grid row");
    if (!row) throw new Error("LayoutXML sem grid row.");
    if (!row.querySelector(`cell[name="${field.name}"]`)) {
      const cell = doc.createElement("cell");
      cell.setAttribute("name", field.name);
      cell.setAttribute("width", field.width);
      row.appendChild(cell);
    }
    return serializer.serializeToString(doc);
  }

  async function retrieveDefaultView() {
    const query = [
      "?$select=savedqueryid,name,returnedtypecode,fetchxml,layoutxml,isdefault,querytype",
      `&$filter=returnedtypecode eq '${expenseEntity}' and querytype eq 0`,
      "&$orderby=isdefault desc,name asc",
      "&$top=10"
    ].join("");
    const result = await api.retrieveMultipleRecords("savedquery", query);
    const view = result.entities.find((item) => item.isdefault) || result.entities[0];
    if (!view?.savedqueryid) throw new Error(`View publica nao encontrada para ${expenseEntity}.`);
    return view;
  }

  async function updateDefaultView() {
    const view = await retrieveDefaultView();
    console.group(`[backup view] ${expenseEntity} / ${view.name} / ${view.savedqueryid}`);
    console.log({ fetchxml: view.fetchxml, layoutxml: view.layoutxml });
    console.groupEnd();
    await api.updateRecord("savedquery", view.savedqueryid, {
      fetchxml: addAttributeToFetch(view.fetchxml),
      layoutxml: addCellToLayout(view.layoutxml)
    });
    return view.savedqueryid;
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

  const createdLookup = await ensureLookup();
  if (createdLookup) {
    log("Aguardando metadata do lookup.");
    await wait(15000);
  }

  const relationships = await manyToOne(expenseEntity);
  const relationship = relationships.find((item) =>
    String(item.ReferencingAttribute).toLowerCase() === lookupLogicalName &&
    String(item.ReferencedEntity).toLowerCase() === maintenanceEntity
  );
  if (!relationship?.ReferencingEntityNavigationPropertyName) {
    throw new Error("Lookup cr40f_manutencao existe, mas navigation property nao foi resolvida.");
  }
  log("Navigation property Manutencao:", relationship.ReferencingEntityNavigationPropertyName);

  const formId = await updateMainForm();
  const viewId = await updateDefaultView();
  await api.execute(publishRequest([expenseEntity]));
  await wait(5000);

  const [attrCheck, formCheck, viewCheck] = await Promise.all([
    attribute(expenseEntity, lookupLogicalName),
    api.retrieveRecord("systemform", formId, "?$select=formxml,name,objecttypecode"),
    api.retrieveRecord("savedquery", viewId, "?$select=fetchxml,layoutxml,name,returnedtypecode")
  ]);
  if (!attrCheck) throw new Error("Campo cr40f_manutencao nao encontrado apos publicar.");
  if (!String(formCheck.formxml || "").includes(`datafieldname="${lookupLogicalName}"`)) {
    throw new Error("Formulario de despesa sem cr40f_manutencao apos publicar.");
  }
  if (!String(viewCheck.fetchxml || "").includes(`name="${lookupLogicalName}"`) || !String(viewCheck.layoutxml || "").includes(`name="${lookupLogicalName}"`)) {
    throw new Error("View de despesa sem cr40f_manutencao apos publicar.");
  }

  console.table([
    { alvo: "lookup", nome: `${expenseEntity}.${lookupLogicalName}`, ok: true },
    { alvo: "form", nome: formCheck.name, ok: true },
    { alvo: "view", nome: viewCheck.name, ok: true }
  ]);
  console.log("Feito: lookup Manutencao em Despesa Operacional criado/validado e publicado.");
})().catch((error) => {
  console.error("[Manutencao/Despesa] Falhou:", error);
  throw error;
});
