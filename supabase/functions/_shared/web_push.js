// =============================================================================
// Web Push (RFC 8030, RFC 8188, RFC 8291, RFC 8292) implementado SOLO con
// WebCrypto (crypto.subtle). Compatible con Node 18+ y Deno, incluidos los
// Edge Functions de Supabase. No requiere dependencias npm.
//
// Uso:
//   import { sendWebPush } from "../_shared/web_push.js";
//   await sendWebPush(subscription, payloadJSON, {
//     subject: "mailto:tu@email.com",
//     publicKey: "...",   // base64url de la clave pública VAPID (65 bytes)
//     privateKey: "...",  // base64url de la clave privada VAPID (32 bytes)
//   });
// =============================================================================

const enc = new TextEncoder();

function toBase64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

/** HKDF-Extract: PRK = HMAC(salt, IKM). */
async function hkdfExtract(salt, ikm) {
  const key = await crypto.subtle.importKey(
    "raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
}

/** HKDF-Expand: OKM = HMAC(PRK, T(i-1) || info || i)... */
async function hkdfExpand(prk, info, length) {
  const key = await crypto.subtle.importKey(
    "raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const blocks = Math.ceil(length / 32);
  const out = new Uint8Array(length);
  let t = new Uint8Array(0);
  let offset = 0;
  for (let i = 1; i <= blocks; i++) {
    const input = new Uint8Array(t.length + info.length + 1);
    input.set(t, 0);
    input.set(info, t.length);
    input[t.length + info.length] = i;
    t = new Uint8Array(await crypto.subtle.sign("HMAC", key, input));
    const remaining = length - offset;
    out.set(t.subarray(0, Math.min(t.length, remaining)), offset);
    offset += t.length;
  }
  return out.slice(0, length);
}

/** Secreto compartido ECDH con la clave pública p256dh de la suscripción. */
async function ecdhSecret(privateKey, uaPublicBytes) {
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: toBase64Url(uaPublicBytes.slice(1, 33)),
    y: toBase64Url(uaPublicBytes.slice(33, 65)),
    ext: true,
  };
  const uaKey = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const raw = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaKey }, privateKey, 256,
  );
  return new Uint8Array(raw);
}

// Prefixo/sufijo DER para convertir una clave privada EC de 32 bytes (scalar)
// al formato PKCS#8 que exige crypto.subtle.importKey.
const PKCS8_PREFIX = new Uint8Array([
  0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
  0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01,
  0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
]);
const PKCS8_SUFFIX = new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00]);

function rawEcToPkcs8(rawPrivateKey, publicKey) {
  const out = new Uint8Array(
    PKCS8_PREFIX.length + rawPrivateKey.length + PKCS8_SUFFIX.length + publicKey.length,
  );
  out.set(PKCS8_PREFIX, 0);
  out.set(rawPrivateKey, PKCS8_PREFIX.length);
  out.set(PKCS8_SUFFIX, PKCS8_PREFIX.length + rawPrivateKey.length);
  out.set(publicKey, PKCS8_PREFIX.length + rawPrivateKey.length + PKCS8_SUFFIX.length);
  return out;
}

/** Firma ES256 (JWS) con la clave privada VAPID. */
async function signEs256(privateKeyB64url, publicKeyB64url, data) {
  const raw = fromBase64Url(privateKeyB64url);
  const pub = fromBase64Url(publicKeyB64url);
  const pkcs8 = rawEcToPkcs8(raw, pub);
  const key = await crypto.subtle.importKey(
    "pkcs8", pkcs8, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, data,
  );
  return new Uint8Array(signature); // r || s (64 bytes), formato JWS
}

/** Crea el JWT VAPID (RFC 8292) firmado con ES256. */
async function createVapidJwt(privateKeyB64url, publicKeyB64url, audience, subject) {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  };
  const signingInput =
    toBase64Url(enc.encode(JSON.stringify(header))) +
    "." +
    toBase64Url(enc.encode(JSON.stringify(payload)));
  const signature = await signEs256(
    privateKeyB64url, publicKeyB64url, enc.encode(signingInput),
  );
  return `${signingInput}.${toBase64Url(signature)}`;
}

