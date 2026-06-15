/**
 * Cole no console do Model-driven App, dentro do ambiente alvo.
 *
 * Alvo:
 * - tabela: cr40f_funcionarios
 * - coluna: cr40f_gerarrecibopersonalizado
 * - formulario: principal ativo da tabela Funcionarios
 *
 * Faz:
 * - cria coluna Sim/Nao quando ausente;
 * - adiciona campo no formulario do funcionario;
 * - publica a tabela;
 * - valida metadado e formxml salvos.
 */
(async () => {
  const TABLE = "cr40f_funcionarios";
  const COLUMN = {
    schemaName: "cr40f_GerarReciboPersonalizado",
    logicalName: "cr40f_gerarrecibopersonalizado",
    label: "Gerar Recibo Personalizado",
    description: "Permite gerar recibo personalizado na tela de receber."
  };
  const ANCHOR_FIELDS = ["cr40f_emailmicrosoft", "cr40f_nomecompleto"];
  const LCID_PT_BR = 1046;
  const FIELD_CLASSID = "{4273EDBD-AC1D-40D3-9FB2-095C621B552D}";

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

  const api = xrm.WebApi.online || xrm.WebApi;
  const clientUrl = xrm.Utility.getGlobalContext().getClientUrl().replace(/\/$/, "");
  const apiUrl = `${clientUrl}/api/data/v9.2`;
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

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

  function label(text) {
    return {
      LocalizedLabels: [{ Label: text, LanguageCode: LCID_PT_BR }],
      UserLocalizedLabel: { Label: text, LanguageCode: LCID_PT_BR }
    };
  }

  async function columnExists() {
    try {
      await request(`EntityDefinitions(LogicalName='${TABLE}')/Attributes(LogicalName='${COLUMN.logicalName}')?$select=LogicalName`);
      return true;
    } catch (error) {
      if (String(error.message).startsWith("404 ")) return false;
      throw error;
    }
  }

  async function createColumn() {
    await request(`EntityDefinitions(LogicalName='${TABLE}')/Attributes`, {
      method: "POST",
      body: JSON.stringify({
        "@odata.type": "Microsoft.Dynamics.CRM.BooleanAttributeMetadata",
        SchemaName: COLUMN.schemaName,
        DisplayName: label(COLUMN.label),
        Description: label(COLUMN.description),
        RequiredLevel: {
          Value: "None",
          CanBeChanged: true,
          ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings"
        },
        DefaultValue: false,
        OptionSet: {
          TrueOption: { Value: 1, Label: label("Sim") },
          FalseOption: { Value: 0, Label: label("Nao") }
        }
      })
    });
  }

  function parseXml(xml) {
    const doc = parser.parseFromString(xml, "text/xml");
    const err = doc.querySelector("parsererror");
    if (err) throw new Error(`XML invalido: ${err.textContent}`);
    return doc;
  }

  function makeLabelNode(doc, text) {
    const labels = doc.createElement("labels");
    const item = doc.createElement("label");
    item.setAttribute("description", text);
    item.setAttribute("languagecode", String(LCID_PT_BR));
    labels.appendChild(item);
    return labels;
  }

  function makeFieldCell(doc) {
    const cell = doc.createElement("cell");
    cell.setAttribute("id", `{${crypto.randomUUID()}}`);
    cell.setAttribute("locklevel", "0");
    cell.setAttribute("colspan", "1");
    cell.setAttribute("rowspan", "1");
    cell.appendChild(makeLabelNode(doc, COLUMN.label));

    const control = doc.createElement("control");
    control.setAttribute("id", COLUMN.logicalName);
    control.setAttribute("classid", FIELD_CLASSID);
    control.setAttribute("datafieldname", COLUMN.logicalName);
    control.setAttribute("disabled", "false");
    cell.appendChild(control);
    return cell;
  }

  function addFieldToFormXml(formxml) {
    const doc = parseXml(formxml);
    if (doc.querySelector(`control[datafieldname="${COLUMN.logicalName}"]`)) {
      return serializer.serializeToString(doc);
    }

    const anchorControl = ANCHOR_FIELDS
      .map((field) => doc.querySelector(`control[datafieldname="${field}"]`))
      .find(Boolean);
    const anchorCell = anchorControl?.closest("cell") || null;
    const anchorRow = anchorCell?.parentElement || null;
    const fieldCell = makeFieldCell(doc);

    if (anchorCell && anchorRow) {
      const emptyRightCell = anchorCell.nextElementSibling?.tagName === "cell"
        && !anchorCell.nextElementSibling.querySelector("control")
        ? anchorCell.nextElementSibling
        : null;
      if (emptyRightCell) emptyRightCell.replaceWith(fieldCell);
      else anchorCell.after(fieldCell);
    } else {
      const rows = doc.querySelector("tabs tab columns column sections section rows");
      if (!rows) throw new Error("FormXML sem rows para inserir campo.");
      const row = doc.createElement("row");
      row.appendChild(fieldCell);
      rows.appendChild(row);
    }

    const nextXml = serializer.serializeToString(doc);
    if (!nextXml.includes(`datafieldname="${COLUMN.logicalName}"`)) {
      throw new Error(`XML local gerado sem campo ${COLUMN.logicalName}.`);
    }
    return nextXml;
  }

  async function retrieveMainForm() {
    const query = [
      "?$select=formid,name,objecttypecode,type,formactivationstate,formxml",
      `&$filter=objecttypecode eq '${TABLE}' and type eq 2`,
      "&$orderby=formactivationstate desc,name asc",
      "&$top=5"
    ].join("");
    const result = await api.retrieveMultipleRecords("systemform", query);
    const form = result.entities.find((item) => Number(item.formactivationstate) === 1) || result.entities[0];
    if (!form?.formid) throw new Error(`Nenhum formulario principal encontrado para ${TABLE}.`);
    if (!form.formxml) throw new Error(`Formulario ${form.name || form.formid} sem formxml.`);
    return form;
  }

  function publishRequest() {
    return {
      ParameterXml: `<importexportxml><entities><entity>${TABLE}</entity></entities><nodes/><securityroles/><settings/><workflows/></importexportxml>`,
      getMetadata: () => ({
        boundParameter: null,
        parameterTypes: {
          ParameterXml: {
            typeName: "Edm.String",
            structuralProperty: 1
          }
        },
        operationType: 0,
        operationName: "PublishXml"
      })
    };
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const existedBefore = await columnExists();
  if (!existedBefore) {
    await createColumn();
    await api.execute(publishRequest());
    await wait(5000);
  }

  const form = await retrieveMainForm();
  console.group(`[backup formxml] ${TABLE} / ${form.name} / ${form.formid}`);
  console.log(form.formxml);
  console.groupEnd();

  const nextXml = addFieldToFormXml(form.formxml);
  await api.updateRecord("systemform", form.formid, { formxml: nextXml });
  await api.execute(publishRequest());
  await wait(3000);

  const [fieldOk, formCheck] = await Promise.all([
    columnExists(),
    api.retrieveRecord("systemform", form.formid, "?$select=formxml,name,objecttypecode,type")
  ]);

  const formOk = String(formCheck.formxml || "").includes(`datafieldname="${COLUMN.logicalName}"`);
  console.table([{
    tabela: TABLE,
    coluna: COLUMN.logicalName,
    colunaCriadaAgora: !existedBefore,
    formulario: formCheck.name,
    formid: form.formid,
    campoNoFormulario: formOk,
    ok: fieldOk && formOk
  }]);

  if (!fieldOk || !formOk) {
    console.group("[debug next formxml]");
    console.log(nextXml);
    console.groupEnd();
    console.group("[debug saved formxml]");
    console.log(formCheck.formxml);
    console.groupEnd();
    throw new Error("Aplicacao terminou, mas verificacao falhou.");
  }

  console.log(`Feito: ${COLUMN.logicalName} criado/adicionado ao formulario de funcionarios.`);
})();
