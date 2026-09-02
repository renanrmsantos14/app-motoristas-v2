import type { AgendaItem, DetailAction, DetailData, Tile } from "../types";

export const tiles: Tile[] = [
  { label: "Visualizar Serviços", variant: "active", icon: "cars", target: "servicos" },
  { label: "Visualizar Histórico", variant: "active", icon: "clock", target: "historico" },
  { label: "Lançar Gastos", variant: "active", icon: "money", target: "servicos" },
  { label: "Solicitar Manutenções", variant: "active", icon: "tools", target: "servicos" }
];

const GERAL_ENTITY_SET = "cr40f_reservadeveculoses";
const TROCA_ENTITY_SET = "cr40f_trocasdecarros";
const MANUTENCAO_ENTITY_SET = "cr40f_manutencoeses";

type ServiceOptions = {
  itemId: string;
  id: string;
  time: string;
  description: string;
  priority: 0 | 1 | 3 | 10;
  client: string;
  receive: "Sim" | "Não";
  amount: string;
  amountValue: number;
  departureAt: string;
  route: string;
  passengersHtml: string;
  departureAddress: string;
  destination: string;
  operationNotes: string;
  passengerProfile: string;
  requester: string;
  vehicle: string;
  actions: DetailAction[];
  searchText: string;
  canceled?: boolean;
  returnForecast?: string;
  finalizationAt?: string;
  finalObservation?: string;
};

type ExchangeOptions = {
  itemId: string;
  id: string;
  label: string;
  title: string;
  time: string;
  description: string;
  priority: 0 | 1 | 3;
  window: string;
  summary: string;
  actionLabel: string;
  giving?: string;
  receiving?: string;
  contactName?: string;
  contactPhone?: string;
  kind: string;
  notes: string;
  operationNotes?: string;
  searchText: string;
};

type MaintenanceOptions = {
  itemId: string;
  id: string;
  time: string;
  description: string;
  dateLabel: string;
  vehicle: string;
  scenario: string;
  driverComments: string;
  serviceDone?: string;
  establishment?: string;
  payment?: string;
  value?: string;
  finalizationAt?: string;
  collaboratorComments?: string;
  requestLinks?: string[];
  finalLinks?: string[];
  invoiceLink?: string;
  searchText: string;
  history?: boolean;
};

function parseBrazilianDateTime(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return "";
  const [, day, month, year, hour, minute] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)).toISOString();
}

function serviceDetail(options: ServiceOptions): DetailData {
  const fields = [
    { label: "Data e Horário de Saída", value: options.departureAt },
    ...(options.returnForecast ? [{ label: "Previsão de retorno", value: options.returnForecast }] : []),
    ...(options.finalizationAt ? [{ label: "Data de Finalização", value: options.finalizationAt }] : []),
    { label: "Cliente", value: options.client },
    { label: "Receber", value: options.receive },
    { label: "Valor a Receber", value: options.amount },
    { label: "Trajeto", value: options.route },
    { label: "Passageiros e Telefones de Contato", value: options.passengersHtml, html: true },
    { label: "Endereço de Saída", value: options.departureAddress },
    { label: "Destino", value: options.destination },
    { label: "Obs de Operação", value: options.operationNotes },
    { label: "Perfil do Passageiro", value: options.passengerProfile },
    { label: "Solicitante", value: options.requester },
    { label: "Veículo", value: options.vehicle },
    ...(options.finalObservation ? [{ label: "Observação Final", value: options.finalObservation }] : [])
  ];

  return {
    type: "SERVICO",
    id: options.id,
    title: "Detalhes do Serviço",
    actions: options.actions,
    fields,
    dataverse: {
      entitySetName: GERAL_ENTITY_SET,
      id: options.id,
      record: {
        cr40f_dataehorriodesada: parseBrazilianDateTime(options.departureAt),
        cr40f_receber: options.receive === "Sim",
        cr40f_cotao: options.amountValue,
        cr40f_trajeto: options.route,
        cr40f_obsdeoperao: options.operationNotes,
        cr40f_horrioprevistoderetorno: options.returnForecast ? parseBrazilianDateTime(options.returnForecast) : null,
        new_datadefinalizacao: options.finalizationAt ? parseBrazilianDateTime(options.finalizationAt) : null
      }
    }
  };
}

function serviceItem(options: ServiceOptions): AgendaItem {
  return {
    id: options.itemId,
    tipo: "SERVICO",
    label: "Serviço",
    time: options.time,
    description: options.description,
    priority: options.priority,
    canceled: options.canceled,
    searchText: options.searchText,
    detail: serviceDetail(options)
  };
}

