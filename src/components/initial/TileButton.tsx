import type { Screen, Tile } from "../../types";
import { PowerIcon } from "../icons/PowerIcon";

type TileButtonProps = {
  tile: Tile;
  onNavigate: (screen: Screen) => void;
};

export function TileButton({ tile, onNavigate }: TileButtonProps) {
  return (
    <div className="tile-slot">
      <div className="tile-frame">
        <div className={`tile-surface ${tile.variant}`}>
          <div className="tile-icon">
            <PowerIcon icon={tile.icon} />
          </div>
          <div className="tile-label">{tile.label}</div>
        </div>
        <button className="tile-hit" aria-label={tile.label} onClick={() => tile.target && onNavigate(tile.target)} />
      </div>
    </div>
  );
}
