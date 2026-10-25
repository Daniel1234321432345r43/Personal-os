import crypto from "crypto";

function getSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VAPID_PRIVATE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "nucleo-finance-webhook-secret-key"
  );
}

/**
 * Genera un token firmado seguro para el usuario que codifica su ID.
 * Permite validar peticiones al webhook incluso sin dependencias de base de datos.
 */
export function createSignedWebhookToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ u: userId, c: Date.now() }),
  ).toString("base64url");
  const hmac = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  return `wh_${payload}.${hmac}`;
}

/**
 * Verifica un token firmado y extrae el userId si la firma es válida.
 */
export function verifySignedWebhookToken(token: string): string | null {
  try {
    if (!token.startsWith("wh_")) return null;
    const raw = token.slice(3);
    const [payload, hmac] = raw.split(".");
    if (!payload || !hmac) return null;
    const expected = crypto
      .createHmac("sha256", getSecret())
      .update(payload)
      .digest("base64url");
    if (hmac !== expected) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    return typeof parsed.u === "string" ? parsed.u : null;
  } catch {
    return null;
  }
}
