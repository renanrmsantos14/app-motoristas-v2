import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DetailAction, DetailData } from "../types";
import { DetailActionButton } from "../components/details/DetailActionButton";
import { DetailsField } from "../components/details/DetailsField";
import { QuestionsBox } from "../components/details/QuestionsBox";
import { TextAreaField } from "../components/common/FormFields";
import { PullToRefresh } from "../components/common/PullToRefresh";
import { AppShell } from "../components/layout/AppShell";
import { DetailsMenu } from "../components/navigation/DetailsMenu";

type ObservationSaveStatus = "idle" | "saving" | "saved" | "error";

type DetailsScreenProps = {
  detail: DetailData;
  onBack: () => void;
  onOpenReceive: () => void;
  onOpenVoucher: () => void;
  onOpenFinalize: (serviceObservation?: string) => void;
  onCancelLocal: () => void;
  onCopy: () => void;
  onRefresh: () => void | Promise<void>;
  onServiceObservationChange?: (observation: string) => Promise<void>;
  serviceObservationDraft?: string;
};

const SERVICE_OBSERVATION_LABEL = "Observação do Motorista";
const SERVICE_OBSERVATION_SAVE_DELAY_MS = 900;
const SAVE_STATUS_VISIBLE_MS = 1600;

const getFieldValue = (detail: DetailData, label: string) =>
  detail.fields.find((field) => field.label.toLowerCase() === label.toLowerCase())?.value ?? "";

const isServiceObservationField = (label: string) => label.toLowerCase() === SERVICE_OBSERVATION_LABEL.toLowerCase();

const isTenarisClient = (detail: DetailData) => /tenn?aris/i.test(getFieldValue(detail, "Cliente"));
const isTrueLike = (value: unknown) => value === true || value === 1 || value === "true";
const shouldRequireReceive = (detail: DetailData) =>
  detail.type === "SERVICO" &&
  (isTrueLike(detail.dataverse?.record?.cr40f_receber) || getFieldValue(detail, "Receber").trim().toLowerCase() === "sim");

const getVisibleActions = (detail: DetailData): DetailAction[] => {
  if (shouldRequireReceive(detail)) {
    return detail.actions.includes("cancel") ? ["cancel", "receber"] : ["receber"];
  }
  if (detail.type !== "SERVICO") return detail.actions.filter((action) => action !== "cancel");
  return isTenarisClient(detail)
    ? detail.actions.filter((action) => action !== "finalizar")
    : detail.actions.filter((action) => action !== "voucher");
};

function ObservationStatus({ status }: { status: ObservationSaveStatus }) {
  if (status === "idle") return null;

  const label = status === "saving" ? "Salvando" : status === "saved" ? "Salvo" : "Falha ao salvar";
  return (
    <span className={`service-observation-status is-${status}`} aria-live="polite" aria-label={label} title={label}>
      <span className="service-observation-orb" aria-hidden="true">
        <span className="service-observation-ring" />
        <span className="service-observation-checkmark" />
        <span className="service-observation-error-mark" />
      </span>
    </span>
  );
}

