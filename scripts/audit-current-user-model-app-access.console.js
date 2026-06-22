/**
 * Cole no console do Model-driven App, no ambiente alvo.
 *
 * Mostra por qual role direto ou herdado por time o usuario atual consegue abrir
 * cada model-driven app. Nao altera nada.
 */
(async () => {
  if (!Xrm?.Utility?.getGlobalContext) {
    throw new Error("Xrm.Utility nao encontrado. Abra dentro do model-driven app.");
  }

  const ctx = Xrm.Utility.getGlobalContext();
  const currentUserId = cleanGuid(ctx.userSettings.userId);
  const apiBaseUrl = `${ctx.getClientUrl().replace(/\/$/, "")}/api/data/v9.2`;
  const roleQuery = "?$select=roleid,name,_parentrootroleid_value,roletemplateid";

  function cleanGuid(value) {
    return String(value || "").replace(/[{}]/g, "").toLowerCase();
  }

  function sameGuid(a, b) {
    return cleanGuid(a) === cleanGuid(b);
  }

  function roleFamilyKeys(role) {
    return [
      cleanGuid(role.roleid),
      cleanGuid(role._parentrootroleid_value),
      cleanGuid(role.roletemplateid),
      String(role.name || "").trim().toLowerCase()
    ].filter(Boolean);
  }

  function sameRoleFamily(a, b) {
    const left = new Set(roleFamilyKeys(a));
    return roleFamilyKeys(b).some((key) => left.has(key));
  }

  function escapeXml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function requestUrl(pathOrUrl) {
    return /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${apiBaseUrl}${pathOrUrl}`;
  }

  async function getJson(pathOrUrl) {
    const url = requestUrl(pathOrUrl);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GET ${response.status} ${response.statusText}: ${url}\n${body}`);
    }

    return response.json();
  }

  async function retrieveAll(pathOrUrl) {
    const rows = [];
    let next = pathOrUrl;

    while (next) {
      const result = await getJson(next);
      rows.push(...(result.value || []));
      next = result["@odata.nextLink"] || null;
    }

    return rows;
  }

  async function getCurrentApp() {
    const urlAppId = cleanGuid(new URL(window.location.href).searchParams.get("appid"));

    if (typeof ctx.getCurrentAppProperties !== "function") {
      return { appId: urlAppId, appName: "", appUniqueName: "", source: "url" };
    }

    try {
      const app = await ctx.getCurrentAppProperties();
      return {
        appId: cleanGuid(app.appId || app.appmoduleid || urlAppId),
        appName: app.displayName || app.name || "",
        appUniqueName: app.uniqueName || app.uniquename || "",
        source: "getCurrentAppProperties"
      };
    } catch (error) {
      return {
        appId: urlAppId,
        appName: "",
        appUniqueName: "",
        source: "url fallback",
        error: String(error?.message || error)
      };
    }
  }

  async function getEntitySetName(logicalName) {
    const metadata = await getJson(`/EntityDefinitions(LogicalName='${logicalName}')?$select=EntitySetName`);
    return metadata.EntitySetName;
  }

  async function getUserDirectRoles(userId) {
    const [user, roles] = await Promise.all([
      getJson(`/systemusers(${userId})?$select=systemuserid,fullname,internalemailaddress`),
      retrieveAll(`/systemusers(${userId})/systemuserroles_association${roleQuery}`)
    ]);

    return {
      user,
      roles: roles.map((role) => ({
        ...role,
        source: "user",
        sourceName: user.fullname || user.internalemailaddress || userId,
        sourceId: userId
      }))
    };
  }

  async function getUserTeams(userId) {
    return retrieveAll(`/systemusers(${userId})/teammembership_association?$select=teamid,name`);
  }

  async function getTeamRoles(team) {
    const teamId = cleanGuid(team.teamid);
    const roles = await retrieveAll(`/teams(${teamId})/teamroles_association${roleQuery}`);

    return roles.map((role) => ({
      ...role,
      source: "team",
      sourceName: team.name || teamId,
      sourceId: teamId
    }));
  }

  async function getApps() {
    const apps = await retrieveAll(
      "/appmodules?$select=appmoduleid,name,uniquename&$filter=componentstate%20eq%200"
    );

    return Promise.all(
      apps.map(async (app) => ({
        ...app,
        appmoduleroles_association: await retrieveAll(
          `/appmodules(${cleanGuid(app.appmoduleid)})/appmoduleroles_association${roleQuery}`
        )
      }))
    );
  }

  async function getPrincipalObjectAccessForApp(entitySetName, app, principal) {
    const fetchXml = [
      "<fetch version=\"1.0\" mapping=\"logical\" distinct=\"false\">",
      "<entity name=\"principalobjectaccess\">",
      "<attribute name=\"accessrightsmask\" />",
      "<attribute name=\"inheritedaccessrightsmask\" />",
      "<attribute name=\"objectid\" />",
      "<attribute name=\"principalid\" />",
      "<filter type=\"and\">",
      `<condition attribute=\"objectid\" operator=\"eq\" value=\"${escapeXml(cleanGuid(app.appmoduleid))}\" />`,
      `<condition attribute=\"principalid\" operator=\"eq\" value=\"${escapeXml(principal.id)}\" />`,
      "</filter>",
      "</entity>",
      "</fetch>"
    ].join("");

    const rows = await retrieveAll(`/${entitySetName}?fetchXml=${encodeURIComponent(fetchXml)}`);
    return rows.map((row) => ({
      appName: app.name || app.uniquename || app.appmoduleid,
      appUniqueName: app.uniquename || "",
      appId: cleanGuid(app.appmoduleid),
      principalType: principal.type,
      principalName: principal.name,
      principalId: principal.id,
      accessRightsMask: row.accessrightsmask,
      inheritedAccessRightsMask: row.inheritedaccessrightsmask
    }));
  }

  async function getPrincipalObjectAccess(apps, principals) {
    try {
      const entitySetName = await getEntitySetName("principalobjectaccess");
      const nested = await Promise.all(
        apps.flatMap((app) =>
          principals.map((principal) => getPrincipalObjectAccessForApp(entitySetName, app, principal))
        )
      );

      return { rows: nested.flat(), error: "" };
    } catch (error) {
      return { rows: [], error: String(error?.message || error) };
    }
  }

  const [{ user, roles: directRoles }, teams, apps, currentApp] = await Promise.all([
    getUserDirectRoles(currentUserId),
    getUserTeams(currentUserId),
    getApps(),
    getCurrentApp()
  ]);

  const teamRolesNested = await Promise.all(teams.map(getTeamRoles));
  const effectiveRoles = [...directRoles, ...teamRolesNested.flat()];
  const principals = [
    {
      type: "user",
      name: user.fullname || user.internalemailaddress || currentUserId,
      id: currentUserId
    },
    ...teams.map((team) => ({
      type: "team",
      name: team.name || cleanGuid(team.teamid),
      id: cleanGuid(team.teamid)
    }))
  ];
  const poaAccess = await getPrincipalObjectAccess(apps, principals);

  const appAccess = [];
  for (const app of apps) {
    const appRoles = app.appmoduleroles_association || [];
    for (const appRole of appRoles) {
      for (const effectiveRole of effectiveRoles) {
        if (!sameGuid(appRole.roleid, effectiveRole.roleid) && !sameRoleFamily(appRole, effectiveRole)) {
          continue;
        }

        appAccess.push({
          appName: app.name || app.uniquename || app.appmoduleid,
          appUniqueName: app.uniquename || "",
          appId: cleanGuid(app.appmoduleid),
          appRoleName: appRole.name,
          appRoleId: cleanGuid(appRole.roleid),
          effectiveRoleName: effectiveRole.name,
          effectiveRoleId: cleanGuid(effectiveRole.roleid),
          source: effectiveRole.source,
          sourceName: effectiveRole.sourceName,
          sourceId: effectiveRole.sourceId,
          matchedBy: sameGuid(appRole.roleid, effectiveRole.roleid) ? "roleid" : "role family/name"
        });
      }
    }
  }

  const currentAppAccessByRole = appAccess.filter((row) => sameGuid(row.appId, currentApp.appId));
  const currentAppAccessByPoa = poaAccess.rows.filter((row) => sameGuid(row.appId, currentApp.appId));
  const currentAppHasUnexplainedAccess =
    Boolean(currentApp.appId) && currentAppAccessByRole.length === 0 && currentAppAccessByPoa.length === 0;

  const roleSummary = effectiveRoles.map((role) => ({
    roleName: role.name,
    roleId: cleanGuid(role.roleid),
    parentRootRoleId: cleanGuid(role._parentrootroleid_value),
    roleTemplateId: cleanGuid(role.roletemplateid),
    source: role.source,
    sourceName: role.sourceName,
    sourceId: role.sourceId
  }));

  console.log("Usuario atual:", {
    userId: currentUserId,
    name: user.fullname,
    email: user.internalemailaddress
  });
  console.log("App atual aberto:");
  console.table([currentApp]);
  console.log("Roles efetivos do usuario:");
  console.table(roleSummary);
  console.log("Apps liberados por role appmoduleroles_association:");
  console.table(appAccess);
  console.log("Compartilhamentos diretos principalobjectaccess para usuario/times:");
  if (poaAccess.error) {
    console.warn("Nao consegui consultar principalobjectaccess:", poaAccess.error);
  }
  console.table(poaAccess.rows);
  if (currentAppHasUnexplainedAccess) {
    console.warn(
      "App atual abriu, mas nao apareceu por app role nem por principalobjectaccess. Verifique sessao/login, cache, grupo Entra ID ou outro mecanismo nao capturado pelo script.",
      currentApp
    );
  }

  window.__modelDrivenAppAccessAudit = {
    user: {
      userId: currentUserId,
      name: user.fullname,
      email: user.internalemailaddress
    },
    roles: roleSummary,
    currentApp,
    appAccess,
    principalObjectAccess: poaAccess.rows,
    principalObjectAccessError: poaAccess.error,
    currentAppAccessByRole,
    currentAppAccessByPoa,
    currentAppHasUnexplainedAccess
  };

  console.log("Resultado salvo em window.__modelDrivenAppAccessAudit");
})();
