/**
 * Cole no console do Model-driven App.
 *
 * Diagnostica lock/staged metadata:
 * - lista solucoes AppBetinhos/Upgrade/Holding;
 * - lista import jobs recentes;
 * - lista async operations recentes de import/export/publish.
 *
 * Nao altera nada.
 */
(async () => {
  const TARGET = "AppBetinhos";

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

  const apiUrl = `${xrm.Utility.getGlobalContext().getClientUrl().replace(/\/$/, "")}/api/data/v9.2`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
    Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
  };

  async function request(path) {
    const response = await fetch(`${apiUrl}/${path.replace(/^\//, "")}`, {
      credentials: "same-origin",
      headers
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${data?.error?.message || text}`);
    }
    return data;
  }

  function fmt(row, name) {
    return row[`${name}@OData.Community.Display.V1.FormattedValue`] ?? row[name] ?? "";
  }

  console.log(`[diagnostico] Ambiente: ${apiUrl.replace("/api/data/v9.2", "")}`);

  const solutionFilter = [
    "contains(friendlyname,'AppBetinhos')",
    "contains(uniquename,'AppBetinhos')",
    "contains(uniquename,'Upgrade')",
    "contains(uniquename,'Holding')"
  ].join(" or ");

  const solutions = await request(
    "solutions?$select=solutionid,uniquename,friendlyname,version,ismanaged,installedon,modifiedon" +
      `&$filter=${solutionFilter}` +
      "&$orderby=modifiedon desc"
  );

  console.group("[solutions suspeitas]");
  console.table((solutions.value ?? []).map((item) => ({
    solutionid: item.solutionid,
    uniquename: item.uniquename,
    friendlyname: item.friendlyname,
    version: item.version,
    ismanaged: item.ismanaged,
    installedon: item.installedon,
    modifiedon: item.modifiedon
  })));
  console.groupEnd();

  const importJobs = await request(
    "importjobs?$select=importjobid,solutionname,progress,startedon,completedon,createdon,modifiedon,data" +
      "&$orderby=createdon desc&$top=15"
  );

  console.group("[importjobs recentes]");
  console.table((importJobs.value ?? []).map((item) => ({
    importjobid: item.importjobid,
    solutionname: item.solutionname,
    progress: item.progress,
    startedon: item.startedon,
    completedon: item.completedon,
    createdon: item.createdon,
    modifiedon: item.modifiedon,
    hasData: Boolean(item.data)
  })));
  console.groupEnd();

  const asyncOps = await request(
    "asyncoperations?$select=asyncoperationid,name,operationtype,statuscode,statecode,createdon,startedon,completedon,message" +
      "&$orderby=createdon desc&$top=30"
  );

  const interesting = (asyncOps.value ?? []).filter((item) => {
    const text = `${item.name ?? ""} ${item.message ?? ""}`.toLowerCase();
    return text.includes("solution") ||
      text.includes("import") ||
      text.includes("export") ||
      text.includes("publish") ||
      text.includes(TARGET.toLowerCase());
  });

  console.group("[asyncoperations suspeitas]");
  console.table(interesting.map((item) => ({
    asyncoperationid: item.asyncoperationid,
    name: item.name,
    operationtype: fmt(item, "operationtype"),
    statecode: fmt(item, "statecode"),
    statuscode: fmt(item, "statuscode"),
    createdon: item.createdon,
    startedon: item.startedon,
    completedon: item.completedon,
    message: item.message
  })));
  console.groupEnd();

  console.warn("Se houver solucao *_Upgrade/Holding ou importjob/asyncoperation preso, limpe pelo Maker/Admin Center antes de exportar de novo.");
})();
