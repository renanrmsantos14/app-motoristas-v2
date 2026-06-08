export type SystemIconName =
  | "home"
  | "refresh"
  | "search"
  | "warning"
  | "error"
  | "money"
  | "dismiss"
  | "arrowLeft"
  | "copy"
  | "check"
  | "eraser"
  | "trash"
  | "camera"
  | "flash"
  | "sync"
  | "rotate";

export function SystemIcon({ name }: { name: SystemIconName }) {
  if (name === "arrowLeft") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M29 10 15 24l14 14M16 24h28" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "copy") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M17 15V8h25v25h-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M8 17h25v25H8V17Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M10 25.5 19.2 34 38 14" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "eraser") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="m31 7 11 11-19 19H12L7 32 31 7Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M19 20 30 31M9 40h32" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "trash") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M9 13h30" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M19 13V8h10v5" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 18 16 40h16l2-22" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 23v12M27 23v12" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "camera") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M7 17h9l3-5h10l3 5h9v24H7V17Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="24" cy="29" r="8" fill="none" stroke="currentColor" strokeWidth="3" />
      </svg>
    );
  }

  if (name === "flash") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M28 4 12 27h13l-5 21 17-27H24l4-17Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "sync") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M38 18a15 15 0 0 0-25-8L9 14M10 30a15 15 0 0 0 25 8l4-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 6v8h8M39 42v-8h-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "rotate") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M15 9h18a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H15a6 6 0 0 1-6-6V15a6 6 0 0 1 6-6Z" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M29 14h7v7M36 14 26 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 34h-7v-7M12 34l10-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "home") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M8 23 24 9l16 14v17H29V28H19v12H8V23Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "refresh") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M38 18a15 15 0 1 0 1 13" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M38 8v10H28" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="21" cy="21" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="m30 30 10 10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "warning") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 6 44 40H4L24 6Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M24 17v12M24 35h.1" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "error") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M24 13v15M24 35h.1" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "money") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M7 14h34v20H7V14Zm7 5v10h20V19H14Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="24" cy="24" r="4" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="m14 14 20 20M34 14 14 34" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
