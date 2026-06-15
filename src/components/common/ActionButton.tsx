import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import { SystemIcon } from "../icons/SystemIcon";

export type ActionButtonState = "idle" | "loading" | "success";
export type ActionButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export type ActionButtonProps = {
  buttonRef?: React.Ref<HTMLButtonElement>;
  className?: string;
  variant?: ActionButtonVariant;
  idleLabel?: string;
  label?: string;
  loadingLabel?: string;
  successLabel?: string;
  state?: ActionButtonState;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  ariaInvalid?: boolean;
};

type ActionBarProps = {
  className?: string;
  children: React.ReactNode;
};

export function ActionButton({
  buttonRef,
  className = "",
  variant = "secondary",
  idleLabel,
  label,
  loadingLabel = "Enviando",
  successLabel = "Enviado",
  state = "idle",
  active = true,
  disabled = false,
  onClick,
  icon,
  ariaInvalid
}: ActionButtonProps) {
  const resolvedIdleLabel = idleLabel ?? label ?? "";
  const visualState = active ? state : "idle";
  const isBusy = visualState !== "idle";
  const buttonLabel = visualState === "success" ? successLabel : visualState === "loading" ? loadingLabel : resolvedIdleLabel;
  const showIdleIcon = visualState === "idle" && Boolean(icon);

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      className={`action-button action-button--${variant} ${className} is-${visualState}`.trim()}
      data-variant={variant}
      data-state={visualState}
      disabled={disabled || (!active && state !== "idle") || isBusy}
      aria-invalid={ariaInvalid}
      aria-busy={visualState === "loading"}
      onClick={onClick}
      whileTap={disabled || isBusy ? undefined : { scale: 0.965, y: 1 }}
      transition={{ type: "spring", stiffness: 460, damping: 28 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={visualState}
          className="action-button-content"
          initial={{ opacity: 0, y: 5, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -5, scale: 0.9 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          {visualState === "loading" ? <span className="action-button-spinner" aria-hidden="true" /> : null}
          {visualState === "success" ? (
            <span className="action-button-check" aria-hidden="true">
              <SystemIcon name="check" />
            </span>
          ) : showIdleIcon ? (
            <span className="action-button-icon" aria-hidden="true">{icon}</span>
          ) : null}
          <span>{buttonLabel}</span>
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

export function ActionBar({ className = "", children }: ActionBarProps) {
  return <div className={`action-bar ${className}`.trim()}>{children}</div>;
}
