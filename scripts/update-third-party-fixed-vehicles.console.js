/**
 * Console script: popula veiculo fixo de fornecedores/terceiros na Geral.
 *
 * Regra:
 * - resolve fornecedor por cr40f_nomecompleto;
 * - resolve veiculo por cr40f_placa;
 * - busca todos os servicos da Geral com aquele motorista;
 * - se o servico esta sem veiculo, preenche com o veiculo fixo;
 * - se ja tem veiculo diferente, alerta na lista e nao sobrescreve;
 * - se ja esta correto, nao entra na lista final.
 *
 * Lista final:
 * ID | Data | Motorista | Placa antiga | Placa Nova
 */
(async () => {
  const DRY_RUN = false;
  const PAGE_SIZE = 5000;
  const PROGRESS_EVERY = 100;

  const FIXED_SUPPLIER_VEHICLES = [
    { motorista: "Eduardo Cristiano de Oliveira", placa: "EZC9F51" },
    { motorista: "Gilberto Fernandes Garcia", placa: "TJC5D76" },
    { motorista: "Jailton Pinheiro Oliveira", placa: "FPO8E53" },
    { motorista: "Altino Luiz Germano de Faria", placa: "UDY9B39" },
    { motorista: "Anderson Vilela", placa: "GHD4I08" },
    { motorista: "Cristiano Avelino", placa: "TCI5I44" },
    { motorista: "Edson Cosme", placa: "RMQ9J24" },
    { motorista: "Fabio Honorio", placa: "GCL9J98" },
    { motorista: "Fábio Ramos", placa: "RJD1E61" },
    { motorista: "Ismael Neto", placa: "UDO2F39" },
    { motorista: "Johnatas de Oliveira Lima", placa: "RUB3F07" },
    { motorista: "Leonardo Rocha", placa: "FCF3A04" },
    { motorista: "Lorran Lima Amorim Alves", placa: "GDP2G67" },
    { motorista: "Marcelo Rabelo", placa: "GDP2G67" },
    { motorista: "Ronaldo", placa: "EXJ5A23" }
  ];

  const SERVICE_ENTITY_SET = "cr40f_reservadeveculoses";
  const VEHICLE_ENTITY_SET = "cr40f_veiculoses";
  const EMPLOYEE_ENTITY_SET = "cr40f_funcionarioses";
  const SERVICE_ID_FIELD = "cr40f_reservadeveculosid";
  const SERVICE_NUMBER_FIELD = "cr40f_id";
  const SERVICE_DATE_FIELD = "cr40f_dataehorriodesada";
  const SERVICE_DRIVER_LOOKUP = "_cr40f_motorista_value";
  const SERVICE_VEHICLE_LOOKUP = "_cr40f_veiculo_value";
  const SERVICE_VEHICLE_NAV = "cr40f_Veiculo";
  const VEHICLE_ID_FIELD = "cr40f_veiculosid";
  const VEHICLE_PLATE_FIELD = "cr40f_placa";
  const EMPLOYEE_ID_FIELD = "cr40f_funcionariosid";
  const EMPLOYEE_NAME_FIELD = "cr40f_nomecompleto";
  const VEHICLE_FORMATTED = `${SERVICE_VEHICLE_LOOKUP}@OData.Community.Display.V1.FormattedValue`;
  const DATE_FORMATTED = `${SERVICE_DATE_FIELD}@OData.Community.Display.V1.FormattedValue`;

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

  const vehicleById = new Map();
  const lista = [];
  const issues = [];
  const actions = [];
  const summary = {
    environment: baseUrl,
    dryRun: DRY_RUN,
    suppliersConfigured: FIXED_SUPPLIER_VEHICLES.length,
    suppliersResolved: 0,
    vehiclesResolved: 0,
    servicesScanned: 0,
    alreadyCorrect: 0,
    dryRunWouldFillMissingVehicle: 0,
    missingVehiclesFilled: 0,
    divergenceAlerts: 0,
    skippedSupplierNotFound: 0,
    skippedSupplierDuplicate: 0,
    skippedVehicleNotFound: 0,
    skippedVehicleDuplicate: 0,
    errors: 0
  };

  function cleanGuid(value) {
    return String(value || "").replace(/[{}]/g, "").trim().toLowerCase();
  }

  function escapeODataText(value) {
    return String(value || "").replace(/'/g, "''");
  }

  function formatDateFromRecord(record) {
    const formatted = String(record?.[DATE_FORMATTED] || "").trim();
    if (formatted) return formatted;
    const raw = record?.[SERVICE_DATE_FIELD];
    const parsed = raw ? new Date(raw) : null;
    if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return "";
    const pad = (value) => String(value).padStart(2, "0");
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
  }

  function addListRow(service, motorista, placaAntiga, placaNova) {
    lista.push({
      ID: String(service?.[SERVICE_NUMBER_FIELD] || "").trim(),
      Data: formatDateFromRecord(service),
      Motorista: String(motorista || "").trim(),
      "Placa antiga": String(placaAntiga || "").trim().toUpperCase(),
      "Placa Nova": String(placaNova || "").trim().toUpperCase()
    });
  }

  function addIssue(kind, extra = {}) {
    issues.push({ kind, ...extra });
  }

  async function request(method, pathOrUrl, body) {
    const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${webApi}${pathOrUrl}`;
    const response = await fetch(url, {
      method,
      headers,
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined
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
      rows.push(...(page?.value || []));
      nextUrl = page?.["@odata.nextLink"] || null;
    }
    return rows;
  }

  async function resolveEmployeeByName(name) {
    const result = await request(
      "GET",
      `/${EMPLOYEE_ENTITY_SET}?$select=${EMPLOYEE_ID_FIELD},${EMPLOYEE_NAME_FIELD}&$filter=${EMPLOYEE_NAME_FIELD} eq '${escapeODataText(name)}'&$top=2`
    );
    const rows = result?.value || [];
    if (rows.length === 1) {
      summary.suppliersResolved += 1;
      return { ok: true, id: cleanGuid(rows[0][EMPLOYEE_ID_FIELD]), name: rows[0][EMPLOYEE_NAME_FIELD] };
    }
    if (!rows.length) return { ok: false, reason: "not_found" };
    return { ok: false, reason: "duplicate", count: rows.length };
  }

  async function resolveVehicleByPlate(plate) {
    const result = await request(
      "GET",
      `/${VEHICLE_ENTITY_SET}?$select=${VEHICLE_ID_FIELD},${VEHICLE_PLATE_FIELD}&$filter=${VEHICLE_PLATE_FIELD} eq '${escapeODataText(plate)}'&$top=2`
    );
    const rows = result?.value || [];
    if (rows.length === 1) {
      summary.vehiclesResolved += 1;
      return { ok: true, id: cleanGuid(rows[0][VEHICLE_ID_FIELD]), plate: String(rows[0][VEHICLE_PLATE_FIELD] || "").trim().toUpperCase() };
    }
    if (!rows.length) return { ok: false, reason: "not_found" };
    return { ok: false, reason: "duplicate", count: rows.length };
  }

  async function resolveVehicleById(vehicleId) {
    const id = cleanGuid(vehicleId);
    if (!id) return { id: "", plate: "" };
    if (vehicleById.has(id)) return vehicleById.get(id);
    const record = await request("GET", `/${VEHICLE_ENTITY_SET}(${id})?$select=${VEHICLE_ID_FIELD},${VEHICLE_PLATE_FIELD}`);
    const resolved = {
      id: cleanGuid(record?.[VEHICLE_ID_FIELD]),
      plate: String(record?.[VEHICLE_PLATE_FIELD] || "").trim().toUpperCase()
    };
    vehicleById.set(id, resolved);
    return resolved;
  }

  async function loadServicesByDriver(driverId) {
    const select = [
      SERVICE_ID_FIELD,
      SERVICE_NUMBER_FIELD,
      SERVICE_DATE_FIELD,
      SERVICE_DRIVER_LOOKUP,
      SERVICE_VEHICLE_LOOKUP
    ].join(",");
    const filter = `${SERVICE_DRIVER_LOOKUP} eq ${cleanGuid(driverId)}`;
    return listAll(`/${SERVICE_ENTITY_SET}?$select=${select}&$filter=${encodeURIComponent(filter)}&$orderby=${SERVICE_DATE_FIELD} asc`);
  }

  for (const item of FIXED_SUPPLIER_VEHICLES) {
    try {
      console.log(`[third-party-fixed-vehicles] processando ${item.motorista} / ${item.placa}`);
      const employee = await resolveEmployeeByName(item.motorista);
      if (!employee.ok) {
        if (employee.reason === "duplicate") summary.skippedSupplierDuplicate += 1;
        else summary.skippedSupplierNotFound += 1;
        addIssue(`supplier_${employee.reason}`, { motorista: item.motorista, count: employee.count || 0 });
        continue;
      }

      const vehicle = await resolveVehicleByPlate(item.placa);
      if (!vehicle.ok) {
        if (vehicle.reason === "duplicate") summary.skippedVehicleDuplicate += 1;
        else summary.skippedVehicleNotFound += 1;
        addIssue(`vehicle_${vehicle.reason}`, { motorista: item.motorista, placa: item.placa, count: vehicle.count || 0 });
        continue;
      }

      const services = await loadServicesByDriver(employee.id);
      console.log(`[third-party-fixed-vehicles] ${item.motorista}: ${services.length} servicos encontrados`);

      let processed = 0;
      for (const service of services) {
        processed += 1;
        summary.servicesScanned += 1;
        if (processed % PROGRESS_EVERY === 0 || processed === services.length) {
          console.log(`[third-party-fixed-vehicles] ${item.motorista}: ${processed}/${services.length}`);
        }

        const currentVehicleId = cleanGuid(service?.[SERVICE_VEHICLE_LOOKUP]);
        if (!currentVehicleId) {
          addListRow(service, employee.name, "", vehicle.plate);
          actions.push({
            action: DRY_RUN ? "would_fill_missing_vehicle" : "filled_missing_vehicle",
            serviceNumber: service?.[SERVICE_NUMBER_FIELD] || "",
            serviceId: cleanGuid(service?.[SERVICE_ID_FIELD]),
            motorista: employee.name,
            targetPlate: vehicle.plate
          });

          if (DRY_RUN) {
            summary.dryRunWouldFillMissingVehicle += 1;
            continue;
          }

          await request("PATCH", `/${SERVICE_ENTITY_SET}(${cleanGuid(service?.[SERVICE_ID_FIELD])})`, {
            [`${SERVICE_VEHICLE_NAV}@odata.bind`]: `/${VEHICLE_ENTITY_SET}(${vehicle.id})`
          });
          summary.missingVehiclesFilled += 1;
          continue;
        }

        if (currentVehicleId === vehicle.id) {
          summary.alreadyCorrect += 1;
          continue;
        }

        const currentVehicle = await resolveVehicleById(currentVehicleId);
        const oldPlate = currentVehicle.plate || service?.[VEHICLE_FORMATTED] || "";
        summary.divergenceAlerts += 1;
        addListRow(service, employee.name, oldPlate, vehicle.plate);
        actions.push({
          action: "divergence_only",
          serviceNumber: service?.[SERVICE_NUMBER_FIELD] || "",
          serviceId: cleanGuid(service?.[SERVICE_ID_FIELD]),
          motorista: employee.name,
          currentPlate: oldPlate,
          fixedPlate: vehicle.plate
        });
      }
    } catch (error) {
      summary.errors += 1;
      addIssue("error", { motorista: item.motorista, placa: item.placa, message: error?.message || String(error) });
      console.error("[third-party-fixed-vehicles] erro", item, error);
    }
  }

  lista.sort((a, b) => a.Data.localeCompare(b.Data) || a.ID.localeCompare(b.ID));
  const result = { summary, lista, actions, issues };
  window.ThirdPartyFixedVehicleLastResult = result;
  console.log("[third-party-fixed-vehicles] resumo", summary);
  console.table(lista);
  if (issues.length) console.table(issues);
  return result;
})();
