import { useRef } from "react";
import type { DetailData } from "../types";
import { DetailsField } from "../components/details/DetailsField";
import { QuestionsBox } from "../components/details/QuestionsBox";
import { PullToRefresh } from "../components/common/PullToRefresh";
import { AppShell } from "../components/layout/AppShell";
import { DetailsMenu } from "../components/navigation/DetailsMenu";

type HistoryDetailsScreenProps = {
  detail: DetailData;
  onBack: () => void;
  onRefresh: () => void | Promise<void>;
};

export function HistoryDetailsScreen({ detail, onBack, onRefresh }: HistoryDetailsScreenProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const title =
    detail.type === "SERVICO"
      ? "Detalhes do Servi\u00e7o"
      : detail.type === "TROCA"
        ? "Detalhes da Troca"
        : "Detalhes da Manuten\u00e7\u00e3o";

  const dateField = detail.fields.find((field) => /data|hora|hor\u00e1rio|janela/i.test(field.label));
  const fieldsWithoutHeaderDate = detail.fields.filter((field) => field !== dateField);

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
