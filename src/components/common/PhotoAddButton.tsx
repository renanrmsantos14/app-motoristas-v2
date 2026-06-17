import { forwardRef } from "react";
import type { ReactNode } from "react";

type PhotoAddButtonProps = {
  disabled?: boolean;
  ariaLabel: string;
  icon?: ReactNode;
  label?: ReactNode;
  onClick: () => void;
};

export const PhotoAddButton = forwardRef<HTMLButtonElement, PhotoAddButtonProps>(function PhotoAddButton(
  { disabled = false, ariaLabel, icon = "+", label, onClick },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className="photo-add-button"
      data-component="PhotoAddButton"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span>{icon}</span>
      {label ? <strong>{label}</strong> : null}
    </button>
  );
});
