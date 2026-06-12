import type { DetailField } from "../../types";
import { extractMaintenancePhotoUrls, isMaintenancePhotoPreviewField } from "../../lib/detailMedia";
import { parseSafeDetailHtml } from "../../lib/detailHtml.ts";
import { openExternalUrl } from "../../lib/localWorkflow";
import { buildGoogleMapsSearchUrl } from "../../lib/mapLinks";
import { useLayoutEffect, useRef, useState } from "react";

const externalUrlPattern = /^https?:\/\/\S+$/i;

function getExternalHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "Link externo";
  }
}

function getPhotoCardTitle(label: string, index: number, total: number) {
  const cleanLabel = label.replace(/^link\s+/i, "").trim();
  if (total === 1) return cleanLabel || "Foto";
  return `${cleanLabel || "Foto"} ${index + 1}`;
}

function DetailPhotoPreview({ label, url, index, total }: { label: string; url: string; index: number; total: number }) {
  const title = getPhotoCardTitle(label, index, total);
  const host = getExternalHost(url);

  return (
    <div className="detail-photo-card">
      <button className="detail-photo-open" type="button" onClick={() => openExternalUrl(url)} aria-label={`Abrir ${title} externamente`}>
        <span className="detail-photo-icon" aria-hidden="true">&gt;</span>
        <span className="detail-photo-copy">
          <strong>{title}</strong>
          <small>{host}</small>
        </span>
      </button>
      <button className="detail-photo-copy-button" type="button" onClick={() => openExternalUrl(url)}>
        Abrir link
      </button>
    </div>
  );
}

export function DetailsField({ field }: { field: DetailField }) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLElement | null>(null);
  const value = field.value.trim();
  const mapUrl = field.html ? "" : buildGoogleMapsSearchUrl(field.label, value);
  const isPhotoPreview = isMaintenancePhotoPreviewField(field.label, value);
  const photoUrls = isPhotoPreview ? extractMaintenancePhotoUrls(value) : [];
  const [fitsInline, setFitsInline] = useState(false);
  const hasExplicitBreak = /\n|<br\s*\/?>/i.test(value);
  const setValueRef = (element: HTMLElement | null) => {
    valueRef.current = element;
  };

  useLayoutEffect(() => {
    if (hasExplicitBreak) {
      setFitsInline(false);
      return;
    }

    const measure = () => {
      const fieldElement = fieldRef.current;
      const labelElement = labelRef.current;
      const valueElement = valueRef.current;

      if (!fieldElement || !labelElement || !valueElement) {
        setFitsInline(false);
        return;
      }

      const measureTextWidth = (element: HTMLElement) => {
        const text = (element.textContent ?? "").trim();
        const elementStyles = getComputedStyle(element);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) return element.getBoundingClientRect().width;
        context.font = elementStyles.font;
        return context.measureText(text).width;
      };

      const styles = getComputedStyle(fieldElement);
      const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const availableWidth = fieldElement.clientWidth - horizontalPadding;
      const inlineGap = 12;
      const requiredWidth = measureTextWidth(labelElement) + measureTextWidth(valueElement) + inlineGap;

      setFitsInline(requiredWidth <= availableWidth);
    };

    measure();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer) observer.observe(fieldRef.current as Element);
    window.addEventListener("resize", measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [field.label, value, hasExplicitBreak]);

  return (
    <div ref={fieldRef} className={`detail-field ${fitsInline ? "detail-field--inline" : ""}`}>
      <div ref={labelRef} className={`detail-field-label ${field.strong ? "lato" : ""}`}>{field.label}</div>
      {field.html ? (
        <div ref={setValueRef} className={`detail-field-value ${field.strong ? "semibold" : ""}`}>
          {parseSafeDetailHtml(value).map((part, index) => {
            if (part.type === "break") return <br key={`break-${index}`} />;
            if (part.type === "link") {
              return (
                <button key={`${part.href}-${index}`} className="detail-inline-link" type="button" onClick={() => openExternalUrl(part.href)}>
                  {part.text}
                </button>
              );
            }
            return <span key={`text-${index}`}>{part.value}</span>;
          })}
        </div>
      ) : isPhotoPreview ? (
        <div ref={setValueRef} className="detail-photo-list">
          {photoUrls.map((photoUrl, index) => (
            <DetailPhotoPreview key={`${photoUrl}-${index}`} label={field.label} url={photoUrl} index={index} total={photoUrls.length} />
          ))}
        </div>
      ) : externalUrlPattern.test(value) ? (
        <button ref={setValueRef} className={`detail-field-value detail-link ${field.strong ? "semibold" : ""}`} type="button" onClick={() => openExternalUrl(value)}>
          {value}
        </button>
      ) : mapUrl ? (
        <button ref={setValueRef} className={`detail-field-value detail-link detail-map-link ${field.strong ? "semibold" : ""}`} type="button" onClick={() => openExternalUrl(mapUrl)} aria-label={`Abrir ${field.label} no Google Maps`}>
          {value}
        </button>
      ) : (
        <div ref={setValueRef} className={`detail-field-value ${field.strong ? "semibold" : ""}`}>{value}</div>
      )}
    </div>
  );
}
