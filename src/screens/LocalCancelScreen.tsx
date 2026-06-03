import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import type { DetailData } from "../types";

type LocalCancelScreenProps = {
  detail: DetailData;
  onBack: () => void;
  onWrongClick: () => void;
  onSubmit: (reason: string) => void;
};

export function LocalCancelScreen({ onBack, onWrongClick, onSubmit }: LocalCancelScreenProps) {
  const [text, setText] = useState("");

  return (
    <AppShell screenLabel="TelaCanceladonoLocal">
      <FormMenu title="Cancelado no Local" onBack={onBack} rightIcon="eraser" rightLabel="Limpar" onRightClick={() => setText("")} />
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
              <div className="cancel-actions">
                <button className="cancel-wrong" onClick={onWrongClick}>Cliquei errado</button>
                <button className="cancel-submit" onClick={() => onSubmit(text)}>Enviar</button>
              </div>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
