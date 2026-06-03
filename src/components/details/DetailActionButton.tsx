import type { DetailAction } from "../../types";

type DetailActionButtonProps = {
  action: DetailAction;
  onClick?: () => void;
};

export function DetailActionButton({ action, onClick }: DetailActionButtonProps) {
  if (action === "cancel") {
    return <button className="detail-action cancel" onClick={onClick}>Cancelar no local</button>;
  }

  if (action === "voucher") {
    return <button className="detail-action voucher" onClick={onClick}>Voucher</button>;
  }

  return <button className="detail-action finish" onClick={onClick}>Finalizar</button>;
}
