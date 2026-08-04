import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const [dataPath, outputPath] = process.argv.slice(2);
const data = JSON.parse(await fs.readFile(dataPath, "utf8"));
const workbook = Workbook.create();
const summary = workbook.worksheets.add("Resumo");
const audit = workbook.worksheets.add("Auditoria por OP");
const divergences = workbook.worksheets.add("Divergências");
const services = workbook.worksheets.add("Serviços");
const payers = workbook.worksheets.add("Pagantes");

const ops = [...new Set([...data.services.map((row) => row.op), ...data.payers.map((row) => row.op)])]
  .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

const titleStyle = { fill: "#17365D", font: { bold: true, color: "#FFFFFF", size: 16 }, verticalAlignment: "center" };
const headerStyle = { fill: "#D9EAF7", font: { bold: true, color: "#17365D" }, verticalAlignment: "center", wrapText: true, borders: { preset: "outside", style: "thin", color: "#AFC6D9" } };
const moneyFormat = 'R$ #,##0.00;[Red]-R$ #,##0.00';

services.getRange("A1:I1").values = [["Linha origem", "OP", "ID serviço", "Saída", "Cliente", "Passageiro", "Status operação", "Status faturamento", "Valor serviço"]];
services.getRange(`A2:I${data.services.length + 1}`).values = data.services.map((row) => [row.source_row, row.op, row.id, row.date, row.client, row.passenger, row.operation_status, row.billing_status, row.value]);
services.getRange("A1:I1").format = headerStyle;
services.getRange(`I2:I${data.services.length + 1}`).format.numberFormat = moneyFormat;
services.freezePanes.freezeRows(1);
services.tables.add(`A1:I${data.services.length + 1}`, true, "ServicosTable").style = "TableStyleMedium2";

payers.getRange("A1:H1").values = [["Linha origem", "OP", "ID pagante", "Valor", "Status pagamento", "Pagante", "Forma pagamento", "Data criação"]];
payers.getRange(`A2:H${data.payers.length + 1}`).values = data.payers.map((row) => [row.source_row, row.op, row.id, row.value, row.payment_status, row.payer, row.payment_method, row.created]);
payers.getRange("A1:H1").format = headerStyle;
payers.getRange(`D2:D${data.payers.length + 1}`).format.numberFormat = moneyFormat;
payers.freezePanes.freezeRows(1);
payers.tables.add(`A1:H${data.payers.length + 1}`, true, "PagantesTable").style = "TableStyleMedium2";

audit.getRange("A1:J1").values = [["OP", "Qtd. serviços", "Total serviços", "Qtd. pagantes", "Total pagantes (todos)", "Pagantes ativos", "Cancelados", "Diferença ativa", "Diferença todos", "Resultado"]];
audit.getRange(`A2:A${ops.length + 1}`).values = ops.map((op) => [op]);
const serviceEnd = data.services.length + 1;
const payerEnd = data.payers.length + 1;
for (let row = 2; row <= ops.length + 1; row += 1) {
  audit.getRange(`B${row}:J${row}`).formulas = [[
    `=COUNTIF('Serviços'!$B$2:$B$${serviceEnd},A${row})`,
    `=SUMIF('Serviços'!$B$2:$B$${serviceEnd},A${row},'Serviços'!$I$2:$I$${serviceEnd})`,
    `=COUNTIF('Pagantes'!$B$2:$B$${payerEnd},A${row})`,
    `=SUMIF('Pagantes'!$B$2:$B$${payerEnd},A${row},'Pagantes'!$D$2:$D$${payerEnd})`,
    `=SUMIFS('Pagantes'!$D$2:$D$${payerEnd},'Pagantes'!$B$2:$B$${payerEnd},A${row},'Pagantes'!$E$2:$E$${payerEnd},"<>Cancelado")`,
    `=E${row}-F${row}`,
    `=ROUND(F${row}-C${row},2)`,
    `=ROUND(E${row}-C${row},2)`,
    `=IF(B${row}=0,"SEM SERVIÇO NA GERAL",IF(D${row}=0,"SEM PAGANTE NO ARQUIVO",IF(H${row}=0,"BATE",IF(H${row}<0,"PAGANTES A MENOS","PAGANTES A MAIS"))))`,
  ]];
}
audit.getRange("A1:J1").format = headerStyle;
audit.getRange(`C2:I${ops.length + 1}`).format.numberFormat = moneyFormat;
audit.freezePanes.freezeRows(1);
audit.tables.add(`A1:J${ops.length + 1}`, true, "AuditoriaOPTable").style = "TableStyleMedium2";
audit.getRange(`J2:J${ops.length + 1}`).conditionalFormats.add("containsText", { text: "BATE", format: { fill: "#E2F0D9", font: { color: "#375623", bold: true } } });
audit.getRange(`J2:J${ops.length + 1}`).conditionalFormats.add("containsText", { text: "MENOS", format: { fill: "#FCE4D6", font: { color: "#9C0006", bold: true } } });
audit.getRange(`J2:J${ops.length + 1}`).conditionalFormats.add("containsText", { text: "MAIS", format: { fill: "#FFF2CC", font: { color: "#7F6000", bold: true } } });

