/**
 * Cole no console do Model-driven App, dentro do ambiente alvo.
 *
 * Atualiza os formularios principais das tabelas:
 * - cr40f_categoriadespesaoperacional
 * - cr40f_formapagamentodespesa
 *
 * O script:
 * - descobre o form principal ativo por objecttypecode;
 * - imprime backup do formxml atual no console antes de alterar;
 * - adiciona os campos na section existente, sem apagar campos padrao;
 * - publica as duas tabelas;
 * - valida se todos os campos entraram no formxml.
 */
(async () => {
  const LCID_PT_BR = "1046";
  const api = Xrm.WebApi.online || Xrm.WebApi;
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const FIELD_CLASSID = "{4273EDBD-AC1D-40D3-9FB2-095C621B552D}";

  const forms = [
    {
      entity: "cr40f_categoriadespesaoperacional",
      title: "Categoria de Despesa Operacional",
      sections: [
        {
          label: "Identificacao",
          fields: [
            { name: "cr40f_nome", label: "Nome" },
            { name: "cr40f_ativa", label: "Ativa" },
            { name: "cr40f_ordem", label: "Ordem" },
            { name: "cr40f_grupodre", label: "Grupo DRE" }
          ]
        },
        {
          label: "Regras do app",
          fields: [
            { name: "cr40f_exigeveiculo", label: "Exige veiculo" },
            { name: "cr40f_exigereserva", label: "Exige reserva" },
            { name: "cr40f_exigekm", label: "Exige KM" },
            { name: "cr40f_exigelitros", label: "Exige litros" }
          ]
        }
      ]
    },
    {
      entity: "cr40f_formapagamentodespesa",
      title: "Forma de Pagamento de Despesa",
      sections: [
        {
          label: "Identificacao",
          fields: [
            { name: "cr40f_nome", label: "Nome" },
            { name: "cr40f_ativa", label: "Ativa" },
            { name: "cr40f_tipo", label: "Tipo" },
            { name: "cr40f_ordem", label: "Ordem" }
          ]
        }
      ]
    }
  ];

  function parseXml(xml) {
    const doc = parser.parseFromString(xml, "text/xml");
    const err = doc.querySelector("parsererror");
    if (err) throw new Error(`XML invalido: ${err.textContent}`);
    return doc;
  }

  function labelNode(doc, description) {
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
    cell.setAttribute("rowspan", "1");
    cell.appendChild(labelNode(doc, field.label));

    const control = doc.createElement("control");
    control.setAttribute("id", field.name);
    control.setAttribute("classid", FIELD_CLASSID);
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
    if (!tab) throw new Error("FormXML sem tab.");

    let tabLabels = tab.querySelector(":scope > labels");
    if (!tabLabels) {
      tabLabels = labelNode(doc, config.title);
      tab.insertBefore(tabLabels, tab.firstChild);
    }
    const tabLabel = tabLabels.querySelector(`label[languagecode="${LCID_PT_BR}"]`) || tabLabels.querySelector("label");
    if (tabLabel) tabLabel.setAttribute("description", config.title);

    const section = doc.querySelector("tabs tab columns column sections section");
    if (!section) throw new Error("FormXML sem section.");
    if (!section.getAttribute("id")) section.setAttribute("id", `{${crypto.randomUUID()}}`);
    if (!section.getAttribute("columns")) section.setAttribute("columns", "2");
    if (!section.getAttribute("labelwidth")) section.setAttribute("labelwidth", "115");

    let rows = section.querySelector(":scope > rows");
    if (!rows) {
      rows = doc.createElement("rows");
      section.appendChild(rows);
    }

    for (const section of config.sections) {
      const missingFields = section.fields.filter((field) => !doc.querySelector(`control[datafieldname="${field.name}"]`));
      for (let i = 0; i < missingFields.length; i += 2) {
        rows.appendChild(makeRow(doc, missingFields.slice(i, i + 2)));
      }
    }

    const nextXml = serializer.serializeToString(doc);
    const expectedFields = config.sections.flatMap((section) => section.fields.map((field) => field.name));
    const missing = expectedFields.filter((field) => !nextXml.includes(`datafieldname="${field}"`));
    if (missing.length) throw new Error(`XML local gerado sem campos: ${missing.join(", ")}`);
    return nextXml;
  }

  async function retrieveMainForm(entity) {
    const query = [
      "?$select=formid,name,objecttypecode,type,formactivationstate,formxml",
      `&$filter=objecttypecode eq '${entity}' and type eq 2`,
      "&$orderby=formactivationstate desc,name asc",
      "&$top=5"
    ].join("");
    const result = await api.retrieveMultipleRecords("systemform", query);
    const form = result.entities.find((item) => Number(item.formactivationstate) === 1) || result.entities[0];
    if (!form?.formid) throw new Error(`Nenhum formulario principal encontrado para ${entity}.`);
    if (!form.formxml) throw new Error(`Formulario ${form.name || form.formid} sem formxml.`);
    return form;
  }

  function publishRequest(entities) {
    return {
      ParameterXml: `<importexportxml><entities>${entities.map((entity) => `<entity>${entity}</entity>`).join("")}</entities><nodes/><securityroles/><settings/><workflows/></importexportxml>`,
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

  const summary = [];
  const pendingChecks = [];

  for (const config of forms) {
    const form = await retrieveMainForm(config.entity);
    console.group(`[backup formxml] ${config.entity} / ${form.name} / ${form.formid}`);
    console.log(form.formxml);
    console.groupEnd();

    const nextXml = updateFormXml(form.formxml, config);
    await api.updateRecord("systemform", form.formid, { formxml: nextXml });

    const expectedFields = config.sections.flatMap((section) => section.fields.map((field) => field.name));
    pendingChecks.push({ config, form, nextXml, expectedFields });
  }

  await api.execute(publishRequest(forms.map((form) => form.entity)));
  await wait(3000);

  for (const item of pendingChecks) {
    const check = await api.retrieveRecord("systemform", item.form.formid, "?$select=formxml,name,objecttypecode,type");
    const missing = item.expectedFields.filter((field) => !String(check.formxml || "").includes(`datafieldname="${field}"`));
    if (missing.length) {
      console.group(`[debug next formxml] ${item.config.entity}`);
      console.log(item.nextXml);
      console.groupEnd();
      console.group(`[debug saved formxml] ${item.config.entity}`);
      console.log(check.formxml);
      console.groupEnd();
      throw new Error(`Formulario ${item.config.entity} atualizado/publicado, mas Dataverse nao retornou campos: ${missing.join(", ")}. Veja [debug next formxml] e [debug saved formxml].`);
    }

    summary.push({
      tabela: item.config.entity,
      formulario: check.name,
      formid: item.form.formid,
      campos: item.expectedFields.length,
      ok: true
    });
  }

  console.table(summary);
  console.log("Feito: formularios completos de categoria de despesa e formas de pagamento publicados.");
})();
