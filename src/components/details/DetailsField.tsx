import type { DetailField } from "../../types";

export function DetailsField({ field }: { field: DetailField }) {
  return (
    <div className="detail-field">
      <div className={`detail-field-label ${field.strong ? "lato" : ""}`}>{field.label}</div>
      {field.html ? (
        <div className="detail-field-value" dangerouslySetInnerHTML={{ __html: field.value }} />
      ) : (
        <div className={`detail-field-value ${field.strong ? "semibold" : ""}`}>{field.value}</div>
      )}
    </div>
  );
}
