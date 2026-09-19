"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/lead-attribution";

/**
 * Запоминает источник визита и страницу входа на первом же экране.
 *
 * Раньше это делала только форма заявки, а на страницах проектов формы нет: человек из
 * поиска входил на кейс, и к моменту заявки страница входа была уже неизвестна.
 * Счётчику заявок в админке нужны обе вещи — откуда пришли и на какую страницу.
 */
export function AttributionCapture() {
  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) {
      return;
    }
    captureAttribution();
  }, []);

  return null;
}