function exchangeItem(options: ExchangeOptions, history = false): AgendaItem {
  const fields = [
    { label: "Janela da Troca", value: options.window },
    { label: "Resumo", value: options.summary, strong: true },
    { label: "O que fazer", value: options.actionLabel, strong: true },
    ...(options.giving ? [{ label: "Você entrega", value: options.giving, strong: true }] : []),
    ...(options.receiving ? [{ label: "Você recebe", value: options.receiving, strong: true }] : []),
    ...(options.contactName ? [{ label: "Encontrar com", value: options.contactName }] : []),
    ...(options.contactPhone ? [{ label: "Telefone", value: options.contactPhone, contact: { phone: options.contactPhone } }] : []),
    { label: "Tipo de Troca", value: options.kind },
    { label: "Observação", value: options.notes },
    ...(options.operationNotes ? [{ label: "Obs de Operação", value: options.operationNotes }] : [])
  ];

  return {
    id: options.itemId,
    tipo: "TROCA",
    label: options.label,
    time: options.time,
    description: options.description,
    priority: options.priority,
    searchText: options.searchText,
    detail: {
      type: "TROCA",
      id: options.id,
      title: options.title,
      actions: history ? [] : ["finalizar"],
      fields,
      dataverse: {
        entitySetName: TROCA_ENTITY_SET,
        id: options.id,
        record: {}
      }
    }
  };
}

function maintenanceItem(options: MaintenanceOptions): AgendaItem {
  const fields = [
    { label: "Data e Horário da Manutenção", value: options.dateLabel },
    ...(options.finalizationAt ? [{ label: "Data de Finalização", value: options.finalizationAt }] : []),
    ...(options.history ? [{ label: "ID Manutenção", value: options.id }] : []),
    { label: "Veículo", value: options.vehicle },
    { label: "Descrição do Cenário Encontrado", value: options.scenario },
    { label: "Comentários ao Motorista", value: options.driverComments },
    ...(options.collaboratorComments ? [{ label: "Comentários do Colaborador", value: options.collaboratorComments }] : []),
    ...(options.serviceDone ? [{ label: "Serviço Realizado", value: options.serviceDone }] : []),
    ...(options.establishment ? [{ label: "Estabelecimento", value: options.establishment }] : []),
    ...(options.payment ? [{ label: "Forma de Pagamento", value: options.payment }] : []),
    ...(options.value ? [{ label: "Valor", value: options.value }] : []),
    ...(options.requestLinks?.[0] ? [{ label: "Link Foto Solicitação 1", value: options.requestLinks[0] }] : []),
    ...(options.requestLinks?.[1] ? [{ label: "Link Foto Solicitação 2", value: options.requestLinks[1] }] : []),
    ...(options.requestLinks?.[2] ? [{ label: "Link Foto Solicitação 3", value: options.requestLinks[2] }] : []),
    ...(options.invoiceLink ? [{ label: "Link Nota Fiscal", value: options.invoiceLink }] : []),
    ...(options.finalLinks?.[0] ? [{ label: "Link Foto Final 1", value: options.finalLinks[0] }] : []),
    ...(options.finalLinks?.[1] ? [{ label: "Link Foto Final 2", value: options.finalLinks[1] }] : []),
    ...(options.finalLinks?.[2] ? [{ label: "Link Foto Final 3", value: options.finalLinks[2] }] : [])
  ];

  return {
    id: options.itemId,
    tipo: "MANUTENCAO",
    label: "Manutenção",
    time: options.time,
    description: options.description,
    priority: 0,
    searchText: options.searchText,
    detail: {
      type: "MANUTENCAO",
      id: options.id,
      title: "Detalhes da Manutenção",
      actions: options.history ? [] : ["cancel", "finalizar"],
      fields,
      dataverse: {
        entitySetName: MANUTENCAO_ENTITY_SET,
        id: options.id,
        record: {}
      }
    }
  };
}

