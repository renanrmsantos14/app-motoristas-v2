/**
 * Cole no console do Model-driven App, no ambiente alvo.
 *
 * Mostra por qual role direto ou herdado por time o usuario atual consegue abrir
 * cada model-driven app. Nao altera nada.
 */
(async () => {
  const api = Xrm?.WebApi?.online || Xrm?.WebApi;
  if (!api) throw new Error("Xrm.WebApi nao encontrado. Abra dentro do model-driven app.");

  const ctx = Xrm.Utility.getGlobalContext();
  const currentUserId = cleanGuid(ctx.userSettings.userId);

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

  async function retrieveAll(entityLogicalName, query) {
    const rows = [];
    let result = await api.retrieveMultipleRecords(entityLogicalName, query);
    rows.push(...result.entities);
    while (result.nextLink) {
      result = await api.retrieveMultipleRecords(entityLogicalName, result.nextLink);
      rows.push(...result.entities);
    }
    return rows;
  }

  async function getUserDirectRoles(userId) {
    const user = await api.retrieveRecord(
      "systemuser",
      userId,
      "?$select=systemuserid,fullname,internalemailaddress&$expand=systemuserroles_association($select=roleid,name,_parentrootroleid_value,roletemplateid)"
    );

    return {
      user,
      roles: (user.systemuserroles_association || []).map((role) => ({
        ...role,
        source: "user",
        sourceName: user.fullname || user.internalemailaddress || userId,
        sourceId: userId
      }))
    };
  }

  async function getUserTeams(userId) {
    const user = await api.retrieveRecord(
      "systemuser",
      userId,
      "?$select=systemuserid&$expand=teammembership_association($select=teamid,name)"
    );
    return user.teammembership_association || [];
  }

  async function getTeamRoles(team) {
    const fullTeam = await api.retrieveRecord(
      "team",
      cleanGuid(team.teamid),
      "?$select=teamid,name&$expand=teamroles_association($select=roleid,name,_parentrootroleid_value,roletemplateid)"
    );

    return (fullTeam.teamroles_association || []).map((role) => ({
      ...role,
      source: "team",
      sourceName: fullTeam.name || team.name || cleanGuid(team.teamid),
      sourceId: cleanGuid(team.teamid)
    }));
  }

  async function getApps() {
    return retrieveAll(
      "appmodule",
      "?$select=appmoduleid,name,uniquename&$filter=componentstate eq 0&$expand=appmoduleroles_association($select=roleid,name,_parentrootroleid_value,roletemplateid)"
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
