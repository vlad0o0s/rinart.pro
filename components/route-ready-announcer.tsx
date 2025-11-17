"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function RouteReadyAnnouncer() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;
    let pollIntervalId: NodeJS.Timeout | null = null;
    let dispatched = false;

    const dispatchReady = () => {
      if (cancelled || dispatched) {
        return;
      }
      
      dispatched = true;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
      
      window.dispatchEvent(
        new CustomEvent("rinart:route-ready", {
          detail: { pathname },
        }),
      );
      
      // Don't force scroll to top here - let PageTransition handle it only on route changes
    };

    // Maximum wait time - always dispatch after this
    timeoutId = setTimeout(() => {
      dispatchReady();
    }, 2000);

    // Quick check if page is already complete
    // For client-side navigation, readyState is usually "complete" immediately
    // but the new route content may not be ready yet, so we need to check content properly
    if (document.readyState === "complete") {
      // Check if main content exists and is actually rendered
      const checkContentReady = () => {
        const main = document.querySelector("main");
        const hasContent = main && main.children.length > 0;
        
        if (hasContent) {
          // Wait a bit to ensure Next.js has finished rendering the new route
          setTimeout(() => {
            if (!cancelled && !dispatched) {
              dispatchReady();
            }
          }, 200);
          return true;
        }
        return false;
      };
      
      // Check immediately
      if (!checkContentReady()) {
        // Content not ready - will be handled by polling or waitForReady below
      }
    }

    // Poll readyState to track changes
    pollIntervalId = setInterval(() => {
      if (cancelled || dispatched) {
        if (pollIntervalId) {
          clearInterval(pollIntervalId);
          pollIntervalId = null;
        }
        return;
      }
      
      const currentState = document.readyState;
      
      // If state changed to interactive or complete, check if we should dispatch
      if (currentState === "interactive" || currentState === "complete") {
        // Check if main content exists
        const main = document.querySelector("main");
        const hasContent = main && main.children.length > 0;
        
        // If interactive or complete AND has content, we're ready
        if (hasContent || currentState === "complete") {
          dispatchReady();
        }
      }
    }, 50); // Poll every 50ms

    // Wait for DOM and images
    const waitForReady = async () => {
      // Wait for DOM to be ready (interactive or complete)
      if (document.readyState === "loading") {
        await new Promise<void>((resolve) => {
          let resolved = false;
          
          const checkState = () => {
            const state = document.readyState;
            if (state !== "loading") {
              if (!resolved) {
                resolved = true;
                resolve();
                window.removeEventListener("DOMContentLoaded", checkState);
                window.removeEventListener("load", checkState);
              }
            }
          };
          
          window.addEventListener("DOMContentLoaded", checkState, { once: true });
          window.addEventListener("load", checkState, { once: true });
          
          // Fallback timeout - wait longer for Next.js hydration
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve();
              window.removeEventListener("DOMContentLoaded", checkState);
              window.removeEventListener("load", checkState);
            }
          }, 1000);
        });
      }

      if (cancelled) {
        return;
      }

      // Check if main content exists and is rendered
      const root =
        (document.querySelector("main") as HTMLElement | null) ||
        (document.querySelector("[data-first-content]") as HTMLElement | null) ||
        document.body;

      const hasContent = root && root.children.length > 0;

      // Wait for first visible image (with timeout)
      const allImages = Array.from(root?.querySelectorAll("img") || []);
      const candidates = allImages.filter((img) => {
        const rect = img.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0;
      });

      const img = candidates[0] as HTMLImageElement | undefined;
      if (img && !img.complete) {
        if (typeof img.decode === "function") {
          await Promise.race([
            img.decode(),
            new Promise<void>((resolve) => setTimeout(resolve, 500)),
          ]).catch(() => {});
        } else {
          await new Promise<void>((resolve) => setTimeout(resolve, 400));
        }
      }

      // Small delay to ensure Next.js has finished hydration
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      
      // Check readyState one more time
      const finalState = document.readyState;
      
      // Dispatch if we have content OR if state is interactive/complete
      if (hasContent || finalState === "interactive" || finalState === "complete") {
        dispatchReady();
      }
    };

    waitForReady().catch(() => {
      // If anything fails, still dispatch
      dispatchReady();
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (pollIntervalId) clearInterval(pollIntervalId);
    };
  }, [pathname]);

  return null;
}

