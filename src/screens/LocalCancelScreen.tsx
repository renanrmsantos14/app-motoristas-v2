import { useState } from "react";
import { FlowSubmitButton, type FlowSubmitState } from "../components/common/FlowSubmitButton";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import type { DetailData } from "../types";

type LocalCancelScreenProps = {
  detail: DetailData;
  onBack: () => void;
  onWrongClick: () => void;
  onSubmit: (reason: string) => void;
  submitState?: FlowSubmitState;
};

export function LocalCancelScreen({ onBack, onWrongClick, onSubmit, submitState = "idle" }: LocalCancelScreenProps) {
  const [text, setText] = useState("");
  const isSubmitting = submitState !== "idle";

  return (
    <AppShell screenLabel="TelaCanceladonoLocal">
      <FormMenu title="Cancelado no Local" onBack={isSubmitting ? undefined : onBack} rightIcon="eraser" rightLabel="Limpar" onRightClick={isSubmitting ? undefined : () => setText("")} />
      <section className="main-panel cancel-main">
        <article className="cancel-card">
          <div className="cancel-title">Descreva detalhadamente:</div>
          <div className="cancel-scroll">
            <div className="cancel-form">
              <div className="cancel-input-block">
                <label>Detalhes do Cancelamento</label>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Digite aqui os envolvidos, horários, detalhes, motivos, etc"
                  rows={6}
                />
              </div>
            </div>
          </div>
          <div className="cancel-actions">
            <button className="cancel-wrong" disabled={isSubmitting} onClick={onWrongClick}>Cliquei errado</button>
            <FlowSubmitButton className="cancel-submit" idleLabel="Enviar" state={submitState} onClick={() => onSubmit(text)} />
          </div>
        </article>
      </section>
    </AppShell>
  );
}