/**
 * Cifra el payload según RFC 8188 (aes128gcm) y RFC 8291:
 * devuelve el cuerpo listo para enviar (salt || rs || as_public || ciphertext).
 */
async function encryptPayload(payloadBytes, p256dhB64url, authB64url) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const uaPublic = fromBase64Url(p256dhB64url);
  const authSecret = fromBase64Url(authB64url);

  // Clave efímera del servidor (as)
  const eph = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
  );
  const ephJwk = await crypto.subtle.exportKey("jwk", eph.publicKey);
  const asPublic = new Uint8Array(65);
  asPublic[0] = 0x04;
  asPublic.set(fromBase64Url(ephJwk.x), 1);
  asPublic.set(fromBase64Url(ephJwk.y), 33);

  const shared = await ecdhSecret(eph.privateKey, uaPublic);

  // RFC 8291: IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || ua || as)
  const info = concat(enc.encode("WebPush: info"), new Uint8Array([0]), uaPublic, asPublic);
  const prk = await hkdfExtract(authSecret, shared);
  const ikm = await hkdfExpand(prk, info, 32);

  // RFC 8188 §3.3: CEK y NONCE = HKDF-Expand(HKDF-Extract(salt, ikm),
  // "Content-Encoding: aes128gcm\0" / "Content-Encoding: nonce\0", ...).
  // (Sin la clave pública en el info; es un error del draft aesgcm antiguo.)
  const prk2 = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk2, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk2, enc.encode("Content-Encoding: nonce\0"), 12);

  // RFC 8188 §2.2: el último registro del cifrado termina con un byte
  // delimitador (0x02) seguido de relleno 0x00. Sin él, el navegador considera
  // el padding malformado y descarta el mensaje en silencio.
  const paddedPayload = concat(payloadBytes, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey(
    "raw", cek, { name: "AES-GCM" }, false, ["encrypt"],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPayload),
  );

  // Cuerpo: salt(16) || rs(4, big-endian = 4096) || idlen(1) || as_public(65) || ciphertext+tag
  // RFC 8188: la clave pública efímera del servidor viaja en el campo keyid,
  // precedida por un byte de longitud (65 = 0x41). Sin ese byte los navegadores
  // reales parsean el header mal y descartan el mensaje en silencio.
  const body = new Uint8Array(16 + 4 + 1 + 65 + ciphertext.length);
  body.set(salt, 0);
  body[16] = 0x00;
  body[17] = 0x00;
  body[18] = 0x10; // 4096 = 0x00001000
  body[19] = 0x00;
  body[20] = 65; // idlen: longitud del keyid (clave pública efímera)
  body.set(asPublic, 21);
  body.set(ciphertext, 86);
  return body;
}

/**
 * Envía una notificación push (RFC 8030).
 * @param {object} subscription { endpoint, keys: { p256dh, auth } }
 * @param {string} payload      JSON con { title, body, url, tag }
 * @param {object} vapid        { subject, publicKey, privateKey }
 */
export async function sendWebPush(subscription, payload, vapid) {
  const { endpoint, keys } = subscription || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error("Suscripción incompleta (endpoint, p256dh, auth)");
  }

  const body = await encryptPayload(enc.encode(payload), keys.p256dh, keys.auth);
  const audience = new URL(endpoint).origin;
  const jwt = await createVapidJwt(
    vapid.privateKey, vapid.publicKey, audience, vapid.subject,
  );

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
      Authorization: `vapid t=${jwt},k=${vapid.publicKey}`,
      "Content-Length": String(body.length),
    },
    body,
  });

  if (res.status !== 201 && res.status !== 202 && !res.ok) {
    const err = new Error(`Web Push falló: ${res.status} ${res.statusText}`);
    err.statusCode = res.status;
    throw err;
  }
  return res;
}
