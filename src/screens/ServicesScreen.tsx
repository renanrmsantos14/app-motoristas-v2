import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { filterAgendaGalleryItems } from "../app/agendaVisibility.ts";
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
  queueHighlightDetailKey?: string;
  onOpenDetails: (detail: DetailData) => void;
};

export function ServicesScreen({ items, onHome, onRefresh, completingDetailKey = "", queueHighlightDetailKey = "", onOpenDetails }: ServicesScreenProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const visibleItems = useMemo(() => filterAgendaGalleryItems(items, now), [items, now]);

  useEffect(() => {
    if (!queueHighlightDetailKey) return;
    const list = listRef.current;
    const target = list?.querySelector<HTMLElement>("[data-queue-highlight='true']");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [queueHighlightDetailKey]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <AppShell screenLabel="TelaServiços">
      <ServicesMenu onHome={onHome} onRefresh={onRefresh} />
      <section className="main-panel services-panel">
        <PullToRefresh scrollRef={listRef} onRefresh={onRefresh}>
        {visibleItems.length === 0 ? (
          <div className="empty-services">Nenhum serviço atribuído a você no momento</div>
        ) : (
            <div ref={listRef} className="agenda-list">
            <AnimatePresence initial={false}>
              {visibleItems.map((item, index) => {
                const detailKey = item.detail ? `${item.detail.type}:${item.detail.id}` : "";
                const isCompleting = Boolean(detailKey && detailKey === completingDetailKey);
                const isQueueHighlight = Boolean(detailKey && detailKey === queueHighlightDetailKey);

                return (
                  <motion.div
                    key={item.id}
                    className={`agenda-layout-item ${isCompleting ? "is-completing-shell" : ""} ${isQueueHighlight ? "is-queue-highlight-shell" : ""}`}
                    data-queue-highlight={isQueueHighlight ? "true" : undefined}
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
                      isQueueHighlight={isQueueHighlight}
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
