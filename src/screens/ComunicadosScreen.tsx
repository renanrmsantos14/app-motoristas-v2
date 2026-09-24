import { useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { SignatureDrawing, SignaturePad } from "../components/comunicados/SignaturePad";
import {
  abrirComunicado,
  assinarComunicado,
  COMUNICADO_TIPO,
  isComunicadoPending,
  type ComunicadoDestinatario,
  type SignatureStrokes
} from "../lib/comunicados";

type Props = {
  items: ComunicadoDestinatario[];
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

export function ComunicadosScreen({ items, selectedId, onSelectedIdChange, onBack, onReload, driverName }: Props) {
  const [strokes, setStrokes] = useState<SignatureStrokes>([]);
  const [observacao, setObservacao] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const selected = items.find((item) => item.id === selectedId);
  const pending = items.filter(isComunicadoPending);
  const completed = items.filter((item) => !isComunicadoPending(item));

  useEffect(() => {
    if (!selected || selected.abertoEm || selected.lidoEm) return;
    let active = true;
    abrirComunicado(selected.id)
      .then(async () => {
        if (!active) return;
        try { await onReload(); }
        catch { if (active) setError("Visualização registrada, mas não foi possível atualizar a lista. Tente novamente."); }
      })
      .catch(() => { if (active) setError("Não foi possível registrar a visualização. Tente atualizar."); });
    return () => { active = false; };
  }, [selected?.id, selected?.abertoEm, selected?.lidoEm]);

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
      setError(signed ? "Ciência registrada, mas não foi possível atualizar a lista. Tente novamente." : cause instanceof Error ? cause.message : "Não foi possível salvar a ciência.");
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    try { await onReload(); }
    catch { setError("Não foi possível atualizar os comunicados. Tente novamente."); }
    finally { setRefreshing(false); }
  };

  return (
    <AppShell screenLabel="Comunicados">
      <div className="comunicado-screen">
        <header className="comunicado-screen-header">
          <button type="button" className="comunicado-back" onClick={selected ? () => openItem("") : onBack}>
            Voltar
          </button>
          <div>
            <span className="comunicado-eyebrow">Betinhos · Operação</span>
            <h1>{selected ? selected.titulo : "Comunicados"}</h1>
          </div>
          <button type="button" className="comunicado-refresh" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? "Atualizando..." : "Atualizar"}</button>
        </header>
        {error ? <p className="comunicado-error comunicado-page-error" role="alert">{error}</p> : null}

        {selected ? (
          <article className="comunicado-detail">
            <div className="comunicado-detail-meta">
              <span>{selected.tipo === COMUNICADO_TIPO.ciencia ? "Exige ciência" : "Informativo"}</span>
              <time>{formatDate(selected.enviadoEm)}</time>
            </div>
            <p className="comunicado-body">{selected.corpo}</p>
            {selected.tipo === COMUNICADO_TIPO.ciencia && !selected.cienteEm ? (
              <section className="comunicado-ack" aria-label="Registro de ciência">
                <h2>Registrar ciência</h2>
                <p>A assinatura será registrada em seu nome: <strong>{driverName}</strong>.</p>
                <label htmlFor="comunicado-observacao">Observação (opcional)</label>
                <textarea id="comunicado-observacao" value={observacao} maxLength={1000} onChange={(event) => setObservacao(event.target.value)} placeholder="Escreva aqui se precisar acrescentar algo." />
                <label>Assine abaixo</label>
                <SignaturePad value={strokes} onChange={setStrokes} />
                <button type="button" className="comunicado-primary" disabled={busy} onClick={() => void sign()}>
                  {busy ? "Salvando ciência..." : "Assinar ciência"}
                </button>
              </section>
            ) : selected.cienteEm ? (
              <section className="comunicado-signed">
                <h2>Ciência registrada</h2>
                <p>{selected.nomeAssinante} · {formatDate(selected.cienteEm)}</p>
                <SignatureDrawing value={parseStrokes(selected.assinaturaJson)} />
                {selected.observacao ? <p>Observação: {selected.observacao}</p> : null}
              </section>
            ) : selected.lidoEm ? <p className="comunicado-read-state">Leitura registrada em {formatDate(selected.lidoEm)}.</p> : <p className="comunicado-read-state">Registrando leitura...</p>}
          </article>
        ) : (
          <div className="comunicado-list">
            <p className="comunicado-list-intro">Informações e avisos enviados pela operação.</p>
            <h2>Pendentes <span>{pending.length}</span></h2>
            {pending.length ? pending.map((item) => (
              <button type="button" className="comunicado-row" key={item.id} onClick={() => openItem(item.id)}>
                <span><strong>{item.titulo}</strong><small>{item.tipo === COMUNICADO_TIPO.ciencia ? "Assinatura necessária" : "Não lido"}</small></span>
                <time>{formatDate(item.enviadoEm)}</time>
              </button>
            )) : <p className="comunicado-empty">Nenhum comunicado pendente.</p>}
            {completed.length ? <><h2>Concluídos</h2>{completed.map((item) => (
              <button type="button" className="comunicado-row is-read" key={item.id} onClick={() => openItem(item.id)}>
                <span><strong>{item.titulo}</strong><small>{item.cienteEm ? "Ciência assinada" : "Lido"}</small></span>
                <time>{formatDate(item.enviadoEm)}</time>
              </button>
            ))}</> : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}
