import carIcon from "../../assets/icons/car.svg";
import clockIcon from "../../assets/icons/clock.svg";
import moneyIcon from "../../assets/icons/money-check-dollar.svg";
import wrenchIcon from "../../assets/icons/wrench.svg";
import type { TileIcon } from "../../types";

const iconByType: Record<TileIcon, string> = {
  cars: carIcon,
  clock: clockIcon,
  money: moneyIcon,
  tools: wrenchIcon
};

export function PowerIcon({ icon }: { icon: TileIcon }) {
  return <img className="power-icon-img" src={iconByType[icon]} alt="" aria-hidden="true" draggable={false} />;
}
