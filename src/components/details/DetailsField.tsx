import type { DetailField } from "../../types";
import { openExternalUrl } from "../../lib/localWorkflow";
import type { MouseEvent } from "react";

const externalUrlPattern = /^https?:\/\/\S+$/i;

export function DetailsField({ field }: { field: DetailField }) {
  const openLinkFromHtml = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest("a[href]");
    const href = link?.getAttribute("href");
    if (!href) return;
    event.preventDefault();
    event.stopPropagation();
    openExternalUrl(href);
  };

  return (
    <div className="detail-field">
      <div className={`detail-field-label ${field.strong ? "lato" : ""}`}>{field.label}</div>
      {field.html ? (
        <div className="detail-field-value" onClick={openLinkFromHtml} dangerouslySetInnerHTML={{ __html: field.value }} />
      ) : externalUrlPattern.test(field.value.trim()) ? (
        <button className={`detail-field-value detail-link ${field.strong ? "semibold" : ""}`} type="button" onClick={() => openExternalUrl(field.value)}>
          {field.value}
        </button>
      ) : (
        <div className={`detail-field-value ${field.strong ? "semibold" : ""}`}>{field.value}</div>
      )}
    </div>
  );
}
