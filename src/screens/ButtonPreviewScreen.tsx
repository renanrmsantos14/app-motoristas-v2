import { useEffect, useRef, useState } from "react";
import invoiceReceiptIcon from "../assets/icons/invoice-receipt.svg";
import { ActionBar, ActionButton, type ActionButtonState } from "../components/common/ActionButton";
import { LocalToast, type ToastState } from "../components/common/LocalToast";
import { SystemIcon } from "../components/icons/SystemIcon";

type PreviewButtonId =
  | "variants-primary"
  | "variants-secondary"
  | "variants-danger"
  | "icons-primary"
  | "icons-secondary"
  | "icons-danger"
  | "bar-secondary"
  | "bar-primary"
  | "receipt"
  | "receipt-secondary"
  | "receipt-primary"
  | "danger-secondary"
  | "danger-primary";

type PreviewStates = Record<PreviewButtonId, ActionButtonState>;

const INITIAL_STATES: PreviewStates = {
  "variants-primary": "idle",
  "variants-secondary": "idle",
  "variants-danger": "idle",
  "icons-primary": "idle",
  "icons-secondary": "idle",
  "icons-danger": "idle",
  "bar-secondary": "idle",
  "bar-primary": "idle",
  receipt: "idle",
  "receipt-secondary": "idle",
  "receipt-primary": "idle",
  "danger-secondary": "idle",
  "danger-primary": "idle"
};

const DEMO_DELAY_MS = 900;

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="button-preview-section">
      <div className="button-preview-section-title">{title}</div>
      {children}
    </section>
  );
}

type ButtonPreviewScreenProps = {
  onShowToast?: (message: string) => void;
};

const REAL_TOAST_PRESETS = [
  { label: "Dataverse carregado", message: "Atualizado do Dataverse." },
  { label: "Gasto registrado", message: "Gasto registrado." },
  { label: "Assinatura salva", message: "Assinatura salva localmente." },
  { label: "Info operacional", message: "Carregando Dataverse." },
  { label: "Fila bloqueada", message: "Conclua os itens anteriores da fila antes de prosseguir." },
  { label: "Recibo indisponivel", message: "Recibo personalizado ainda nao foi configurado." },
  { label: "Servico ausente", message: "Serviço remoto não encontrado." },
  { label: "Falha Dataverse", message: "Falha ao carregar Dataverse." },
  { label: "Falha veiculos", message: "Falha ao carregar veículos." },
  { label: "Foto apagada", message: "Foto apagada." },
  { label: "Cancelamento enviado", message: "Cancelamento enviado para analise." },
  { label: "Dados reiniciados", message: "Dados locais reiniciados." }
] as const;

const PREVIEW_TOAST: ToastState = {
  id: 1,
  tone: "success",
  message: "Flow enviado. Mantenha esta tela aberta enquanto a operacao termina."
};

