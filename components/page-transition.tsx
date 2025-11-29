"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./page-transition.module.css";

const SESSION_KEY = "rinart-preload-shown";
const PRE_ANIMATION_DELAY = 0;
const CLOSE_DURATION = 600;
const LINE_DURATION = 500;
const OPEN_DURATION = 1400;
const MAX_WAIT_DURATION = 8000;
const NAVIGATION_DELAY = 650; // Delay before starting navigation to allow close animation
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
  const pendingHashRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

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

  const finishWaiting = useCallback(() => {
    clearWaitTimer();
    pendingPathRef.current = null;
    readyPathRef.current = null;
    setPhase("open");
  }, [clearWaitTimer]);

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
        pendingHashRef.current = null;
        setIsActive(true);
        // Fastest start - immediately cover and line, minimal delay
        setPhase("cover");
        // Transition to line very quickly (10ms instead of animation frame)
        setTimeout(() => setPhase("line"), 10);
      } else {
        // Route change: normal close → line sequence
        readyPathRef.current = null;
        // Keep pendingHashRef for route changes with hash
        setPhase("idle");
        setIsActive(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setPhase("close");
          });
        });
      }
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
      // For initial load, wait longer to ensure page is fully ready before opening
      const delay = shouldAwaitRouteRef.current ? LINE_DURATION : LINE_DURATION + 400;
      const timer = setTimeout(() => setPhase(shouldAwaitRouteRef.current ? "wait" : "open"), delay);
      return () => clearTimeout(timer);
    }

    if (phase === "open") {
      const hasAnchor = pendingHashRef.current && pendingHashRef.current.length > 0;
      
      // If there's an anchor, don't scroll to top - scroll directly to anchor
      if (hasAnchor) {
        const timer = setTimeout(() => {
          setIsActive(false);
          // Scroll to anchor immediately after animation completes
          if (typeof window !== "undefined" && pendingHashRef.current) {
            const hash = pendingHashRef.current;
            pendingHashRef.current = null;
            // Wait for page to render, then scroll immediately to anchor
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                const element = document.querySelector(hash);
                if (element) {
                  // Instant scroll to avoid visible scroll to top
                  element.scrollIntoView({ behavior: "instant", block: "start" });
                }
              });
            });
          }
        }, OPEN_DURATION);
        return () => clearTimeout(timer);
      }
      
      // No anchor: scroll to top on route changes (not on initial load)
      if (
        typeof window !== "undefined" &&
        shouldAwaitRouteRef.current &&
        previousPathRef.current !== null &&
        !isInitialLoadRef.current
      ) {
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
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) {
        return;
      }

      const current = window.location;
      
      // Check if it's a same-page anchor link (same pathname, different or same hash)
      // For same-page anchors, handle smooth scroll manually
      const isSamePage = url.pathname === current.pathname;
      const isSamePageAnchor = isSamePage && url.hash;
      
      // If same page with anchor, prevent default behavior and handle smooth scroll manually
      // onClick handlers (like closeMenu) are attached with React, which uses bubbling phase
      // Our handler uses capture phase (true), so we execute first
      // We need to prevent default, but let React handlers execute via bubbling
      if (isSamePageAnchor) {
        // Prevent default navigation behavior immediately
        event.preventDefault();
        // Don't stop propagation - let React onClick handlers (like closeMenu) execute
        // event.stopPropagation(); // Commented to allow React handlers
        
        // Handle smooth scroll after a microtask to ensure React handlers run
        queueMicrotask(() => {
          // Smooth scroll to anchor
          const targetId = url.hash.substring(1); // Remove #
          const targetElement = document.getElementById(targetId) || document.querySelector(url.hash);
          
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
            // Update URL hash without triggering scroll
            history.pushState(null, "", url.hash);
          }
        });
        
        return;
      }
      
      // If completely same page (pathname, search, hash), allow default behavior
      const isCompletelySamePage = 
        url.pathname === current.pathname &&
        url.search === current.search &&
        url.hash === current.hash;

      if (isCompletelySamePage) {
        return;
      }

      // For cross-page anchor links (different pathname with hash), we need to navigate
      // and then scroll to the anchor after the page loads
      const destination = url.pathname + url.search + url.hash;
      const targetPath = url.pathname;
      const targetHash = url.hash;

      // Set pendingPath BEFORE router.push so route-ready event can match it
      pendingPathRef.current = targetPath;
      // Store hash to scroll to it after navigation completes
      pendingHashRef.current = targetHash || null;

      // Prevent default navigation to handle it ourselves
      event.preventDefault();
      event.stopPropagation();

      // Start transition - this will clear any existing navigation timer
      startTransition({ awaitRoute: true });

      // Wait for closing animation to complete before loading new page
      // This ensures the screen is fully covered before navigation starts
      setTimeout(() => {
        try {
          router.push(destination);
        } catch {
          // Fallback: try window.location as last resort
          window.location.href = destination;
        }
      }, NAVIGATION_DELAY);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router, startTransition]);

  useEffect(() => {
    if (typeof window === "undefined") return;



    const hasShownPreload = sessionStorage.getItem(SESSION_KEY);
    
    if (!hasShownPreload) {
      // Start immediately without delay
      startTransition();
      sessionStorage.setItem(SESSION_KEY, "true");
    }

    return () => {
      if (initialTimerRef.current) {
        clearTimeout(initialTimerRef.current);
        initialTimerRef.current = null;
      }
      // Don't clear navigation timer here - it should complete even if component remounts
      // clearNavigationTimer();
    };
  }, [startTransition, pathname]);

  useEffect(() => {
    // Mark that initial load is complete after first pathname change
    if (isInitialLoadRef.current && previousPathRef.current !== null) {
      isInitialLoadRef.current = false;
    }
    
    // If we're waiting for a route and pathname matches pendingPath, finish waiting
    if (phase === "wait" && pendingPathRef.current && pathname === pendingPathRef.current) {
      queueMicrotask(() => {
        finishWaiting();
      });
    }
    
    previousPathRef.current = pathname;
  }, [pathname, isActive, phase, finishWaiting]);

  useEffect(() => {
    if (phase !== "wait") {
      clearWaitTimer();
      return;
    }

    // Check if paths match (either from readyPath or current pathname)
    if (pendingPathRef.current) {
      const pathsMatch = 
        (readyPathRef.current && readyPathRef.current === pendingPathRef.current) ||
        (pathname && pathname === pendingPathRef.current);
      
      if (pathsMatch) {
        queueMicrotask(() => {
          finishWaiting();
        });
        return;
      }
    }

    waitTimerRef.current = setTimeout(() => {
      finishWaiting();
      waitTimerRef.current = null;
    }, MAX_WAIT_DURATION);

    return () => {
      clearWaitTimer();
    };
  }, [phase, finishWaiting, clearWaitTimer, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleRouteReady = (event: Event) => {
      const customEvent = event as CustomEvent<{ pathname?: string }>;
      const readyPath = customEvent.detail?.pathname;
      const currentPathname = pathname;
      
      readyPathRef.current = readyPath ?? null;

      // If there's an anchor, scroll to it immediately when page is ready
      // This prevents visible scroll to top
      if (pendingHashRef.current && typeof window !== "undefined") {
        const hash = pendingHashRef.current;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const element = document.querySelector(hash);
            if (element) {
              // Scroll immediately to anchor to prevent scroll to top
              element.scrollIntoView({ behavior: "instant", block: "start" });
              // Prevent browser's default scroll to top
              window.scrollTo(window.scrollX, element.getBoundingClientRect().top + window.scrollY);
            }
          });
        });
      }

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

      if (pathsMatch) {
        finishWaiting();
      }
    };

    window.addEventListener("rinart:route-ready", handleRouteReady as EventListener);
    return () => {
      window.removeEventListener("rinart:route-ready", handleRouteReady as EventListener);
    };
  }, [phase, finishWaiting, pathname]);


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
