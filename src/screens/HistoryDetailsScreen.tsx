import { useRef } from "react";
import type { DetailData } from "../types";
import { DetailsField } from "../components/details/DetailsField";
import { QuestionsBox } from "../components/details/QuestionsBox";
import { PullToRefresh } from "../components/common/PullToRefresh";
import { AppShell } from "../components/layout/AppShell";
import { DetailsMenu } from "../components/navigation/DetailsMenu";
import type { DetailField } from "../types";

type HistoryDetailsScreenProps = {
  detail: DetailData;
  onBack: () => void;
  onRefresh: () => void | Promise<void>;
};

function normalizeFieldKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getFirstName(value: string) {
  const words = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, "") ?? "";
  return /[A-Za-zÀ-ÿ]/.test(first) && !/\d/.test(first) ? first : "";
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'");
}

function stripPhoneTail(value: string) {
  return value
    .replace(/\b(?:sem\s+telefone|telefone|whats(?:app)?|celular|contato)\b.*$/i, "")
    .replace(/(?:^|[\s:;,\-|])\+?\d[\d\s().-]{7,}\d.*$/g, "")
    .replace(/[\s:;,\-|]+$/g, "")
    .trim();
}

function getSafeFirstName(value: string) {
  const withoutLinks = String(value ?? "").replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ");
  const withoutTags = withoutLinks.replace(/<[^>]+>/g, " ");
  return getFirstName(stripPhoneTail(decodeBasicHtmlEntities(withoutTags).replace(/\s+/g, " ")));
}

function simplifyPassengerValue(value: string) {
  const segments = String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/[\n;]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => getSafeFirstName(segment))
    .filter(Boolean);

  return segments.join("<br />");
}

function sanitizeHistoryField(field: DetailField): DetailField | null {
  const key = normalizeFieldKey(field.label);

  if (key === "enderecodesaida" || key === "obsdeoperacao") return null;

  if (key === "passageirosetelefonesdecontato" || key === "passageiros") {
    const value = simplifyPassengerValue(field.value);
    return value ? { ...field, value, html: value.includes("<br />") } : null;
  }

  if (key === "solicitante") {
    const value = getSafeFirstName(field.value);
    return value ? { ...field, value, html: false } : null;
  }

  return field;
}

export function HistoryDetailsScreen({ detail, onBack, onRefresh }: HistoryDetailsScreenProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const title =
    detail.type === "SERVICO"
      ? "Detalhes do Servi\u00e7o"
      : detail.type === "TROCA"
        ? "Detalhes da Troca"
        : "Detalhes da Manuten\u00e7\u00e3o";

  const dateField = detail.fields.find((field) => /data|hora|hor\u00e1rio|janela/i.test(field.label));
  const fieldsWithoutHeaderDate = detail.fields
    .filter((field) => field !== dateField)
    .map(sanitizeHistoryField)
    .filter((field): field is DetailField => Boolean(field));

  return (
    <AppShell screenLabel="TelaDetalhesHistorico">
      <DetailsMenu title={title} onBack={onBack} />
      <section className="main-panel details-main details-main-v1 history-details-main">
        <article className={`details-card details-card-v1 history-detail ${detail.type.toLowerCase()}`}>
          <div className="details-header-v1 history-header-v1">
            <div className="details-date-v1">{dateField?.value ?? "Sem data"}</div>
            <div className="details-code-v1">#{detail.id}</div>
          </div>
          <PullToRefresh className="pull-refresh--details" scrollRef={scrollRef} onRefresh={onRefresh}>
            <div ref={scrollRef} className="details-scroll details-scroll-v1 history-scroll-v1">
              <div className="details-fields details-fields-v1 history-fields-v1">
                {fieldsWithoutHeaderDate.map((field) => (
                  <DetailsField key={field.label} field={field} />
                ))}
                {detail.type === "MANUTENCAO" ? <QuestionsBox /> : null}
              </div>
            </div>
          </PullToRefresh>
        </article>
      </section>
    </AppShell>
  );
}
