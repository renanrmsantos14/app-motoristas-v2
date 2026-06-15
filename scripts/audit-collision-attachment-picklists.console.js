/**
 * Cole no console do Model-driven App, no ambiente Dev ou Test.
 *
 * Faz:
 * - le metadata real da tabela cr40f_anexocolisao;
 * - lista todos os campos Picklist/Choice;
 * - mostra valor, labels por idioma, UserLocalizedLabel, se o choice e global;
 * - destaca opcao sem label, label vazia, idioma base faltando.
 */
(async () => {
  const TABLE = "cr40f_anexocolisao";
  const BASE_LANGUAGE = 1046;

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

  const clientUrl = xrm.Utility.getGlobalContext().getClientUrl().replace(/\/$/, "");
  const apiUrl = `${clientUrl}/api/data/v9.2`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0"
  };

  async function request(path) {
    const response = await fetch(`${apiUrl}/${path}`, {
      credentials: "same-origin",
      headers
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message = data?.error?.message || text || response.statusText;
      throw new Error(`${response.status} ${response.statusText}: ${message}`);
    }
    return data;
  }

  const metadata = await request(
    `EntityDefinitions(LogicalName='${TABLE}')/Attributes/Microsoft.Dynamics.CRM.PicklistAttributeMetadata` +
      `?$select=LogicalName,SchemaName&$expand=OptionSet($select=IsGlobal,Name,Options)`
  );

  const attributes = metadata.value ?? [];
  if (!attributes.length) {
    console.warn(`Nenhum campo picklist encontrado em ${TABLE}.`);
    return;
  }

  const rows = [];
  const problems = [];

  for (const attribute of attributes) {
    const optionSet = attribute.OptionSet ?? {};
    const options = optionSet.Options ?? [];
    for (const option of options) {
      const localizedLabels = Array.isArray(option.Label?.LocalizedLabels) ? option.Label.LocalizedLabels : [];
      const userLocalizedLabel = option.Label?.UserLocalizedLabel?.Label ?? "";
      const baseLabel = localizedLabels.find((item) => Number(item.LanguageCode) === BASE_LANGUAGE)?.Label ?? "";
      const allLabels = localizedLabels
        .map((item) => `${item.LanguageCode}:${String(item.Label ?? "").trim()}`)
        .join(" | ");

      const issueList = [];
      if (!localizedLabels.length) issueList.push("sem LocalizedLabels");
      if (!baseLabel.trim()) issueList.push(`sem label ${BASE_LANGUAGE}`);
      if (!userLocalizedLabel.trim()) issueList.push("sem UserLocalizedLabel");
      if (localizedLabels.some((item) => !String(item.Label ?? "").trim())) issueList.push("label vazia");

      const row = {
        field: attribute.LogicalName,
        schema: attribute.SchemaName,
        global: Boolean(optionSet.IsGlobal),
        globalName: optionSet.Name ?? "",
        value: option.Value,
        base1046: baseLabel,
        userLabel: userLocalizedLabel,
        labels: allLabels,
        issues: issueList.join("; ")
      };

      rows.push(row);
      if (issueList.length) problems.push(row);
    }
  }

  console.table(rows);

  if (problems.length) {
    console.warn("Problemas encontrados:");
    console.table(problems);
  } else {
    console.log(`Nenhum problema de label encontrado em ${TABLE}.`);
  }

  return { table: TABLE, totalOptions: rows.length, problems };
})();
