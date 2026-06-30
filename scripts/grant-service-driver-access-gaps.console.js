/**
 * Cole no console do Model-driven App, no ambiente alvo.
 *
 * ALTERA DADOS: concede compartilhamento direto do servico e relacionados
 * para o motorista designado.
 *
 * Filtro:
 * - servicos de 45 dias para tras ate 10.000.000 dias para frente;
 * - com motorista designado;
 * - motorista com `cr40f_emailmicrosoft`;
 * - systemuser ativo encontrado pelo mesmo email;
 * - sem compartilhamento direto de leitura no servico ou relacionado.
 *
 * Resultado completo:
 * - window.ServiceDriverAccessGrantLastResult
 */
(async () => {
  const DRY_RUN = true;
  const PAGE_SIZE = 5000;
  const DAYS_BACK = 45;
  const DAYS_FORWARD = 10000000;
  const DATAVERSE_MAX_DATE = "9999-12-31T23:59:59Z";
  const ONLY_PROGRAMMED = true;
  const EXCLUDE_EXCHANGE_GERAL = true;
  const INCLUDED_CATEGORIES = [100000000, 100000001]; // servico, manutencao
  const ACTION_LOG_LIMIT = 500;

  const SERVICE_ENTITY_SET = "cr40f_reservadeveculoses";
  const SERVICE_PASSENGER_ENTITY_SET = "cr40f_servicosporpassageiros";
  const EMPLOYEE_ENTITY_SET = "cr40f_funcionarioses";
  const USER_ENTITY_SET = "systemusers";

  const SERVICE_LOGICAL_NAME = "cr40f_reservadeveculos";
  const SERVICE_PASSENGER_LOGICAL_NAME = "cr40f_servicosporpassageiro";
  const MAINTENANCE_LOGICAL_NAME = "cr40f_manutencoes";
  const PASSENGER_LOGICAL_NAME = "cr40f_bancodedados";
  const USER_LOGICAL_NAME = "systemuser";
  const POA_LOGICAL_NAME = "principalobjectaccess";

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
  const RELATED_FULL_RIGHTS = SERVICE_RIGHTS;
  const READ_RIGHTS = "ReadAccess";
  const READ_ACCESS_MASK = 1;

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
  const poaCache = new Map();
  const entitySetCache = new Map();
  const servicePassengersCache = new Map();
  const processedAccess = new Set();
  const actions = [];
  const issues = [];

  const summary = {
    environment: baseUrl,
    dryRun: DRY_RUN,
    daysBack: DAYS_BACK,
    daysForward: DAYS_FORWARD,
    endDateUsed: "",
    scannedServices: 0,
    scannedTargets: 0,
    resolvedDrivers: 0,
    alreadyHadReadAccess: 0,
    dryRunGrantOrModify: 0,
    granted: 0,
    modified: 0,
    skippedDuplicateAccess: 0,
    skippedNoDriver: 0,
    skippedNoEmail: 0,
    skippedNoUser: 0,
    skippedDuplicateUser: 0,
    errors: 0
  };

  function log(...args) {
    console.log("[service-driver-access-grant]", ...args);
  }

  function cleanGuid(value) {
    return String(value || "").replace(/[{}]/g, "").trim().toLowerCase();
  }

  function escapeODataText(value) {
    return String(value || "").replace(/'/g, "''");
  }

  function escapeXml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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
      serviceBusinessId: service?.cr40f_id || "",
      serviceDate: service?.cr40f_dataehorriodesada || "",
      driverEmployeeId: cleanGuid(service?._cr40f_motorista_value),
      ...extra
    });
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

  async function getEntitySetName(logicalName) {
    const key = String(logicalName || "").trim().toLowerCase();
    if (entitySetCache.has(key)) return entitySetCache.get(key);
    const meta = await request("GET", `/EntityDefinitions(LogicalName='${escapeODataText(key)}')?$select=EntitySetName`);
    entitySetCache.set(key, meta.EntitySetName);
    return meta.EntitySetName;
  }

  async function fetchXml(logicalName, fetchXmlText) {
    const entitySetName = await getEntitySetName(logicalName);
    return listAll(`/${entitySetName}?fetchXml=${encodeURIComponent(fetchXmlText)}`);
  }

  function getDateFilterEnd(now) {
    const maxDate = new Date(DATAVERSE_MAX_DATE);
    const desired = new Date(now.getTime() + DAYS_FORWARD * 24 * 60 * 60 * 1000);
    if (Number.isNaN(desired.getTime()) || desired.getTime() > maxDate.getTime()) {
      return DATAVERSE_MAX_DATE;
    }
    return desired.toISOString();
  }

  function buildServiceFilter() {
    const now = new Date();
    const start = new Date(now.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString();
    const end = getDateFilterEnd(now);
    summary.endDateUsed = end;

    const filters = [
      "_cr40f_motorista_value ne null",
      `cr40f_dataehorriodesada ge ${start}`,
      `cr40f_dataehorriodesada le ${end}`
    ];
    if (ONLY_PROGRAMMED) filters.push("new_foiprogramado eq true");
    if (EXCLUDE_EXCHANGE_GERAL) filters.push("_cr40f_ot_value eq null");
    if (INCLUDED_CATEGORIES.length) {
      filters.push(`(${INCLUDED_CATEGORIES.map((value) => `new_categoriadoitem eq ${value}`).join(" or ")})`);
    }
    return filters.join(" and ");
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
      const result = { ok: false, reason: "no_email", employeeId: key, employeeName, email, fallbackEmail };
      employeeCache.set(key, result);
      return result;
    }

    if (userByEmailCache.has(email)) {
      const cached = userByEmailCache.get(email);
      const result = { ...cached, employeeId: key, employeeName, email, fallbackEmail };
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

    userByEmailCache.set(email, userResult);
    const result = { ...userResult, employeeId: key, employeeName, fallbackEmail };
    employeeCache.set(key, result);
    return result;
  }

  async function hasDirectReadAccess(targetLogicalName, targetId, userId) {
    const key = `${targetLogicalName}:${cleanGuid(targetId)}:${cleanGuid(userId)}`;
    if (poaCache.has(key)) return poaCache.get(key);

    const fetch = [
      "<fetch version=\"1.0\" mapping=\"logical\">",
      `<entity name="${POA_LOGICAL_NAME}">`,
      "<attribute name=\"accessrightsmask\" />",
      "<attribute name=\"principalid\" />",
      "<attribute name=\"objectid\" />",
      "<filter type=\"and\">",
      `<condition attribute="objectid" operator="eq" value="${escapeXml(targetId)}" />`,
      `<condition attribute="principalid" operator="eq" value="${escapeXml(userId)}" />`,
      "</filter>",
      "</entity>",
      "</fetch>"
    ].join("");

    const rows = await fetchXml(POA_LOGICAL_NAME, fetch);
    const hasRead = rows.some((row) => (Number(row.accessrightsmask || 0) & READ_ACCESS_MASK) === READ_ACCESS_MASK);
    poaCache.set(key, hasRead);
    return hasRead;
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

  async function buildTargetsForService(service) {
    const serviceId = cleanGuid(service[SERVICE_ID]);
    const serviceLabel = service.cr40f_id || serviceId;
    const targets = [{
      targetKind: "servico",
      targetLogicalName: SERVICE_LOGICAL_NAME,
      targetPrimaryIdName: SERVICE_ID,
      targetId: serviceId,
      rights: SERVICE_RIGHTS,
      source: `servico ${serviceLabel}`
    }];

    const maintenanceId = cleanGuid(service._cr40f_om_value);
    if (maintenanceId) {
      targets.push({
        targetKind: "manutencao",
        targetLogicalName: MAINTENANCE_LOGICAL_NAME,
        targetPrimaryIdName: MAINTENANCE_ID,
        targetId: maintenanceId,
        rights: RELATED_FULL_RIGHTS,
        source: `manutencao vinculada ao servico ${serviceLabel}`
      });
    }

    const requesterId = cleanGuid(service._cr40f_solicitante_value);
    if (requesterId) {
      targets.push({
        targetKind: "solicitante",
        targetLogicalName: PASSENGER_LOGICAL_NAME,
        targetPrimaryIdName: PASSENGER_ID,
        targetId: requesterId,
        rights: READ_RIGHTS,
        source: `solicitante do servico ${serviceLabel}`
      });
    }

    const servicePassengers = await listServicePassengers(serviceId);
    for (const servicePassenger of servicePassengers) {
      const servicePassengerId = cleanGuid(servicePassenger[SERVICE_PASSENGER_ID]);
      const passengerId = cleanGuid(servicePassenger._cr40f_bancodedados_value);
      if (servicePassengerId) {
        targets.push({
          targetKind: "servico_por_passageiro",
          targetLogicalName: SERVICE_PASSENGER_LOGICAL_NAME,
          targetPrimaryIdName: SERVICE_PASSENGER_ID,
          targetId: servicePassengerId,
          rights: READ_RIGHTS,
          source: `servico por passageiro do servico ${serviceLabel}`
        });
      }
      if (passengerId) {
        targets.push({
          targetKind: "passageiro",
          targetLogicalName: PASSENGER_LOGICAL_NAME,
          targetPrimaryIdName: PASSENGER_ID,
          targetId: passengerId,
          rights: READ_RIGHTS,
          source: `passageiro do servico ${serviceLabel}`
        });
      }
    }

    return targets;
  }

  async function ensureAccess(service, target, driver) {
    const serviceId = cleanGuid(service[SERVICE_ID]);
    const key = `${target.targetLogicalName}:${target.targetId}:${driver.userId}:${target.rights}`;
    if (processedAccess.has(key)) {
      summary.skippedDuplicateAccess += 1;
      return;
    }
    processedAccess.add(key);

    const action = {
      serviceId,
      serviceBusinessId: service.cr40f_id || "",
      serviceDate: service.cr40f_dataehorriodesada || "",
      driverEmployeeId: driver.employeeId,
      employeeName: driver.employeeName,
      emailMicrosoft: driver.email,
      userId: driver.userId,
      userName: driver.userName,
      targetKind: target.targetKind,
      targetLogicalName: target.targetLogicalName,
      targetId: target.targetId,
      rights: target.rights,
      source: target.source
    };

    if (DRY_RUN) {
      summary.dryRunGrantOrModify += 1;
      addAction({ operation: "GrantAccess/ModifyAccess", ...action });
      return;
    }

    const payload = {
      Target: buildEntityReference(target.targetLogicalName, target.targetPrimaryIdName, target.targetId),
      PrincipalAccess: buildPrincipalAccess(driver.userId, target.rights)
    };

    try {
      await request("POST", "/GrantAccess", payload);
      summary.granted += 1;
      addAction({ operation: "GrantAccess", ...action });
    } catch (grantError) {
      try {
        await request("POST", "/ModifyAccess", payload);
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

  for (const service of services) {
    summary.scannedServices += 1;
    const serviceId = cleanGuid(service[SERVICE_ID]);
    const driverEmployeeId = cleanGuid(service._cr40f_motorista_value);
    const driver = await resolveEmployeeUser(driverEmployeeId, service);

    if (!driver.ok) {
      if (driver.reason === "no_driver") summary.skippedNoDriver += 1;
      if (driver.reason === "no_email") summary.skippedNoEmail += 1;
      if (driver.reason === "no_user") summary.skippedNoUser += 1;
      if (driver.reason === "duplicate_user") summary.skippedDuplicateUser += 1;
      pushIssue(driver.reason, service, {
        employeeName: driver.employeeName || "",
        emailMicrosoft: driver.email || "",
        emailBetinhos: driver.fallbackEmail || "",
        userCount: driver.count || 0
      });
      continue;
    }

    summary.resolvedDrivers += 1;
    let targets = [];
    try {
      targets = await buildTargetsForService(service);
    } catch (error) {
      summary.errors += 1;
      pushIssue("related_query_error", service, {
        employeeName: driver.employeeName || "",
        emailMicrosoft: driver.email || "",
        userId: driver.userId,
        error: error?.message || String(error)
      });
      continue;
    }

    for (const target of targets) {
      summary.scannedTargets += 1;
      let hasAccess = false;
      try {
        hasAccess = await hasDirectReadAccess(target.targetLogicalName, target.targetId, driver.userId);
      } catch (error) {
        summary.errors += 1;
        pushIssue("poa_query_error", service, {
          employeeName: driver.employeeName || "",
          emailMicrosoft: driver.email || "",
          userId: driver.userId,
          targetKind: target.targetKind,
          targetLogicalName: target.targetLogicalName,
          targetId: target.targetId,
          error: error?.message || String(error)
        });
        continue;
      }

      if (hasAccess) {
        summary.alreadyHadReadAccess += 1;
        continue;
      }

      await ensureAccess(service, target, driver);
    }
  }

  const result = { summary, actions, issues };
  window.ServiceDriverAccessGrantLastResult = result;

  log(`Ambiente: ${baseUrl}`);
  console.table(summary);
  if (actions.length) console.table(actions);
  if (issues.length) console.table(issues.slice(0, ACTION_LOG_LIMIT));
  log("Resultado completo em window.ServiceDriverAccessGrantLastResult");
})();
