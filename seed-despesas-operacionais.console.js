/**
 * Paste in Model-driven App console after creating the expense tables.
 * Seeds categories and payment methods for operational expenses.
 */
(async () => {
  const api = Xrm.WebApi;

  async function list(table, select) {
    const result = await api.retrieveMultipleRecords(table, `?$select=${select}&$top=500`);
    return result.entities;
  }

  async function existsByName(table, nameField, name) {
    const rows = await list(table, `${nameField}`);
    return rows.some((row) => String(row[nameField] ?? "").trim().toLowerCase() === name.toLowerCase());
  }

  async function createIfMissing(table, nameField, name, payload) {
    if (await existsByName(table, nameField, name)) {
      console.log(`[seed despesas] ja existe: ${table} / ${name}`);
      return;
    }
    await api.createRecord(table, payload);
    console.log(`[seed despesas] criado: ${table} / ${name}`);
  }

  const categories = [
    ["Combustivel", true, false, true, true, 10, "Frota"],
    ["Pedagio", false, false, false, false, 20, "Operacional"],
    ["Estacionamento", false, false, false, false, 30, "Operacional"],
    ["Lavagem", true, false, false, false, 40, "Frota"],
    ["Manutencao emergencial", true, false, false, false, 50, "Frota"],
    ["Alimentacao", false, false, false, false, 60, "Equipe"],
    ["Hospedagem", false, false, false, false, 70, "Equipe"],
    ["Outros", false, false, false, false, 999, "Outros"]
  ];

  for (const [nome, exigeVeiculo, exigeReserva, exigeKm, exigeLitros, ordem, grupo] of categories) {
    await createIfMissing("cr40f_categoriadespesaoperacional", "cr40f_nome", nome, {
      cr40f_nome: nome,
      cr40f_ativa: true,
      cr40f_exigeveiculo: exigeVeiculo,
      cr40f_exigereserva: exigeReserva,
      cr40f_exigekm: exigeKm,
      cr40f_exigelitros: exigeLitros,
      cr40f_ordem: ordem,
      cr40f_grupodre: grupo
    });
  }

  const paymentMethods = [
    ["Cartao empresa", "Cartao", 10],
    ["Cartao motorista", "Cartao", 20],
    ["Dinheiro motorista", "Dinheiro", 30],
    ["Pix motorista", "Pix", 40],
    ["Tag CTF", "Tag", 50],
    ["Sem Parar", "Tag", 60],
    ["Outros", "Outros", 999]
  ];

  for (const [nome, tipo, ordem] of paymentMethods) {
    await createIfMissing("cr40f_formapagamentodespesa", "cr40f_nome", nome, {
      cr40f_nome: nome,
      cr40f_ativa: true,
      cr40f_tipo: tipo,
      cr40f_ordem: ordem
    });
  }

  const check = {
    categorias: await list("cr40f_categoriadespesaoperacional", "cr40f_nome,cr40f_ativa,cr40f_exigelitros"),
    formasPagamento: await list("cr40f_formapagamentodespesa", "cr40f_nome,cr40f_ativa")
  };

  console.log("[seed despesas] concluido", check);
  return check;
})();
