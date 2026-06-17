/*
Cole este script no console do Model-driven App DEV.

Faz:
- cria a coluna new_idioma na tabela cr40f_recibos_v2, se ainda nao existir
- cria as opcoes Portugues, Ingles e Espanhol
- adiciona o campo no formulario principal, se ainda nao estiver
- publica a entidade
*/
(async () => {
  const LCID = 1046;
  const ENTITY_NAME = "cr40f_recibos_v2";
  const COLUMN_LOGICAL_NAME = "new_idioma";
  const COLUMN_SCHEMA_NAME = "new_Idioma";
  const COLUMN_LABEL = "Idioma";
  const CHOICE_CLASSID = "{3EF39988-22BB-4F0B-BBBE-64B5A3748AEE}";
  const OPTIONS = [
    [100000000, "Português"],
    [100000001, "Inglês"],
    [100000002, "Espanhol"]
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
  if (!xrm) throw new Error("Xrm nao encontrado. Rode no Model-driven App.");

  const api = xrm.WebApi.online || xrm.WebApi;
  const clientUrl = xrm.Utility.getGlobalContext().getClientUrl().replace(/\/$/, "");
  const webApi = `${clientUrl}/api/data/v9.2`;
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0"
  };

  const label = (text) => ({ LocalizedLabels: [{ Label: text, LanguageCode: LCID }] });
  const required = (value = "None") => ({
    Value: value,
    CanBeChanged: true,
    ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings"
  });
  const option = (value, text) => ({ Value: value, Label: label(text) });
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const request = async (method, path, body, ok404 = false) => {
    const response = await fetch(encodeURI(`${webApi}${path}`), {
      method,
      credentials: "same-origin",
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    if (ok404 && response.status === 404) return null;
    if (!response.ok) throw new Error(`${method} ${path}\n${response.status} ${response.statusText}\n${text}`);
    return text ? JSON.parse(text) : null;
  };

  const publishRequest = (entities) => ({
    ParameterXml: `<importexportxml><entities>${entities.map((name) => `<entity>${name}</entity>`).join("")}</entities><nodes/><securityroles/><settings/><workflows/></importexportxml>`,
    getMetadata: () => ({
      boundParameter: null,
      parameterTypes: { ParameterXml: { typeName: "Edm.String", structuralProperty: 1 } },
      operationType: 0,
      operationName: "PublishXml"
    })
  });

  const parseXml = (xml) => {
    const doc = parser.parseFromString(xml, "text/xml");
    const err = doc.querySelector("parsererror");
    if (err) throw new Error(`FormXML invalido: ${err.textContent}`);
    return doc;
  };

  const makeLabelsNode = (doc, description) => {
    const labels = doc.createElement("labels");
    const item = doc.createElement("label");
    item.setAttribute("description", description);
    item.setAttribute("languagecode", String(LCID));
    labels.appendChild(item);
    return labels;
  };

  const makeCell = (doc, empty = false) => {
    const cell = doc.createElement("cell");
    cell.setAttribute("id", `{${crypto.randomUUID()}}`);
    cell.setAttribute("locklevel", "0");
    cell.setAttribute("colspan", "1");
    cell.setAttribute("rowspan", "1");
    if (empty) {
      cell.setAttribute("showlabel", "false");
      return cell;
    }

    cell.appendChild(makeLabelsNode(doc, COLUMN_LABEL));
    const control = doc.createElement("control");
    control.setAttribute("id", COLUMN_LOGICAL_NAME);
    control.setAttribute("classid", CHOICE_CLASSID);
    control.setAttribute("datafieldname", COLUMN_LOGICAL_NAME);
    control.setAttribute("disabled", "false");
    cell.appendChild(control);
    return cell;
  };

  const currentAttribute = await request(
    "GET",
    `/EntityDefinitions(LogicalName='${ENTITY_NAME}')/Attributes(LogicalName='${COLUMN_LOGICAL_NAME}')?$select=LogicalName,SchemaName,AttributeType`,
    null,
    true
  );

  if (!currentAttribute) {
    console.log("[receipt-language] criando coluna", COLUMN_LOGICAL_NAME);
    await request("POST", `/EntityDefinitions(LogicalName='${ENTITY_NAME}')/Attributes`, {
      "@odata.type": "Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
      SchemaName: COLUMN_SCHEMA_NAME,
      DisplayName: label(COLUMN_LABEL),
      Description: label(COLUMN_LABEL),
      RequiredLevel: required("None"),
      OptionSet: {
        IsGlobal: false,
        OptionSetType: "Picklist",
        Options: OPTIONS.map(([value, text]) => option(value, text))
      }
    });
    await wait(3000);
    await api.execute(publishRequest([ENTITY_NAME]));
    await wait(2000);
  } else {
    console.log("[receipt-language] coluna ja existe", currentAttribute);
  }

  const forms = await request(
    "GET",
    `/systemforms?$select=formid,name,objecttypecode,type,formactivationstate,formxml&$filter=objecttypecode eq '${ENTITY_NAME}' and type eq 2&$orderby=formactivationstate desc,name asc`
  );
  const mainForm = forms?.value?.[0];
  if (!mainForm?.formid || !mainForm.formxml) throw new Error("Formulario principal nao encontrado.");

  const doc = parseXml(mainForm.formxml);
  if (!doc.querySelector(`control[datafieldname='${COLUMN_LOGICAL_NAME}']`)) {
    const section = doc.querySelector("tabs tab columns column sections section");
    if (!section) throw new Error("FormXML sem section principal.");
    section.setAttribute("columns", "2");

    let rows = section.querySelector(":scope > rows");
    if (!rows) {
      rows = doc.createElement("rows");
      section.appendChild(rows);
    }

    const row = doc.createElement("row");
    row.setAttribute("height", "35");
    row.appendChild(makeCell(doc));
    row.appendChild(makeCell(doc, true));
    rows.appendChild(row);

    console.log("[receipt-language] adicionando campo no formulario", mainForm.name);
    await api.updateRecord("systemform", mainForm.formid, { formxml: serializer.serializeToString(doc) });
    await wait(2000);
  } else {
    console.log("[receipt-language] campo ja estava no formulario", mainForm.name);
  }

  await api.execute(publishRequest([ENTITY_NAME]));
  console.log("[receipt-language] concluido");
})();
