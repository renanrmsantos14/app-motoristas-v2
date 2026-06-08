import { useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { AgendaItem, DetailData } from "../types";
import { AppShell } from "../components/layout/AppShell";
import { ServicesMenu } from "../components/navigation/ServicesMenu";
import { AgendaCard } from "../components/services/AgendaCard";
import { PullToRefresh } from "../components/common/PullToRefresh";

type ServicesScreenProps = {
  items: AgendaItem[];
  onHome: () => void;
  onRefresh: () => void | Promise<void>;
  completingDetailKey?: string;
  onOpenDetails: (detail: DetailData) => void;
};

export function ServicesScreen({ items, onHome, onRefresh, completingDetailKey = "", onOpenDetails }: ServicesScreenProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  return (
    <AppShell screenLabel="TelaServiços">
      <ServicesMenu onHome={onHome} onRefresh={onRefresh} />
      <section className="main-panel services-panel">
        <PullToRefresh scrollRef={listRef} onRefresh={onRefresh}>
        {items.length === 0 ? (
          <div className="empty-services">Nenhum serviço atribuído a você no momento</div>
        ) : (
            <div ref={listRef} className="agenda-list">
            <AnimatePresence initial={false}>
              {items.map((item, index) => {
                const isCompleting = Boolean(item.detail && `${item.detail.type}:${item.detail.id}` === completingDetailKey);

                return (
                  <motion.div
                    key={item.id}
                    className={`agenda-layout-item ${isCompleting ? "is-completing-shell" : ""}`}
                    layout
                    initial={false}
                    animate={{ opacity: 1, y: 0, scale: 1, marginBottom: 14 }}
                    exit={{ opacity: 0, height: 0, y: -10, scale: 0.99, marginBottom: 0 }}
                    transition={{
                      layout: { type: "spring", stiffness: 360, damping: 36, mass: 0.72 },
                      opacity: { duration: 0.18, ease: [0.23, 1, 0.32, 1] },
                      height: { duration: 0.28, ease: [0.32, 0.72, 0, 1] },
                      y: { duration: 0.28, ease: [0.32, 0.72, 0, 1] },
                      scale: { duration: 0.28, ease: [0.32, 0.72, 0, 1] }
                    }}
                  >
                    <AgendaCard
                      item={item}
                      index={index}
                      isCompleting={isCompleting}
                      onOpen={(selected) => selected.detail && onOpenDetails(selected.detail)}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        </PullToRefresh>
      </section>
    </AppShell>
  );
}
