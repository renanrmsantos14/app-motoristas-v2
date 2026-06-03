const fs = require("fs");

const input = "dataverse-metadata-prefix-2026-06-01T11-28-09-842Z.json";
const schema = JSON.parse(fs.readFileSync(input, "utf8"));
const tables = schema.entities ?? schema.Entities ?? schema.tables ?? schema.Tables ?? [];

const pickLabel = (value) =>
  value?.userLocalizedLabel ??
  value?.UserLocalizedLabel?.Label ??
  value?.localizedLabels?.[0]?.label ??
  value?.LocalizedLabels?.[0]?.Label ??
  "";

const interestingTables = new Set([
  "cr40f_reservadeveculos",
  "cr40f_manutencoes",
  "cr40f_trocasdecarro",
  "cr40f_funcionarios",
  "cr40f_servicosporpassageiro",
  "new_possedeveiculo"
]);

const index = tables
  .filter((table) => interestingTables.has(table.logicalName ?? table.LogicalName))
  .map((table) => {
    const attributes = table.attributes ?? table.Attributes ?? [];
    return {
      logicalName: table.logicalName ?? table.LogicalName,
      entitySetName: table.entitySetName ?? table.EntitySetName,
      primaryIdAttribute: table.primaryIdAttribute ?? table.PrimaryIdAttribute,
      primaryNameAttribute: table.primaryNameAttribute ?? table.PrimaryNameAttribute,
      displayName: pickLabel(table.displayName ?? table.DisplayName),
      attributes: attributes
        .filter((attr) => {
          const logical = attr.logicalName ?? attr.LogicalName ?? "";
          return logical.startsWith("cr40f_") || logical.startsWith("new_");
        })
        .map((attr) => ({
          logicalName: attr.logicalName ?? attr.LogicalName,
          schemaName: attr.schemaName ?? attr.SchemaName,
          type: attr.attributeType ?? attr.AttributeType ?? attr.attributeTypeName?.value ?? attr.AttributeTypeName?.Value,
          displayName: pickLabel(attr.displayName ?? attr.DisplayName),
          targets: attr.targets ?? attr.Targets ?? []
        }))
        .sort((a, b) => a.logicalName.localeCompare(b.logicalName))
    };
  });

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/dataverse-schema-index.json", JSON.stringify(index, null, 2));
console.log(JSON.stringify(index.map((table) => ({
  logicalName: table.logicalName,
  entitySetName: table.entitySetName,
  attributes: table.attributes.length
})), null, 2));
