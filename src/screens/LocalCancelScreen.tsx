import { useState } from "react";
import { ActionBar, ActionButton, type ActionButtonState } from "../components/common/ActionButton";
import { TextAreaField } from "../components/common/FormFields";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import type { DetailData } from "../types";

type LocalCancelScreenProps = {
  detail: DetailData;
  onBack: () => void;
  onWrongClick: () => void;
  onSubmit: (reason: string) => void;
  submitState?: ActionButtonState;
};

export function LocalCancelScreen({ onBack, onWrongClick, onSubmit, submitState = "idle" }: LocalCancelScreenProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const isSubmitting = submitState !== "idle";
  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Informe o motivo do cancelamento.");
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <AppShell screenLabel="TelaCanceladonoLocal">
      <FormMenu title="Cancelado no Local" onBack={isSubmitting ? undefined : onBack} rightIcon="eraser" rightLabel="Limpar" onRightClick={isSubmitting ? undefined : () => {
        setText("");
        setError("");
      }} />
      <section className="main-panel cancel-main">
        <article className="cancel-card">
          <div className="cancel-title">Descreva detalhadamente:</div>
          <div className="cancel-scroll">
            <div className="cancel-form">
              <TextAreaField
                fieldClassName="cancel-input-block"
                label="Detalhes do Cancelamento"
                error={error}
                required
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  if (error && event.target.value.trim()) setError("");
                }}
                placeholder="Digite aqui os envolvidos, horários, detalhes, motivos, etc"
                rows={6}
              />
            </div>
          </div>
          <ActionBar className="cancel-actions">
            <ActionButton className="cancel-wrong" label="Cliquei errado" disabled={isSubmitting} onClick={onWrongClick} />
            <ActionButton className="cancel-submit" variant="danger" idleLabel="Enviar" state={submitState} onClick={submit} />
          </ActionBar>
        </article>
      </section>
    </AppShell>
  );
}