const serviceMap = new Map();
for (const row of data.services) {
  const item = serviceMap.get(row.op) ?? { count: 0, total: 0 };
  item.count += 1; item.total += row.value; serviceMap.set(row.op, item);
}
const payerMap = new Map();
for (const row of data.payers) {
  const item = payerMap.get(row.op) ?? { count: 0, all: 0, active: 0, cancelled: 0 };
  item.count += 1; item.all += row.value;
  if (String(row.payment_status ?? "").trim().toLocaleLowerCase("pt-BR") === "cancelado") item.cancelled += row.value;
  else item.active += row.value;
  payerMap.set(row.op, item);
}
const mismatchRows = ops.map((op) => {
  const s = serviceMap.get(op) ?? { count: 0, total: 0 };
  const p = payerMap.get(op) ?? { count: 0, all: 0, active: 0, cancelled: 0 };
  const diffActive = Math.round((p.active - s.total) * 100) / 100;
  const diffAll = Math.round((p.all - s.total) * 100) / 100;
  let status = "BATE";
  if (!s.count) status = "SEM SERVIÇO NA GERAL";
  else if (!p.count) status = "SEM PAGANTE NO ARQUIVO";
  else if (diffActive < 0) status = "PAGANTES A MENOS";
  else if (diffActive > 0) status = "PAGANTES A MAIS";
  return [op, s.count, s.total, p.count, p.all, p.active, p.cancelled, diffActive, diffAll, status];
}).filter((row) => row[3] > 0 && row[1] > 0 && row[7] !== 0);

divergences.getRange("A1:J1").values = [["OP", "Qtd. serviços", "Total serviços", "Qtd. pagantes", "Total pagantes (todos)", "Pagantes ativos", "Cancelados", "Diferença ativa", "Diferença todos", "Resultado"]];
if (mismatchRows.length) divergences.getRange(`A2:J${mismatchRows.length + 1}`).values = mismatchRows;
divergences.getRange("A1:J1").format = headerStyle;
divergences.getRange(`C2:I${mismatchRows.length + 1}`).format.numberFormat = moneyFormat;
divergences.freezePanes.freezeRows(1);
divergences.tables.add(`A1:J${mismatchRows.length + 1}`, true, "DivergenciasTable").style = "TableStyleMedium9";

