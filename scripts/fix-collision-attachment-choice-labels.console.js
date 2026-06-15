/**
 * Cole no console do Model-driven App, no ambiente Dev.
 *
 * Faz:
 * - valida labels pt-BR nos Choices de cr40f_anexocolisao;
 * - atualiza somente opcoes sem label;
 * - publica a tabela;
 * - le metadata de volta.
 *
 * Se todos os labels existem no metadata ao vivo mas o ZIP exportado sai sem
 * <labels>, o problema e staging/export preso no Dataverse, nao falta de label.
 */
(async () => {
  const TABLE = "cr40f_anexocolisao";
  const LCID_PT_BR = 1046;
  const CHOICES = [
    {
      logicalName: "cr40f_status",
      options: [
        [100000000, "Pendente"],
        [100000001, "Enviado"],
        [100000002, "Falhou"],
        [100000003, "Invalido"]
      ]
    },
    {
      logicalName: "cr40f_tipo",
      options: [
        [100000000, "Cena"],
        [100000001, "Dano Betinhos"],
        [100000002, "Dano terceiro"],
        [100000003, "Documento terceiro"],
        [100000004, "Extra"]
      ]
    }
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
  if (!xrm) throw new Error("Xrm nao encontrado. Cole dentro do Model-driven App.");

  const api = xrm.WebApi.online || xrm.WebApi;
  const clientUrl = xrm.Utility.getGlobalContext().getClientUrl().replace(/\/$/, "");
  const apiUrl = `${clientUrl}/api/data/v9.2`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0"
  };

  function label(text) {
    return {
      LocalizedLabels: [{ Label: text, LanguageCode: LCID_PT_BR }],
      UserLocalizedLabel: { Label: text, LanguageCode: LCID_PT_BR }
    };
  }

  async function request(path, options = {}, retries = 2) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${apiUrl}/${path.replace(/^\//, "")}`, {
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
      } catch (error) {
        lastError = error;
        if (attempt >= retries) break;
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      }
    }
    throw lastError;
  }

  async function updateOptionLabel(attributeLogicalName, value, text) {
    await request("UpdateOptionValue", {
      method: "POST",
      body: JSON.stringify({
        EntityLogicalName: TABLE,
        AttributeLogicalName: attributeLogicalName,
        Value: value,
        Label: label(text),
        MergeLabels: true
      })
    });
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

  async function readPicklist(logicalName) {
    return request(
      `EntityDefinitions(LogicalName='${TABLE}')/Attributes(LogicalName='${logicalName}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata` +
        "?$select=LogicalName,SchemaName" +
        "&$expand=OptionSet($select=IsGlobal,Name,Options)"
    );
  }

  async function readPicklists() {
    const value = [];
    for (const choice of CHOICES) {
      value.push(await readPicklist(choice.logicalName));
    }
    return { value };
  }

  function getPtBrLabel(option) {
    const labels = option.Label?.LocalizedLabels ?? [];
    return labels.find((item) => Number(item.LanguageCode) === LCID_PT_BR)?.Label ?? "";
  }

  function summarize(metadata) {
    const rows = [];
    const problems = [];
    for (const choice of CHOICES) {
      const attribute = metadata.value?.find((item) => item.LogicalName === choice.logicalName);
      if (!attribute) {
        problems.push({ field: choice.logicalName, issue: "campo nao encontrado" });
        continue;
      }
      for (const [value, fallback] of choice.options) {
        const option = attribute.OptionSet?.Options?.find((item) => Number(item.Value) === value);
        const actual = option ? getPtBrLabel(option) : "";
        const ok = Boolean(actual.trim());
        const row = {
          field: choice.logicalName,
          value,
          fallback,
          actual,
          ok
        };
        rows.push(row);
        if (!ok) problems.push({ ...row, issue: option ? "label ausente" : "opcao nao encontrada" });
      }
    }
    return { rows, problems };
  }

  console.log(`[inicio] Ambiente: ${clientUrl}`);
  console.log(`[inicio] Tabela: ${TABLE}`);

  let before;
  try {
    before = summarize(await readPicklists());
    console.group("[antes]");
    console.table(before.rows);
    if (before.problems.length) console.table(before.problems);
    console.groupEnd();
  } catch (error) {
    console.error("[bloqueado ao ler metadata]", error.message);
    throw error;
  }

  if (!before.problems.length) {
    console.log("Feito: metadata ao vivo tem labels pt-BR em todas as opcoes. Nao atualizei nada.");
    console.warn("Se o ZIP exportado ainda sai sem <labels>, o problema e staging/export preso no Dataverse.");
    return;
  }

  for (const problem of before.problems) {
    const choice = CHOICES.find((item) => item.logicalName === problem.field);
    const option = choice?.options.find(([value]) => Number(value) === Number(problem.value));
    if (!choice || !option) continue;
    const [, text] = option;
    console.log(`[update] ${choice.logicalName} ${problem.value} -> ${text}`);
    try {
      await updateOptionLabel(choice.logicalName, problem.value, text);
    } catch (error) {
      if (String(error.message).includes("staged metadata")) {
        console.error("[lock metadata]", error.message);
        console.error("Esse erro confirma lock/staging preso no Dataverse. Nao e falta de label ao vivo.");
      }
      throw error;
    }
  }

  console.log("[publish] Publicando tabela...");
  await api.execute(publishRequest());
  await new Promise((resolve) => setTimeout(resolve, 10000));

  const after = summarize(await readPicklists());
  console.group("[depois]");
  console.table(after.rows);
  if (after.problems.length) console.table(after.problems);
  console.groupEnd();

  if (after.problems.length) {
    throw new Error(`Ainda existem ${after.problems.length} problema(s) de label. Veja tabela [depois].`);
  }

  console.log("Feito: labels corrigidos e metadata lida de volta com sucesso. Exporte a solucao e rode find-solution-missing-option-labels.ps1 no ZIP novo.");
})();
