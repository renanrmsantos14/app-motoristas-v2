/**
 * Cole no console do Model-driven App, no ambiente alvo.
 *
 * Objetivo:
 * - varrer servicos ja existentes com motorista e manutencao vinculada;
 * - resolver o systemuser pelo email Microsoft do funcionario;
 * - compartilhar a manutencao com o mesmo conjunto minimo de direitos do plugin.
 *
 * Modo de uso:
 * - deixe DRY_RUN = true para simular;
 * - mude para DRY_RUN = false para aplicar.
 */
(async () => {
  const DRY_RUN = true;
  const PAGE_SIZE = 5000;

  const SERVICE_ENTITY_SET = "cr40f_reservadeveculoses";
  const EMPLOYEE_ENTITY_SET = "cr40f_funcionarioses";
  const USER_ENTITY_SET = "systemusers";

  const SERVICE_LOGICAL_NAME = "cr40f_reservadeveculos";
  const MAINTENANCE_LOGICAL_NAME = "cr40f_manutencoes";
  const USER_LOGICAL_NAME = "systemuser";

  const SERVICE_ID = "cr40f_reservadeveculosid";
  const MAINTENANCE_ID = "cr40f_manutencoesid";
  const EMPLOYEE_ID = "cr40f_funcionariosid";
  const USER_ID = "systemuserid";

  const EMPLOYEE_NAME = "cr40f_nomecompleto";
  const EMPLOYEE_EMAIL = "cr40f_emailmicrosoft";
  const USER_NAME = "fullname";
  const USER_EMAIL = "internalemailaddress";

  const REQUIRED_RIGHTS = ["ReadAccess", "WriteAccess", "AppendAccess", "AppendToAccess"];

  const api = Xrm?.WebApi?.online || Xrm?.WebApi;
  if (!api) throw new Error("Xrm.WebApi nao encontrado. Abra dentro do model-driven app.");

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
  const processedPairs = new Set();

  const summary = {
    scannedServices: 0,
    uniquePairs: 0,
    granted: 0,
    modified: 0,
    alreadyOk: 0,
    dryRunGrant: 0,
    dryRunModify: 0,
    skippedNoEmail: 0,
    skippedNoUser: 0,
    skippedDuplicateUser: 0,
    skippedDuplicatePair: 0,
    errors: 0
  };

  const issues = [];
  const actions = [];

  function log(...args) {
    console.log("[maintenance-backfill]", ...args);
  }

  function trimGuid(value) {
    return String(value || "").replace(/[{}]/g, "").toLowerCase();
  }

  function escapeODataText(value) {
    return String(value || "").replace(/'/g, "''");
  }

  function isAbsoluteUrl(value) {
    return /^https?:\/\//i.test(value || "");
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
      [primaryIdName]: trimGuid(id)
    };
  }

  function buildPrincipalAccess(userId, rightsText) {
    return {
      AccessMask: rightsText,
      Principal: buildEntityReference(USER_LOGICAL_NAME, USER_ID, userId)
    };
  }

  async function executeOrganizationAction(operationName, payload, parameterTypes) {
    const requestPayload = {
      ...payload,
      getMetadata: () => ({
        boundParameter: null,
        parameterTypes,
        operationType: 0,
        operationName
      })
    };

    const response = await api.execute(requestPayload);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${operationName}\n${response.status} ${response.statusText}\n${text}`);
    }
    return text ? JSON.parse(text) : null;
  }

  function requiredRightsText() {
    return REQUIRED_RIGHTS.join(", ");
  }

  async function resolveEmployee(employeeId) {
    const key = trimGuid(employeeId);
    if (!key) return { ok: false, reason: "employee_missing" };
    if (employeeCache.has(key)) return employeeCache.get(key);

    const employee = await request(
      "GET",
      `/${EMPLOYEE_ENTITY_SET}(${key})?$select=${EMPLOYEE_ID},${EMPLOYEE_NAME},${EMPLOYEE_EMAIL}`
    );

    const employeeName = String(employee?.[EMPLOYEE_NAME] || key).trim();
    const email = String(employee?.[EMPLOYEE_EMAIL] || "").trim().toLowerCase();

    if (!email) {
      const result = { ok: false, reason: "no_email", employeeId: key, employeeName };
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
        userId: trimGuid(users[0][USER_ID]),
        userName: String(users[0][USER_NAME] || users[0][USER_ID]).trim()
      };
    }

    userByEmailCache.set(email, userResult);
    const result = { ...userResult, employeeId: key, employeeName, email };
    employeeCache.set(key, result);
    return result;
  }

  async function ensureMaintenanceAccess(maintenanceId, userId) {
    const payload = {
      Target: buildEntityReference(MAINTENANCE_LOGICAL_NAME, MAINTENANCE_ID, maintenanceId),
      PrincipalAccess: buildPrincipalAccess(userId, requiredRightsText())
    };

    if (DRY_RUN) {
      return "grant_or_modify";
    }

    try {
      await executeOrganizationAction("GrantAccess", payload, {
        Target: { typeName: "mscrm.crmbaseentity", structuralProperty: 5 },
        PrincipalAccess: { typeName: "mscrm.PrincipalAccess", structuralProperty: 2 }
      });
      return "grant";
    } catch (grantError) {
      try {
        await executeOrganizationAction("ModifyAccess", payload, {
          Target: { typeName: "mscrm.crmbaseentity", structuralProperty: 5 },
          PrincipalAccess: { typeName: "mscrm.PrincipalAccess", structuralProperty: 2 }
        });
        return "modify";
      } catch (modifyError) {
        throw new Error(
          [
            "GrantAccess falhou e ModifyAccess tambem falhou.",
            `GrantAccess: ${grantError?.message || String(grantError)}`,
            `ModifyAccess: ${modifyError?.message || String(modifyError)}`
          ].join("\n")
        );
      }
    }
  }

  function pushIssue(kind, service, extra) {
    issues.push({
      kind,
      serviceId: service[SERVICE_ID],
      serviceBusinessId: service.cr40f_id || "",
      employeeId: trimGuid(service._cr40f_motorista_value),
      maintenanceId: trimGuid(service._cr40f_om_value),
      ...extra
    });
  }

  const services = await listAll(
    `/${SERVICE_ENTITY_SET}?$select=${SERVICE_ID},cr40f_id,_cr40f_motorista_value,_cr40f_om_value&$filter=_cr40f_motorista_value ne null and _cr40f_om_value ne null`
  );

  log(`Servicos encontrados: ${services.length}. DRY_RUN=${DRY_RUN}`);

  for (const service of services) {
    summary.scannedServices += 1;

    const serviceId = trimGuid(service[SERVICE_ID]);
    const serviceBusinessId = String(service.cr40f_id || serviceId).trim();
    const employeeId = trimGuid(service._cr40f_motorista_value);
    const maintenanceId = trimGuid(service._cr40f_om_value);

    if (!employeeId || !maintenanceId) continue;

    try {
      const resolved = await resolveEmployee(employeeId);
      if (!resolved.ok) {
        if (resolved.reason === "no_email") summary.skippedNoEmail += 1;
        if (resolved.reason === "no_user") summary.skippedNoUser += 1;
        if (resolved.reason === "duplicate_user") summary.skippedDuplicateUser += 1;
        pushIssue(resolved.reason, service, {
          employeeName: resolved.employeeName || "",
          email: resolved.email || "",
          userCount: resolved.count || 0
        });
        continue;
      }

      const pairKey = `${maintenanceId}:${resolved.userId}`;
      if (processedPairs.has(pairKey)) {
        summary.skippedDuplicatePair += 1;
        continue;
      }
      processedPairs.add(pairKey);
      summary.uniquePairs += 1;

      const action = await ensureMaintenanceAccess(maintenanceId, resolved.userId);
      actions.push({
        action,
        serviceBusinessId,
        serviceId,
        maintenanceId,
        employeeName: resolved.employeeName,
        email: resolved.email,
        userName: resolved.userName,
        userId: resolved.userId,
        dryRun: DRY_RUN
      });

      if (DRY_RUN) {
        summary.dryRunGrant += 1;
      } else {
        if (action === "grant") summary.granted += 1;
        else summary.modified += 1;
      }
    } catch (error) {
      summary.errors += 1;
      pushIssue("error", service, {
        message: error?.message || String(error),
        serviceBusinessId
      });
    }
  }

  console.table([summary]);
  if (actions.length) {
    console.log("Acoes:");
    console.table(actions.slice(0, 50));
    if (actions.length > 50) console.log(`Acoes extras omitidas: ${actions.length - 50}`);
  }
  if (issues.length) {
    console.log("Problemas:");
    console.table(issues.slice(0, 50));
    if (issues.length > 50) console.log(`Problemas extras omitidos: ${issues.length - 50}`);
  }

  window.__maintenanceSharingBackfill = {
    dryRun: DRY_RUN,
    summary,
    actions,
    issues
  };

  log("Fim. Resultado salvo em window.__maintenanceSharingBackfill");
})();
