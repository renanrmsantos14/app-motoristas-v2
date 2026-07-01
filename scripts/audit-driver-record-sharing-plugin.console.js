/**
 * Cole este script no console do navegador, dentro do model-driven app.
 *
 * O script NAO altera nada.
 * Ele audita se o plugin Betinhos.DriverRecordSharing esta refletido
 * corretamente nos compartilhamentos atuais do Dataverse.
 *
 * Comandos depois de colar:
 *   await window.DriverRecordSharingAudit.auditCurrentForm()
 *   await window.DriverRecordSharingAudit.auditRecord("cr40f_reservadeveculos", "GUID")
 *   await window.DriverRecordSharingAudit.auditEmployee("GUID_FUNCIONARIO")
 *   await window.DriverRecordSharingAudit.runAll({ sampleSizePerEntity: 5 })
 *
 * O script verifica:
 * - entidades diretas: servico, troca, posse, colisao, recibo
 * - hierarquia do servico: manutencao, servicos por passageiro, passageiros e solicitante
 * - entidade especial: cr40f_servicosporpassageiro
 * - problemas de identidade: email vazio, systemuser ausente, duplicado
 * - shares faltando
 * - shares sobrando
 *
 * auditEmployee valida apenas o usuario daquele funcionario. auditRecord/runAll
 * validam o conjunto completo de usuarios esperados para cada registro.
 */
