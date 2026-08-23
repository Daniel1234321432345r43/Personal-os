"use client";

/**
 * Helpers de cliente para notificaciones push (Web Push API).
 * Registran el service worker de /sw.js y guardan la suscripción en el
 * servidor vía /api/push/* para que la Edge Function de recordatorios
 * pueda notificar aunque la app esté cerrada.
 */

const SW_PATH = "/sw.js";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SW_PATH);
  } catch (err) {
    console.error("[push] no se pudo registrar el service worker:", err);
    return null;
  }
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  const reg = await registerServiceWorker();
  if (!reg) return null;
  try {
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/vapid-public-key");
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return typeof data?.publicKey === "string" ? data.publicKey : null;
  } catch {
    return null;
  }
}

export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) {
    return { ok: false, error: "Tu navegador no soporta notificaciones push." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "Permiso de notificaciones denegado. Actívalo desde el navegador." };
  }

  const publicKey = await getVapidPublicKey();
  if (!publicKey) {
    return {
      ok: false,
      error: "Falta la clave pública VAPID en el servidor (.env). Ejecuta el script de claves VAPID.",
    };
  }

  const reg = await registerServiceWorker();
  if (!reg) {
    return { ok: false, error: "No se pudo registrar el service worker." };
  }

  try {
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return {
        ok: false,
        error: data?.error ?? `Error ${res.status} al guardar la suscripción.`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo suscribir a las notificaciones.",
    };
  }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean; error?: string }> {
  const subscription = await getPushSubscription();
  if (!subscription) return { ok: true };

  try {
    const res = await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.error ?? "No se pudo desuscribir." };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo desuscribir.",
    };
  }
}

/** Convierte una clave VAPID (base64url) al Uint8Array que espera pushManager. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray: Uint8Array<ArrayBuffer> = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
