"use client";

import { useCallback, useEffect, useMemo, useRef, useState, startTransition as reactStartTransition } from "react";
import type { CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./page-transition.module.css";

const SESSION_KEY = "rinart-preload-shown";
const PRE_ANIMATION_DELAY = 50;
const CLOSE_DURATION = 800;
const LINE_DURATION = 600;
const OPEN_DURATION = 800;
const MAX_WAIT_DURATION = 8000;
type Phase = "idle" | "cover" | "close" | "line" | "wait" | "open";

type PageTransitionProps = {
  enabled?: boolean;
  logoUrl?: string;
};

export function PageTransition({ enabled = true, logoUrl }: PageTransitionProps = {}) {
  if (!enabled) {
    return null;
  }
  return <PageTransitionInner logoUrl={logoUrl} />;
}

function PageTransitionInner({ logoUrl }: { logoUrl?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [mode, setMode] = useState<"initial" | "route">("initial");
  const navigationRef = useRef<NodeJS.Timeout | null>(null);
  const initialTimerRef = useRef<NodeJS.Timeout | null>(null);
  const waitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousPathRef = useRef<string | null>(null);
  const pendingPathRef = useRef<string | null>(null);
  const shouldAwaitRouteRef = useRef(false);
  const readyPathRef = useRef<string | null>(null);

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
      setMode(shouldAwaitRouteRef.current ? "route" : "initial");
      
      if (!shouldAwaitRouteRef.current) {
        // Initial load: instantly cover, then proceed to line without "closing" animation
        pendingPathRef.current = null;
        readyPathRef.current = null;
        setPhase("idle");
        setIsActive(true);
        requestAnimationFrame(() => {
          setPhase("cover");
          requestAnimationFrame(() => {
            setPhase("line");
          });
        });
      } else {
        // Route change: normal close → line sequence
        readyPathRef.current = null;
        setPhase("idle");
        setIsActive(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setPhase("close");
          });
        });
      }
    },
    [clearNavigationTimer, clearWaitTimer, phase, isActive],
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
      // Ensure scroll is at top when animation completes
      if (typeof window !== "undefined") {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
      const timer = setTimeout(() => {
        setIsActive(false);
      }, OPEN_DURATION);
      return () => clearTimeout(timer);
    }
  }, [phase, isActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;

      if (!anchor) {
        return;
      }
      
      if (anchor.target && anchor.target !== "_self") {
        return;
      }
      if (anchor.hasAttribute("download") || anchor.getAttribute("rel") === "external") {
        return;
      }

      const hrefAttr = anchor.getAttribute("href");
      
      if (!hrefAttr || hrefAttr.startsWith("#")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch (error) {
        return;
      }

      if (url.origin !== window.location.origin) {
        return;
      }

      const current = window.location;
      const isSamePage = 
        url.pathname === current.pathname &&
        url.search === current.search &&
        url.hash === current.hash;

      if (isSamePage) {
        return;
      }

      const destination = url.pathname + url.search + url.hash;
      const targetPath = url.pathname;

      // Set pendingPath BEFORE router.push so route-ready event can match it
      pendingPathRef.current = targetPath;

      // Dispatch event to unlock scroll before transition
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("rinart:route-change"));
      }

      // Start transition - this will clear any existing navigation timer
      startTransition({ awaitRoute: true });

      // Prevent default navigation to handle it ourselves
      event.preventDefault();
      event.stopPropagation();

      try {
        // Call router.push directly - no setTimeout, no queueMicrotask
        // This should work if router is correctly initialized
        router.push(destination);
      } catch (error) {
        // Fallback: try window.location as last resort
        window.location.href = destination;
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router, startTransition]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Always prevent unwanted scroll on page load/refresh
    const preventScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    // Set scroll to top immediately
    preventScroll();
    
    // Also set on next frame to ensure it sticks
    requestAnimationFrame(() => {
      preventScroll();
      requestAnimationFrame(() => {
        preventScroll();
      });
    });

    // Monitor scroll for a short time after mount
    const scrollMonitor = setInterval(() => {
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
      
      if (currentScroll > 0) {
        // Try to fix it
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    }, 100);

    // Clear monitor on cleanup
    setTimeout(() => clearInterval(scrollMonitor), 5000);

    const hasShownPreload = sessionStorage.getItem(SESSION_KEY);
    
    if (!hasShownPreload) {
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
      clearInterval(scrollMonitor);
      // Don't clear navigation timer here - it should complete even if component remounts
      // clearNavigationTimer();
    };
  }, [startTransition, pathname]);

  useEffect(() => {
    previousPathRef.current = pathname;
  }, [pathname, isActive, phase]);

  const finishWaiting = useCallback(() => {
    clearWaitTimer();
    pendingPathRef.current = null;
    readyPathRef.current = null;
    setPhase("open");
  }, [clearWaitTimer, phase]);

  useEffect(() => {
    if (phase !== "wait") {
      clearWaitTimer();
      return;
    }

    if (
      pendingPathRef.current &&
      readyPathRef.current &&
      readyPathRef.current === pendingPathRef.current
    ) {
      queueMicrotask(() => {
        finishWaiting();
      });
      return;
    }

    waitTimerRef.current = setTimeout(() => {
      finishWaiting();
      waitTimerRef.current = null;
    }, MAX_WAIT_DURATION);

    return () => {
      clearWaitTimer();
    };
  }, [phase, finishWaiting, clearWaitTimer]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleRouteReady = (event: Event) => {
      const customEvent = event as CustomEvent<{ pathname?: string }>;
      const readyPath = customEvent.detail?.pathname;
      const currentPathname = pathname;
      
      readyPathRef.current = readyPath ?? null;

      // Check if we're waiting and paths match
      if (phase !== "wait") {
        return;
      }

      if (!pendingPathRef.current) {
        return;
      }

      // Check if readyPath matches pendingPath OR if current pathname matches pendingPath
      const pathsMatch = 
        (readyPathRef.current && readyPathRef.current === pendingPathRef.current) ||
        (currentPathname && currentPathname === pendingPathRef.current);

      if (!pathsMatch) {
        return;
      }

      finishWaiting();
    };

    window.addEventListener("rinart:route-ready", handleRouteReady as EventListener);
    return () => {
      window.removeEventListener("rinart:route-ready", handleRouteReady as EventListener);
    };
  }, [phase, finishWaiting, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isActive) {
      const originalOverflow = document.body.style.overflow;
      const originalHeight = document.body.style.height;
      const originalScrollBehavior = document.documentElement.style.scrollBehavior;
      
      document.body.style.overflow = "hidden";
      document.body.style.height = "100vh";
      document.documentElement.style.scrollBehavior = "auto";
      
      // Force scroll to top when animation starts
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.height = originalHeight;
        document.documentElement.style.scrollBehavior = originalScrollBehavior || "";
        
        // Ensure we're at top after animation completes
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      };
    }
  }, [isActive, phase]);

  const wrapperClassName = [
    styles.wrapper,
    isActive ? styles.wrapperActive : "",
    phase === "cover" ? styles.phaseCover : "",
    phase === "close" ? styles.phaseClose : "",
    phase === "line" ? styles.phaseLine : "",
    phase === "wait" ? styles.phaseWait : "",
    phase === "open" ? styles.phaseOpen : "",
  ]
    .filter(Boolean)
    .join(" ");

  const logoStyle = useMemo(() => {
    const url = logoUrl?.trim();
    if (!url) {
      return undefined;
    }
    return { "--transition-logo-image": `url("${url}")` } as CSSProperties & {
      "--transition-logo-image"?: string;
    };
  }, [logoUrl]);

  return (
    <div className={wrapperClassName} aria-hidden={!isActive} data-mode={mode}>
      <div className={`${styles.panel} ${styles.panelTop}`}>
        <div className={styles.logoLineWrapper} style={logoStyle} />
        <div className={styles.line} />
      </div>
      <div className={`${styles.panel} ${styles.panelBottom}`} />
    </div>
  );
}
