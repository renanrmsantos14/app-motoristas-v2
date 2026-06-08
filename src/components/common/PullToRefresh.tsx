import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type PullState = "idle" | "ready" | "refreshing" | "done";

type PullToRefreshProps = {
  children: ReactNode;
  className?: string;
  scrollRef?: React.RefObject<HTMLElement>;
  disabled?: boolean;
  onRefresh: () => void | Promise<void>;
};

const MAX_PULL = 112;
const TRIGGER_PULL = 68;
const TOUCH_SLOP = 8;

function getScrollTop(element: HTMLElement | null) {
  return element ? element.scrollTop : 0;
}

export function PullToRefresh({ children, className = "", scrollRef, disabled = false, onRefresh }: PullToRefreshProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const pullRef = useRef(0);
  const trackingRef = useRef(false);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const visualTimerRef = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [state, setState] = useState<PullState>("idle");

  const reset = useCallback(() => {
    if (visualTimerRef.current) {
      window.clearTimeout(visualTimerRef.current);
      visualTimerRef.current = null;
    }
    setPull(0);
    setState("idle");
    pullingRef.current = false;
    trackingRef.current = false;
    pullRef.current = 0;
  }, []);

  const runRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    pullingRef.current = false;
    setState("refreshing");
    pullRef.current = TRIGGER_PULL;
    setPull(TRIGGER_PULL);
    try {
      await onRefresh();
      setState("done");
      setPull(46);
      window.setTimeout(reset, 620);
    } catch {
      reset();
    } finally {
      refreshingRef.current = false;
    }
  }, [onRefresh, reset]);

  const showVisualRefresh = useCallback((phase: "start" | "done") => {
    if (phase === "start") {
      if (visualTimerRef.current) window.clearTimeout(visualTimerRef.current);
      setState("refreshing");
      pullRef.current = TRIGGER_PULL;
      setPull(TRIGGER_PULL);
      return;
    }

    setState("done");
    setPull(46);
    visualTimerRef.current = window.setTimeout(reset, 620);
  }, [reset]);

  const end = useCallback(() => {
    if (!pullingRef.current) {
      trackingRef.current = false;
      return;
    }
    if (pullRef.current >= TRIGGER_PULL) {
      void runRefresh();
      return;
    }
    reset();
  }, [reset, runRefresh]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onTouchStart = (event: TouchEvent) => {
      if (disabled || refreshingRef.current || event.touches.length !== 1) return;
      const touch = event.touches[0];
      trackingRef.current = getScrollTop(scrollRef?.current ?? null) <= 0;
      pullingRef.current = false;
      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;
      pullRef.current = 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (disabled || refreshingRef.current || !trackingRef.current || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const deltaY = touch.clientY - startYRef.current;
      const deltaX = Math.abs(touch.clientX - startXRef.current);
      if (deltaY <= 0 || deltaX > Math.abs(deltaY)) return;
      if (getScrollTop(scrollRef?.current ?? null) > 0) {
        reset();
        return;
      }
      if (deltaY < TOUCH_SLOP && !pullingRef.current) return;

      event.preventDefault();
      pullingRef.current = true;

      const effectiveDistance = deltaY - TOUCH_SLOP;
      const resisted =
        effectiveDistance <= TRIGGER_PULL
          ? effectiveDistance * 0.9
          : TRIGGER_PULL * 0.9 + (effectiveDistance - TRIGGER_PULL) * 0.32;
      const nextPull = Math.max(0, Math.min(MAX_PULL, resisted));
      pullRef.current = nextPull;
      setPull(nextPull);
      setState(nextPull >= TRIGGER_PULL ? "ready" : "idle");
    };

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", end);
    root.addEventListener("touchcancel", reset);

    return () => {
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", end);
      root.removeEventListener("touchcancel", reset);
    };
  }, [disabled, end, reset, scrollRef]);

  useEffect(() => {
    const onRefreshVisual = (event: Event) => {
      const phase = (event as CustomEvent<{ phase?: "start" | "done" }>).detail?.phase;
      if (phase === "start" || phase === "done") showVisualRefresh(phase);
    };

    window.addEventListener("betinhos:refresh-visual", onRefreshVisual);
    return () => window.removeEventListener("betinhos:refresh-visual", onRefreshVisual);
  }, [showVisualRefresh]);

  useEffect(() => reset, [reset]);

  const beginPointer = (clientX: number, clientY: number) => {
    if (disabled || refreshingRef.current) return;
    trackingRef.current = getScrollTop(scrollRef?.current ?? null) <= 0;
    pullingRef.current = false;
    startYRef.current = clientY;
    startXRef.current = clientX;
    pullRef.current = 0;
  };

  const movePointer = (clientX: number, clientY: number, cancelNativeScroll: () => void) => {
    if (disabled || refreshingRef.current || !trackingRef.current) return;
    const deltaY = clientY - startYRef.current;
    const deltaX = Math.abs(clientX - startXRef.current);
    if (deltaY <= 0 || deltaX > Math.abs(deltaY)) return;
    if (getScrollTop(scrollRef?.current ?? null) > 0) {
      reset();
      return;
    }
    if (deltaY < TOUCH_SLOP && !pullingRef.current) return;
    cancelNativeScroll();
    pullingRef.current = true;
    const effectiveDistance = deltaY - TOUCH_SLOP;
    const resisted =
      effectiveDistance <= TRIGGER_PULL
        ? effectiveDistance * 0.9
        : TRIGGER_PULL * 0.9 + (effectiveDistance - TRIGGER_PULL) * 0.32;
    const nextPull = Math.max(0, Math.min(MAX_PULL, resisted));
    pullRef.current = nextPull;
    setPull(nextPull);
    setState(nextPull >= TRIGGER_PULL ? "ready" : "idle");
  };

  const pullRatio = Math.min(1, pull / TRIGGER_PULL);
  const label = state === "refreshing" ? "Atualizando" : state === "ready" ? "Solte para atualizar" : state === "done" ? "Atualizado" : "Puxe para atualizar";

  return (
    <div
      ref={rootRef}
      className={`pull-refresh ${state !== "idle" || pull > 0 ? "is-pulling" : ""} pull-refresh--${state} ${className}`.trim()}
      style={{
        "--pull-distance": `${pull}px`,
        "--pull-ratio": pullRatio,
        "--pull-arc": `${Math.round(pullRatio * 310)}deg`,
        "--pull-rotation": `${Math.round(pull * 3)}deg`
      } as React.CSSProperties}
      onPointerDown={(event) => {
        if (event.pointerType === "touch") return;
        beginPointer(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        movePointer(event.clientX, event.clientY, () => event.preventDefault());
      }}
      onPointerUp={end}
      onPointerCancel={reset}
    >
      <div className="pull-refresh-indicator" aria-live="polite" role="status">
        <span className="pull-refresh-ring" aria-hidden="true">
          <span className="pull-refresh-ring-track" />
          <span className="pull-refresh-ring-arc" />
          <span className="pull-refresh-check" />
        </span>
        <strong>{label}</strong>
      </div>
      <div className="pull-refresh-content">{children}</div>
    </div>
  );
}
