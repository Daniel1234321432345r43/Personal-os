/* Service Worker de Núcleo — notificaciones push.
 * Registrado desde src/lib/push.ts. Recibe los mensajes push enviados por el
 * servidor (API de la app o Edge Function send-reminders de Supabase). */
"use strict";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Si el payload no es JSON, usamos el texto plano.
    data = event.data ? { body: event.data.text() } : {};
  }

  const title = data.title || "Núcleo";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon.svg",
    badge: data.badge,
    tag: data.tag || "nucleo-reminder",
    data: { url: data.url || "/" },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