summary.mergeCells("A1:H2");
summary.getRange("A1").values = [["Auditoria de valores por Ordem de Pagamento"]];
summary.getRange("A1:H2").format = titleStyle;
summary.getRange("A4:B9").values = [
  ["Indicador", "Resultado"],
  ["OPs nos dois arquivos", ops.filter((op) => serviceMap.has(op) && payerMap.has(op)).length],
  ["OPs que batem (ativos)", ops.filter((op) => serviceMap.has(op) && payerMap.has(op) && Math.round(((payerMap.get(op)?.active ?? 0) - (serviceMap.get(op)?.total ?? 0)) * 100) === 0).length],
  ["OPs com pagantes a menos", mismatchRows.filter((row) => row[7] < 0).length],
  ["OPs com pagantes a mais", mismatchRows.filter((row) => row[7] > 0).length],
  ["OPs só na Geral", ops.filter((op) => serviceMap.has(op) && !payerMap.has(op)).length],
];
summary.getRange("A4:B4").format = headerStyle;
summary.getRange("D4:H9").values = [
  ["Critério", "Definição", null, null, null],
  ["Total serviços", "Soma de todas as linhas da mesma OP na planilha Geral.", null, null, null],
  ["Pagantes ativos", "Soma de todas as linhas da OP, excluindo Status do Pagamento = Cancelado.", null, null, null],
  ["Diferença ativa", "Pagantes ativos menos Total serviços. Zero significa igualdade exata em centavos.", null, null, null],
  ["Diferença todos", "Inclui registros cancelados; útil para identificar cancelamento sem reposição.", null, null, null],
  ["Escopo", "OP sem pagante no export não é tratada como erro de valor; aparece separadamente.", null, null, null],
];
summary.getRange("D4:H4").format = headerStyle;
summary.mergeCells("E5:H5"); summary.mergeCells("E6:H6"); summary.mergeCells("E7:H7"); summary.mergeCells("E8:H8"); summary.mergeCells("E9:H9");
summary.getRange("A11:H13").values = [
  ["Fontes", null, null, null, null, null, null, null],
  ["Geral", data.sources.agenda, null, null, null, null, null, null],
  ["Pagantes", data.sources.pagantes, null, null, null, null, null, null],
];
summary.getRange("A11:H11").format = headerStyle;
summary.mergeCells("B12:H12"); summary.mergeCells("B13:H13");
summary.showGridLines = false;

for (const sheet of [summary, audit, divergences, services, payers]) {
  const used = sheet.getUsedRange();
  used.format.font = { name: "Aptos", size: 10 };
  used.format.autofitColumns();
  used.format.autofitRows();
}
summary.getRange("A1:H2").format = titleStyle;
summary.getRange("A:A").format.columnWidth = 24;
summary.getRange("B:B").format.columnWidth = 18;
summary.getRange("D:D").format.columnWidth = 22;
summary.getRange("E:H").format.columnWidth = 18;
audit.getRange("A:J").format.columnWidth = 17;
divergences.getRange("A:J").format.columnWidth = 17;
services.getRange("D:H").format.columnWidth = 22;
payers.getRange("F:H").format.columnWidth = 22;

await fs.mkdir(new URL(".", `file:///${outputPath.replaceAll("\\", "/")}`).pathname, { recursive: true }).catch(() => {});
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const previewDir = outputPath.replace(/\.xlsx$/i, "-previews");
await fs.mkdir(previewDir, { recursive: true });
for (const sheetName of ["Resumo", "Auditoria por OP", "Divergências", "Serviços", "Pagantes"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 0.8, format: "png" });
  await fs.writeFile(`${previewDir}/${sheetName.replaceAll(" ", "-")}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const checks = [];
checks.push((await workbook.inspect({ kind: "table", range: "Resumo!A1:H13", include: "values,formulas", tableMaxRows: 15, tableMaxCols: 10, maxChars: 10000 })).ndjson);
checks.push((await workbook.inspect({ kind: "table", range: `Divergências!A1:J${mismatchRows.length + 1}`, include: "values,formulas", tableMaxRows: 30, tableMaxCols: 12, maxChars: 30000 })).ndjson);
checks.push((await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, summary: "formula errors" })).ndjson);
console.log(JSON.stringify({ outputPath, mismatchRows: mismatchRows.length, checks }));
