import { AnimatePresence, motion } from "motion/react";

export type LoadingOverlayState = {
  phase: "loading" | "success";
  title: string;
  message?: string;
};

type LoadingOverlayProps = {
  loading: LoadingOverlayState | null;
};

export function LoadingOverlay({ loading }: LoadingOverlayProps) {
  return (
    <AnimatePresence initial={false}>
      {loading ? (
        <motion.div
          key={`${loading.title}:${loading.message ?? ""}`}
          className="loading-overlay-layer"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={loading.title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="loading-overlay-backdrop" aria-hidden="true" />
          <motion.div
            className={`loading-overlay-card is-${loading.phase}`}
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            <span className="loading-overlay-mark" aria-hidden="true">
              <span className="loading-overlay-spinner" />
              <span className="loading-overlay-check">
                <span className="loading-overlay-check-stem" />
                <span className="loading-overlay-check-kick" />
              </span>
            </span>
            <div className="loading-overlay-copy">
              <div className="loading-overlay-title">{loading.title}</div>
              {loading.message ? <p>{loading.message}</p> : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
