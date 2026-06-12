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
    ["Abastecimento", true, false, true, true, 10, "Frota"],
    ["Almoço", false, false, false, false, 20, "Equipe"],
    ["Aplicativos", false, false, false, false, 30, "Operacional"],
    ["Café", false, false, false, false, 40, "Equipe"],
    ["Estacionamento", false, false, false, false, 50, "Operacional"],
    ["Gastos a pedido do cliente", false, false, false, false, 60, "Cliente"],
    ["Hospedagem", false, false, false, false, 70, "Equipe"],
    ["Jantar", false, false, false, false, 80, "Equipe"],
    ["Lanche", false, false, false, false, 90, "Equipe"],
    ["Lavagem", true, false, false, false, 100, "Frota"],
    ["Locação de carro", false, false, false, false, 110, "Operacional"],
    ["Manutenção", true, false, false, false, 120, "Frota"],
    ["Outros", false, false, false, false, 130, "Outros"],
    ["Pedágio", false, false, false, false, 140, "Operacional"]
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
    ["Cartão de crédito", "Cartão", 10],
    ["CTF (Sem parar)", "Tag", 20],
    ["TicketLog", "Cartão", 30],
    ["Particular (Reembolso)", "Reembolso", 40],
    ["Dinheiro (Corporativo)", "Dinheiro", 50],
    ["Faturado (Plano mensal)", "Faturado", 60]
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
