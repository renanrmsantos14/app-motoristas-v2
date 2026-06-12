// Cole no console do Model-driven App, em qualquer tela do mesmo ambiente.
// Alvo: tabela cr40f_veiculos, form "Informações" e view "Visualização Padrão".
(async () => {
  const FORM_ID = "262c2f45-e3be-4fe5-8350-e42c62638bf5";
  const VIEW_ID = "78b895c8-4e03-f111-8406-7ced8db12edc";
  const ENTITY = "cr40f_veiculos";
  const STATUS = "cr40f_statusdoveiculo";
  const CATEGORY = "new_categoriadoveiculo";
  const CATEGORY_LABEL = "Categoria do Veículo";
  const CHOICE_CLASSID = "{3EF39988-22BB-4F0B-BBBE-64B5A3748AEE}";

  const api = Xrm.WebApi.online;
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  function parseXml(xml) {
    const doc = parser.parseFromString(xml, "text/xml");
    const err = doc.querySelector("parsererror");
    if (err) throw new Error(`XML invalido: ${err.textContent}`);
    return doc;
  }

  function addAttributeToFetch(fetchxml) {
    const doc = parseXml(fetchxml);
    const entity = doc.querySelector(`entity[name="${ENTITY}"]`);
    if (!entity) throw new Error(`FetchXML sem entity ${ENTITY}.`);
    if (!entity.querySelector(`attribute[name="${CATEGORY}"]`)) {
      const statusAttr = entity.querySelector(`attribute[name="${STATUS}"]`);
      if (!statusAttr) throw new Error(`FetchXML sem attribute ${STATUS}.`);
      const attr = doc.createElement("attribute");
      attr.setAttribute("name", CATEGORY);
      statusAttr.after(attr);
    }
    return serializer.serializeToString(doc);
  }

  function addCellToLayout(layoutxml) {
    const doc = parseXml(layoutxml);
    const row = doc.querySelector("grid row");
    if (!row) throw new Error("LayoutXML sem row.");
    if (!row.querySelector(`cell[name="${CATEGORY}"]`)) {
      const statusCell = row.querySelector(`cell[name="${STATUS}"]`);
      if (!statusCell) throw new Error(`LayoutXML sem cell ${STATUS}.`);
      const cell = doc.createElement("cell");
      cell.setAttribute("name", CATEGORY);
      cell.setAttribute("width", "150");
      statusCell.after(cell);
    }
    return serializer.serializeToString(doc);
  }

  function addCellToLayoutJson(layoutjson) {
    if (!layoutjson) return layoutjson;
    const json = JSON.parse(layoutjson);
    const cells = json?.Rows?.[0]?.Cells;
    if (!Array.isArray(cells)) return layoutjson;
    if (!cells.some((cell) => cell.Name === CATEGORY)) {
      const statusIndex = cells.findIndex((cell) => cell.Name === STATUS);
      if (statusIndex < 0) throw new Error(`LayoutJSON sem cell ${STATUS}.`);
      cells.splice(statusIndex + 1, 0, {
        Name: CATEGORY,
        Width: 150,
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

  function addCellToForm(formxml) {
    const doc = parseXml(formxml);
    if (doc.querySelector(`control[datafieldname="${CATEGORY}"]`)) {
      return serializer.serializeToString(doc);
    }

    const statusControl = doc.querySelector(`control[datafieldname="${STATUS}"]`);
    if (!statusControl) throw new Error(`FormXML sem control ${STATUS}.`);
    const statusCell = statusControl.closest("cell");
    const row = statusCell?.parentElement;
    if (!row) throw new Error("Nao encontrei row do status.");

    const emptyRightCell = statusCell.nextElementSibling?.tagName === "cell"
      && !statusCell.nextElementSibling.querySelector("control")
      ? statusCell.nextElementSibling
      : null;

    const categoryCell = doc.createElement("cell");
    categoryCell.setAttribute("id", `{${crypto.randomUUID()}}`);
    categoryCell.setAttribute("locklevel", "0");
    categoryCell.setAttribute("colspan", "1");
    categoryCell.setAttribute("rowspan", "1");

    const labels = doc.createElement("labels");
    const label = doc.createElement("label");
    label.setAttribute("description", CATEGORY_LABEL);
    label.setAttribute("languagecode", "1046");
    labels.appendChild(label);

    const control = doc.createElement("control");
    control.setAttribute("id", CATEGORY);
    control.setAttribute("classid", CHOICE_CLASSID);
    control.setAttribute("datafieldname", CATEGORY);
    control.setAttribute("disabled", "false");

    categoryCell.appendChild(labels);
    categoryCell.appendChild(control);

    if (emptyRightCell) emptyRightCell.replaceWith(categoryCell);
    else statusCell.after(categoryCell);

    return serializer.serializeToString(doc);
  }

  function publishRequest() {
    return {
      ParameterXml: `<importexportxml><entities><entity>${ENTITY}</entity></entities><nodes/><securityroles/><settings/><workflows/></importexportxml>`,
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

  const view = await api.retrieveRecord(
    "savedquery",
    VIEW_ID,
    "?$select=fetchxml,layoutxml,layoutjson,name,returnedtypecode"
  );
  if (view.returnedtypecode !== ENTITY) throw new Error(`View nao e de ${ENTITY}: ${view.returnedtypecode}`);

  const nextFetch = addAttributeToFetch(view.fetchxml);
  const nextLayout = addCellToLayout(view.layoutxml);
  const nextLayoutJson = addCellToLayoutJson(view.layoutjson);

  await api.updateRecord("savedquery", VIEW_ID, {
    fetchxml: nextFetch,
    layoutxml: nextLayout,
    layoutjson: nextLayoutJson
  });

  const form = await api.retrieveRecord("systemform", FORM_ID, "?$select=formxml,name,objecttypecode,type");
  if (form.objecttypecode !== ENTITY) throw new Error(`Form nao e de ${ENTITY}: ${form.objecttypecode}`);

  const nextFormXml = addCellToForm(form.formxml);
  await api.updateRecord("systemform", FORM_ID, { formxml: nextFormXml });

  await api.execute(publishRequest());

  const [viewCheck, formCheck] = await Promise.all([
    api.retrieveRecord("savedquery", VIEW_ID, "?$select=fetchxml,layoutxml"),
    api.retrieveRecord("systemform", FORM_ID, "?$select=formxml")
  ]);

  const okView = viewCheck.fetchxml.includes(CATEGORY) && viewCheck.layoutxml.includes(CATEGORY);
  const okForm = formCheck.formxml.includes(`datafieldname="${CATEGORY}"`);
  console.table([
    { alvo: "Visualizacao Padrao", ok: okView },
    { alvo: "Formulario Informacoes", ok: okForm }
  ]);
  if (!okView || !okForm) throw new Error("Aplicacao terminou, mas verificacao falhou.");
  console.log("Feito: Categoria do Veiculo adicionada ao lado direito do Status.");
})();
