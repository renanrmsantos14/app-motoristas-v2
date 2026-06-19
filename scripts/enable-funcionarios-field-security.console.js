/**
 * Cole no console do Model-driven App, dentro do ambiente alvo.
 *
 * Alvo:
 * - tabela: cr40f_funcionarios
 *
 * Faz:
 * - lista atributos da tabela;
 * - filtra atributos securables;
 * - habilita IsSecured=true em lote;
 * - publica a tabela;
 * - mostra resumo final.
 *
 * Observacao:
 * - isto so habilita "seguranca de coluna" no metadata;
 * - ainda sera necessario configurar Field Security Profile para leitura/update/create.
 */
(async () => {
  const TABLE = "cr40f_funcionarios";
  const DRY_RUN = false;
  const PAUSE_EVERY = 20;
  const PAUSE_MS = 1200;

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
  if (!xrm) throw new Error("Xrm nao encontrado. Cole este script dentro do Model-driven App/Power Apps.");

  const clientUrl = xrm.Utility.getGlobalContext().getClientUrl().replace(/\/$/, "");
  const apiUrl = `${clientUrl}/api/data/v9.2`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0"
  };

  async function request(method, path, body = null) {
    const response = await fetch(`${apiUrl}/${path.replace(/^\//, "")}`, {
      method,
      credentials: "same-origin",
      headers,
      body: body ? JSON.stringify(body) : null
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message = data?.error?.message || text || response.statusText;
      const error = new Error(`${response.status} ${response.statusText}: ${message}`);
      error.response = data;
      throw error;
    }

    return data;
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function isManagedBooleanTrue(value) {
    if (value === true) return true;
    if (value?.Value === true) return true;
    return false;
  }

  function isAttributeSecurable(attribute) {
    return (
      isManagedBooleanTrue(attribute.CanBeSecuredForRead) ||
      isManagedBooleanTrue(attribute.CanBeSecuredForCreate) ||
      isManagedBooleanTrue(attribute.CanBeSecuredForUpdate)
    );
  }

  function isEligibleAttribute(attribute) {
    if (!attribute?.LogicalName || !attribute?.SchemaName || !attribute?.MetadataId) return false;
    if (attribute.AttributeOf) return false;
    if (!attribute["@odata.type"]) return false;
    return isAttributeSecurable(attribute);
  }

  function buildUpdateAttributePayload(attribute) {
    return {
      "@odata.type": attribute["@odata.type"],
      MetadataId: attribute.MetadataId,
      SchemaName: attribute.SchemaName,
      LogicalName: attribute.LogicalName,
      IsSecured: true
    };
  }

  function getAttributeMetadataPath(attribute) {
    const base = `EntityDefinitions(LogicalName='${TABLE}')/Attributes(LogicalName='${attribute.LogicalName}')`;
    const typeName = String(attribute["@odata.type"] ?? "").trim();
    if (!typeName) return base;
    return `${base}/${typeName}`;
  }

  function publishRequestBody(entityName) {
    return {
      ParameterXml: `<importexportxml><entities><entity>${entityName}</entity></entities><nodes/><securityroles/><settings/><workflows/></importexportxml>`
    };
  }

  console.log(`[field-security] lendo atributos de ${TABLE}...`);
  const metadata = await request(
    "GET",
    `EntityDefinitions(LogicalName='${TABLE}')?$select=LogicalName&$expand=Attributes($select=LogicalName,SchemaName,MetadataId,AttributeType,AttributeOf,IsSecured,CanBeSecuredForRead,CanBeSecuredForCreate,CanBeSecuredForUpdate)`
  );

  const allAttributes = Array.isArray(metadata?.Attributes) ? metadata.Attributes : [];
  const securableAttributes = allAttributes.filter(isEligibleAttribute);
  const pending = securableAttributes.filter((attribute) => attribute.IsSecured !== true);
  const alreadySecured = securableAttributes.filter((attribute) => attribute.IsSecured === true);

  console.table(
    securableAttributes.map((attribute) => ({
      logicalName: attribute.LogicalName,
      schemaName: attribute.SchemaName,
      attributeType: attribute.AttributeType,
      isSecured: attribute.IsSecured === true,
      canRead: isManagedBooleanTrue(attribute.CanBeSecuredForRead),
      canCreate: isManagedBooleanTrue(attribute.CanBeSecuredForCreate),
      canUpdate: isManagedBooleanTrue(attribute.CanBeSecuredForUpdate)
    }))
  );

  console.log(
    `[field-security] tabela=${TABLE} | total=${allAttributes.length} | securables=${securableAttributes.length} | jaSeguros=${alreadySecured.length} | faltando=${pending.length} | dryRun=${DRY_RUN}`
  );

  if (DRY_RUN || !pending.length) {
    console.log("[field-security] nada a aplicar.");
    return;
  }

  const updated = [];
  const failed = [];

  for (let index = 0; index < pending.length; index += 1) {
    const attribute = pending[index];
    try {
      await request("PATCH", getAttributeMetadataPath(attribute), buildUpdateAttributePayload(attribute));
      updated.push(attribute.LogicalName);
      console.log(`[field-security] ${index + 1}/${pending.length} ok -> ${attribute.LogicalName}`);
    } catch (error) {
      failed.push({
        logicalName: attribute.LogicalName,
        message: error.message
      });
      console.error(`[field-security] ${index + 1}/${pending.length} falhou -> ${attribute.LogicalName}`, error);
    }

    if ((index + 1) % PAUSE_EVERY === 0) {
      await wait(PAUSE_MS);
    }
  }

  if (updated.length) {
    console.log("[field-security] publicando tabela...");
    await request("POST", "PublishXml", publishRequestBody(TABLE));
    await wait(3000);
  }

  const finalMetadata = await request(
    "GET",
    `EntityDefinitions(LogicalName='${TABLE}')?$select=LogicalName&$expand=Attributes($select=LogicalName,IsSecured,CanBeSecuredForRead,CanBeSecuredForCreate,CanBeSecuredForUpdate)`
  );
  const finalSecurables = (finalMetadata?.Attributes ?? []).filter(isEligibleAttribute);
  const finalPending = finalSecurables.filter((attribute) => attribute.IsSecured !== true).map((attribute) => attribute.LogicalName);

  console.table([
    {
      tabela: TABLE,
      securables: securableAttributes.length,
      atualizados: updated.length,
      falhas: failed.length,
      restantesNaoSeguros: finalPending.length
    }
  ]);

  if (failed.length) {
    console.group("[field-security] falhas");
    console.table(failed);
    console.groupEnd();
  }

  if (finalPending.length) {
    console.warn("[field-security] atributos ainda nao securizados:", finalPending);
  } else {
    console.log(`[field-security] feito: todos atributos securables de ${TABLE} estao com IsSecured=true.`);
  }
})();
