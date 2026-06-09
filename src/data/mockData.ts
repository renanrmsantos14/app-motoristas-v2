import type { AgendaItem, Tile } from "../types";

export const tiles: Tile[] = [
  { label: "Visualizar Serviços", variant: "active", icon: "cars", target: "servicos" },
  { label: "Visualizar Histórico", variant: "active", icon: "clock", target: "historico" },
  { label: "Lançar Gastos", variant: "active", icon: "money", target: "servicos" },
  { label: "Solicitar Manutenções", variant: "active", icon: "tools", target: "servicos" }
];

export const agendaMock: AgendaItem[] = [
  { id: "h-hoje", tipo: "HEADER", tituloData: "HOJE", seta: "" },
  {
    id: "srv-10241",
    tipo: "SERVICO",
    label: "Serviço",
    time: "HOJE 14:30",
    description: "Hotel Fasano São Paulo -> Aeroporto de Congonhas",
    priority: 1,
    searchText: "10241 hotel fasano sao paulo aeroporto de congonhas servico hoje 14:30",
    detail: {
      type: "SERVICO",
      id: "10241",
      title: "Detalhes do Serviço",
      actions: ["cancel", "voucher"],
      fields: [
        { label: "Data e Horário de Saída", value: "02/06/2026 14:30" },
        { label: "Cliente", value: "Tenaris" },
        { label: "Receber", value: "Sim" },
        { label: "Trajeto", value: "Hotel Fasano São Paulo -> Aeroporto de Congonhas" },
        {
          label: "Passageiros e Telefones de Contato",
          value: "Ana Paula Martins<br />+55 (11) 98765-4321<br /><br />Roberto Almeida<br />+55 (11) 91234-5678",
          html: true
        },
        { label: "Endereço de Saída", value: "Rua Vitório Fasano, 88 - Jardins, São Paulo - SP" },
        { label: "Destino", value: "Aeroporto de Congonhas - Av. Washington Luís, s/n" },
        { label: "Obs de Operação", value: "Passageiros aguardam na recepção. Confirmar bagagens antes da saída." },
        { label: "Perfil do Passageiro", value: "Executivo. Atendimento discreto. Prefere trajeto direto." },
        { label: "Solicitante", value: "Mariana Costa" },
        { label: "Veículo", value: "Corolla Preto ABC1D23" }
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
        { label: "Início da Janela de Troca", value: "02/06/2026 16:00" },
        { label: "Fim da Janela de Troca", value: "02/06/2026 17:00" },
        { label: "Você irá trocar de carro com:", value: "Carlos Andrade", strong: true },
        { label: "Telefone", value: "+55 (12) 99723-6961" },
        { label: "Whatsapp", value: "Abrir conversa" },
        { label: "Veículos envolvidos:", value: "Você entrega:\nCorolla Preto | ABC1D23\nVocê recebe:\nCivic Prata | XYZ9A87", strong: true },
        { label: "Observações", value: "Troca combinada na base operacional. Conferir pertences antes da entrega." }
      ]
    }
  },
  {
    id: "manut-76",
    tipo: "MANUTENCAO",
    label: "Manutenção",
    time: "HOJE 18:10",
    description: "Manutenção no Corolla Preto ABC1D23",
    priority: 0,
    searchText: "76 manutencao corolla preto abc1d23 hoje 18:10",
    detail: {
      type: "MANUTENCAO",
      id: "76",
      title: "Detalhes da Manutenção",
      actions: ["finalizar"],
      fields: [
        { label: "Data e Horário da Manutenção", value: "02/06/2026 18:10" },
        { label: "Descrição do Cenário Encontrado", value: "Verificar ruído no freio dianteiro e calibragem dos pneus." },
        { label: "Veículo", value: "Corolla Preto ABC1D23" },
        { label: "Comentários ao Motorista", value: "Levar o veículo até a base e aguardar orientação do Júnior." }
      ]
    }
  },
  { id: "h-amanha", tipo: "HEADER", tituloData: "AMANHÃ", seta: "" },
  {
    id: "srv-10244",
    tipo: "SERVICO",
    label: "Serviço",
    time: "AMANHÃ 08:20",
    description: "Residencial Alphaville -> Reunião Faria Lima",
    priority: 10,
    searchText: "10244 residencial alphaville reuniao faria lima servico amanha 08:20",
    detail: {
      type: "SERVICO",
      id: "10244",
      title: "Detalhes do Serviço",
      actions: ["cancel", "finalizar"],
      fields: [
        { label: "Data e Horário de Saída", value: "03/06/2026 08:20" },
        { label: "Cliente", value: "Cliente Executivo Alphaville" },
        { label: "Receber", value: "Sim" },
        { label: "Trajeto", value: "Residencial Alphaville -> Reunião Faria Lima" },
        { label: "Passageiros e Telefones de Contato", value: "Eduardo Ribeiro<br />+55 (11) 95555-0101", html: true },
        { label: "Endereço de Saída", value: "Alameda Rio Negro, Alphaville - Barueri - SP" },
        { label: "Destino", value: "Av. Brigadeiro Faria Lima, São Paulo - SP" },
        { label: "Obs de Operação", value: "Chegar 10 minutos antes. Passageiro seguirá para reunião." },
        { label: "Perfil do Passageiro", value: "Diretor financeiro. Prefere silêncio no trajeto." },
        { label: "Solicitante", value: "Patrícia Gomes" },
        { label: "Veículo", value: "Civic Prata XYZ9A87" }
      ]
    }
  },
  {
    id: "troca-384",
    tipo: "TROCA",
    label: "Troca de Carro",
    time: "AMANHÃ entre 11:00 e 12:00",
    description: "Deixar o carro na base",
    priority: 0,
    searchText: "384 troca carro base amanha 11:00 12:00",
    detail: {
      type: "TROCA",
      id: "384",
      title: "Detalhes da Troca",
      actions: ["finalizar"],
      fields: [
        { label: "Início da Janela de Troca", value: "03/06/2026 11:00" },
        { label: "Fim da Janela de Troca", value: "03/06/2026 12:00" },
        { label: "Você irá trocar de carro com:", value: "Base Operacional (Você devolverá um veículo.)", strong: true },
        { label: "Veículos envolvidos:", value: "Você entrega: Civic Prata | XYZ9A87", strong: true },
        { label: "Observações", value: "Devolver veículo limpo e com checklist preenchido." }
      ]
    }
  }
];

