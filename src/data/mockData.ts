import type { AgendaItem, Tile } from "../types";

export const tiles: Tile[] = [
  { label: "Visualizar ServiÃ§os", variant: "active", icon: "cars", target: "servicos" },
  { label: "Visualizar HistÃ³rico", variant: "active", icon: "clock", target: "historico" },
  { label: "LanÃ§ar Gastos", variant: "active", icon: "money", target: "servicos" },
  { label: "Solicitar ManutenÃ§Ãµes", variant: "active", icon: "tools", target: "servicos" }
];

export const agendaMock: AgendaItem[] = [
  { id: "h-hoje", tipo: "HEADER", tituloData: "HOJE", seta: "" },
  {
    id: "srv-10241",
    tipo: "SERVICO",
    label: "ServiÃ§o",
    time: "HOJE 14:30",
    description: "Hotel Fasano SÃ£o Paulo -> Aeroporto de Congonhas",
    priority: 1,
    searchText: "10241 hotel fasano sao paulo aeroporto de congonhas servico hoje 14:30",
    detail: {
      type: "SERVICO",
      id: "10241",
      title: "Detalhes do ServiÃ§o",
      actions: ["cancel", "voucher"],
      fields: [
        { label: "Data e HorÃ¡rio de SaÃ­da", value: "02/06/2026 14:30" },
        { label: "Cliente", value: "Tenaris" },
        { label: "Receber", value: "Não" },
        { label: "Trajeto", value: "Hotel Fasano SÃ£o Paulo -> Aeroporto de Congonhas" },
        {
          label: "Passageiros e Telefones de Contato",
          value: "Ana Paula Martins<br />+55 (11) 98765-4321<br /><br />Roberto Almeida<br />+55 (11) 91234-5678",
          html: true
        },
        { label: "EndereÃ§o de SaÃ­da", value: "Rua VitÃ³rio Fasano, 88 - Jardins, SÃ£o Paulo - SP" },
        { label: "Destino", value: "Aeroporto de Congonhas - Av. Washington LuÃ­s, s/n" },
        { label: "Obs de OperaÃ§Ã£o", value: "Passageiros aguardam na recepÃ§Ã£o. Confirmar bagagens antes da saÃ­da." },
        { label: "Perfil do Passageiro", value: "Executivo. Atendimento discreto. Prefere trajeto direto." },
        { label: "Solicitante", value: "Mariana Costa" },
        { label: "VeÃ­culo", value: "Corolla Preto ABC1D23" }
      ]
    }
  },
  {
    id: "troca-381",
    tipo: "TROCA",
    label: "Troca de Carro",
    time: "HOJE entre 16:00 e 17:00",
    description: "Trocar de carro com Carlos Andrade",
    priority: 3,
    searchText: "381 troca de carro carlos andrade hoje 16:00 17:00",
    detail: {
      type: "TROCA",
      id: "381",
      title: "Detalhes da Troca",
      actions: ["finalizar"],
      fields: [
        { label: "InÃ­cio da Janela de Troca", value: "02/06/2026 16:00" },
        { label: "Fim da Janela de Troca", value: "02/06/2026 17:00" },
        { label: "VocÃª irÃ¡ trocar de carro com:", value: "Carlos Andrade", strong: true },
        { label: "Telefone", value: "+55 (12) 99723-6961" },
        { label: "Whatsapp", value: "Abrir conversa" },
        { label: "VeÃ­culos envolvidos:", value: "VocÃª entrega:\nCorolla Preto | ABC1D23\nVocÃª recebe:\nCivic Prata | XYZ9A87", strong: true },
        { label: "ObservaÃ§Ãµes", value: "Troca combinada na base operacional. Conferir pertences antes da entrega." }
      ]
    }
  },
  {
    id: "manut-76",
    tipo: "MANUTENCAO",
    label: "ManutenÃ§Ã£o",
    time: "HOJE 18:10",
    description: "ManutenÃ§Ã£o no Corolla Preto ABC1D23",
    priority: 0,
    searchText: "76 manutencao corolla preto abc1d23 hoje 18:10",
    detail: {
      type: "MANUTENCAO",
      id: "76",
      title: "Detalhes da ManutenÃ§Ã£o",
      actions: ["finalizar"],
      fields: [
        { label: "Data e HorÃ¡rio da ManutenÃ§Ã£o", value: "02/06/2026 18:10" },
        { label: "DescriÃ§Ã£o do CenÃ¡rio Encontrado", value: "Verificar ruÃ­do no freio dianteiro e calibragem dos pneus." },
        { label: "VeÃ­culo", value: "Corolla Preto ABC1D23" },
        { label: "ComentÃ¡rios ao Motorista", value: "Levar o veÃ­culo atÃ© a base e aguardar orientaÃ§Ã£o do JÃºnior." }
      ]
    }
  },
  { id: "h-amanha", tipo: "HEADER", tituloData: "AMANHÃƒ", seta: "" },
  {
    id: "srv-10244",
    tipo: "SERVICO",
    label: "ServiÃ§o",
    time: "AMANHÃƒ 08:20",
    description: "Residencial Alphaville -> ReuniÃ£o Faria Lima",
    priority: 10,
    searchText: "10244 residencial alphaville reuniao faria lima servico amanha 08:20",
    detail: {
      type: "SERVICO",
      id: "10244",
      title: "Detalhes do ServiÃ§o",
      actions: ["cancel", "finalizar"],
      fields: [
        { label: "Data e HorÃ¡rio de SaÃ­da", value: "03/06/2026 08:20" },
        { label: "Cliente", value: "Cliente Executivo Alphaville" },
        { label: "Receber", value: "Não" },
        { label: "Trajeto", value: "Residencial Alphaville -> ReuniÃ£o Faria Lima" },
        { label: "Passageiros e Telefones de Contato", value: "Eduardo Ribeiro<br />+55 (11) 95555-0101", html: true },
        { label: "EndereÃ§o de SaÃ­da", value: "Alameda Rio Negro, Alphaville - Barueri - SP" },
        { label: "Destino", value: "Av. Brigadeiro Faria Lima, SÃ£o Paulo - SP" },
        { label: "Obs de OperaÃ§Ã£o", value: "Chegar 10 minutos antes. Passageiro seguirÃ¡ para reuniÃ£o." },
        { label: "Perfil do Passageiro", value: "Diretor financeiro. Prefere silÃªncio no trajeto." },
        { label: "Solicitante", value: "PatrÃ­cia Gomes" },
        { label: "VeÃ­culo", value: "Civic Prata XYZ9A87" }
      ]
    }
  },
  {
    id: "troca-384",
    tipo: "TROCA",
    label: "Troca de Carro",
    time: "AMANHÃƒ entre 11:00 e 12:00",
    description: "Deixar o carro na base",
    priority: 0,
    searchText: "384 troca carro base amanha 11:00 12:00",
    detail: {
      type: "TROCA",
      id: "384",
      title: "Detalhes da Troca",
      actions: ["finalizar"],
      fields: [
        { label: "InÃ­cio da Janela de Troca", value: "03/06/2026 11:00" },
        { label: "Fim da Janela de Troca", value: "03/06/2026 12:00" },
        { label: "VocÃª irÃ¡ trocar de carro com:", value: "Base Operacional (VocÃª devolverÃ¡ um veÃ­culo.)", strong: true },
        { label: "VeÃ­culos envolvidos:", value: "VocÃª entrega: Civic Prata | XYZ9A87", strong: true },
        { label: "ObservaÃ§Ãµes", value: "Devolver veÃ­culo limpo e com checklist preenchido." }
      ]
    }
  }
];

