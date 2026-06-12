/**
 * Cole no console do Model-driven App, dentro do ambiente alvo.
 *
 * Popula/atualiza a tabela cr40f_cidade com municipios do Brasil via API oficial do IBGE.
 * Chave de deduplicacao: cr40f_codigo_ibge.
 * Campos:
 * - cr40f_name: "Cidade - UF"
 * - cr40f_nome
 * - cr40f_uf
 * - cr40f_pais: "Brasil"
 * - cr40f_codigo_ibge
 * - cr40f_nome_uf
 * - cr40f_regiao
 * - cr40f_ativa: true
 */
(async () => {
  const ENTITY = "cr40f_cidade";
  const ENTITY_SET = "cr40f_cidades";
  const IBGE_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome";
  const api = Xrm.WebApi.online || Xrm.WebApi;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function retrieveAllExisting() {
    const rows = [];
    let options = "?$select=cr40f_cidadeid,cr40f_codigo_ibge,cr40f_name,cr40f_nome,cr40f_uf,cr40f_pais,cr40f_nome_uf,cr40f_regiao,cr40f_ativa&$top=5000";
    while (options) {
      const result = await api.retrieveMultipleRecords(ENTITY, options);
      rows.push(...result.entities);
      if (!result.nextLink) break;
      const queryIndex = result.nextLink.indexOf("?");
      options = queryIndex >= 0 ? result.nextLink.slice(queryIndex) : "";
    }
    return rows;
  }

  function cityFromIbge(item) {
    const uf = item?.microrregiao?.mesorregiao?.UF;
    const regiao = uf?.regiao;
    const nome = String(item?.nome ?? "").trim();
    const siglaUf = String(uf?.sigla ?? "").trim().toUpperCase();
    return {
      cr40f_name: [nome, siglaUf].filter(Boolean).join(" - "),
      cr40f_nome: nome,
      cr40f_uf: siglaUf,
      cr40f_pais: "Brasil",
      cr40f_codigo_ibge: String(item?.id ?? "").trim(),
      cr40f_nome_uf: String(uf?.nome ?? "").trim(),
      cr40f_regiao: String(regiao?.nome ?? "").trim(),
      cr40f_ativa: true
    };
  }

  function changed(current, next) {
    return Object.entries(next).some(([key, value]) => String(current[key] ?? "") !== String(value ?? ""));
  }

  console.log("[Cidades] Baixando municipios do IBGE.");
  const ibgeResponse = await fetch(IBGE_URL, { headers: { Accept: "application/json" } });
  if (!ibgeResponse.ok) throw new Error(`IBGE falhou: ${ibgeResponse.status} ${ibgeResponse.statusText}`);
  const ibgeRows = await ibgeResponse.json();
  if (!Array.isArray(ibgeRows) || ibgeRows.length < 5000) throw new Error(`IBGE retornou quantidade inesperada: ${ibgeRows?.length ?? "n/a"}`);

  console.log("[Cidades] Carregando existentes do Dataverse.");
  const existingRows = await retrieveAllExisting();
  const existingByIbge = new Map(existingRows.map((row) => [String(row.cr40f_codigo_ibge ?? "").trim(), row]));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const failures = [];

  for (let index = 0; index < ibgeRows.length; index += 1) {
    const next = cityFromIbge(ibgeRows[index]);
    if (!next.cr40f_codigo_ibge || !next.cr40f_nome || !next.cr40f_uf) {
      failures.push({ index, motivo: "Dados IBGE incompletos", item: ibgeRows[index] });
      continue;
    }

    const current = existingByIbge.get(next.cr40f_codigo_ibge);
    try {
      if (!current) {
        await api.createRecord(ENTITY, next);
        created += 1;
      } else if (changed(current, next)) {
        await api.updateRecord(ENTITY, current.cr40f_cidadeid, next);
        updated += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      failures.push({
        codigoIbge: next.cr40f_codigo_ibge,
        cidade: next.cr40f_name,
        erro: error?.message || String(error)
      });
    }

    if ((index + 1) % 100 === 0) {
      console.log(`[Cidades] ${index + 1}/${ibgeRows.length} | criadas=${created} atualizadas=${updated} sem_mudanca=${skipped} falhas=${failures.length}`);
      await sleep(120);
    }
  }

  const check = await api.retrieveMultipleRecords(ENTITY, "?$select=cr40f_cidadeid&$filter=cr40f_pais eq 'Brasil'&$top=10");
  console.table([{ fonte: "IBGE", recebidas: ibgeRows.length, criadas: created, atualizadas: updated, semMudanca: skipped, falhas: failures.length, amostraBrasil: check.entities.length }]);
  if (failures.length) {
    console.group("[Cidades] Falhas");
    console.table(failures.slice(0, 50));
    console.groupEnd();
    throw new Error(`Seed terminou com ${failures.length} falha(s). Veja console.`);
  }
  console.log(`Feito: ${ENTITY_SET} populada/atualizada com municipios do Brasil.`);
})();
