export type Screen =
  | "inicio"
  | "servicos"
  | "historico"
  | "detalhes"
  | "detalhesHistorico"
  | "voucher"
  | "assinatura"
  | "finalizar"
  | "gastos"
  | "fotoGasto"
  | "previewFotoGasto"
  | "colisoesInicio"
  | "colisoes"
  | "fotoColisao"
  | "previewFotoColisao"
  | "solicitarManutencao"
  | "fotoSolicitacaoManutencao"
  | "previewFotoSolicitacaoManutencao"
  | "fotoManutencao"
  | "previewFotoManutencao"
  | "canceladoLocal";

export type TileIcon = "cars" | "clock" | "money" | "tools";

export type AgendaType = "HEADER" | "SERVICO" | "TROCA" | "MANUTENCAO";

export type Tile = {
  label: string;
  variant: "active" | "disabled";
  icon: TileIcon;
  target?: Screen;
};

export type DetailAction = "cancel" | "voucher" | "finalizar";

export type MaintenancePhotoKind = "NOTAFISCAL" | `NOTAFISCAL_${number}` | "FOTO1" | "FOTO2" | "FOTO3";

export type DetailField = {
  label: string;
  value: string;
  strong?: boolean;
  html?: boolean;
};

export type DetailData = {
  type: Exclude<AgendaType, "HEADER">;
  id: string;
  title: string;
  fields: DetailField[];
  actions: DetailAction[];
  dataverse?: {
    entitySetName: string;
    id: string;
    record?: Record<string, unknown>;
  };
};

export type AgendaItem = {
  id: string;
  tipo: AgendaType;
  tituloData?: string;
  seta?: string;
  label?: string;
  time?: string;
  description?: string;
  priority?: 0 | 1 | 2 | 3 | 10;
  canceled?: boolean;
  searchText?: string;
  detail?: DetailData;
};
