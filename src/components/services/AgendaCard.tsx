import type { CSSProperties } from "react";
import checkIcon from "../../assets/icons/check-svgrepo-com.svg";
import type { AgendaItem } from "../../types";
import { SystemIcon } from "../icons/SystemIcon";
import { NotificationMarker } from "./NotificationMarker";

type AgendaCardProps = {
  item: AgendaItem;
  index?: number;
  isCompleting?: boolean;
  onOpen: (item: AgendaItem) => void;
};

function formatAgendaTime(value?: string) {
  if (!value) return { context: "", time: "" };

  const normalized = value.replace(/\s+/g, " ").trim();
  const rangeMatch = normalized.match(/^(.*?)\s+entre\s+(\d{2}:\d{2})\s+e\s+(\d{2}:\d{2})$/i);
  if (rangeMatch) {
    return {
      context: rangeMatch[1],
      time: `${rangeMatch[2]} - ${rangeMatch[3]}`,
    };
  }

  const singleMatch = normalized.match(/^(.*?)(\d{2}:\d{2})$/);
  if (singleMatch) {
    return {
      context: singleMatch[1].trim(),
      time: singleMatch[2],
    };
  }

  return { context: "", time: normalized };
}

function getTrajectory(item: AgendaItem) {
  const trajectoryField = item.detail?.fields.find((field) => field.label.toLowerCase() === "trajeto");

  return trajectoryField?.value || item.description || "";
}

export function AgendaCard({ item, index = 0, isCompleting = false, onOpen }: AgendaCardProps) {
  const className = `agenda-card ${item.tipo.toLowerCase()} ${isCompleting ? "is-completing" : ""}`;
  const time = formatAgendaTime(item.time);
  const trajectory = getTrajectory(item);
  const style = { "--agenda-index": index } as CSSProperties;

  if (item.tipo === "HEADER") {
    return (
      <article className={className} style={style}>
        <div className="agenda-header-title">
          {item.tituloData} {item.seta}
        </div>
      </article>
    );
  }

  return (
    <article className={className} style={style}>
      <div className="agenda-card-inner">
        <div className="agenda-card-header">
          <div className="agenda-time">
            {time.context ? <span>{time.context}</span> : null}
            <strong>{time.time}</strong>
          </div>
          <div className="agenda-label">{item.label}</div>
        </div>

        <div className="agenda-card-body">
          <div className="agenda-trajectory">
            {item.tipo === "SERVICO" ? <span>Trajeto</span> : null}
            <strong>{trajectory}</strong>
          </div>
        </div>
      </div>
      <button className="agenda-hit" aria-label={item.description} disabled={isCompleting} onClick={() => onOpen(item)} />
      {isCompleting ? (
        <div className="agenda-complete-layer" aria-hidden="true">
          <div className="agenda-complete-check">
            <img src={checkIcon} alt="" />
          </div>
        </div>
      ) : null}
      {item.canceled ? (
        <div className="canceled-overlay">
          <SystemIcon name="dismiss" />
          <div className="canceled-title">CANCELADO</div>
          <div className="canceled-note">(desconsiderar este item)</div>
        </div>
      ) : null}
      <NotificationMarker priority={item.priority} />
    </article>
  );
}