export function ButtonPreviewScreen({ onShowToast }: ButtonPreviewScreenProps) {
  const [states, setStates] = useState<PreviewStates>(INITIAL_STATES);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const runDemo = (buttonId: PreviewButtonId) => {
    setStates((current) => ({ ...current, [buttonId]: "loading" }));

    const successTimer = window.setTimeout(() => {
      setStates((current) => ({ ...current, [buttonId]: "success" }));
    }, DEMO_DELAY_MS);

    const idleTimer = window.setTimeout(() => {
      setStates((current) => ({ ...current, [buttonId]: "idle" }));
    }, DEMO_DELAY_MS * 2);

    timersRef.current.push(successTimer, idleTimer);
    onShowToast?.(`Preview acionado: ${buttonId}.`);
  };

  const fireToastPreview = (message: string) => {
    onShowToast?.(message);
  };

  return (
    <main className="button-preview-screen">
      <div className="button-preview-shell">
        <header className="button-preview-header">
          <div className="button-preview-kicker">Dev only</div>
          <h1>Preview de botoes</h1>
          <p>`?dev=preview` abre esta tela fora do fluxo.</p>
        </header>

        <PreviewSection title="Variantes">
          <div className="button-preview-grid">
            <ActionButton className="button-preview-button" variant="primary" label="Primario" loadingLabel="Carregando" successLabel="Pronto" onClick={() => runDemo("variants-primary")} state={states["variants-primary"]} />
            <ActionButton className="button-preview-button" label="Secundario" loadingLabel="Carregando" successLabel="Pronto" onClick={() => runDemo("variants-secondary")} state={states["variants-secondary"]} />
            <ActionButton className="button-preview-button" variant="danger" label="Cancelado" loadingLabel="Cancelando" successLabel="Cancelado" onClick={() => runDemo("variants-danger")} state={states["variants-danger"]} />
          </div>
        </PreviewSection>

        <PreviewSection title="Com icone">
          <div className="button-preview-grid">
            <ActionButton className="button-preview-button" variant="primary" label="Confirmar" loadingLabel="Confirmando" successLabel="Confirmado" icon={<SystemIcon name="check" />} onClick={() => runDemo("icons-primary")} state={states["icons-primary"]} />
            <ActionButton className="button-preview-button" label="Voltar" loadingLabel="Voltando" successLabel="Voltou" icon={<SystemIcon name="arrowLeft" />} onClick={() => runDemo("icons-secondary")} state={states["icons-secondary"]} />
            <ActionButton className="button-preview-button" variant="danger" label="Apagar foto" loadingLabel="Apagando foto" successLabel="Apagada" icon={<SystemIcon name="trash" />} onClick={() => runDemo("icons-danger")} state={states["icons-danger"]} />
          </div>
        </PreviewSection>

        <PreviewSection title="Barra padrao">
          <ActionBar className="button-preview-action-bar">
            <ActionButton className="button-preview-button" label="Voltar" loadingLabel="Voltando" successLabel="Voltou" icon={<SystemIcon name="arrowLeft" />} onClick={() => runDemo("bar-secondary")} state={states["bar-secondary"]} />
            <ActionButton
              className="button-preview-button"
              variant="primary"
              idleLabel="FINALIZAR"
              loadingLabel="ENVIANDO"
              successLabel="FINALIZADO"
              state={states["bar-primary"]}
              onClick={() => runDemo("bar-primary")}
            />
          </ActionBar>
        </PreviewSection>

        <PreviewSection title="Recibo acima da barra">
          <ActionBar className="button-preview-action-bar receive-actions has-personal-receipt">
            <ActionButton
              className="button-preview-button receive-receipt"
              label="Gerar recibo personalizado"
              loadingLabel="Gerando recibo"
              successLabel="Recibo pronto"
              icon={<img src={invoiceReceiptIcon} alt="" />}
              state={states.receipt}
              onClick={() => runDemo("receipt")}
            />
            <ActionButton className="button-preview-button receive-secondary" label="Voltar" loadingLabel="Voltando" successLabel="Voltou" icon={<SystemIcon name="arrowLeft" />} onClick={() => runDemo("receipt-secondary")} state={states["receipt-secondary"]} />
            <ActionButton
              className="button-preview-button receive-primary"
              variant="primary"
              idleLabel="FINALIZAR"
              loadingLabel="ENVIANDO"
              successLabel="FINALIZADO"
              state={states["receipt-primary"]}
              onClick={() => runDemo("receipt-primary")}
            />
          </ActionBar>
        </PreviewSection>

        <PreviewSection title="Acao destrutiva">
          <ActionBar className="button-preview-action-bar">
            <ActionButton className="button-preview-button" label="Cancelar" loadingLabel="Cancelando" successLabel="Cancelado" icon={<SystemIcon name="dismiss" />} onClick={() => runDemo("danger-secondary")} state={states["danger-secondary"]} />
            <ActionButton
              className="button-preview-button"
              variant="danger"
              idleLabel="Enviar"
              loadingLabel="ENVIANDO"
              successLabel="ENVIADO"
              state={states["danger-primary"]}
              onClick={() => runDemo("danger-primary")}
            />
          </ActionBar>
        </PreviewSection>

        <PreviewSection title="Toasts reais do app">
          <div className="button-preview-grid">
            {REAL_TOAST_PRESETS.map((preset) => (
              <ActionButton
                key={preset.label}
                className="button-preview-button"
                label={preset.label}
                onClick={() => fireToastPreview(preset.message)}
              />
            ))}
          </div>
        </PreviewSection>

        <PreviewSection title="Toast fixo para avaliacao">
          <div className="button-preview-toast-stage">
            <LocalToast toast={PREVIEW_TOAST} onDismiss={() => undefined} inline />
          </div>
        </PreviewSection>
      </div>
    </main>
  );
}
