/**
 * Cole no console do Model-driven App, no ambiente alvo.
 *
 * Objetivo:
 * - liberar acesso de servicos ja existentes para o motorista designado;
 * - cobrir servico, manutencao vinculada, servicos por passageiro, passageiros e solicitante;
 * - usar os mesmos direitos principais do plugin Betinhos.DriverRecordSharing.
 *
 * Uso:
 * 1. rode primeiro com DRY_RUN = true;
 * 2. corrija problemas de email/systemuser apontados no resumo;
 * 3. mude DRY_RUN = false e rode de novo;
 * 4. valide com scripts/audit-driver-record-sharing-plugin.console.js.
 */
(async () => {
  const DRY_RUN = true;
  const PAGE_SIZE = 5000;
  const ACTION_LOG_LIMIT = 300;

  // FUTURE_PLUS_HISTORY cobre:
  // - todos os servicos futuros ja designados;
  // - historico ate 45 dias para nao quebrar historico de terceiros.
  // Troque para ALL_ASSIGNED se quiser processar todo historico com motorista.
  const SCOPE = "FUTURE_PLUS_HISTORY"; // FUTURE_PLUS_HISTORY | APP_WINDOW | ALL_ASSIGNED
  const DAYS_BACK = 45;
  const DAYS_FORWARD = 3;
  const ONLY_PROGRAMMED = true;
  const EXCLUDE_EXCHANGE_GERAL = true;
  const INCLUDED_CATEGORIES = [100000000, 100000001]; // servico, manutencao
  const EXTRA_SERVICE_FILTER = "";

  const SERVICE_ENTITY_SET = "cr40f_reservadeveculoses";
  const SERVICE_PASSENGER_ENTITY_SET = "cr40f_servicosporpassageiros";
  const EMPLOYEE_ENTITY_SET = "cr40f_funcionarioses";
  const USER_ENTITY_SET = "systemusers";

  const SERVICE_LOGICAL_NAME = "cr40f_reservadeveculos";
  const SERVICE_PASSENGER_LOGICAL_NAME = "cr40f_servicosporpassageiro";
  const MAINTENANCE_LOGICAL_NAME = "cr40f_manutencoes";
  const PASSENGER_LOGICAL_NAME = "cr40f_bancodedados";
  const USER_LOGICAL_NAME = "systemuser";

  const SERVICE_ID = "cr40f_reservadeveculosid";
  const SERVICE_PASSENGER_ID = "cr40f_servicosporpassageiroid";
  const MAINTENANCE_ID = "cr40f_manutencoesid";
  const PASSENGER_ID = "cr40f_bancodedadosid";
  const EMPLOYEE_ID = "cr40f_funcionariosid";
  const USER_ID = "systemuserid";

  const EMPLOYEE_NAME = "cr40f_nomecompleto";
  const EMPLOYEE_EMAIL = "cr40f_emailmicrosoft";
  const EMPLOYEE_FALLBACK_EMAIL = "cr40f_emailbetinhos";
  const USER_NAME = "fullname";
  const USER_EMAIL = "internalemailaddress";

  const SERVICE_RIGHTS = "ReadAccess, WriteAccess, AppendAccess, AppendToAccess";
  const RELATED_RIGHTS = SERVICE_RIGHTS;
  const READ_RIGHTS = "ReadAccess";

  if (!window.Xrm?.Utility?.getGlobalContext) {
    throw new Error("Xrm.Utility nao encontrado. Abra este script dentro do model-driven app.");
  }

  const ctx = Xrm.Utility.getGlobalContext();
  const baseUrl = ctx.getClientUrl().replace(/\/$/, "");
  const webApi = `${baseUrl}/api/data/v9.2`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
    Prefer: `odata.include-annotations="OData.Community.Display.V1.FormattedValue",odata.maxpagesize=${PAGE_SIZE}`
  };

  const employeeCache = new Map();
  const userByEmailCache = new Map();
  const processedAccess = new Set();
  const servicePassengersCache = new Map();
  const issues = [];
  const actions = [];
  const summary = {
    environment: baseUrl,
    dryRun: DRY_RUN,
    scope: SCOPE,
    scannedServices: 0,
    scannedServicePassengers: 0,
    resolvedDrivers: 0,
    dryRunAccess: 0,
    granted: 0,
    modified: 0,
    skippedDuplicateAccess: 0,
    skippedNoDriver: 0,
    skippedNoEmail: 0,
    skippedNoEmailButHasEmailBetinhos: 0,
    skippedNoUser: 0,
    skippedDuplicateUser: 0,
    errors: 0
  };

  function log(...args) {
    console.log("[driver-sharing-backfill]", ...args);
  }

  function cleanGuid(value) {
    return String(value || "").replace(/[{}]/g, "").trim().toLowerCase();
  }

  function escapeODataText(value) {
    return String(value || "").replace(/'/g, "''");
  }

  function isAbsoluteUrl(value) {
    return /^https?:\/\//i.test(value || "");
  }

  function addAction(action) {
    if (actions.length < ACTION_LOG_LIMIT) actions.push(action);
  }

  function pushIssue(kind, service, extra = {}) {
    issues.push({
      kind,
      serviceId: cleanGuid(service?.[SERVICE_ID]),
      serviceBusinessId: String(service?.cr40f_id || "").trim(),
      serviceDate: service?.cr40f_dataehorriodesada || "",
      driverEmployeeId: cleanGuid(service?._cr40f_motorista_value),
      ...extra
    });
  }

  function buildIssueSummaryByDriver() {
    const map = new Map();
    for (const issue of issues) {
      const key = [
        issue.kind || "",
        issue.driverEmployeeId || "",
        issue.employeeName || "",
        issue.email || "",
        issue.fallbackEmail || ""
      ].join("|");
      const current = map.get(key) || {
        kind: issue.kind || "",
        driverEmployeeId: issue.driverEmployeeId || "",
        employeeName: issue.employeeName || "",
        emailMicrosoft: issue.email || "",
        emailBetinhos: issue.fallbackEmail || "",
        userCount: issue.userCount || 0,
        services: 0,
        examples: []
      };
      current.services += 1;
      if (current.examples.length < 5 && issue.serviceBusinessId) {
        current.examples.push(issue.serviceBusinessId);
      }
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => b.services - a.services);
  }

  async function request(method, pathOrUrl, body) {
    const url = isAbsoluteUrl(pathOrUrl) ? pathOrUrl : `${webApi}${pathOrUrl}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin"
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${method} ${url}\n${response.status} ${response.statusText}\n${text}`);
    }

    return text ? JSON.parse(text) : null;
  }

  async function listAll(path) {
    const rows = [];
    let nextUrl = `${webApi}${path}`;
    while (nextUrl) {
      const page = await request("GET", nextUrl);
      rows.push(...(page?.value ?? []));
      nextUrl = page?.["@odata.nextLink"] ?? null;
    }
    return rows;
  }

  function buildEntityReference(logicalName, primaryIdName, id) {
    return {
      "@odata.type": `Microsoft.Dynamics.CRM.${logicalName}`,
      [primaryIdName]: cleanGuid(id)
    };
  }

  function buildPrincipalAccess(userId, rightsText) {
    return {
      AccessMask: rightsText,
      Principal: buildEntityReference(USER_LOGICAL_NAME, USER_ID, userId)
    };
  }

  async function executeOrganizationAction(operationName, payload) {
    return request("POST", `/${operationName}`, payload);
  }

  async function resolveEmployeeUser(employeeId, service) {
    const key = cleanGuid(employeeId);
    if (!key) return { ok: false, reason: "no_driver" };
    if (employeeCache.has(key)) return employeeCache.get(key);

    const employee = await request(
      "GET",
      `/${EMPLOYEE_ENTITY_SET}(${key})?$select=${EMPLOYEE_ID},${EMPLOYEE_NAME},${EMPLOYEE_EMAIL},${EMPLOYEE_FALLBACK_EMAIL}`
    );

    const employeeName = String(employee?.[EMPLOYEE_NAME] || key).trim();
    const email = String(employee?.[EMPLOYEE_EMAIL] || "").trim().toLowerCase();
    const fallbackEmail = String(employee?.[EMPLOYEE_FALLBACK_EMAIL] || "").trim().toLowerCase();
    if (!email) {
      const result = {
        ok: false,
        reason: "no_email",
        employeeId: key,
        employeeName,
        fallbackEmail,
        hasFallbackEmail: Boolean(fallbackEmail)
      };
      employeeCache.set(key, result);
      return result;
    }

    if (userByEmailCache.has(email)) {
      const cached = userByEmailCache.get(email);
      const result = { ...cached, employeeId: key, employeeName, email };
      employeeCache.set(key, result);
      return result;
    }

    const users = await listAll(
      `/${USER_ENTITY_SET}?$select=${USER_ID},${USER_NAME},${USER_EMAIL}&$filter=isdisabled eq false and ${USER_EMAIL} eq '${escapeODataText(email)}'`
    );

    let userResult;
    if (users.length === 0) {
      userResult = { ok: false, reason: "no_user", email };
    } else if (users.length > 1) {
      userResult = { ok: false, reason: "duplicate_user", email, count: users.length };
    } else {
      userResult = {
        ok: true,
        email,
        userId: cleanGuid(users[0][USER_ID]),
        userName: String(users[0][USER_NAME] || users[0][USER_ID]).trim()
      };
    }

    if (!userResult.ok) pushIssue(userResult.reason, service, { employeeName, email, userCount: userResult.count || 0 });
    userByEmailCache.set(email, userResult);

    const result = { ...userResult, employeeId: key, employeeName, email };
    employeeCache.set(key, result);
    return result;
  }

  async function ensureAccess(target, user, rightsText, source) {
    if (!target.id || !user.userId) return;

    const key = `${target.logicalName}:${target.id}:${user.userId}:${rightsText}`;
    if (processedAccess.has(key)) {
      summary.skippedDuplicateAccess += 1;
      return;
    }
    processedAccess.add(key);

    const action = {
      target: `${target.logicalName}:${target.id}`,
      rights: rightsText,
      userId: user.userId,
      userName: user.userName,
      source
    };

    if (DRY_RUN) {
      summary.dryRunAccess += 1;
      addAction({ operation: "GrantAccess/ModifyAccess", ...action });
      return;
    }

    const payload = {
      Target: buildEntityReference(target.logicalName, target.primaryIdName, target.id),
      PrincipalAccess: buildPrincipalAccess(user.userId, rightsText)
    };

    try {
      await executeOrganizationAction("GrantAccess", payload);
      summary.granted += 1;
      addAction({ operation: "GrantAccess", ...action });
    } catch (grantError) {
      try {
        await executeOrganizationAction("ModifyAccess", payload);
        summary.modified += 1;
        addAction({ operation: "ModifyAccess", ...action });
      } catch (modifyError) {
        summary.errors += 1;
        issues.push({
          kind: "access_error",
          ...action,
          grantError: grantError?.message || String(grantError),
          modifyError: modifyError?.message || String(modifyError)
        });
      }
    }
  }

  async function listServicePassengers(serviceId) {
    const key = cleanGuid(serviceId);
    if (servicePassengersCache.has(key)) return servicePassengersCache.get(key);

    const rows = await listAll(
      `/${SERVICE_PASSENGER_ENTITY_SET}?$select=${SERVICE_PASSENGER_ID},_cr40f_geral_value,_cr40f_bancodedados_value&$filter=_cr40f_geral_value eq ${key}`
    );
    servicePassengersCache.set(key, rows);
    return rows;
  }

  function buildServiceFilter() {
    const filters = ["_cr40f_motorista_value ne null"];
    if (ONLY_PROGRAMMED) filters.push("new_foiprogramado eq true");
    if (EXCLUDE_EXCHANGE_GERAL) filters.push("_cr40f_ot_value eq null");
    if (INCLUDED_CATEGORIES.length) {
      filters.push(`(${INCLUDED_CATEGORIES.map((value) => `new_categoriadoitem eq ${value}`).join(" or ")})`);
    }
    if (SCOPE === "FUTURE_PLUS_HISTORY") {
      const now = new Date();
      const start = new Date(now.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString();
      filters.push(`cr40f_dataehorriodesada ge ${start}`);
    }
    if (SCOPE === "APP_WINDOW") {
      const now = new Date();
      const start = new Date(now.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString();
      const end = new Date(now.getTime() + DAYS_FORWARD * 24 * 60 * 60 * 1000).toISOString();
      filters.push(`cr40f_dataehorriodesada ge ${start}`);
      filters.push(`cr40f_dataehorriodesada le ${end}`);
    }
    if (EXTRA_SERVICE_FILTER.trim()) filters.push(`(${EXTRA_SERVICE_FILTER.trim()})`);
    return filters.join(" and ");
  }

  const serviceSelect = [
    SERVICE_ID,
    "cr40f_id",
    "cr40f_dataehorriodesada",
    "cr40f_status",
    "new_categoriadoitem",
    "new_foiprogramado",
    "_cr40f_motorista_value",
    "_cr40f_om_value",
    "_cr40f_solicitante_value",
    "_cr40f_ot_value"
  ].join(",");

  const services = await listAll(
    `/${SERVICE_ENTITY_SET}?$select=${serviceSelect}&$filter=${encodeURIComponent(buildServiceFilter())}&$orderby=cr40f_dataehorriodesada asc`
  );

  log(`Ambiente: ${baseUrl}`);
  log(`Servicos encontrados: ${services.length}. DRY_RUN=${DRY_RUN}. SCOPE=${SCOPE}`);

  for (const service of services) {
    summary.scannedServices += 1;
    const serviceId = cleanGuid(service[SERVICE_ID]);
    const driverEmployeeId = cleanGuid(service._cr40f_motorista_value);

    if (!driverEmployeeId) {
      summary.skippedNoDriver += 1;
      pushIssue("no_driver", service);
      continue;
    }

    let user;
    try {
      user = await resolveEmployeeUser(driverEmployeeId, service);
    } catch (error) {
      summary.errors += 1;
      pushIssue("driver_resolution_error", service, { error: error?.message || String(error) });
      continue;
    }

    if (!user.ok) {
      if (user.reason === "no_email") summary.skippedNoEmail += 1;
      if (user.reason === "no_email" && user.hasFallbackEmail) summary.skippedNoEmailButHasEmailBetinhos += 1;
      if (user.reason === "no_user") summary.skippedNoUser += 1;
      if (user.reason === "duplicate_user") summary.skippedDuplicateUser += 1;
      if (user.reason !== "no_user" && user.reason !== "duplicate_user") {
        pushIssue(user.reason, service, {
          employeeName: user.employeeName || "",
          email: user.email || "",
          fallbackEmail: user.fallbackEmail || "",
          userCount: user.count || 0
        });
      }
      continue;
    }

    summary.resolvedDrivers += 1;

    await ensureAccess(
      { logicalName: SERVICE_LOGICAL_NAME, primaryIdName: SERVICE_ID, id: serviceId },
      user,
      SERVICE_RIGHTS,
      `servico ${service.cr40f_id || serviceId}`
    );

    const maintenanceId = cleanGuid(service._cr40f_om_value);
    if (maintenanceId) {
      await ensureAccess(
        { logicalName: MAINTENANCE_LOGICAL_NAME, primaryIdName: MAINTENANCE_ID, id: maintenanceId },
        user,
        RELATED_RIGHTS,
        `manutencao vinculada ao servico ${service.cr40f_id || serviceId}`
      );
    }

    const requesterId = cleanGuid(service._cr40f_solicitante_value);
    if (requesterId) {
      await ensureAccess(
        { logicalName: PASSENGER_LOGICAL_NAME, primaryIdName: PASSENGER_ID, id: requesterId },
        user,
        READ_RIGHTS,
        `solicitante do servico ${service.cr40f_id || serviceId}`
      );
    }

    let servicePassengers = [];
    try {
      servicePassengers = await listServicePassengers(serviceId);
    } catch (error) {
      summary.errors += 1;
      pushIssue("service_passenger_query_error", service, { error: error?.message || String(error) });
      continue;
    }

    summary.scannedServicePassengers += servicePassengers.length;
    for (const servicePassenger of servicePassengers) {
      const servicePassengerId = cleanGuid(servicePassenger[SERVICE_PASSENGER_ID]);
      const passengerId = cleanGuid(servicePassenger._cr40f_bancodedados_value);

      if (servicePassengerId) {
        await ensureAccess(
          { logicalName: SERVICE_PASSENGER_LOGICAL_NAME, primaryIdName: SERVICE_PASSENGER_ID, id: servicePassengerId },
          user,
          READ_RIGHTS,
          `passageiro selecionado do servico ${service.cr40f_id || serviceId}`
        );
      }

      if (passengerId) {
        await ensureAccess(
          { logicalName: PASSENGER_LOGICAL_NAME, primaryIdName: PASSENGER_ID, id: passengerId },
          user,
          READ_RIGHTS,
          `cadastro do passageiro do servico ${service.cr40f_id || serviceId}`
        );
      }
    }
  }

  const issueSummaryByDriver = buildIssueSummaryByDriver();
  const result = { summary, issueSummaryByDriver, issues, actionsPreview: actions };
  window.DriverSharingBackfillLastResult = result;
  console.table(summary);
  if (issueSummaryByDriver.length) console.table(issueSummaryByDriver);
  if (issues.length) console.table(issues.slice(0, 200));
  log("Resultado completo em window.DriverSharingBackfillLastResult");
})();
