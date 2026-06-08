import { AnimatePresence, motion } from "motion/react";
import { SystemIcon } from "../icons/SystemIcon";

export type FlowSubmitState = "idle" | "loading" | "success";

type FlowSubmitButtonProps = {
  className: string;
  idleLabel: string;
  loadingLabel?: string;
  successLabel?: string;
  state: FlowSubmitState;
  onClick: () => void;
};

export function FlowSubmitButton({
  className,
  idleLabel,
  loadingLabel = "Enviando",
  successLabel = "Enviado",
  state,
  onClick
}: FlowSubmitButtonProps) {
  const isBusy = state !== "idle";
  const label = state === "success" ? successLabel : state === "loading" ? loadingLabel : idleLabel;

  return (
    <motion.button
      type="button"
      className={`${className} flow-submit-button is-${state}`}
      disabled={isBusy}
      aria-busy={state === "loading"}
      onClick={onClick}
      whileTap={isBusy ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          className="flow-submit-content"
          initial={{ opacity: 0, y: 5, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -5, scale: 0.9 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          {state === "loading" ? <span className="flow-submit-spinner" aria-hidden="true" /> : null}
          {state === "success" ? (
            <span className="flow-submit-check" aria-hidden="true">
              <SystemIcon name="check" />
            </span>
          ) : null}
          <span>{label}</span>
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