export const agendaMock: AgendaItem[] = [
  { id: "h-hoje", tipo: "HEADER", tituloData: "HOJE", seta: "" },
  serviceItem({
    itemId: "srv-10240",
    id: "10240",
    time: "HOJE 09:15",
    description: "Base Betinhos -> Aeroporto de Guarulhos",
    priority: 10,
    client: "Particular",
    receive: "Sim",
    amount: "R$ 380,00",
    amountValue: 380,
    departureAt: "01/07/2026 09:15",
    returnForecast: "01/07/2026 13:15",
    route: "Base Betinhos -> Aeroporto de Guarulhos",
    passengersHtml: "Henrique Tavares<br />+55 (11) 99888-1100",
    departureAddress: "Rua das Acácias, 120 - Jardim Satélite, São José dos Campos - SP",
    destination: "GRU Airport - Terminal 3, Guarulhos - SP",
    operationNotes: "Receber em cartão na chegada. Passageiro com 2 malas e 1 bagagem de mão.",
    passengerProfile: "Família executiva. Confirmar carrinho de bagagem ao desembarque.",
    requester: "Fernanda Lima",
    vehicle: "Spin Preta FGH4J21",
    actions: ["cancel", "receber"],
    searchText: "10240 base betinhos aeroporto guarulhos receber servico hoje 09:15"
  }),
  serviceItem({
    itemId: "srv-10241",
    id: "10241",
    time: "HOJE 14:30",
    description: "Hotel Fasano São Paulo -> Aeroporto de Congonhas",
    priority: 1,
    client: "Tenaris",
    receive: "Não",
    amount: "R$ 0,00",
    amountValue: 0,
    departureAt: "01/07/2026 14:30",
    route: "Hotel Fasano São Paulo -> Aeroporto de Congonhas",
    passengersHtml: "Ana Paula Martins<br />+55 (11) 98765-4321<br /><br />Roberto Almeida<br />+55 (11) 91234-5678",
    departureAddress: "Rua Vittorio Fasano, 88 - Jardins, São Paulo - SP",
    destination: "Aeroporto de Congonhas - Av. Washington Luís, s/n - São Paulo - SP",
    operationNotes: "Passageiros aguardam na recepção. Confirmar bagagens antes da saída.",
    passengerProfile: "Executivo. Atendimento discreto. Prefere trajeto direto.",
    requester: "Mariana Costa",
    vehicle: "Corolla Preto ABC1D23",
    actions: ["cancel", "voucher"],
    searchText: "10241 hotel fasano sao paulo aeroporto de congonhas tenaris voucher servico hoje 14:30"
  }),
  exchangeItem({
    itemId: "troca-381",
    id: "381",
    label: "Troca entre Motoristas",
    title: "Troca entre Motoristas",
    time: "HOJE entre 16:00 e 17:00",
    description: "Entregar Corolla ABC1D23 e receber Civic XYZ9A87",
    priority: 3,
    window: "01/07/2026 16:00 - 17:00",
    summary: "Troque com Carlos Andrade. Entregue Corolla Preto ABC1D23 e receba Civic Prata XYZ9A87.",
    actionLabel: "Trocar veículo com Carlos Andrade",
    giving: "Corolla Preto ABC1D23",
    receiving: "Civic Prata XYZ9A87",
    contactName: "Carlos Andrade",
    contactPhone: "+55 (12) 99723-6961",
    kind: "Troca",
    notes: "Troca combinada na base operacional. Conferir pertences, documentos e chaves antes da entrega.",
    operationNotes: "Ponto de encontro na portaria da base. Confirmar fotos do veículo antes da saída.",
    searchText: "381 troca entre motoristas carlos andrade corolla abc1d23 civic xyz9a87 hoje 16:00 17:00"
  }),
  exchangeItem({
    itemId: "troca-382",
    id: "382",
    label: "Retirada na Base",
    title: "Retirada na Base",
    time: "HOJE entre 17:20 e 18:00",
    description: "Retirar Spin Preta FGH4J21 na base",
    priority: 1,
    window: "01/07/2026 17:20 - 18:00",
    summary: "Retire Spin Preta FGH4J21 na base operacional.",
    actionLabel: "Retirar veículo na base",
    receiving: "Spin Preta FGH4J21",
    kind: "Retirada da base",
    notes: "Veículo separado para serviço noturno. Conferir combustível, TAG e documentos.",
    operationNotes: "Chave com a operação. Veículo estacionado na vaga 04.",
    searchText: "382 retirada na base spin preta fgh4j21 hoje 17:20 18:00"
  }),
  maintenanceItem({
    itemId: "manut-76",
    id: "76",
    time: "HOJE 18:10",
    description: "Manutenção no Corolla Preto ABC1D23",
    dateLabel: "01/07/2026 18:10",
    vehicle: "Corolla Preto ABC1D23",
    scenario: "Verificar ruído no freio dianteiro, calibragem dos pneus e alinhamento após impacto em buraco.",
    driverComments: "Levar o veículo até a base, fotografar pneus e aguardar orientação do Júnior.",
    collaboratorComments: "Aprovação já alinhada com a operação caso o diagnóstico confirme desgaste.",
    requestLinks: [
      "https://example.com/mock/manutencao/76/solicitacao-1.jpg",
      "https://example.com/mock/manutencao/76/solicitacao-2.jpg"
    ],
    searchText: "76 manutencao corolla preto abc1d23 hoje 18:10"
  }),
  { id: "h-amanha", tipo: "HEADER", tituloData: "AMANHÃ", seta: "" },
  serviceItem({
    itemId: "srv-10244",
    id: "10244",
    time: "AMANHÃ 08:20",
    description: "Residencial Alphaville -> Reunião Faria Lima",
    priority: 3,
    client: "Cliente Executivo Alphaville",
    receive: "Não",
    amount: "R$ 0,00",
    amountValue: 0,
    departureAt: "02/07/2026 08:20",
    route: "Residencial Alphaville -> Reunião Faria Lima",
    passengersHtml: "Eduardo Ribeiro<br />+55 (11) 95555-0101",
    departureAddress: "Alameda Rio Negro, Alphaville - Barueri - SP",
    destination: "Av. Brigadeiro Faria Lima, 3477 - Itaim Bibi, São Paulo - SP",
    operationNotes: "Chegar 10 minutos antes. Passageiro seguirá para reunião com três executivos.",
    passengerProfile: "Diretor financeiro. Prefere silêncio no trajeto.",
    requester: "Patrícia Gomes",
    vehicle: "Civic Prata XYZ9A87",
    actions: ["cancel", "finalizar"],
    searchText: "10244 residencial alphaville reuniao faria lima servico amanha 08:20"
  }),
  serviceItem({
    itemId: "srv-10245",
    id: "10245",
    time: "AMANHÃ 22:40",
    description: "Hotel Unique -> Fazenda Boa Vista",
    priority: 1,
    client: "Particular Premium",
    receive: "Sim",
    amount: "R$ 1.250,00",
    amountValue: 1250,
    departureAt: "02/07/2026 22:40",
    route: "Hotel Unique -> Fazenda Boa Vista",
    passengersHtml: "Luciana Ferraz<br />+55 (11) 97770-1111<br /><br />Criança 1<br />Cadeirinha obrigatória",
    departureAddress: "Av. Brigadeiro Luís Antônio, 4700 - Jardim Paulista, São Paulo - SP",
    destination: "Rod. Castello Branco, km 102,5 - Porto Feliz - SP",
    operationNotes: "Receber via Pix ao final. Confirmar cadeirinha infantil e parada rápida em posto seguro.",
    passengerProfile: "Família com criança. Atenção a conforto, climatização e bagagem extra.",
    requester: "Paula Ferraz",
    vehicle: "Trailblazer Branca QWE5R67",
    actions: ["cancel", "receber"],
    searchText: "10245 hotel unique fazenda boa vista receber pix servico amanha 22:40"
  }),
  exchangeItem({
    itemId: "troca-384",
    id: "384",
    label: "Devolução à Base",
    title: "Devolução à Base",
    time: "AMANHÃ entre 11:00 e 12:00",
    description: "Devolver Civic Prata XYZ9A87 na base",
    priority: 0,
    window: "02/07/2026 11:00 - 12:00",
    summary: "Devolva Civic Prata XYZ9A87 na base operacional.",
    actionLabel: "Devolver veículo na base",
    giving: "Civic Prata XYZ9A87",
    kind: "Devolução à base",
    notes: "Devolver veículo limpo, sem objetos pessoais e com checklist preenchido.",
    operationNotes: "Após a devolução, entregar chave e documento ao responsável da base.",
    searchText: "384 devolucao a base civic prata xyz9a87 amanha 11:00 12:00"
  })
];

