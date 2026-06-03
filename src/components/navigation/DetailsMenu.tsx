import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SystemIcon } from "../icons/SystemIcon";

type DetailsMenuProps = {
  title: string;
  onBack: () => void;
  onCopy?: () => void;
};

export function DetailsMenu({ title, onBack, onCopy }: DetailsMenuProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = () => {
    onCopy?.();
    setCopied(true);
  };

  return (
    <header className="menu details-menu">
      <button className="icon-button details-back" aria-label="Voltar" onClick={onBack}>
        <SystemIcon name="arrowLeft" />
      </button>
      <div className="details-title-block">
        <span>Detalhes</span>
        <strong>{title}</strong>
      </div>
      <motion.button
        className={`icon-button details-copy copy-button ${copied ? "copied" : ""}`}
        aria-label={copied ? "Copiado" : "Copiar"}
        onClick={handleCopy}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 520, damping: 34 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? "check" : "copy"}
            className="copy-button-icon"
            initial={{ opacity: 0, y: 5, scale: 0.82 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.82 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <SystemIcon name={copied ? "check" : "copy"} />
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </header>
  );
}
