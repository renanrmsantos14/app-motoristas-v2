import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

export type ToastTone = "info" | "success" | "warning" | "error";

export type ToastState = {
  id: number;
  message: string;
  tone: ToastTone;
};

type LocalToastProps = {
  toast: ToastState | null;
  onDismiss: () => void;
  inline?: boolean;
};

const TOAST_META: Record<ToastTone, { label: string }> = {
  info: { label: "Aviso" },
  success: { label: "Conclu\u00eddo" },
  warning: { label: "Aten\u00e7\u00e3o" },
  error: { label: "Erro" }
};

export function LocalToast({ toast, onDismiss, inline = false }: LocalToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => onDismiss(), 2900);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <AnimatePresence initial={false} mode="sync">
      {toast ? (
        <motion.div
          key={toast.id}
          className={`local-toast-layer${inline ? " is-inline" : ""}`}
          aria-live="polite"
          aria-atomic="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        >
          <motion.div
            className={`local-toast local-toast--${toast.tone}`}
            role={toast.tone === "error" ? "alert" : "status"}
            tabIndex={0}
            initial={{ opacity: 0, y: -10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.992 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            onClick={onDismiss}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onDismiss();
              }
            }}
          >
            <div className="local-toast-body">
              <div className="local-toast-copy">
                <div className="local-toast-head">
                  <span className="local-toast-label">{TOAST_META[toast.tone].label}</span>
                  <button
                    className="local-toast-close"
                    type="button"
                    aria-label="Fechar aviso"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDismiss();
                    }}
                  >
                    +
                  </button>
                </div>
                <span className="local-toast-message">{toast.message}</span>
              </div>
            </div>
            <span className="local-toast-progress" aria-hidden="true" />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
