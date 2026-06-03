const fs = require("fs");

const [, , tableName, columnName] = process.argv;
if (!tableName || !columnName) {
  console.error("Uso: node scripts/inspect-schema-option.cjs <tabela> <campo>");
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync("dataverse-metadata-prefix-2026-06-01T11-28-09-842Z.json", "utf8"));
const entities = metadata.entities || metadata.Entities || [];
const entity = entities.find((item) => (item.logicalName || item.LogicalName) === tableName);
if (!entity) {
  console.error(`Tabela nao encontrada: ${tableName}`);
  process.exit(2);
}

const attributes = entity.attributes || entity.Attributes || [];
const attribute = attributes.find((item) => (item.logicalName || item.LogicalName) === columnName);
if (!attribute) {
  console.error(`Campo nao encontrado: ${tableName}.${columnName}`);
  process.exit(3);
}

const options =
  attribute.optionSet?.options ||
  attribute.OptionSet?.Options ||
  attribute.globalOptionSet?.options ||
  attribute.GlobalOptionSet?.Options ||
  [];
console.log(JSON.stringify(options.map((option) => ({
  value: option.value ?? option.Value,
  label: option.label?.userLocalizedLabel ?? option.Label?.UserLocalizedLabel?.Label ?? option.Label?.LocalizedLabels?.[0]?.Label ?? ""
})), null, 2));
