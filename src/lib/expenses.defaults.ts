import type { ExpenseReferenceData } from "./expenses.types.ts";

export const DEFAULT_EXPENSE_REFERENCE_DATA: ExpenseReferenceData = {
  categories: [
    { id: "local-abastecimento", name: "Abastecimento", order: 10, exigeVeiculo: true, exigeReserva: false, exigeKm: true, exigeLitros: true },
    { id: "local-almoco", name: "Almo\u00e7o", order: 20, exigeVeiculo: false, exigeReserva: false, exigeKm: false, exigeLitros: false },
    { id: "local-aplicativos", name: "Aplicativos", order: 30, exigeVeiculo: false, exigeReserva: false, exigeKm: false, exigeLitros: false },
    { id: "local-cafe", name: "Caf\u00e9", order: 40, exigeVeiculo: false, exigeReserva: false, exigeKm: false, exigeLitros: false },
    { id: "local-estacionamento", name: "Estacionamento", order: 50, exigeVeiculo: false, exigeReserva: false, exigeKm: false, exigeLitros: false },
    { id: "local-gastos-cliente", name: "Gastos a pedido do cliente", order: 60, exigeVeiculo: false, exigeReserva: false, exigeKm: false, exigeLitros: false },
    { id: "local-hospedagem", name: "Hospedagem", order: 70, exigeVeiculo: false, exigeReserva: false, exigeKm: false, exigeLitros: false },
    { id: "local-jantar", name: "Jantar", order: 80, exigeVeiculo: false, exigeReserva: false, exigeKm: false, exigeLitros: false },
    { id: "local-lanche", name: "Lanche", order: 90, exigeVeiculo: false, exigeReserva: false, exigeKm: false, exigeLitros: false },
    { id: "local-lavagem", name: "Lavagem", order: 100, exigeVeiculo: true, exigeReserva: false, exigeKm: false, exigeLitros: false },
    { id: "local-locacao-carro", name: "Loca\u00e7\u00e3o de carro", order: 110, exigeVeiculo: false, exigeReserva: false, exigeKm: false, exigeLitros: false },
    { id: "local-manutencao", name: "Manuten\u00e7\u00e3o", order: 120, exigeVeiculo: true, exigeReserva: false, exigeKm: false, exigeLitros: false },
    { id: "local-outros", name: "Outros", order: 130, exigeVeiculo: false, exigeReserva: false, exigeKm: false, exigeLitros: false },
    { id: "local-pedagio", name: "Ped\u00e1gio", order: 140, exigeVeiculo: false, exigeReserva: false, exigeKm: false, exigeLitros: false }
  ],
  paymentMethods: [
    { id: "local-cartao-credito", name: "Cart\u00e3o de cr\u00e9dito", order: 10, tipo: "Cart\u00e3o" },
    { id: "local-ctf-sem-parar", name: "CTF (Sem parar)", order: 20, tipo: "Tag" },
    { id: "local-ticketlog", name: "TicketLog", order: 30, tipo: "Cart\u00e3o" },
    { id: "local-particular-reembolso", name: "Particular (Reembolso)", order: 40, tipo: "Reembolso" },
    { id: "local-dinheiro-corporativo", name: "Dinheiro (Corporativo)", order: 50, tipo: "Dinheiro" },
    { id: "local-faturado-plano-mensal", name: "Faturado (Plano mensal)", order: 60, tipo: "Faturado" }
  ],
  cities: []
};
