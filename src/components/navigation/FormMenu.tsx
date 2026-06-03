import { SystemIcon, type SystemIconName } from "../icons/SystemIcon";

type FormMenuProps = {
  title: string;
  onBack: () => void;
  rightIcon?: SystemIconName;
  rightLabel?: string;
  onRightClick?: () => void;
};

export function FormMenu({ title, onBack, rightIcon, rightLabel, onRightClick }: FormMenuProps) {
  return (
    <header className="menu form-menu">
      <button className="icon-button form-menu-button" aria-label="Voltar" onClick={onBack}>
        <SystemIcon name="arrowLeft" />
      </button>
      <div className="form-menu-title">{title}</div>
      {rightIcon ? (
        <button className="icon-button form-menu-button" aria-label={rightLabel ?? "Acao"} onClick={onRightClick}>
          <SystemIcon name={rightIcon} />
        </button>
      ) : (
        <div className="form-menu-spacer" aria-hidden="true" />
      )}
    </header>
  );
}
