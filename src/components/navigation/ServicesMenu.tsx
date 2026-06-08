import { useState } from "react";
import { motion } from "motion/react";
import { SystemIcon } from "../icons/SystemIcon";

type ServicesMenuProps = {
  onHome: () => void;
  onRefresh: () => void | Promise<void>;
  title?: string;
};

export function ServicesMenu({ onHome, onRefresh, title = "Seus Serviços" }: ServicesMenuProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    window.dispatchEvent(new CustomEvent("betinhos:refresh-visual", { detail: { phase: "start" } }));
    try {
      await onRefresh();
    } finally {
      window.dispatchEvent(new CustomEvent("betinhos:refresh-visual", { detail: { phase: "done" } }));
      window.setTimeout(() => setIsRefreshing(false), 360);
    }
  };

  return (
    <header className="menu services-menu">
      <div className="services-menu-inner">
        <motion.div className="services-discovery-bar" layout transition={{ type: "spring", bounce: 0.18, duration: 0.42 }}>
          <motion.button
            className="services-nav-button services-nav-button--home"
            aria-label="Início"
            onClick={onHome}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
          >
            <SystemIcon name="home" />
            <span>Início</span>
          </motion.button>

          <motion.div className="services-title-block" layout>
            <span>Agenda</span>
            <strong>{title}</strong>
          </motion.div>

          <motion.button
            className="services-nav-button services-nav-button--refresh"
            aria-label="Atualizar"
            onClick={refresh}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
          >
            <motion.span animate={{ rotate: isRefreshing ? 360 : 0 }} transition={{ duration: 0.42, ease: "easeOut" }}>
              <SystemIcon name="refresh" />
            </motion.span>
          </motion.button>
        </motion.div>
      </div>
    </header>
  );
}