export function DetailsScreen({
  detail,
  onBack,
  onOpenReceive,
  onOpenVoucher,
  onOpenFinalize,
  onCancelLocal,
  onCopy,
  onRefresh,
  onServiceObservationChange,
  serviceObservationDraft = ""
}: DetailsScreenProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const statusResetTimerRef = useRef<number | null>(null);
  const saveSequenceRef = useRef(0);
  const initialServiceObservation = serviceObservationDraft;
  const savedObservationRef = useRef(initialServiceObservation);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [hasMoreContent, setHasMoreContent] = useState(false);
  const [shouldRenderScrollHint, setShouldRenderScrollHint] = useState(false);
  const [isScrollHintExiting, setIsScrollHintExiting] = useState(false);
  const [serviceObservation, setServiceObservation] = useState(initialServiceObservation);
  const [serviceObservationStatus, setServiceObservationStatus] = useState<ObservationSaveStatus>("idle");
  const dateField = detail.fields.find((field) => /data|hora|horário|janela/i.test(field.label));
  const fieldsWithoutHeaderDate = dateField ? detail.fields.filter((field) => field !== dateField) : detail.fields;
  const visibleFields = detail.type === "SERVICO" ? fieldsWithoutHeaderDate.filter((field) => !isServiceObservationField(field.label)) : fieldsWithoutHeaderDate;
  const visibleActions = getVisibleActions(detail);
  const canAutosaveObservation = detail.type === "SERVICO" && Boolean(onServiceObservationChange);

  const clearSaveTimer = useCallback(() => {
    if (!saveTimerRef.current) return;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
  }, []);

  const clearStatusResetTimer = useCallback(() => {
    if (!statusResetTimerRef.current) return;
    window.clearTimeout(statusResetTimerRef.current);
    statusResetTimerRef.current = null;
  }, []);

  const saveServiceObservation = useCallback(async (nextObservation: string) => {
    if (!canAutosaveObservation || !onServiceObservationChange) return;
    clearSaveTimer();
    if (nextObservation === savedObservationRef.current) return;

    const sequence = saveSequenceRef.current + 1;
    saveSequenceRef.current = sequence;
    clearStatusResetTimer();
    setServiceObservationStatus("saving");
    try {
      await onServiceObservationChange(nextObservation);
      if (saveSequenceRef.current !== sequence) return;
      savedObservationRef.current = nextObservation;
      setServiceObservationStatus("saved");
      statusResetTimerRef.current = window.setTimeout(() => {
        if (saveSequenceRef.current === sequence) setServiceObservationStatus("idle");
        statusResetTimerRef.current = null;
      }, SAVE_STATUS_VISIBLE_MS);
    } catch {
      if (saveSequenceRef.current !== sequence) return;
      setServiceObservationStatus("error");
    }
  }, [canAutosaveObservation, clearSaveTimer, clearStatusResetTimer, onServiceObservationChange]);

  const scheduleServiceObservationSave = useCallback((nextObservation: string) => {
    if (!canAutosaveObservation) return;
    clearSaveTimer();
    if (nextObservation === savedObservationRef.current) {
      setServiceObservationStatus("saved");
      return;
    }
    saveTimerRef.current = window.setTimeout(() => {
      void saveServiceObservation(nextObservation);
    }, SERVICE_OBSERVATION_SAVE_DELAY_MS);
  }, [canAutosaveObservation, clearSaveTimer, saveServiceObservation]);

  useEffect(() => {
    clearSaveTimer();
    savedObservationRef.current = initialServiceObservation;
    setServiceObservation(initialServiceObservation);
    clearStatusResetTimer();
    setServiceObservationStatus("idle");
  }, [clearSaveTimer, clearStatusResetTimer, detail.id, detail.type, initialServiceObservation]);

  useEffect(() => () => {
    clearSaveTimer();
    clearStatusResetTimer();
  }, [clearSaveTimer, clearStatusResetTimer]);

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
  }, [detail.id, visibleFields.length, scheduleScrollHintUpdate]);

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
    }, 320);
    return () => window.clearTimeout(timer);
  }, [hasMoreContent, shouldRenderScrollHint]);

  const handleCancel = () => {
    if (confirmCancel) {
      onCancelLocal();
      return;
    }
    setConfirmCancel(true);
  };

  const handleServiceObservationChange = (value: string) => {
    setServiceObservation(value);
    scheduleServiceObservationSave(value);
  };

  const handleOpenFinalize = () => {
    if (detail.type === "SERVICO") {
      void saveServiceObservation(serviceObservation);
      onOpenFinalize(serviceObservation);
      return;
    }
    onOpenFinalize();
  };

  return (
    <AppShell screenLabel="TelaDetalhes">
      <DetailsMenu title={detail.title} onBack={onBack} onCopy={onCopy} />
      <section className="main-panel details-main details-main-v1">
        <article className={`details-card details-card-v1 ${detail.type.toLowerCase()} ${hasMoreContent || shouldRenderScrollHint ? "is-scrollable" : ""}`}>
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
                {visibleFields.map((field) => (
                  <DetailsField key={field.label} field={field} />
                ))}

                {detail.type === "SERVICO" ? (
                  <TextAreaField
                    id={`service-observation-${detail.id}`}
                    fieldClassName="finalize-input-block shadow service-observation-editor"
                    label={
                      <span className="service-observation-label-content">
                        <span>Observação do motorista</span>
                        <ObservationStatus status={serviceObservationStatus} />
                      </span>
                    }
                    rows={4}
                    value={serviceObservation}
                    placeholder="Digite aqui"
                    disabled={!canAutosaveObservation}
                    onChange={(event) => handleServiceObservationChange(event.target.value)}
                    onBlur={() => void saveServiceObservation(serviceObservation)}
                  />
                ) : null}

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
                  onClick={action === "receber" ? onOpenReceive : action === "voucher" ? onOpenVoucher : action === "finalizar" ? handleOpenFinalize : handleCancel}
                />
              ))}
            </div>
          </footer>
        </article>
      </section>
    </AppShell>
  );
}
