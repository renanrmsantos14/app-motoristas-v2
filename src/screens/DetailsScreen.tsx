import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DetailData } from "../types";
import { DetailActionButton } from "../components/details/DetailActionButton";
import { DetailsField } from "../components/details/DetailsField";
import { QuestionsBox } from "../components/details/QuestionsBox";
import { PullToRefresh } from "../components/common/PullToRefresh";
import { AppShell } from "../components/layout/AppShell";
import { DetailsMenu } from "../components/navigation/DetailsMenu";

type DetailsScreenProps = {
  detail: DetailData;
  onBack: () => void;
  onOpenVoucher: () => void;
  onOpenFinalize: () => void;
  onCancelLocal: () => void;
  onCopy: () => void;
  onRefresh: () => void | Promise<void>;
};

const getFieldValue = (detail: DetailData, label: string) =>
  detail.fields.find((field) => field.label.toLowerCase() === label.toLowerCase())?.value ?? "";

const isTenarisClient = (detail: DetailData) => /tenn?aris/i.test(getFieldValue(detail, "Cliente"));

const getVisibleActions = (detail: DetailData) => {
  if (detail.type !== "SERVICO") return detail.actions.filter((action) => action !== "cancel");
  return isTenarisClient(detail)
    ? detail.actions.filter((action) => action !== "finalizar")
    : detail.actions.filter((action) => action !== "voucher");
};

export function DetailsScreen({
  detail,
  onBack,
  onOpenVoucher,
  onOpenFinalize,
  onCancelLocal,
  onCopy,
  onRefresh
}: DetailsScreenProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [hasMoreContent, setHasMoreContent] = useState(false);
  const [shouldRenderScrollHint, setShouldRenderScrollHint] = useState(false);
  const [isScrollHintExiting, setIsScrollHintExiting] = useState(false);
  const dateField = detail.fields.find((field) => /data|hora|hor\u00e1rio|janela/i.test(field.label));
  const fieldsWithoutHeaderDate = dateField ? detail.fields.filter((field) => field !== dateField) : detail.fields;
  const visibleActions = getVisibleActions(detail);

  const updateScrollHint = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const remaining = Math.ceil(element.scrollHeight - element.scrollTop - element.clientHeight);
    setHasMoreContent(remaining > 16);
  }, []);

  const scheduleScrollHintUpdate = useCallback(() => {
    updateScrollHint();
    requestAnimationFrame(updateScrollHint);
    window.setTimeout(updateScrollHint, 180);
    window.setTimeout(updateScrollHint, 520);
  }, [updateScrollHint]);

  useLayoutEffect(() => {
    scheduleScrollHintUpdate();
  }, [detail.id, fieldsWithoutHeaderDate.length, scheduleScrollHintUpdate]);

  useEffect(() => {
    scheduleScrollHintUpdate();
    const element = scrollRef.current;
    if (!element) return;

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleScrollHintUpdate) : null;
    observer?.observe(element);
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    window.addEventListener("resize", scheduleScrollHintUpdate);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", scheduleScrollHintUpdate);
    };
  }, [detail.id, scheduleScrollHintUpdate]);

  useEffect(() => {
    if (!confirmCancel) return;
    const timer = window.setTimeout(() => setConfirmCancel(false), 4500);
    return () => window.clearTimeout(timer);
  }, [confirmCancel]);

  useEffect(() => {
    if (hasMoreContent) {
      setShouldRenderScrollHint(true);
      setIsScrollHintExiting(false);
      return;
    }

    if (!shouldRenderScrollHint) return;
    setIsScrollHintExiting(true);
    const timer = window.setTimeout(() => {
      setShouldRenderScrollHint(false);
      setIsScrollHintExiting(false);
    }, 340);
    return () => window.clearTimeout(timer);
  }, [hasMoreContent, shouldRenderScrollHint]);

  const handleCancel = () => {
    if (confirmCancel) {
      onCancelLocal();
      return;
    }
    setConfirmCancel(true);
  };

  return (
    <AppShell screenLabel="TelaDetalhes">
      <DetailsMenu title={detail.title} onBack={onBack} onCopy={onCopy} />
      <section className="main-panel details-main details-main-v1">
        <article className={`details-card details-card-v1 ${detail.type.toLowerCase()} ${hasMoreContent ? "is-scrollable" : ""}`}>
          <div className="details-header-v1">
            <div className="details-date-v1">{dateField?.value ?? "Sem data"}</div>
            <div className="details-code-v1">#{detail.id}</div>
          </div>

          <PullToRefresh className="pull-refresh--details" scrollRef={scrollRef} onRefresh={onRefresh}>
            <div
              ref={scrollRef}
              className={`details-scroll details-scroll-v1 ${hasMoreContent ? "has-more-content" : ""}`}
              onScroll={updateScrollHint}
            >
              <div className="details-fields details-fields-v1">
                {fieldsWithoutHeaderDate.map((field) => (
                  <DetailsField key={field.label} field={field} />
                ))}

                {detail.type === "MANUTENCAO" ? <QuestionsBox /> : null}
              </div>
            </div>
          </PullToRefresh>

          {shouldRenderScrollHint ? (
            <div className={`details-scroll-hint ${isScrollHintExiting ? "is-exiting" : ""}`} aria-hidden="true">
              <span>Mais detalhes abaixo</span>
            </div>
          ) : null}

          <footer className="details-footer-v1">
            {confirmCancel ? <div className="cancel-confirm-warning">Serviço foi realmente cancelado no local? Clique novamente para confirmar.</div> : null}
            <div className={`detail-actions detail-actions-v1 ${detail.type.toLowerCase()}`}>
              {visibleActions.map((action) => (
                <DetailActionButton
                  key={action}
                  action={action}
                  onClick={action === "voucher" ? onOpenVoucher : action === "finalizar" ? onOpenFinalize : handleCancel}
                />
              ))}
            </div>
          </footer>
        </article>
      </section>
    </AppShell>
  );
}
