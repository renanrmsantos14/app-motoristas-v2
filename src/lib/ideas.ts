// Boas ideias: mesmo contrato da tabela cr40f_boasideias usada pela Tela Planner (IdeasView).
export const IDEA_TITLE_MAX_LENGTH = 100;
export const IDEA_DETAILS_MAX_LENGTH = 2000;

export const IDEA_STATUS = {
  nova: 100000000,
  emAvaliacao: 100000001,
  aprovada: 100000002,
  implementada: 100000003
} as const;

export const IDEA_STATUS_OPTIONS = [
  { value: IDEA_STATUS.nova, label: "Nova", tone: "info" },
  { value: IDEA_STATUS.emAvaliacao, label: "Em avaliação", tone: "process" },
  { value: IDEA_STATUS.aprovada, label: "Aprovada", tone: "success" },
  { value: IDEA_STATUS.implementada, label: "Implementada", tone: "brand" }
] as const;

export type IdeaStatusTone = (typeof IDEA_STATUS_OPTIONS)[number]["tone"];

export type Idea = {
  id: string;
  title: string;
  details: string;
  status: number;
  createdAt: string;
};

export type IdeaDraft = {
  title: string;
  details: string;
};

export type IdeaDraftErrors = Partial<Record<keyof IdeaDraft, string>>;

export function getIdeaStatusOption(status: number) {
  return IDEA_STATUS_OPTIONS.find((option) => option.value === status) ?? null;
}

export function validateIdeaDraft(draft: IdeaDraft): IdeaDraftErrors {
  const errors: IdeaDraftErrors = {};
  const title = draft.title.trim();
  if (!title) errors.title = "Informe o título da ideia.";
  else if (title.length > IDEA_TITLE_MAX_LENGTH) errors.title = `O título deve ter até ${IDEA_TITLE_MAX_LENGTH} caracteres.`;
  if (draft.details.trim().length > IDEA_DETAILS_MAX_LENGTH) {
    errors.details = `A descrição deve ter até ${IDEA_DETAILS_MAX_LENGTH} caracteres.`;
  }
  return errors;
}

export function buildIdeaRecord(draft: IdeaDraft) {
  return {
    cr40f_name: draft.title.trim(),
    cr40f_detalhes: draft.details.trim(),
    cr40f_status: IDEA_STATUS.nova
  };
}

export function normalizeIdeaRecord(record: Record<string, unknown>): Idea {
  const status = Number(record.cr40f_status);
  return {
    id: String(record.cr40f_boasideiasid ?? ""),
    title: String(record.cr40f_name ?? ""),
    details: String(record.cr40f_detalhes ?? ""),
    status: Number.isFinite(status) && record.cr40f_status !== null && record.cr40f_status !== undefined ? status : IDEA_STATUS.nova,
    createdAt: String(record.createdon ?? "")
  };
}

export function formatIdeaDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(date);
}