export const historyMock: AgendaItem[] = [
  { id: "hist-hoje", tipo: "HEADER", tituloData: "HOJE", seta: "" },
  {
    id: "hist-srv-10239",
    tipo: "SERVICO",
    label: "Serviço",
    time: "HOJE 09:10",
    description: "Aeroporto de Guarulhos -> Escritório Tenaris",
    priority: 0,
    searchText: "10239 guarulhos escritorio tenaris servico concluido hoje",
    detail: {
      type: "SERVICO",
      id: "10239",
      title: "Detalhes do Serviço",
      actions: [],
      fields: [
        { label: "Data e Horário de Saída", value: "02/06/2026 09:10" },
        { label: "Data de Finalização", value: "02/06/2026 10:05" },
        { label: "Cliente", value: "Tenaris" },
        { label: "Trajeto", value: "Aeroporto de Guarulhos -> Escritório Tenaris" },
        { label: "Passageiros", value: "Marcelo Nunes<br />+55 (11) 97777-0101", html: true },
        { label: "Endereço de Saída", value: "GRU Airport - Terminal 3" },
        { label: "Destino", value: "Av. das Nações Unidas, São Paulo - SP" },
        { label: "Obs de Operação", value: "Voucher gerado e serviço concluído." },
        { label: "Perfil do Passageiro", value: "Executivo internacional. Atendimento discreto." },
        { label: "Solicitante", value: "Camila Torres" },
        { label: "Veículo", value: "Corolla Preto ABC1D23" }
      ]
    }
  },
  {
    id: "hist-troca-376",
    tipo: "TROCA",
    label: "Troca de Carro",
    time: "ONTEM 17:30",
    description: "Troca concluída com Base Operacional",
    priority: 0,
    searchText: "376 troca carro base operacional concluida ontem",
    detail: {
      type: "TROCA",
      id: "376",
      title: "Detalhes da Troca",
      actions: [],
      fields: [
        { label: "Início da Janela de Troca", value: "01/06/2026 17:00" },
        { label: "Fim da Janela de Troca", value: "01/06/2026 18:00" },
        { label: "Você trocou de carro com:", value: "Base Operacional" },
        { label: "Telefone", value: "+55 (12) 99723-6961" },
        { label: "Whatsapp", value: "Abrir conversa" },
        { label: "Veículos envolvidos:", value: "Entregou: Corolla Preto | ABC1D23\nRecebeu: Civic Prata | XYZ9A87" },
        { label: "Observações", value: "Troca concluída sem pendências." }
      ]
    }
  },
  {
    id: "hist-manut-72",
    tipo: "MANUTENCAO",
    label: "Manutenção",
    time: "2 dias atrás 15:40",
    description: "Manutenção realizada no Civic Prata XYZ9A87",
    priority: 0,
    searchText: "72 manutencao civic prata realizada",
    detail: {
      type: "MANUTENCAO",
      id: "72",
      title: "Detalhes da Manutenção",
      actions: [],
      fields: [
        { label: "Data e Horário da Manutenção", value: "31/05/2026 15:40" },
        { label: "Data de Finalização", value: "31/05/2026 17:12" },
        { label: "Descrição do Cenário Encontrado", value: "Troca de pastilhas de freio dianteiras." },
        { label: "Veículo", value: "Civic Prata XYZ9A87" },
        { label: "Comentários ao Motorista", value: "Serviço autorizado pelo Júnior." },
        { label: "Serviço Realizado", value: "Pastilhas substituídas e teste concluído." },
        { label: "Estabelecimento", value: "Auto Center Vila Olímpia" },
        { label: "Comentários do Motorista", value: "Nota fiscal anexada. Sem pendências." },
        { label: "Forma de Pagamento", value: "Cartão" },
        { label: "Valor", value: "R$ 480,00" }
      ]
    }
  },
  {
    id: "hist-cancelado",
    tipo: "SERVICO",
    label: "Serviço",
    time: "5 dias atrás 20:20",
    description: "Hotel Unique -> Aeroporto de Viracopos",
    priority: 0,
    canceled: true,
    searchText: "cancelado hotel unique viracopos",
    detail: {
      type: "SERVICO",
      id: "10188",
      title: "Detalhes do Serviço",
      actions: [],
      fields: [
        { label: "Data e Horário de Saída", value: "28/05/2026 20:20" },
        { label: "Cliente", value: "Cliente Executivo" },
        { label: "Trajeto", value: "Hotel Unique -> Aeroporto de Viracopos" },
        { label: "Observação Final", value: "Cancelado no local pelo passageiro." }
      ]
    }
  }
];
