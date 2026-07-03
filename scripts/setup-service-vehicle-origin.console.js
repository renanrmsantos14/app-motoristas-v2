/**
 * Console script: cria e inicializa Origem do Veiculo na Geral.
 *
 * Uso:
 * 1. Abra o Model-driven App no ambiente alvo.
 * 2. Cole este arquivo inteiro no console do navegador.
 * 3. Aguarde terminar. Resultado: window.ServiceVehicleOriginSetupLastResult.
 *
 * Campo criado:
 * - Tabela: cr40f_reservadeveculos
 * - Coluna: new_origemveiculo
 * - Rotulo: Origem do Veiculo
 * - Opcoes:
 *   - 100000000 = Automatico
 *   - 100000001 = Manual
 * - Default: Automatico
 *
 * Seguro:
 * - nao apaga nada;
 * - se o campo ja existe, nao recria;
 * - backfill altera somente registros com new_origemveiculo vazio.
 */
(async () => {
  const DRY_RUN = false;
  const LCID = 1046;
  const PAGE_SIZE = 5000;
  const TABLE_LOGICAL = "cr40f_reservadeveculos";
  const TABLE_SET = "cr40f_reservadeveculoses";
  const TABLE_ID = "cr40f_reservadeveculosid";
  const FIELD_LOGICAL = "new_origemveiculo";
  const FIELD_SCHEMA = "new_OrigemVeiculo";
  const FIELD_LABEL = "Origem do Veículo";
  const ORIGIN_AUTO = 100000000;
  const ORIGIN_MANUAL = 100000001;

  function pickXrm() {
    try {
      if (window.Xrm?.Utility?.getGlobalContext) return window.Xrm;
      if (window.parent?.Xrm?.Utility?.getGlobalContext) return window.parent.Xrm;
    } catch {
      return window.Xrm || null;
    }
    return null;
  }

  const xrm = pickXrm();
  if (!xrm) throw new Error("Xrm nao encontrado. Cole dentro do Model-driven App.");

  const baseUrl = xrm.Utility.getGlobalContext().getClientUrl().replace(/\/$/, "");
  const webApi = `${baseUrl}/api/data/v9.2`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
    Prefer: `odata.include-annotations="OData.Community.Display.V1.FormattedValue",odata.maxpagesize=${PAGE_SIZE}`
  };

  const result = {
    environment: baseUrl,
    dryRun: DRY_RUN,
    field: `${TABLE_LOGICAL}.${FIELD_LOGICAL}`,
    createdField: false,
    fieldAlreadyExisted: false,
    published: false,
    scanned: 0,
    updatedDefaultAutomatic: 0,
    errors: []
  };

  function label(text) {
    return {
      LocalizedLabels: [{ Label: text, LanguageCode: LCID }],
      UserLocalizedLabel: { Label: text, LanguageCode: LCID }
    };
  }

  function option(value, text) {
    return {
      Value: value,
      Label: label(text)
    };
  }

  async function request(method, pathOrUrl, body, ok404 = false) {
    const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${webApi}${pathOrUrl}`;
    const response = await fetch(url, {
      method,
      headers,
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    if (ok404 && response.status === 404) return null;
    if (!response.ok) throw new Error(`${method} ${url}\n${response.status} ${response.statusText}\n${text}`);
    return text ? JSON.parse(text) : null;
  }

  async function attributeExists() {
    return Boolean(await request(
      "GET",
      `/EntityDefinitions(LogicalName='${TABLE_LOGICAL}')/Attributes(LogicalName='${FIELD_LOGICAL}')?$select=LogicalName,SchemaName`,
      null,
      true
    ));
  }

  async function createField() {
    if (await attributeExists()) {
      result.fieldAlreadyExisted = true;
      console.log(`[service-vehicle-origin] campo ja existe: ${FIELD_LOGICAL}`);
      return;
    }

    console.log(`[service-vehicle-origin] criando campo ${FIELD_LOGICAL}`);
    if (DRY_RUN) return;

    await request("POST", `/EntityDefinitions(LogicalName='${TABLE_LOGICAL}')/Attributes`, {
      "@odata.type": "Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
      SchemaName: FIELD_SCHEMA,
      DisplayName: label(FIELD_LABEL),
      Description: label("Define se o veículo do serviço foi preenchido automaticamente por posse/troca ou definido manualmente."),
      RequiredLevel: {
        Value: "None",
        CanBeChanged: true,
        ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings"
      },
      DefaultFormValue: ORIGIN_AUTO,
      OptionSet: {
        IsGlobal: false,
        OptionSetType: "Picklist",
        Options: [
          option(ORIGIN_AUTO, "Automático"),
          option(ORIGIN_MANUAL, "Manual")
        ]
      }
    });
    result.createdField = true;
  }

  async function publish() {
    if (DRY_RUN) return;
    const requestObject = {
      ParameterXml: `<importexportxml><entities><entity>${TABLE_LOGICAL}</entity></entities><nodes/><securityroles/><settings/><workflows/></importexportxml>`,
      getMetadata: () => ({
        boundParameter: null,
        parameterTypes: { ParameterXml: { typeName: "Edm.String", structuralProperty: 1 } },
        operationType: 0,
        operationName: "PublishXml"
      })
    };
    await xrm.WebApi.online.execute(requestObject);
    result.published = true;
  }

  async function listAll(path) {
    const rows = [];
    let nextUrl = `${webApi}${path}`;
    while (nextUrl) {
      const page = await request("GET", nextUrl);
      rows.push(...(page?.value || []));
      nextUrl = page?.["@odata.nextLink"] || null;
    }
    return rows;
  }

  async function backfillDefaultAutomatic() {
    const rows = await listAll(`/${TABLE_SET}?$select=${TABLE_ID},${FIELD_LOGICAL}&$filter=${FIELD_LOGICAL} eq null`);
    result.scanned = rows.length;
    console.log(`[service-vehicle-origin] registros sem origem: ${rows.length}`);

    for (const row of rows) {
      const id = row[TABLE_ID];
      if (!id) continue;
      if (!DRY_RUN) {
        await request("PATCH", `/${TABLE_SET}(${id})`, { [FIELD_LOGICAL]: ORIGIN_AUTO });
      }
      result.updatedDefaultAutomatic += 1;
      if (result.updatedDefaultAutomatic % 100 === 0) {
        console.log(`[service-vehicle-origin] atualizados ${result.updatedDefaultAutomatic}/${rows.length}`);
      }
    }
  }

  try {
    await createField();
    await publish();
    await backfillDefaultAutomatic();
    await publish();
  } catch (error) {
    result.errors.push(String(error?.message || error));
    throw error;
  } finally {
    window.ServiceVehicleOriginSetupLastResult = result;
    console.log("[service-vehicle-origin] resultado", result);
  }
})();
