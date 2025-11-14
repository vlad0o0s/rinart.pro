"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./page-transition.module.css";

const SESSION_KEY = "rinart-preload-shown";
const PRE_ANIMATION_DELAY = 50;
const CLOSE_DURATION = 800;
const LINE_DURATION = 600;
const OPEN_DURATION = 800;
const MAX_WAIT_DURATION = 8000;

type Phase = "idle" | "close" | "line" | "wait" | "open";

type PageTransitionProps = {
  enabled?: boolean;
};

export function PageTransition({ enabled = true }: PageTransitionProps = {}) {
  if (!enabled) {
    return null;
  }
  return <PageTransitionInner />;
}

function PageTransitionInner() {
  const router = useRouter();
  const pathname = usePathname();
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const navigationRef = useRef<NodeJS.Timeout | null>(null);
  const initialTimerRef = useRef<NodeJS.Timeout | null>(null);
  const waitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousPathRef = useRef<string | null>(null);
  const pendingPathRef = useRef<string | null>(null);
  const shouldAwaitRouteRef = useRef(false);

  const clearNavigationTimer = useCallback(() => {
    if (navigationRef.current) {
      clearTimeout(navigationRef.current);
      navigationRef.current = null;
    }
  }, []);

  const clearWaitTimer = useCallback(() => {
    if (waitTimerRef.current) {
      clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
  }, []);

  const startTransition = useCallback(
    (options?: { awaitRoute?: boolean }) => {
      clearNavigationTimer();
      clearWaitTimer();
      shouldAwaitRouteRef.current = Boolean(options?.awaitRoute);
      if (!shouldAwaitRouteRef.current) {
        pendingPathRef.current = null;
      }
      setPhase("idle");
      setIsActive(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase("close"));
      });
    },
    [clearNavigationTimer, clearWaitTimer],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (phase === "close") {
      const timer = setTimeout(() => setPhase("line"), CLOSE_DURATION);
      return () => clearTimeout(timer);
    }

    if (phase === "line") {
      const timer = setTimeout(() => setPhase(shouldAwaitRouteRef.current ? "wait" : "open"), LINE_DURATION);
      return () => clearTimeout(timer);
    }

    if (phase === "open") {
      const timer = setTimeout(() => setIsActive(false), OPEN_DURATION);
      return () => clearTimeout(timer);
    }
  }, [phase, isActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download") || anchor.getAttribute("rel") === "external") return;

      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("#")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const current = window.location;
      if (
        url.pathname === current.pathname &&
        url.search === current.search &&
        url.hash === current.hash
      ) {
        return;
      }

      startTransition({ awaitRoute: true });
      event.preventDefault();

      const destination = url.pathname + url.search + url.hash;
      const targetPath = url.pathname;

      navigationRef.current = setTimeout(() => {
        pendingPathRef.current = targetPath;
        router.push(destination);
        navigationRef.current = null;
      }, CLOSE_DURATION);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router, startTransition]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!sessionStorage.getItem(SESSION_KEY)) {
      initialTimerRef.current = setTimeout(() => {
        startTransition();
        sessionStorage.setItem(SESSION_KEY, "true");
      }, PRE_ANIMATION_DELAY);
    }

    return () => {
      if (initialTimerRef.current) {
        clearTimeout(initialTimerRef.current);
        initialTimerRef.current = null;
      }
      clearNavigationTimer();
    };
  }, [startTransition, clearNavigationTimer]);

  useEffect(() => {
    previousPathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (phase !== "wait") {
      clearWaitTimer();
      return;
    }

    waitTimerRef.current = setTimeout(() => {
      setPhase("open");
      pendingPathRef.current = null;
      waitTimerRef.current = null;
    }, MAX_WAIT_DURATION);

    if (typeof window !== "undefined" && pendingPathRef.current && pathname === pendingPathRef.current) {
      window.dispatchEvent(
        new CustomEvent("rinart:route-ready", {
          detail: { pathname },
        }),
      );
    }

    return () => clearWaitTimer();
  }, [phase, pathname, clearWaitTimer]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleRouteReady = (event: Event) => {
      if (phase !== "wait") {
        return;
      }

      const customEvent = event as CustomEvent<{ pathname?: string }>;
      const readyPath = customEvent.detail?.pathname;
      if (!readyPath || !pendingPathRef.current || readyPath !== pendingPathRef.current) {
        return;
      }

      pendingPathRef.current = null;
      setPhase("open");
    };

    window.addEventListener("rinart:route-ready", handleRouteReady as EventListener);
    return () => window.removeEventListener("rinart:route-ready", handleRouteReady as EventListener);
  }, [phase]);

  const wrapperClassName = [
    styles.wrapper,
    isActive ? styles.wrapperActive : "",
    phase === "close" ? styles.phaseClose : "",
    phase === "line" ? styles.phaseLine : "",
    phase === "open" ? styles.phaseOpen : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClassName} aria-hidden={!isActive}>
      <div className={`${styles.panel} ${styles.panelTop}`}>
        <div className={styles.logoLineWrapper} />
        <div className={styles.line} />
      </div>
      <div className={`${styles.panel} ${styles.panelBottom}`} />
    </div>
  );
}
