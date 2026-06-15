import { ActionButton } from "../common/ActionButton";
import type { DetailAction } from "../../types";

type DetailActionButtonProps = {
  action: DetailAction;
  onClick?: () => void;
};

export function DetailActionButton({ action, onClick }: DetailActionButtonProps) {
  if (action === "cancel") {
    return <ActionButton className="detail-action cancel" variant="danger" label="Cancelar no local" onClick={onClick ?? (() => undefined)} />;
  }

  if (action === "receber") {
    return <ActionButton className="detail-action finish" variant="primary" label="Receber" onClick={onClick ?? (() => undefined)} />;
  }

  if (action === "voucher") {
    return <ActionButton className="detail-action voucher" label="Voucher" onClick={onClick ?? (() => undefined)} />;
  }

  return <ActionButton className="detail-action finish" variant="primary" label="Finalizar" onClick={onClick ?? (() => undefined)} />;
}
