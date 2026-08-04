import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const files = process.argv.slice(2);
for (const path of files) {
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(path));
  const sheets = JSON.parse((await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 10000 })).json ?? "[]");
  console.log(JSON.stringify({ path, sheets }));
  for (const sheet of sheets) {
    const result = await workbook.inspect({
      kind: "region",
      sheetId: sheet.name,
      range: "A1:AZ12",
      maxChars: 20000,
      tableMaxRows: 12,
      tableMaxCols: 52,
      tableMaxCellChars: 200,
    });
    console.log(result.ndjson);
  }
}
