import { useEffect, useState } from "react";
import { reportAppError } from "../lib/appErrorLogger";
import { AppShell } from "../components/layout/AppShell";
import { ActionButton } from "../components/common/ActionButton";
import { TextAreaControl } from "../components/common/FormFields";
import { ServicesMenu } from "../components/navigation/ServicesMenu";
import { SignatureDrawing, SignaturePad } from "../components/comunicados/SignaturePad";
import { ComunicadoAgendaCard } from "../components/comunicados/ComunicadoAgendaCard";
import {
  abrirComunicado,
  assinarComunicado,
  COMUNICADO_TIPO,
  isComunicadoPending,
  isMockComunicados,
  type ComunicadoDestinatario,
  type SignatureStrokes
} from "../lib/comunicados";

export type ComunicadosLoadStatus = "loading" | "ready" | "error";

type Props = {
  items: ComunicadoDestinatario[];
  loadStatus?: ComunicadosLoadStatus;
  selectedId: string;
  onSelectedIdChange: (id: string) => void;
  onBack: () => void;
  onReload: () => Promise<void>;
  driverName: string;
};

function parseStrokes(value: string): SignatureStrokes {
  try { return JSON.parse(value) as SignatureStrokes; } catch { return []; }
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

export function ComunicadosScreen({ items, loadStatus = "ready", selectedId, onSelectedIdChange, onBack, onReload, driverName }: Props) {
  const [strokes, setStrokes] = useState<SignatureStrokes>([]);
  const [observacao, setObservacao] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = items.find((item) => item.id === selectedId);
  const pending = items.filter(isComunicadoPending);
  const completed = items.filter((item) => !isComunicadoPending(item));

  useEffect(() => {
    if (!selected || selected.tipo !== COMUNICADO_TIPO.ciencia || selected.abertoEm) return;
    let active = true;
    abrirComunicado(selected.id)
      .then(async () => {
        if (!active) return;
        try { await onReload(); }
        catch (cause) {
          reportAppError(cause, { source: "comunicados", action: "abrirComunicado", phase: "reload-after-open", screen: "Comunicados", detailId: selected.id, detailType: "COMUNICADO", notifyUser: false });
          if (active) setError("Visualização registrada, mas não foi possível atualizar a lista. Tente novamente.");
        }
      })
      .catch((cause) => {
        reportAppError(cause, { source: "comunicados", action: "abrirComunicado", phase: "execute", screen: "Comunicados", detailId: selected.id, detailType: "COMUNICADO", notifyUser: false });
        if (active) setError("Não foi possível registrar a visualização. Tente atualizar.");
      });
    return () => { active = false; };
  }, [selected?.id, selected?.tipo, selected?.abertoEm]);

  const acknowledge = async () => {
    if (!selected || selected.tipo !== COMUNICADO_TIPO.informativo || busy) return;
    setBusy(true);
    setError("");
    let recorded = false;
    try {
      await abrirComunicado(selected.id);
      recorded = true;
      await onReload();
      onSelectedIdChange("");
    } catch (cause) {
      reportAppError(cause, { source: "comunicados", action: "acknowledge", phase: recorded ? "reload-after-acknowledge" : "execute", screen: "Comunicados", detailId: selected.id, detailType: "COMUNICADO", payload: { recorded }, notifyUser: false });
      setError(recorded ? "Ciência registrada, mas não foi possível atualizar a lista. Tente atualizar." : cause instanceof Error ? cause.message : "Não foi possível registrar a ciência. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const openItem = (id: string) => {
    setStrokes([]);
    setObservacao("");
    setError("");
    onSelectedIdChange(id);
  };

  const sign = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    let signed = false;
    try {
      await assinarComunicado(selected.id, strokes, observacao);
      signed = true;
      await onReload();
    } catch (cause) {
      reportAppError(cause, { source: "comunicados", action: "assinarComunicado", phase: signed ? "reload-after-sign" : "execute-or-validation", screen: "Comunicados", detailId: selected.id, detailType: "COMUNICADO", payload: { signed, strokeCount: strokes.length, observationLength: observacao.length }, notifyUser: false });
      setError(signed ? "Ciência registrada, mas não foi possível atualizar a lista. Tente novamente." : cause instanceof Error ? cause.message : "Não foi possível salvar a ciência.");
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setError("");
    try { await onReload(); }
    catch (cause) {
      reportAppError(cause, { source: "comunicados", action: "refresh", phase: "reload", screen: "Comunicados", detailId: selectedId, detailType: "COMUNICADO", notifyUser: false });
      setError("Não foi possível atualizar os comunicados. Tente novamente.");
    }
  };

  return (
    <AppShell screenLabel="Comunicados">
      <ServicesMenu
        title={selected ? selected.titulo : "Comunicados"}
        eyebrow={isMockComunicados() ? "Operação · Mock local" : "Operação"}
        homeLabel="Voltar"
        homeIcon="arrowLeft"
        onHome={selected ? () => openItem("") : onBack}
        onRefresh={refresh}
      />
      <section className="comunicado-screen" aria-label={selected ? "Detalhes do comunicado" : "Lista de comunicados"}>
        {error ? <p className="comunicado-error comunicado-page-error" role="alert">{error}</p> : null}

        {selected ? (
          <article className="comunicado-detail">
            <div className="comunicado-message">
              <div className="comunicado-detail-meta">
                <span>{selected.tipo === COMUNICADO_TIPO.ciencia ? "Assinatura obrigatória" : "Informativo"}</span>
                <time>{formatDate(selected.enviadoEm)}</time>
              </div>
              <p className="comunicado-body">{selected.corpo}</p>
            </div>
            {selected.tipo === COMUNICADO_TIPO.ciencia && !selected.cienteEm ? (
              <section className="comunicado-ack" aria-label="Registro de ciência">
                <div className="comunicado-ack-intro">
                  <h2>Registrar ciência</h2>
                  <p>A assinatura será registrada em seu nome: <strong>{driverName}</strong>.</p>
                </div>
                <div className="comunicado-field">
                  <label htmlFor="comunicado-observacao">Observação <span>(opcional)</span></label>
                  <TextAreaControl id="comunicado-observacao" value={observacao} maxLength={1000} onChange={(event) => setObservacao(event.target.value)} placeholder="Escreva aqui se precisar acrescentar algo." />
                </div>
                <div className="comunicado-field comunicado-field-signature">
                  <label>Assine abaixo</label>
                  <SignaturePad value={strokes} onChange={setStrokes} />
                </div>
                <ActionButton className="comunicado-primary" variant="primary" idleLabel="Assinar ciência" loadingLabel="Salvando ciência" state={busy ? "loading" : "idle"} onClick={() => void sign()} />
              </section>
            ) : selected.cienteEm ? (
              <section className="comunicado-signed">
                <h2>Ciência registrada</h2>
                <p>{selected.nomeAssinante} · {formatDate(selected.cienteEm)}</p>
                <SignatureDrawing value={parseStrokes(selected.assinaturaJson)} />
                {selected.observacao ? <p>Observação: {selected.observacao}</p> : null}
              </section>
            ) : selected.lidoEm ? <p className="comunicado-read-state">Ciência registrada em {formatDate(selected.lidoEm)}.</p> : (
              <section className="comunicado-ack comunicado-ack-simple" aria-label="Confirmar ciência">
                <p>Ao continuar, sua ciência deste informativo será registrada.</p>
                <ActionButton className="comunicado-primary" variant="primary" idleLabel="Seguinte" loadingLabel="Registrando ciência" state={busy ? "loading" : "idle"} onClick={() => void acknowledge()} />
              </section>
            )}
          </article>
        ) : (
          <div className="comunicado-list services-panel">
            <div className="comunicado-list-intro"><span>Central de avisos</span><p>Informações e avisos enviados pela operação.</p></div>
            {loadStatus === "loading" && !items.length ? (
              <div className="comunicado-skeleton" role="status" aria-busy="true" aria-label="Carregando comunicados">
                <span /><span /><span />
              </div>
            ) : loadStatus === "error" && !items.length ? (
              <div className="comunicado-load-error" role="alert">
                <p>Não foi possível carregar os comunicados. Verifique a conexão e tente novamente.</p>
                <ActionButton variant="secondary" idleLabel="Tentar novamente" loadingLabel="Carregando" state={busy ? "loading" : "idle"} onClick={() => { setBusy(true); void refresh().finally(() => setBusy(false)); }} />
              </div>
            ) : <>
            <h2>Pendentes <span>{pending.length}</span></h2>
            {pending.length ? pending.map((item) => (
              <ComunicadoAgendaCard key={item.id} item={item} onOpen={openItem} />
            )) : <p className="comunicado-empty">Nenhum comunicado pendente.</p>}
            </>}
            {completed.length ? <><h2>Concluídos</h2>{completed.map((item) => (
              <ComunicadoAgendaCard key={item.id} item={item} onOpen={openItem} />
            ))}</> : null}
          </div>
        )}
      </section>
    </AppShell>
  );
}
