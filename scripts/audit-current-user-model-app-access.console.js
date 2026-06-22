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

  const [{ user, roles: directRoles }, teams, apps] = await Promise.all([
    getUserDirectRoles(currentUserId),
    getUserTeams(currentUserId),
    getApps()
  ]);

  const teamRolesNested = await Promise.all(teams.map(getTeamRoles));
  const effectiveRoles = [...directRoles, ...teamRolesNested.flat()];

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
  console.log("Roles efetivos do usuario:");
  console.table(roleSummary);
  console.log("Apps liberados e caminho de acesso:");
  console.table(appAccess);

  window.__modelDrivenAppAccessAudit = {
    user: {
      userId: currentUserId,
      name: user.fullname,
      email: user.internalemailaddress
    },
    roles: roleSummary,
    appAccess
  };

  console.log("Resultado salvo em window.__modelDrivenAppAccessAudit");
})();
