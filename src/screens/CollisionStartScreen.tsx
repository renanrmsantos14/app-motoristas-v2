import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import type { CollisionType } from "../lib/collisions";

type CollisionStartScreenProps = {
  onBack: () => void;
  onSelect: (type: CollisionType) => void;
};

export function CollisionStartScreen({ onBack, onSelect }: CollisionStartScreenProps) {
  return (
    <AppShell screenLabel="TelaColisoesInicio">
      <FormMenu title="Colisões" onBack={onBack} />
      <section className="main-panel collision-start-main">
        <article className="collision-start-card">
          <div className="collision-start-care-message">Antes de tudo, que bom que vocês estão bem. Agora escolha a opção que melhor descreve o ocorrido.</div>
          <div className="collision-start-kicker">O que aconteceu?</div>
          <div className="collision-choice-list">
            <button className="collision-choice collision-choice--primary" type="button" onClick={() => onSelect("eu_bati")}>
              <strong>Eu bati</strong>
              <span>Em outro veículo, objeto, portão, guia ou estrutura.</span>
            </button>
            <button className="collision-choice" type="button" onClick={() => onSelect("bateram_em_mim")}>
              <strong>Bateram em mim</strong>
              <span>Outro motorista atingiu o veículo Betinhos.</span>
            </button>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
