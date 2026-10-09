"use client";

/**
 * Notificaciones del navegador compartidas por la app.
 *
 * La notificación es persistente (no desaparece sola) y usa el service worker
 * cuando está disponible, que es lo que funciona en móvil y en la PWA. Si el
 * usuario no ha dado permiso, no se hace nada: el aviso dentro de la app (el
 * toast) sigue apareciendo igual.
 *
 * Vive aquí, y no dentro del Pomodoro, porque el mismo aviso lo necesitan los
 * exámenes que se completan solos al pasar su día.
 */

import { registerServiceWorker } from "@/lib/push";

export interface BrowserNotificationOptions {
  /** Dónde llevar al usuario si pulsa la notificación (por defecto, la raíz). */
  url?: string;
  /** Etiqueta única. Por defecto, una distinta por notificación (no se agrupan). */
  tag?: string;
  /** true (por defecto) para que no desaparezca sola: hay que cerrarla. */
  requireInteraction?: boolean;
}

export async function showBrowserNotification(
  title: string,
  body: string,
  options: BrowserNotificationOptions = {},
): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const notificationOptions: NotificationOptions = {
    body,
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: options.tag ?? `nucleo-${Date.now()}`,
    requireInteraction: options.requireInteraction ?? true,
    data: { url: options.url ?? "/" },
  };

  try {
    const reg = await registerServiceWorker();
    if (reg) {
      await reg.showNotification(title, notificationOptions);
    } else {
      new Notification(title, notificationOptions);
    }
  } catch (err) {
    console.error("[notify] no se pudo mostrar la notificación:", err);
  }
}
