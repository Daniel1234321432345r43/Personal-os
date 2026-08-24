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
  // Pomodoro timer notification — al pulsar, abrir la app en /pomodoro
  if (event.notification.tag === "pomodoro-timer") {
    event.notification.close();
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            return;
          }
        }
        return self.clients.openWindow("/pomodoro");
      }),
    );
    return;
  }

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

// ── Pomodoro: notificación persistente en pantalla de bloqueo ────────────
// El cliente (pomodoro-client.tsx) envía mensajes para crear/actualizar/cerrar
// una notificación que se muestra fija en la pantalla de bloqueo.
self.addEventListener("message", (event) => {
  const { type, body } = event.data || {};
  if (type !== "pomodoro-update") return;

  if (!body) {
    // body vacío → cerrar la notificación
    self.registration
      .getNotifications({ tag: "pomodoro-timer" })
      .then((list) => list.forEach((n) => n.close()));
    return;
  }

  self.registration.showNotification("🍅 Pomodoro", {
    body,
    tag: "pomodoro-timer",
    renotify: true,
    requireInteraction: true,
    icon: "/icon.svg",
    badge: "/icon.svg",
    silent: true,
    data: { url: "/pomodoro" },
  });
});
