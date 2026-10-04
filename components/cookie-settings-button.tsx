"use client";

import type { ReactNode } from "react";
import { CONSENT_SETTINGS_EVENT } from "@/lib/cookie-consent";

/**
 * «Настройки куки» в подвале: заново открывает баннер, чтобы изменить выбор.
 * Отозвать согласие должно быть не сложнее, чем дать его.
 */
export function CookieSettingsButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(CONSENT_SETTINGS_EVENT))}
    >
      {children}
    </button>
  );
}
