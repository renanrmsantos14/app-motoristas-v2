const fs = require("fs");

const source = fs.readFileSync("src/lib/dataverse.ts", "utf8");
const metadata = JSON.parse(fs.readFileSync("dataverse-metadata-prefix-2026-06-01T11-28-09-842Z.json", "utf8"));
const entities = Array.isArray(metadata) ? metadata : metadata.entities || metadata.EntityMetadata || metadata.value || [];

function findEntity(logicalName) {
  return entities.find((entity) => entity.LogicalName === logicalName || entity.logicalName === logicalName);
}

function entityAttributes(logicalName) {
  const entity = findEntity(logicalName);
  return new Set(((entity && (entity.attributes || entity.Attributes)) || []).map((attribute) => attribute.LogicalName || attribute.logicalName).filter(Boolean));
}

function selectFields(constName) {
  const pattern = new RegExp(`const ${constName} =\\s*\\n\\s*"\\$select=([^"]+)"`);
  const match = source.match(pattern);
  return match ? match[1].split(",") : [];
}

const checks = {
  GERAL_SELECT: "cr40f_reservadeveculos",
  MAINTENANCE_SELECT: "cr40f_manutencoes",
  EXCHANGE_SELECT: "cr40f_trocasdecarro"
};

for (const [constName, table] of Object.entries(checks)) {
  const attributes = entityAttributes(table);
  const fields = selectFields(constName).filter((field) => !field.startsWith("_"));
  const missing = fields.filter((field) => !attributes.has(field));
  console.log(`${constName} ${table}`);
  console.log(missing.length ? `missing: ${missing.join(", ")}` : "missing: none");
}

const inlineChecks = [
  {
    name: "current user",
    table: "systemuser",
    fields: ["internalemailaddress", "fullname"]
  },
  {
    name: "funcionarios",
    table: "cr40f_funcionarios",
    fields: ["cr40f_funcionariosid", "cr40f_nomecompleto", "cr40f_emailmicrosoft"]
  },
  {
    name: "servicos por passageiro",
    table: "cr40f_servicosporpassageiro",
    fields: [
      "cr40f_servicosporpassageiroid",
      "cr40f_ordemdeselecao",
      "new_enderecodesaidacolunaservicosporpassageiro"
    ]
  },
  {
    name: "banco de dados passageiro",
    table: "cr40f_bancodedados",
    fields: ["cr40f_bancodedadosid", "cr40f_nomedopassageiro", "cr40f_telefone", "cr40f_idioma"]
  },
  {
    name: "posse veiculo",
    table: "new_possedeveiculo",
    fields: ["new_possedeveiculoid", "new_fimdaposse"]
  }
];

for (const check of inlineChecks) {
  const attributes = entityAttributes(check.table);
  const missing = check.fields.filter((field) => !attributes.has(field));
  console.log(`${check.name} ${check.table}`);
  console.log(missing.length ? `missing: ${missing.join(", ")}` : "missing: none");
}

const writeChecks = [
  {
    name: "geral writes",
    table: "cr40f_reservadeveculos",
    fields: ["new_rascunhovoucher", "cr40f_status", "new_datadefinalizacao", "new_observacaofinal", "new_visualizacaodomotorista"]
  },
  {
    name: "manutencao writes",
    table: "cr40f_manutencoes",
    fields: [
      "cr40f_datamanutencao",
      "cr40f_estabelecimento",
      "cr40f_valor",
      "new_comentariosdocolaborador",
      "cr40f_servicorealizado",
      "cr40f_pagamento",
      "cr40f_status",
      "new_linkdanotafiscal",
      "new_linkdafotofinal1",
      "new_linkdafotofinal2",
      "new_linkdafotofinal3"
    ]
  },
  {
    name: "troca writes",
    table: "cr40f_trocasdecarro",
    fields: [
      "new_concluidomotorista1",
      "new_observacaodomotorista1",
      "new_concluidomotorista2",
      "new_observacaodomotorista2",
      "cr40f_statusdatroca"
    ]
  },
  {
    name: "posse writes",
    table: "new_possedeveiculo",
    fields: ["new_iniciodaposse", "new_fimdaposse"]
  }
];

for (const check of writeChecks) {
  const attributes = entityAttributes(check.table);
  const missing = check.fields.filter((field) => !attributes.has(field));
  console.log(`${check.name} ${check.table}`);
  console.log(missing.length ? `missing: ${missing.join(", ")}` : "missing: none");
}
