/**
 * Cole no console do model-driven app.
 *
 * Objetivo:
 * - garantir que cada funcionario em cr40f_funcionarios com cr40f_emailmicrosoft
 *   tenha ReadAccess e AppendToAccess no proprio registro de funcionario.
 *
 * Padrao seguro:
 * - DRY_RUN = true nao altera nada.
 * - depois de revisar o resumo, mude para false e rode novamente.
 */
(async () => {
  if (!window.Xrm?.Utility?.getGlobalContext) {
    throw new Error("Xrm.Utility nao encontrado. Abra dentro do model-driven app.");
  }

  const DRY_RUN = true;
  const ONLY_WITH_EMAIL = true;
  const INCLUDE_DISMISSED = false;
  const ACCESS_MASK = "ReadAccess, AppendToAccess";

  const EMPLOYEE_LOGICAL_NAME = "cr40f_funcionarios";
  const EMPLOYEE_SET = "cr40f_funcionarioses";
  const EMPLOYEE_ID = "cr40f_funcionariosid";
  const EMPLOYEE_NAME = "cr40f_nomecompleto";
  const EMPLOYEE_EMAIL = "cr40f_emailmicrosoft";
  const EMPLOYEE_DISMISSAL = "cr40f_datadedemissao";
  const USER_LOGICAL_NAME = "systemuser";
  const USER_SET = "systemusers";
  const USER_ID = "systemuserid";
  const USER_NAME = "fullname";
  const USER_EMAIL = "internalemailaddress";
  const USER_DISABLED = "isdisabled";

  const ctx = Xrm.Utility.getGlobalContext();
  const apiBaseUrl = `${ctx.getClientUrl().replace(/\/$/, "")}/api/data/v9.2`;
  const summary = {
    dryRun: DRY_RUN,
    employeesRead: 0,
    skippedNoEmail: 0,
    skippedDismissed: 0,
    noActiveUser: 0,
    duplicateActiveUsers: 0,
    grantOrModifyDryRun: 0,
    granted: 0,
    modified: 0,
    errors: 0
  };
  const actions = [];
  const issues = [];

  function cleanGuid(value) {
    return String(value || "").replace(/[{}]/g, "").trim().toLowerCase();
  }

  function escapeOData(value) {
    return String(value || "").replace(/'/g, "''");
  }

  function buildEntityReference(logicalName, primaryIdName, id) {
    return {
      "@odata.type": `Microsoft.Dynamics.CRM.${logicalName}`,
      [primaryIdName]: cleanGuid(id)
    };
  }

  function buildPrincipalAccess(userId) {
    return {
      AccessMask: ACCESS_MASK,
      Principal: buildEntityReference(USER_LOGICAL_NAME, USER_ID, userId)
    };
  }

  async function request(method, path, body) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${method} ${path} -> ${response.status} ${response.statusText}: ${text}`);
    }

    if (response.status === 204) {
      return {};
    }

    return response.json();
  }

  async function retrieveAll(path) {
    const rows = [];
    let next = path;
    while (next) {
      const url = /^https?:\/\//i.test(next) ? next.replace(apiBaseUrl, "") : next;
      const page = await request("GET", url);
      rows.push(...(page.value || []));
      next = page["@odata.nextLink"] || "";
    }
    return rows;
  }

  async function resolveActiveUser(email) {
    const normalized = String(email || "").trim().toLowerCase();
    const rows = await retrieveAll(
      `/${USER_SET}?$select=${USER_ID},${USER_NAME},${USER_EMAIL},${USER_DISABLED}` +
        `&$filter=${USER_EMAIL} eq '${escapeOData(normalized)}' and ${USER_DISABLED} eq false`
    );
    return rows.map((row) => ({
      id: cleanGuid(row[USER_ID]),
      name: row[USER_NAME] || "",
      email: String(row[USER_EMAIL] || "").trim().toLowerCase()
    }));
  }

  async function ensureEmployeeSelfAccess(employee, user) {
    const action = {
      employeeId: cleanGuid(employee[EMPLOYEE_ID]),
      employeeName: employee[EMPLOYEE_NAME] || "",
      email: String(employee[EMPLOYEE_EMAIL] || "").trim().toLowerCase(),
      userId: user.id,
      userName: user.name,
      rights: ACCESS_MASK
    };

    if (DRY_RUN) {
      summary.grantOrModifyDryRun += 1;
      actions.push({ operation: "GrantAccess/ModifyAccess", ...action });
      return;
    }

    const payload = {
      Target: buildEntityReference(EMPLOYEE_LOGICAL_NAME, EMPLOYEE_ID, employee[EMPLOYEE_ID]),
      PrincipalAccess: buildPrincipalAccess(user.id)
    };

    try {
      await request("POST", "/GrantAccess", payload);
      summary.granted += 1;
      actions.push({ operation: "GrantAccess", ...action });
    } catch (grantError) {
      try {
        await request("POST", "/ModifyAccess", payload);
        summary.modified += 1;
        actions.push({ operation: "ModifyAccess", ...action });
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

  const filters = [];
  if (ONLY_WITH_EMAIL) {
    filters.push(`${EMPLOYEE_EMAIL} ne null`);
  }
  if (!INCLUDE_DISMISSED) {
    filters.push(`${EMPLOYEE_DISMISSAL} eq null`);
  }

  const employees = await retrieveAll(
    `/${EMPLOYEE_SET}?$select=${EMPLOYEE_ID},${EMPLOYEE_NAME},${EMPLOYEE_EMAIL},${EMPLOYEE_DISMISSAL}` +
      (filters.length ? `&$filter=${filters.join(" and ")}` : "") +
      `&$orderby=${EMPLOYEE_NAME} asc`
  );

  summary.employeesRead = employees.length;

  for (const employee of employees) {
    const employeeId = cleanGuid(employee[EMPLOYEE_ID]);
    const employeeName = employee[EMPLOYEE_NAME] || employeeId;
    const email = String(employee[EMPLOYEE_EMAIL] || "").trim().toLowerCase();

    if (!email) {
      summary.skippedNoEmail += 1;
      continue;
    }

    if (!INCLUDE_DISMISSED && employee[EMPLOYEE_DISMISSAL]) {
      summary.skippedDismissed += 1;
      continue;
    }

    const users = await resolveActiveUser(email);
    if (users.length === 0) {
      summary.noActiveUser += 1;
      issues.push({ kind: "no_active_user", employeeId, employeeName, email });
      continue;
    }

    if (users.length > 1) {
      summary.duplicateActiveUsers += 1;
      issues.push({ kind: "duplicate_active_users", employeeId, employeeName, email, users });
      continue;
    }

    await ensureEmployeeSelfAccess(employee, users[0]);
  }

  console.log("[grant-employee-self-access] summary");
  console.table([summary]);
  console.log("[grant-employee-self-access] actions");
  console.table(actions);
  if (issues.length) {
    console.log("[grant-employee-self-access] issues");
    console.table(issues);
  }

  return { summary, actions, issues };
})();
