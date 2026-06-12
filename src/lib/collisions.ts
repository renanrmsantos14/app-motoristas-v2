export const COLLISION_STATUS = {
  enviado: 100000000,
  emAnalise: 100000001,
  resolvido: 100000002,
  cancelado: 100000003
} as const;

export const COLLISION_ATTACHMENT_STATUS = {
  semAnexo: 100000000,
  enviando: 100000001,
  completo: 100000002,
  falhou: 100000003,
  parcial: 100000004
} as const;

export const COLLISION_ATTACHMENT_TYPE = {
  cena: 100000000,
  danoBetinhos: 100000001,
  danoTerceiro: 100000002,
  documentoTerceiro: 100000003,
  extra: 100000004
} as const;

export const COLLISION_MEDIA_TYPE = {
  foto: 100000000,
  video: 100000001
} as const;

export type CollisionType = "eu_bati" | "bateram_em_mim";

export type CollisionPhotoKind = "cena" | "danoBetinhos" | "danoTerceiro" | "documentoTerceiro" | "extra" | "video";

export type CollisionPhoto = {
  id: string;
  kind: CollisionPhotoKind;
  dataUrl: string;
  previewUrl?: string;
  posterUrl?: string;
  durationLabel?: string;
  mediaType?: "foto" | "video";
};

export type CollisionDraft = {
  tipoOcorrencia: CollisionType | "";
  dataHora: string;
  local: string;
  veiculoId: string;
  descricao: string;
  houveTerceiro: boolean;
  terceiroNome: string;
  terceiroTelefone: string;
  terceiroPlaca: string;
  terceiroVeiculo: string;
  terceiroDocumento: string;
  terceiroSeguradora: string;
  terceiroObservacao: string;
};

export type CollisionLookupNavigationNames = {
  motorista: string;
  veiculo: string;
};

export type CollisionValidationErrors = Partial<Record<keyof CollisionDraft | CollisionPhotoKind, string>>;

export const COLLISION_REQUIRED_PHOTOS: Array<{ kind: CollisionPhotoKind; label: string }> = [
  { kind: "danoBetinhos", label: "Veículos" },
  { kind: "cena", label: "Local" }
];

export const COLLISION_THIRD_PARTY_REQUIRED_PHOTOS: Array<{ kind: CollisionPhotoKind; label: string }> = [
  { kind: "danoTerceiro", label: "CNH da pessoa" },
  { kind: "documentoTerceiro", label: "Documento do veículo da pessoa" }
];

export const COLLISION_WHATSAPP_MESSAGE =
  "Olá. Sou da Betinhos Executive Service. Precisamos confirmar os dados da ocorrência registrada hoje. Pode me retornar por aqui?";

export function createEmptyCollisionDraft(now = new Date()): CollisionDraft {
  return {
    tipoOcorrencia: "",
    dataHora: toDateTimeLocalValue(now),
    local: "",
    veiculoId: "",
    descricao: "",
    houveTerceiro: false,
    terceiroNome: "",
    terceiroTelefone: "",
    terceiroPlaca: "",
    terceiroVeiculo: "",
    terceiroDocumento: "",
    terceiroSeguradora: "",
    terceiroObservacao: ""
  };
}

export function getCollisionTypeLabel(type: CollisionType | "") {
  if (type === "eu_bati") return "Eu bati";
  if (type === "bateram_em_mim") return "Bateram em mim";
  return "";
}

export function getCollisionPhotoLabel(kind: CollisionPhotoKind) {
  if (kind === "video") return "Vídeo";
  return [...COLLISION_REQUIRED_PHOTOS, ...COLLISION_THIRD_PARTY_REQUIRED_PHOTOS].find((item) => item.kind === kind)?.label ?? "Foto extra";
}

export function isCollisionVideo(photo: Pick<CollisionPhoto, "kind" | "dataUrl" | "mediaType">) {
  return photo.mediaType === "video" || photo.kind === "video" || photo.dataUrl.startsWith("data:video/");
}

export function hasCollisionThirdParty(draft: Pick<CollisionDraft, "tipoOcorrencia" | "houveTerceiro">) {
  return draft.tipoOcorrencia === "bateram_em_mim" || draft.houveTerceiro;
}

export function getRequiredCollisionPhotos(hasThirdParty: boolean) {
  return hasThirdParty ? [...COLLISION_REQUIRED_PHOTOS, ...COLLISION_THIRD_PARTY_REQUIRED_PHOTOS] : COLLISION_REQUIRED_PHOTOS;
}

function toDateTimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toDataverseDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function cleanText(value: string) {
  return String(value ?? "").trim();
}

function normalizePhone(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00") && digits.length > 10) return digits.slice(2);
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

export function validateCollisionDraft(draft: CollisionDraft, photos: CollisionPhoto[]): CollisionValidationErrors {
  const errors: CollisionValidationErrors = {};

  if (!draft.tipoOcorrencia) errors.tipoOcorrencia = "Informe o que aconteceu.";
  if (!cleanText(draft.local)) errors.local = "Informe o local.";
  if (!cleanText(draft.veiculoId)) errors.veiculoId = "Selecione o veículo.";
  if (!cleanText(draft.descricao)) errors.descricao = "Descreva rapidamente o ocorrido.";
  const hasThirdParty = hasCollisionThirdParty(draft);
  if (hasThirdParty) {
    if (!cleanText(draft.terceiroNome)) errors.terceiroNome = "Informe o nome do terceiro.";
    if (!normalizePhone(draft.terceiroTelefone)) errors.terceiroTelefone = "Informe o WhatsApp/telefone.";
  }

  for (const requiredPhoto of getRequiredCollisionPhotos(hasThirdParty)) {
    if (!photos.some((photo) => photo.kind === requiredPhoto.kind && photo.dataUrl)) {
      errors[requiredPhoto.kind] = `Adicione foto: ${requiredPhoto.label}.`;
    }
  }

  return errors;
}

export function buildCollisionWhatsAppUrl(phone: string, message = COLLISION_WHATSAPP_MESSAGE) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return "";
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function buildCollisionCreatePayload({
  draft,
  photos,
  motoristaId,
  veiculoId,
  motoristaEntitySet,
  veiculoEntitySet,
  lookupNavigationNames
}: {
  draft: CollisionDraft;
  photos: CollisionPhoto[];
  motoristaId: string;
  veiculoId: string;
  motoristaEntitySet: string;
  veiculoEntitySet: string;
  lookupNavigationNames: CollisionLookupNavigationNames;
}) {
  const errors = validateCollisionDraft({ ...draft, veiculoId: draft.veiculoId || veiculoId }, photos);
  if (Object.keys(errors).length) throw new Error(Object.values(errors).filter(Boolean).join(" "));

  const selectedVehicleId = cleanText(draft.veiculoId || veiculoId);
  const typeLabel = getCollisionTypeLabel(draft.tipoOcorrencia);
  const date = toDataverseDateTime(draft.dataHora);
  const local = cleanText(draft.local);

  const recordName = `${typeLabel} - ${local}`.slice(0, 180);

  return {
    cr40f_name: recordName,
    cr40f_nome: recordName,
    cr40f_tipoocorrencia: draft.tipoOcorrencia === "eu_bati" ? 100000000 : 100000001,
    cr40f_datahora: date,
    cr40f_local: local,
    cr40f_descricao: cleanText(draft.descricao),
    cr40f_houveterceiro: hasCollisionThirdParty(draft),
    cr40f_terceironome: hasCollisionThirdParty(draft) ? cleanText(draft.terceiroNome) : "",
    cr40f_terceirotelefone: hasCollisionThirdParty(draft) ? cleanText(draft.terceiroTelefone) : "",
    cr40f_terceiroplaca: hasCollisionThirdParty(draft) ? cleanText(draft.terceiroPlaca).toUpperCase() : "",
    cr40f_terceiroveiculo: hasCollisionThirdParty(draft) ? cleanText(draft.terceiroVeiculo) : "",
    cr40f_terceirodocumento: hasCollisionThirdParty(draft) ? cleanText(draft.terceiroDocumento) : "",
    cr40f_terceiroseguradora: hasCollisionThirdParty(draft) ? cleanText(draft.terceiroSeguradora) : "",
    cr40f_terceiroobservacao: hasCollisionThirdParty(draft) ? cleanText(draft.terceiroObservacao) : "",
    cr40f_statusoperacional: COLLISION_STATUS.enviado,
    cr40f_statusanexo: photos.length ? COLLISION_ATTACHMENT_STATUS.enviando : COLLISION_ATTACHMENT_STATUS.semAnexo,
    [`${lookupNavigationNames.motorista}@odata.bind`]: `/${motoristaEntitySet}(${motoristaId.replace(/[{}]/g, "").toLowerCase()})`,
    [`${lookupNavigationNames.veiculo}@odata.bind`]: `/${veiculoEntitySet}(${selectedVehicleId.replace(/[{}]/g, "").toLowerCase()})`
  };
}