export const historyMock: AgendaItem[] = [
  { id: "hist-hoje", tipo: "HEADER", tituloData: "HOJE", seta: "" },
  serviceItem({
    itemId: "hist-srv-10239",
    id: "10239",
    time: "HOJE 09:10",
    description: "Aeroporto de Guarulhos -> Escritório Tenaris",
    priority: 0,
    client: "Tenaris",
    receive: "Não",
    amount: "R$ 0,00",
    amountValue: 0,
    departureAt: "01/07/2026 09:10",
    route: "Aeroporto de Guarulhos -> Escritório Tenaris",
    passengersHtml: "Marcelo Nunes<br />+55 (11) 97777-0101",
    departureAddress: "GRU Airport - Terminal 3",
    destination: "Av. das Nações Unidas, 12995 - Brooklin, São Paulo - SP",
    operationNotes: "Voucher gerado e serviço concluído.",
    passengerProfile: "Executivo internacional. Atendimento discreto.",
    requester: "Camila Torres",
    vehicle: "Corolla Preto ABC1D23",
    actions: [],
    searchText: "10239 guarulhos escritorio tenaris servico concluido hoje",
    finalizationAt: "01/07/2026 10:05"
  }),
  serviceItem({
    itemId: "hist-srv-10238",
    id: "10238",
    time: "ONTEM 21:35",
    description: "Shopping Iguatemi -> Aeroporto de Congonhas",
    priority: 0,
    client: "Particular",
    receive: "Sim",
    amount: "R$ 245,00",
    amountValue: 245,
    departureAt: "30/06/2026 21:35",
    route: "Shopping Iguatemi -> Aeroporto de Congonhas",
    passengersHtml: "Priscila Moraes<br />+55 (11) 96666-4400",
    departureAddress: "Av. Brigadeiro Faria Lima, 2232 - Jardim Paulistano, São Paulo - SP",
    destination: "Aeroporto de Congonhas - São Paulo - SP",
    operationNotes: "Recebimento confirmado com dois comprovantes anexados.",
    passengerProfile: "Passageira frequente. Prefere embarque rápido e direto.",
    requester: "Priscila Moraes",
    vehicle: "Civic Prata XYZ9A87",
    actions: [],
    searchText: "10238 iguatemi congonhas receber concluido ontem",
    finalizationAt: "30/06/2026 22:18",
    finalObservation: "Pagamento confirmado via Pix e comprovantes enviados."
  }),
  exchangeItem({
    itemId: "hist-troca-376",
    id: "376",
    label: "Troca de Carro",
    title: "Detalhes da Troca",
    time: "ONTEM 17:30",
    description: "Troca concluída com Base Operacional",
    priority: 0,
    window: "30/06/2026 17:00 - 18:00",
    summary: "Troca concluída com a base operacional sem pendências.",
    actionLabel: "Troca concluída",
    giving: "Corolla Preto ABC1D23",
    receiving: "Civic Prata XYZ9A87",
    contactName: "Base Operacional",
    contactPhone: "+55 (12) 99723-6961",
    kind: "Troca",
    notes: "Checklist final conferido e sem avarias adicionais.",
    searchText: "376 troca carro base operacional concluida ontem"
  }, true),
  maintenanceItem({
    itemId: "hist-manut-72",
    id: "72",
    time: "2 dias atrás 15:40",
    description: "Manutenção realizada no Civic Prata XYZ9A87",
    dateLabel: "29/06/2026 15:40",
    vehicle: "Civic Prata XYZ9A87",
    scenario: "Troca de pastilhas de freio dianteiras e reaperto geral.",
    driverComments: "Serviço autorizado pelo Júnior.",
    collaboratorComments: "Validado com fornecedor homologado.",
    serviceDone: "Pastilhas substituídas, alinhamento conferido e teste de rodagem aprovado.",
    establishment: "Auto Center Vila Olímpia",
    payment: "Cartão",
    value: "R$ 480,00",
    finalizationAt: "29/06/2026 17:12",
    invoiceLink: "https://example.com/mock/manutencao/72/nota-fiscal.pdf",
    finalLinks: [
      "https://example.com/mock/manutencao/72/final-1.jpg",
      "https://example.com/mock/manutencao/72/final-2.jpg"
    ],
    searchText: "72 manutencao civic prata realizada",
    history: true
  }),
  serviceItem({
    itemId: "hist-cancelado",
    id: "10188",
    time: "5 dias atrás 20:20",
    description: "Hotel Unique -> Aeroporto de Viracopos",
    priority: 0,
    client: "Cliente Executivo",
    receive: "Não",
    amount: "R$ 0,00",
    amountValue: 0,
    departureAt: "26/06/2026 20:20",
    route: "Hotel Unique -> Aeroporto de Viracopos",
    passengersHtml: "Não informado",
    departureAddress: "Hotel Unique - São Paulo - SP",
    destination: "Aeroporto de Viracopos - Campinas - SP",
    operationNotes: "Serviço cancelado no local pelo passageiro.",
    passengerProfile: "Não informado",
    requester: "Não informado",
    vehicle: "Corolla Preto ABC1D23",
    actions: [],
    searchText: "cancelado hotel unique viracopos",
    canceled: true,
    finalObservation: "Cancelado no local pelo passageiro."
  })
];