(async () => {
  if (!window.Xrm?.Utility?.getGlobalContext) {
    throw new Error("Xrm.Utility nao encontrado. Abra este script dentro do model-driven app.");
  }

  const CONFIG = {
    apiVersion: "v9.2",
    sampleSizePerEntity: 5,
    logTables: true,
    supportedDirectEntities: [
      {
        logicalName: "cr40f_reservadeveculos",
        label: "Servico",
        includeServiceHierarchy: true,
        driverLookups: ["cr40f_motorista"]
      },
      {
        logicalName: "cr40f_trocasdecarro",
        label: "Troca de carro",
        includeServiceHierarchy: false,
        driverLookups: ["cr40f_motorista1", "cr40f_motorista2"]
      },
      {
        logicalName: "new_possedeveiculo",
        label: "Posse de veiculo",
        includeServiceHierarchy: false,
        driverLookups: ["new_motorista"]
      },
      {
        logicalName: "cr40f_colisao_v2",
        label: "Colisao",
        includeServiceHierarchy: false,
        driverLookups: ["cr40f_motorista"]
      },
      {
        logicalName: "cr40f_recibos_v2",
        label: "Recibo",
        includeServiceHierarchy: false,
        driverLookups: ["cr40f_motorista"]
      }
    ],
    servicePassenger: {
      logicalName: "cr40f_servicosporpassageiro",
      serviceLookup: "cr40f_geral",
      passengerLookup: "cr40f_bancodedados"
    },
    tables: {
      employee: {
        logicalName: "cr40f_funcionarios",
        id: "cr40f_funcionariosid",
        name: "cr40f_nomecompleto",
        email: "cr40f_emailmicrosoft",
        dismissalDate: "cr40f_datadedemissao"
      },
      user: {
        logicalName: "systemuser",
        id: "systemuserid",
        name: "fullname",
        email: "internalemailaddress",
        disabled: "isdisabled"
      },
      service: {
        logicalName: "cr40f_reservadeveculos",
        id: "cr40f_reservadeveculosid",
        driver: "cr40f_motorista",
        maintenance: "cr40f_om",
        requester: "cr40f_solicitante",
        startDate: "cr40f_dataehorriodesada",
        programmed: "new_foiprogramado",
        exchange: "cr40f_ot",
        category: "new_categoriadoitem",
        backfillDaysBack: 45,
        backfillCategories: [100000000, 100000001]
      },
      maintenance: {
        logicalName: "cr40f_manutencoes",
        id: "cr40f_manutencoesid"
      },
      passenger: {
        logicalName: "cr40f_bancodedados",
        id: "cr40f_bancodedadosid",
        name: "cr40f_nomedopassageiro"
      },
      principalObjectAccess: {
        logicalName: "principalobjectaccess"
      }
    }
  };

  const ctx = Xrm.Utility.getGlobalContext();
  const apiBaseUrl = `${ctx.getClientUrl().replace(/\/$/, "")}/api/data/${CONFIG.apiVersion}`;
  const state = {
    entityMeta: new Map(),
    employeeResolution: new Map(),
    userById: new Map(),
    serviceDrivers: new Map(),
    passengerAllowedUsers: new Map(),
    servicePassengerByService: new Map(),
    servicePassengerByPassenger: new Map(),
    servicesByRequester: new Map(),
    sharesByRecord: new Map()
  };
  const LOOKUP_COLUMNS = new Set([
    CONFIG.tables.service.driver,
    CONFIG.tables.service.maintenance,
    CONFIG.tables.service.requester,
    CONFIG.servicePassenger.serviceLookup,
    CONFIG.servicePassenger.passengerLookup,
    ...CONFIG.supportedDirectEntities.flatMap((item) => item.driverLookups)
  ]);

  function cleanGuid(value) {
    return String(value || "").replace(/[{}]/g, "").trim().toLowerCase();
  }

  function sameGuid(left, right) {
    return cleanGuid(left) === cleanGuid(right);
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase() || "";
  }

  function uniqueById(items) {
    const map = new Map();
    for (const item of items || []) {
      const id = cleanGuid(item?.id || item?.userId || item?.principalId);
      if (!id || map.has(id)) {
        continue;
      }

      map.set(id, item);
    }
    return [...map.values()];
  }

  function uniqueIds(values) {
    return [...new Set((values || []).map(cleanGuid).filter(Boolean))];
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
        "OData-Version": "4.0",
        Prefer: 'odata.include-annotations="*"'
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GET ${response.status} ${response.statusText}: ${url}\n${body}`);
    }

    if (response.status === 204) {
      return {};
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

  async function getEntityMeta(logicalName) {
    const key = String(logicalName || "").trim().toLowerCase();
    if (state.entityMeta.has(key)) {
      return state.entityMeta.get(key);
    }

    const metadata = await getJson(
      `/EntityDefinitions(LogicalName='${escapeXml(key)}')?$select=LogicalName,EntitySetName,PrimaryIdAttribute`
    );

    const value = {
      logicalName: metadata.LogicalName,
      entitySetName: metadata.EntitySetName,
      primaryIdAttribute: metadata.PrimaryIdAttribute
    };

    state.entityMeta.set(key, value);
    return value;
  }

  async function fetchXml(logicalName, fetchXmlText) {
    const meta = await getEntityMeta(logicalName);
    return retrieveAll(`/${meta.entitySetName}?fetchXml=${encodeURIComponent(fetchXmlText)}`);
  }

  async function retrieveRecord(logicalName, id, columns) {
    const meta = await getEntityMeta(logicalName);
    const recordId = cleanGuid(id);
    const select = (columns || [])
      .filter(Boolean)
      .map((column) => (LOOKUP_COLUMNS.has(column) ? `_${column}_value` : column))
      .join(",");
    return getJson(`/${meta.entitySetName}(${recordId})?$select=${select}`);
  }

  function getLookup(record, attribute) {
    if (!record || !attribute) {
      return null;
    }

    const valueKey = `_${attribute}_value`;
    const id = cleanGuid(record[valueKey]);
    if (!id) {
      return null;
    }

    return {
      id,
      name: record[`${valueKey}@OData.Community.Display.V1.FormattedValue`] || "",
      logicalName: record[`${valueKey}@Microsoft.Dynamics.CRM.lookuplogicalname`] || ""
    };
  }

  function setDifference(expectedIds, actualIds) {
    const actual = new Set((actualIds || []).map(cleanGuid));
    return (expectedIds || []).filter((id) => !actual.has(cleanGuid(id)));
  }

  async function resolveEmployee(employeeLookup) {
    const employeeId = cleanGuid(employeeLookup?.id);
    if (!employeeId) {
      return null;
    }

    if (state.employeeResolution.has(employeeId)) {
      return state.employeeResolution.get(employeeId);
    }

    const employee = await retrieveRecord(CONFIG.tables.employee.logicalName, employeeId, [
      CONFIG.tables.employee.id,
      CONFIG.tables.employee.name,
      CONFIG.tables.employee.email,
      CONFIG.tables.employee.dismissalDate
    ]);

    const employeeName = employee[CONFIG.tables.employee.name] || employeeLookup.name || employeeId;
    const email = normalizeEmail(employee[CONFIG.tables.employee.email]);
    const dismissalDate = employee[CONFIG.tables.employee.dismissalDate] || null;

    let resolution;
    if (!email) {
      resolution = {
        status: "missing_email",
        employeeId,
        employeeName,
        email,
        dismissalDate,
        users: []
      };
    } else {
      const fetch = [
        "<fetch version=\"1.0\" mapping=\"logical\">",
        `<entity name="${CONFIG.tables.user.logicalName}">`,
        `<attribute name="${CONFIG.tables.user.id}" />`,
        `<attribute name="${CONFIG.tables.user.name}" />`,
        `<attribute name="${CONFIG.tables.user.email}" />`,
        `<attribute name="${CONFIG.tables.user.disabled}" />`,
        "<filter type=\"and\">",
        `<condition attribute="${CONFIG.tables.user.email}" operator="eq" value="${escapeXml(email)}" />`,
        `<condition attribute="${CONFIG.tables.user.disabled}" operator="eq" value="0" />`,
        "</filter>",
        "</entity>",
        "</fetch>"
      ].join("");

      const users = (await fetchXml(CONFIG.tables.user.logicalName, fetch)).map((row) => ({
        id: cleanGuid(row[CONFIG.tables.user.id]),
        name: row[CONFIG.tables.user.name] || "",
        email: normalizeEmail(row[CONFIG.tables.user.email]),
        isDisabled: Boolean(row[CONFIG.tables.user.disabled])
      }));

      for (const user of users) {
        state.userById.set(user.id, user);
      }

      if (users.length === 0) {
        resolution = {
          status: "no_active_user",
          employeeId,
          employeeName,
          email,
          dismissalDate,
          users: []
        };
      } else if (users.length > 1) {
        resolution = {
          status: "duplicate_active_users",
          employeeId,
          employeeName,
          email,
          dismissalDate,
          users
        };
      } else {
        resolution = {
          status: "resolved",
          employeeId,
          employeeName,
          email,
          dismissalDate,
          users
        };
      }
    }

    state.employeeResolution.set(employeeId, resolution);
    return resolution;
  }

  async function getServiceCurrentDrivers(serviceId) {
    const normalizedId = cleanGuid(serviceId);
    if (!normalizedId) {
      return { drivers: [], identityIssues: [] };
    }

    if (state.serviceDrivers.has(normalizedId)) {
      return state.serviceDrivers.get(normalizedId);
    }

    const service = await retrieveRecord(CONFIG.tables.service.logicalName, normalizedId, [
      CONFIG.tables.service.id,
      CONFIG.tables.service.driver,
      CONFIG.tables.service.maintenance,
      CONFIG.tables.service.requester
    ]);

    const driverLookup = getLookup(service, CONFIG.tables.service.driver);
    const driverResolutions = driverLookup ? [await resolveEmployee(driverLookup)] : [];
    const identityIssues = driverResolutions
      .filter(Boolean)
      .filter((item) => item.status !== "resolved")
      .map((item) => ({
        severity: item.status === "missing_email" ? "warning" : "error",
        message: `Servico ${normalizedId}: funcionario ${item.employeeName} ficou em estado ${item.status}.`,
        code: item.status
      }));

    const drivers = uniqueById(
      driverResolutions
        .filter((item) => item?.status === "resolved")
        .flatMap((item) =>
          item.users.map((user) => ({
            id: user.id,
            name: user.name || user.email || user.id,
            email: user.email,
            employeeId: item.employeeId,
            employeeName: item.employeeName
          }))
        )
    );

    const value = {
      serviceId: normalizedId,
      drivers,
      identityIssues,
      maintenanceLookup: getLookup(service, CONFIG.tables.service.maintenance),
      requesterLookup: getLookup(service, CONFIG.tables.service.requester)
    };

    state.serviceDrivers.set(normalizedId, value);
    return value;
  }

  async function getSharedPrincipals(logicalName, recordId) {
    const cacheKey = `${logicalName}:${cleanGuid(recordId)}`;
    if (state.sharesByRecord.has(cacheKey)) {
      return state.sharesByRecord.get(cacheKey);
    }

    const entitySetName = (await getEntityMeta(CONFIG.tables.principalObjectAccess.logicalName)).entitySetName;
    const fetch = [
      "<fetch version=\"1.0\" mapping=\"logical\">",
      `<entity name="${CONFIG.tables.principalObjectAccess.logicalName}">`,
      "<attribute name=\"principalid\" />",
      "<attribute name=\"accessrightsmask\" />",
      "<attribute name=\"inheritedaccessrightsmask\" />",
      "<filter type=\"and\">",
      `<condition attribute="objectid" operator="eq" value="${escapeXml(cleanGuid(recordId))}" />`,
      "</filter>",
      "</entity>",
      "</fetch>"
    ].join("");

    const rows = await retrieveAll(`/${entitySetName}?fetchXml=${encodeURIComponent(fetch)}`);
    const principals = rows.map((row) => {
      const principalId =
        cleanGuid(row._principalid_value) ||
        cleanGuid(row.principalid) ||
        cleanGuid(row["principalid"]);
      const knownUser = state.userById.get(principalId);
      const principalType =
        row["_principalid_value@Microsoft.Dynamics.CRM.lookuplogicalname"] ||
        row["principalid@Microsoft.Dynamics.CRM.lookuplogicalname"] ||
        (knownUser ? CONFIG.tables.user.logicalName : "");
      return {
        principalId,
        principalName:
          row["_principalid_value@OData.Community.Display.V1.FormattedValue"] ||
          row["principalid@OData.Community.Display.V1.FormattedValue"] ||
          knownUser?.name ||
          knownUser?.email ||
          principalId,
        principalType,
        accessRightsMask: row.accessrightsmask,
        inheritedAccessRightsMask: row.inheritedaccessrightsmask
      };
    });

    const value = {
      all: principals,
      users: principals.filter((item) => item.principalType === CONFIG.tables.user.logicalName),
      nonUsers: principals.filter((item) => item.principalType && item.principalType !== CONFIG.tables.user.logicalName)
    };

    state.sharesByRecord.set(cacheKey, value);
    return value;
  }

  async function listServicePassengersByService(serviceId) {
    const normalizedId = cleanGuid(serviceId);
    if (!normalizedId) {
      return [];
    }

    if (state.servicePassengerByService.has(normalizedId)) {
      return state.servicePassengerByService.get(normalizedId);
    }

    const logicalName = CONFIG.servicePassenger.logicalName;
    const fetch = [
      "<fetch version=\"1.0\" mapping=\"logical\">",
      `<entity name="${logicalName}">`,
      `<attribute name="cr40f_servicosporpassageiroid" />`,
      `<attribute name="${CONFIG.servicePassenger.serviceLookup}" />`,
      `<attribute name="${CONFIG.servicePassenger.passengerLookup}" />`,
      "<filter type=\"and\">",
      `<condition attribute="${CONFIG.servicePassenger.serviceLookup}" operator="eq" value="${escapeXml(normalizedId)}" />`,
      "</filter>",
      "</entity>",
      "</fetch>"
    ].join("");

    const rows = (await fetchXml(logicalName, fetch)).map((row) => ({
      id: cleanGuid(row.cr40f_servicosporpassageiroid),
      service: getLookup(row, CONFIG.servicePassenger.serviceLookup),
      passenger: getLookup(row, CONFIG.servicePassenger.passengerLookup)
    }));

    state.servicePassengerByService.set(normalizedId, rows);
    return rows;
  }

  async function listServicePassengersByPassenger(passengerId) {
    const normalizedId = cleanGuid(passengerId);
    if (!normalizedId) {
      return [];
    }

    if (state.servicePassengerByPassenger.has(normalizedId)) {
      return state.servicePassengerByPassenger.get(normalizedId);
    }

    const logicalName = CONFIG.servicePassenger.logicalName;
    const fetch = [
      "<fetch version=\"1.0\" mapping=\"logical\">",
      `<entity name="${logicalName}">`,
      `<attribute name="cr40f_servicosporpassageiroid" />`,
      `<attribute name="${CONFIG.servicePassenger.serviceLookup}" />`,
      `<attribute name="${CONFIG.servicePassenger.passengerLookup}" />`,
      "<filter type=\"and\">",
      `<condition attribute="${CONFIG.servicePassenger.passengerLookup}" operator="eq" value="${escapeXml(normalizedId)}" />`,
      "</filter>",
      "</entity>",
      "</fetch>"
    ].join("");

    const rows = (await fetchXml(logicalName, fetch)).map((row) => ({
      id: cleanGuid(row.cr40f_servicosporpassageiroid),
      service: getLookup(row, CONFIG.servicePassenger.serviceLookup),
      passenger: getLookup(row, CONFIG.servicePassenger.passengerLookup)
    }));

    state.servicePassengerByPassenger.set(normalizedId, rows);
    return rows;
  }

  async function listServicesByRequester(passengerId) {
    const normalizedId = cleanGuid(passengerId);
    if (!normalizedId) {
      return [];
    }

    if (state.servicesByRequester.has(normalizedId)) {
      return state.servicesByRequester.get(normalizedId);
    }

    const logicalName = CONFIG.tables.service.logicalName;
    const fetch = [
      "<fetch version=\"1.0\" mapping=\"logical\">",
      `<entity name="${logicalName}">`,
      `<attribute name="${CONFIG.tables.service.id}" />`,
      `<attribute name="${CONFIG.tables.service.driver}" />`,
      `<attribute name="${CONFIG.tables.service.requester}" />`,
      "<filter type=\"and\">",
      `<condition attribute="${CONFIG.tables.service.requester}" operator="eq" value="${escapeXml(normalizedId)}" />`,
      "</filter>",
      "</entity>",
      "</fetch>"
    ].join("");

    const rows = (await fetchXml(logicalName, fetch)).map((row) => ({
      id: cleanGuid(row[CONFIG.tables.service.id]),
      driver: getLookup(row, CONFIG.tables.service.driver),
      requester: getLookup(row, CONFIG.tables.service.requester)
    }));

    state.servicesByRequester.set(normalizedId, rows);
    return rows;
  }

  async function getAllowedUsersForPassenger(passengerId) {
    const normalizedId = cleanGuid(passengerId);
    if (!normalizedId) {
      return [];
    }

    if (state.passengerAllowedUsers.has(normalizedId)) {
      return state.passengerAllowedUsers.get(normalizedId);
    }

    const links = await listServicePassengersByPassenger(normalizedId);
    const requesterServices = await listServicesByRequester(normalizedId);
    const serviceIds = uniqueIds([
      ...links.map((link) => link.service?.id),
      ...requesterServices.map((service) => service.id)
    ]);

    const nestedDrivers = await Promise.all(
      serviceIds.map((serviceId) => getServiceCurrentDrivers(serviceId))
    );

    const allowedUsers = uniqueById(
      nestedDrivers.flatMap((item) => item.drivers.map((driver) => ({ id: driver.id, name: driver.name, email: driver.email })))
    );

    state.passengerAllowedUsers.set(normalizedId, allowedUsers);
    return allowedUsers;
  }

  function makeIssue(severity, entity, recordId, scope, message, details) {
    return {
      severity,
      entity,
      recordId: cleanGuid(recordId),
      scope,
      message,
      details: details || ""
    };
  }

  function buildShareCheckRow(result, check) {
    return {
      entity: result.entity,
      recordId: result.recordId,
      caseType: result.caseType,
      scope: check.scope,
      targetEntity: check.targetEntity,
      targetId: check.targetId,
      expectedUsers: check.expectedUsers.map((item) => item.name || item.email || item.id).join(" | "),
      actualUsers: check.actualUsers.map((item) => item.principalName || item.principalId).join(" | "),
      missingUsers: check.missingUsers.map((item) => item.name || item.email || item.id).join(" | "),
      unexpectedUsers: check.unexpectedUsers.map((item) => item.principalName || item.principalId).join(" | "),
      nonUserShares: check.nonUserShares.map((item) => `${item.principalType}:${item.principalName}`).join(" | "),
      status: check.status
    };
  }

  function filterExpectedUsersForScope(expectedUsers, options) {
    const expected = uniqueById(expectedUsers || []);
    const expectedUserIds = options?.expectedUserIds || null;
    if (!expectedUserIds?.size) {
      return expected;
    }

    return expected.filter((item) => expectedUserIds.has(cleanGuid(item.id)));
  }

  function compareShares(scope, targetEntity, targetId, expectedUsers, shareSet, options) {
    const expected = filterExpectedUsersForScope(expectedUsers, options);
    const allActualUsers = uniqueById((shareSet?.users || []).map((item) => ({
      id: item.principalId,
      principalId: item.principalId,
      principalName: item.principalName,
      principalType: item.principalType,
      accessRightsMask: item.accessRightsMask
    })));
    const actualUsers = options?.ignoreUnexpectedUsers
      ? allActualUsers.filter((item) => expected.some((expectedUser) => sameGuid(expectedUser.id, item.principalId)))
      : allActualUsers;

    const missingIds = setDifference(
      expected.map((item) => item.id),
      actualUsers.map((item) => item.principalId)
    );
    const unexpectedIds = setDifference(
      actualUsers.map((item) => item.principalId),
      expected.map((item) => item.id)
    );

    const missingUsers = expected.filter((item) => missingIds.some((missingId) => sameGuid(missingId, item.id)));
    const unexpectedUsers = actualUsers.filter((item) => unexpectedIds.some((unexpectedId) => sameGuid(unexpectedId, item.principalId)));
    const nonUserShares = options?.ignoreUnexpectedUsers ? [] : shareSet?.nonUsers || [];

    let status = "ok";
    if (missingUsers.length > 0) {
      status = "missing";
    } else if (unexpectedUsers.length > 0 || nonUserShares.length > 0) {
      status = "unexpected";
    }

    return {
      scope,
      targetEntity,
      targetId: cleanGuid(targetId),
      expectedUsers: expected,
      actualUsers,
      missingUsers,
      unexpectedUsers,
      nonUserShares,
      status
    };
  }

  async function buildDirectRecordAudit(entityConfig, recordId, options) {
    const meta = await getEntityMeta(entityConfig.logicalName);
    const columns = [...entityConfig.driverLookups];
    if (entityConfig.includeServiceHierarchy) {
      columns.push(CONFIG.tables.service.maintenance);
      columns.push(CONFIG.tables.service.requester);
    }

    const record = await retrieveRecord(entityConfig.logicalName, recordId, [...columns, meta.primaryIdAttribute]);
    const driverLookups = uniqueById(entityConfig.driverLookups.map((field) => getLookup(record, field)).filter(Boolean));
    const driverResolutions = await Promise.all(driverLookups.map(resolveEmployee));

    const result = {
      entity: entityConfig.logicalName,
      recordId: cleanGuid(recordId),
      caseType: "direct",
      label: entityConfig.label,
      checks: [],
      issues: []
    };

    for (const resolution of driverResolutions.filter(Boolean)) {
      if (resolution.status === "resolved") {
        continue;
      }

      result.issues.push(
        makeIssue(
          resolution.status === "missing_email" ? "warning" : "error",
          entityConfig.logicalName,
          recordId,
          "identity",
          `Funcionario ${resolution.employeeName} ficou em estado ${resolution.status}.`,
          resolution.email || ""
        )
      );
    }

    const expectedUsers = uniqueById(
      driverResolutions
        .filter((item) => item?.status === "resolved")
        .flatMap((item) =>
          item.users.map((user) => ({
            id: user.id,
            name: user.name || user.email || user.id,
            email: user.email
          }))
        )
    );

    const mainShares = await getSharedPrincipals(entityConfig.logicalName, recordId);
    result.checks.push(compareShares("main", entityConfig.logicalName, recordId, expectedUsers, mainShares, options));

    if (!entityConfig.includeServiceHierarchy) {
      return result;
    }

    const maintenanceLookup = getLookup(record, CONFIG.tables.service.maintenance);
    if (maintenanceLookup) {
      const maintenanceShares = await getSharedPrincipals(CONFIG.tables.maintenance.logicalName, maintenanceLookup.id);
      result.checks.push(
        compareShares("maintenance", CONFIG.tables.maintenance.logicalName, maintenanceLookup.id, expectedUsers, maintenanceShares, options)
      );
    }

    const requesterLookup = getLookup(record, CONFIG.tables.service.requester);
    if (requesterLookup) {
      const allowedUsers = await getAllowedUsersForPassenger(requesterLookup.id);
      const requesterShares = await getSharedPrincipals(CONFIG.tables.passenger.logicalName, requesterLookup.id);
      result.checks.push(compareShares("requester", CONFIG.tables.passenger.logicalName, requesterLookup.id, allowedUsers, requesterShares, options));
    }

    const servicePassengers = await listServicePassengersByService(recordId);
    for (const link of servicePassengers) {
      const linkShares = await getSharedPrincipals(CONFIG.servicePassenger.logicalName, link.id);
      result.checks.push(compareShares("service_passenger_link", CONFIG.servicePassenger.logicalName, link.id, expectedUsers, linkShares, options));
    }

    const uniquePassengers = uniqueById(servicePassengers.map((item) => item.passenger).filter(Boolean));
    for (const passenger of uniquePassengers) {
      const allowedUsers = await getAllowedUsersForPassenger(passenger.id);
      const passengerShares = await getSharedPrincipals(CONFIG.tables.passenger.logicalName, passenger.id);
      result.checks.push(compareShares("passenger", CONFIG.tables.passenger.logicalName, passenger.id, allowedUsers, passengerShares, options));
    }

    return result;
  }

  async function buildServicePassengerAudit(recordId, options) {
    const record = await retrieveRecord(CONFIG.servicePassenger.logicalName, recordId, [
      "cr40f_servicosporpassageiroid",
      CONFIG.servicePassenger.serviceLookup,
      CONFIG.servicePassenger.passengerLookup
    ]);

    const serviceLookup = getLookup(record, CONFIG.servicePassenger.serviceLookup);
    const passengerLookup = getLookup(record, CONFIG.servicePassenger.passengerLookup);
    const serviceState = serviceLookup ? await getServiceCurrentDrivers(serviceLookup.id) : { drivers: [], identityIssues: [] };

    const result = {
      entity: CONFIG.servicePassenger.logicalName,
      recordId: cleanGuid(recordId),
      caseType: "service_passenger",
      label: "Servico por passageiro",
      checks: [],
      issues: [...serviceState.identityIssues.map((item) => makeIssue(item.severity, CONFIG.servicePassenger.logicalName, recordId, "identity", item.message, item.code))]
    };

    const linkShares = await getSharedPrincipals(CONFIG.servicePassenger.logicalName, recordId);
    result.checks.push(compareShares("service_passenger_link", CONFIG.servicePassenger.logicalName, recordId, serviceState.drivers, linkShares, options));

    if (passengerLookup) {
      const allowedUsers = await getAllowedUsersForPassenger(passengerLookup.id);
      const passengerShares = await getSharedPrincipals(CONFIG.tables.passenger.logicalName, passengerLookup.id);
      result.checks.push(compareShares("passenger", CONFIG.tables.passenger.logicalName, passengerLookup.id, allowedUsers, passengerShares, options));
    }

    return result;
  }

  async function getSampleIdsForEntity(logicalName, sampleSize) {
    const meta = await getEntityMeta(logicalName);
    const fetch = [
      `<fetch version="1.0" mapping="logical" top="${Number(sampleSize || CONFIG.sampleSizePerEntity) || 5}">`,
      `<entity name="${logicalName}">`,
      `<attribute name="${meta.primaryIdAttribute}" />`,
      "<order attribute=\"createdon\" descending=\"true\" />",
      "</entity>",
      "</fetch>"
    ].join("");

    const rows = await fetchXml(logicalName, fetch);
    return rows.map((row) => cleanGuid(row[meta.primaryIdAttribute])).filter(Boolean);
  }

  async function listServiceIdsForEmployee(employeeId) {
    const normalizedId = cleanGuid(employeeId);
    if (!normalizedId) {
      throw new Error("auditEmployee exige GUID valido do funcionario.");
    }

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - CONFIG.tables.service.backfillDaysBack);

    const categories = CONFIG.tables.service.backfillCategories || [];
    const categoryConditions = categories
      .map((value) => `<condition attribute="${CONFIG.tables.service.category}" operator="eq" value="${value}" />`)
      .join("");

    const fetch = [
      "<fetch version=\"1.0\" mapping=\"logical\">",
      `<entity name="${CONFIG.tables.service.logicalName}">`,
      `<attribute name="${CONFIG.tables.service.id}" />`,
      `<attribute name="${CONFIG.tables.service.startDate}" />`,
      "<filter type=\"and\">",
      `<condition attribute="${CONFIG.tables.service.driver}" operator="eq" value="${escapeXml(normalizedId)}" />`,
      `<condition attribute="${CONFIG.tables.service.startDate}" operator="on-or-after" value="${start.toISOString()}" />`,
      `<condition attribute="${CONFIG.tables.service.programmed}" operator="eq" value="1" />`,
      `<condition attribute="${CONFIG.tables.service.exchange}" operator="null" />`,
      categories.length ? `<filter type="or">${categoryConditions}</filter>` : "",
      "</filter>",
      `<order attribute="${CONFIG.tables.service.startDate}" descending="false" />`,
      "</entity>",
      "</fetch>"
    ].join("");

    const rows = await fetchXml(CONFIG.tables.service.logicalName, fetch);
    return rows.map((row) => cleanGuid(row[CONFIG.tables.service.id])).filter(Boolean);
  }

  async function auditRecord(logicalName, recordId) {
    const normalizedEntity = String(logicalName || "").trim().toLowerCase();
    const normalizedId = cleanGuid(recordId);
    if (!normalizedEntity || !normalizedId) {
      throw new Error("auditRecord exige logicalName e GUID validos.");
    }

    const direct = CONFIG.supportedDirectEntities.find((item) => item.logicalName === normalizedEntity);
    let result;
    if (direct) {
      result = await buildDirectRecordAudit(direct, normalizedId);
    } else if (normalizedEntity === CONFIG.servicePassenger.logicalName) {
      result = await buildServicePassengerAudit(normalizedId);
    } else {
      throw new Error(`Entidade nao suportada pelo plugin: ${normalizedEntity}`);
    }

    const report = finalizeReport([result]);
    printReport(report);
    return report;
  }

  async function auditEmployee(employeeId) {
    const normalizedId = cleanGuid(employeeId);
    if (!normalizedId) {
      throw new Error("auditEmployee exige GUID valido do funcionario.");
    }

    const employee = await retrieveRecord(CONFIG.tables.employee.logicalName, normalizedId, [
      CONFIG.tables.employee.id,
      CONFIG.tables.employee.name,
      CONFIG.tables.employee.email
    ]);
    const employeeResolution = await resolveEmployee({
      id: normalizedId,
      name: employee[CONFIG.tables.employee.name] || normalizedId
    });
    const auditOptions = {
      expectedUserIds: new Set((employeeResolution?.users || []).map((user) => cleanGuid(user.id)).filter(Boolean)),
      ignoreUnexpectedUsers: true
    };

    const serviceIds = await listServiceIdsForEmployee(normalizedId);
    console.log(
      `[DriverRecordSharingAudit] Funcionario ${employee[CONFIG.tables.employee.name] || normalizedId} ` +
        `<${employee[CONFIG.tables.employee.email] || "sem email"}>: ${serviceIds.length} servico(s) no escopo do plugin.`
    );

    if (employeeResolution?.status !== "resolved") {
      console.warn(
        `[DriverRecordSharingAudit] Funcionario ${employee[CONFIG.tables.employee.name] || normalizedId} ` +
          `nao resolveu para usuario ativo unico: ${employeeResolution?.status || "unknown"}.`
      );
    } else {
      console.log(
        `[DriverRecordSharingAudit] auditEmployee limitado ao usuario ` +
          `${employeeResolution.users[0].name || employeeResolution.users[0].email || employeeResolution.users[0].id}.`
      );
    }

    const results = [];
    for (const serviceId of serviceIds) {
      try {
        results.push(await buildDirectRecordAudit(CONFIG.supportedDirectEntities[0], serviceId, auditOptions));
      } catch (error) {
        results.push({
          entity: CONFIG.tables.service.logicalName,
          recordId: cleanGuid(serviceId),
          caseType: "direct",
          label: "Servico",
          checks: [],
          issues: [makeIssue("error", CONFIG.tables.service.logicalName, serviceId, "runtime", String(error?.message || error), "employee service audit failed")]
        });
      }
    }

    const report = finalizeReport(results);
    printReport(report);
    return report;
  }

  async function auditCurrentForm() {
    const formTarget = getCurrentFormTarget();
    if (!formTarget) {
      throw new Error(
        "Nao consegui descobrir entidade e ID da tela atual. Se for registro novo, salve antes. Se for registro existente, use auditRecord('entidade', 'GUID')."
      );
    }

    console.log(`[DriverRecordSharingAudit] Tela atual detectada via ${formTarget.source}: ${formTarget.entityName} ${formTarget.id}`);
    return auditRecord(formTarget.entityName, formTarget.id);
  }

  function pickFirstNonEmpty(values) {
    for (const value of values || []) {
      const text = String(value || "").trim();
      if (text) {
        return text;
      }
    }

    return "";
  }

  function tryBuildFormTarget(entityName, id, source) {
    const normalizedEntity = String(entityName || "").trim().toLowerCase();
    const normalizedId = cleanGuid(id);
    if (!normalizedEntity || !normalizedId) {
      return null;
    }

    return {
      entityName: normalizedEntity,
      id: normalizedId,
      source
    };
  }

  function tryReadXrmPage(sourceLabel, xrmObject) {
    try {
      const entity = xrmObject?.Page?.data?.entity;
      if (!entity) {
        return null;
      }

      return tryBuildFormTarget(entity.getEntityName?.(), entity.getId?.(), sourceLabel);
    } catch (error) {
      console.warn(`Falha lendo ${sourceLabel}:`, error);
      return null;
    }
  }

  function tryReadPageContext() {
    try {
      const pageContext = window.Xrm?.Utility?.getPageContext?.();
      const input = pageContext?.input;
      if (!input) {
        return null;
      }

      const entityName = pickFirstNonEmpty([
        input.entityName,
        input.etn,
        input.logicalName
      ]);

      const id = pickFirstNonEmpty([
        input.entityId,
        input.recordId,
        input.id
      ]);

      return tryBuildFormTarget(entityName, id, "Xrm.Utility.getPageContext");
    } catch (error) {
      console.warn("Falha lendo Xrm.Utility.getPageContext:", error);
      return null;
    }
  }

  function tryReadUrl(sourceLabel, rawUrl) {
    try {
      if (!rawUrl) {
        return null;
      }

      const url = new URL(rawUrl, window.location.origin);
      const direct = tryBuildFormTarget(url.searchParams.get("etn"), url.searchParams.get("id"), sourceLabel);
      if (direct) {
        return direct;
      }

      const hash = String(url.hash || "").replace(/^#/, "");
      if (!hash) {
        return null;
      }

      const hashVariants = [hash];
      try {
        const decoded = decodeURIComponent(hash);
        if (decoded && decoded !== hash) {
          hashVariants.push(decoded);
        }
      } catch (error) {
        console.warn(`Falha decodificando hash em ${sourceLabel}:`, error);
      }

      for (const variant of hashVariants) {
        const params = new URLSearchParams(variant.replace(/^[?#]/, ""));
        const candidate = tryBuildFormTarget(
          params.get("etn") || params.get("entityName"),
          params.get("id") || params.get("entityId") || params.get("recordId"),
          `${sourceLabel}#hash`
        );
        if (candidate) {
          return candidate;
        }
      }
    } catch (error) {
      console.warn(`Falha lendo ${sourceLabel}:`, error);
    }

    return null;
  }

  function getCurrentFormTarget() {
    const resolvers = [
      () => tryReadXrmPage("window.Xrm.Page", window.Xrm),
      () => tryReadXrmPage("window.parent.Xrm.Page", window.parent?.Xrm),
      () => tryReadXrmPage("window.top.Xrm.Page", window.top?.Xrm),
      () => tryReadPageContext(),
      () => tryReadUrl("window.location.href", window.location?.href),
      () => tryReadUrl("window.parent.location.href", window.parent?.location?.href),
      () => tryReadUrl("window.top.location.href", window.top?.location?.href)
    ];

    for (const resolve of resolvers) {
      const target = resolve();
      if (target) {
        return target;
      }
    }

    return null;
  }

  async function runAll(options = {}) {
    const sampleSizePerEntity = Number(options.sampleSizePerEntity || CONFIG.sampleSizePerEntity) || 5;
    const reports = [];

    for (const direct of CONFIG.supportedDirectEntities) {
      const ids = await getSampleIdsForEntity(direct.logicalName, sampleSizePerEntity);
      for (const id of ids) {
        try {
          reports.push(await buildDirectRecordAudit(direct, id));
        } catch (error) {
          reports.push({
            entity: direct.logicalName,
            recordId: cleanGuid(id),
            caseType: "direct",
            label: direct.label,
            checks: [],
            issues: [makeIssue("error", direct.logicalName, id, "runtime", String(error?.message || error), "record audit failed")]
          });
        }
      }
    }

    const servicePassengerIds = await getSampleIdsForEntity(CONFIG.servicePassenger.logicalName, sampleSizePerEntity);
    for (const id of servicePassengerIds) {
      try {
        reports.push(await buildServicePassengerAudit(id));
      } catch (error) {
        reports.push({
          entity: CONFIG.servicePassenger.logicalName,
          recordId: cleanGuid(id),
          caseType: "service_passenger",
          label: "Servico por passageiro",
          checks: [],
          issues: [makeIssue("error", CONFIG.servicePassenger.logicalName, id, "runtime", String(error?.message || error), "record audit failed")]
        });
      }
    }

    const report = finalizeReport(reports);
    printReport(report);
    return report;
  }

  function finalizeReport(recordResults) {
    const checkRows = [];
    const issueRows = [];

    for (const result of recordResults) {
      for (const check of result.checks || []) {
        checkRows.push(buildShareCheckRow(result, check));

        if (check.missingUsers.length > 0) {
          issueRows.push(
            makeIssue(
              "error",
              result.entity,
              result.recordId,
              check.scope,
              `Faltam shares em ${check.targetEntity}:${check.targetId}.`,
              check.missingUsers.map((item) => item.name || item.email || item.id).join(" | ")
            )
          );
        }

        if (check.unexpectedUsers.length > 0) {
          issueRows.push(
            makeIssue(
              "warning",
              result.entity,
              result.recordId,
              check.scope,
              `Ha shares sobrando em ${check.targetEntity}:${check.targetId}.`,
              check.unexpectedUsers.map((item) => item.principalName || item.principalId).join(" | ")
            )
          );
        }

        if (check.nonUserShares.length > 0) {
          issueRows.push(
            makeIssue(
              "warning",
              result.entity,
              result.recordId,
              check.scope,
              `Ha principals nao-user compartilhados em ${check.targetEntity}:${check.targetId}.`,
              check.nonUserShares.map((item) => `${item.principalType}:${item.principalName}`).join(" | ")
            )
          );
        }
      }

      issueRows.push(...(result.issues || []));
    }

    const summary = {
      auditedRecords: recordResults.length,
      totalChecks: checkRows.length,
      failedChecks: checkRows.filter((item) => item.status === "missing").length,
      warningChecks: checkRows.filter((item) => item.status === "unexpected").length,
      totalIssues: issueRows.length,
      errors: issueRows.filter((item) => item.severity === "error").length,
      warnings: issueRows.filter((item) => item.severity === "warning").length
    };

    return {
      generatedAt: new Date().toISOString(),
      summary,
      recordResults,
      checkRows,
      issueRows
    };
  }

  function printReport(report) {
    console.log("Resumo da auditoria do plugin:", report.summary);

    if (!CONFIG.logTables) {
      return;
    }

    console.log("Checks executados:");
    console.table(report.checkRows);

    if (report.issueRows.length > 0) {
      console.log("Issues encontradas:");
      console.table(report.issueRows);
    } else {
      console.log("Nenhuma issue encontrada.");
    }
  }

  window.DriverRecordSharingAudit = {
    config: CONFIG,
    runAll,
    auditCurrentForm,
    auditEmployee,
    auditRecord,
    getCurrentFormTarget
  };

  console.log("DriverRecordSharingAudit carregado.");
  console.log("Uso rapido:");
  console.log("  await window.DriverRecordSharingAudit.auditCurrentForm()");
  console.log("  await window.DriverRecordSharingAudit.auditEmployee('GUID_FUNCIONARIO')");
  console.log("  await window.DriverRecordSharingAudit.auditRecord('cr40f_reservadeveculos', 'GUID')");
  console.log("  await window.DriverRecordSharingAudit.runAll({ sampleSizePerEntity: 5 })");
})();