export const historyMock: AgendaItem[] = [
  { id: "hist-hoje", tipo: "HEADER", tituloData: "HOJE", seta: "" },
  {
    id: "hist-srv-10239",
    tipo: "SERVICO",
    label: "ServiÃ§o",
    time: "HOJE 09:10",
    description: "Aeroporto de Guarulhos -> EscritÃ³rio Tenaris",
    priority: 0,
    searchText: "10239 guarulhos escritorio tenaris servico concluido hoje",
    detail: {
      type: "SERVICO",
      id: "10239",
      title: "Detalhes do ServiÃ§o",
      actions: [],
      fields: [
        { label: "Data e HorÃ¡rio de SaÃ­da", value: "02/06/2026 09:10" },
        { label: "Data de FinalizaÃ§Ã£o", value: "02/06/2026 10:05" },
        { label: "Cliente", value: "Tenaris" },
        { label: "Trajeto", value: "Aeroporto de Guarulhos -> EscritÃ³rio Tenaris" },
        { label: "Passageiros", value: "Marcelo Nunes<br />+55 (11) 97777-0101", html: true },
        { label: "EndereÃ§o de SaÃ­da", value: "GRU Airport - Terminal 3" },
        { label: "Destino", value: "Av. das NaÃ§Ãµes Unidas, SÃ£o Paulo - SP" },
        { label: "Obs de OperaÃ§Ã£o", value: "Voucher gerado e serviÃ§o concluÃ­do." },
        { label: "Perfil do Passageiro", value: "Executivo internacional. Atendimento discreto." },
        { label: "Solicitante", value: "Camila Torres" },
        { label: "VeÃ­culo", value: "Corolla Preto ABC1D23" }
      ]
    }
  },
  {
    id: "hist-troca-376",
    tipo: "TROCA",
    label: "Troca de Carro",
    time: "ONTEM 17:30",
    description: "Troca concluÃ­da com Base Operacional",
    priority: 0,
    searchText: "376 troca carro base operacional concluida ontem",
    detail: {
      type: "TROCA",
      id: "376",
      title: "Detalhes da Troca",
      actions: [],
      fields: [
        { label: "InÃ­cio da Janela de Troca", value: "01/06/2026 17:00" },
        { label: "Fim da Janela de Troca", value: "01/06/2026 18:00" },
        { label: "VocÃª trocou de carro com:", value: "Base Operacional" },
        { label: "Telefone", value: "+55 (12) 99723-6961" },
        { label: "Whatsapp", value: "Abrir conversa" },
        { label: "VeÃ­culos envolvidos:", value: "Entregou: Corolla Preto | ABC1D23\nRecebeu: Civic Prata | XYZ9A87" },
        { label: "ObservaÃ§Ãµes", value: "Troca concluÃ­da sem pendÃªncias." }
      ]
    }
  },
  {
    id: "hist-manut-72",
    tipo: "MANUTENCAO",
    label: "ManutenÃ§Ã£o",
    time: "2 dias atrÃ¡s 15:40",
    description: "ManutenÃ§Ã£o realizada no Civic Prata XYZ9A87",
    priority: 0,
    searchText: "72 manutencao civic prata realizada",
    detail: {
      type: "MANUTENCAO",
      id: "72",
      title: "Detalhes da ManutenÃ§Ã£o",
      actions: [],
      fields: [
        { label: "Data e HorÃ¡rio da ManutenÃ§Ã£o", value: "31/05/2026 15:40" },
        { label: "Data de FinalizaÃ§Ã£o", value: "31/05/2026 17:12" },
        { label: "DescriÃ§Ã£o do CenÃ¡rio Encontrado", value: "Troca de pastilhas de freio dianteiras." },
        { label: "VeÃ­culo", value: "Civic Prata XYZ9A87" },
        { label: "ComentÃ¡rios ao Motorista", value: "ServiÃ§o autorizado pelo JÃºnior." },
        { label: "ServiÃ§o Realizado", value: "Pastilhas substituÃ­das e teste concluÃ­do." },
        { label: "Estabelecimento", value: "Auto Center Vila OlÃ­mpia" },
        { label: "ComentÃ¡rios do Motorista", value: "Nota fiscal anexada. Sem pendÃªncias." },
        { label: "Forma de Pagamento", value: "CartÃ£o" },
        { label: "Valor", value: "R$ 480,00" }
      ]
    }
  },
  {
    id: "hist-cancelado",
    tipo: "SERVICO",
    label: "ServiÃ§o",
    time: "5 dias atrÃ¡s 20:20",
    description: "Hotel Unique -> Aeroporto de Viracopos",
    priority: 0,
    canceled: true,
    searchText: "cancelado hotel unique viracopos",
    detail: {
      type: "SERVICO",
      id: "10188",
      title: "Detalhes do ServiÃ§o",
      actions: [],
      fields: [
        { label: "Data e HorÃ¡rio de SaÃ­da", value: "28/05/2026 20:20" },
        { label: "Cliente", value: "Cliente Executivo" },
        { label: "Trajeto", value: "Hotel Unique -> Aeroporto de Viracopos" },
        { label: "ObservaÃ§Ã£o Final", value: "Cancelado no local pelo passageiro." }
      ]
    }
  }
];

