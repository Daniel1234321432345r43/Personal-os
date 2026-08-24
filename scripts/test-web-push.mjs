// Prueba end-to-end del módulo supabase/functions/_shared/web_push.js:
// 1. Simula un navegador (clave ECDH + auth secret) suscrito a un endpoint local.
// 2. Envía una notificación con sendWebPush().
// 3. Descifra el payload como haría el navegador y verifica el JWT VAPID.
// Ejecutar: node scripts/test-web-push.mjs
import http from "node:http";
import { sendWebPush } from "../supabase/functions/_shared/web_push.js";

const enc = new TextEncoder();

function b64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (str.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hkdfExtract(salt, ikm) {
  const key = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
}
async function hkdfExpand(prk, info, length) {
  const key = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const out = new Uint8Array(length);
  let t = new Uint8Array(0);
  let off = 0;
  for (let i = 1; off < length; i++) {
    const input = new Uint8Array(t.length + info.length + 1);
    input.set(t, 0);
    input.set(info, t.length);
    input[t.length + info.length] = i;
    t = new Uint8Array(await crypto.subtle.sign("HMAC", key, input));
    const remaining = length - off;
    out.set(t.subarray(0, Math.min(t.length, remaining)), off);
    off += t.length;
  }
  return out.slice(0, length);
}
function concat(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

// --- Navegador: clave ECDH "de usuario" -------------------------------------
const uaKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const uaJwk = await crypto.subtle.exportKey("jwk", uaKeys.publicKey);
const uaPublic = new Uint8Array(65);
uaPublic[0] = 4;
uaPublic.set(unb64url(uaJwk.x), 1);
uaPublic.set(unb64url(uaJwk.y), 33);
const authSecret = crypto.getRandomValues(new Uint8Array(16));
const subscription = {
  endpoint: "http://127.0.0.1:18765/push",
  keys: { p256dh: b64url(uaPublic), auth: b64url(authSecret) },
};

// --- Servidor: claves VAPID (mismo formato que genera `web-push`) -----------
const vapidKeys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const vapidJwk = await crypto.subtle.exportKey("jwk", vapidKeys.privateKey);
const vapidPublic = new Uint8Array(65);
vapidPublic[0] = 4;
vapidPublic.set(unb64url(vapidJwk.x), 1);
vapidPublic.set(unb64url(vapidJwk.y), 33);
const vapid = {
  subject: "mailto:test@example.com",
  publicKey: b64url(vapidPublic),
  privateKey: b64url(unb64url(vapidJwk.d)),
};

// --- Endpoint local que captura la petición ---------------------------------
let captured = null;
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    captured = { headers: req.headers, body: Buffer.concat(chunks) };
    res.writeHead(201);
    res.end();
  });
});
await new Promise((r) => server.listen(18765, r));

const payload = JSON.stringify({ title: "Núcleo", body: "En 5 min empieza tu sesión de estudio: Mates", url: "/calendar" });
await sendWebPush(subscription, payload, vapid);
await new Promise((r) => setTimeout(r, 100));
server.close();

if (!captured) throw new Error("No se capturó ninguna petición");

// --- 1) Verificar cabeceras --------------------------------------------------
if (captured.headers["content-encoding"] !== "aes128gcm") throw new Error("Content-Encoding incorrecto");
if (!captured.headers.authorization?.startsWith("vapid t=")) throw new Error("Falta Authorization VAPID");
console.log("✓ Cabeceras correctas (aes128gcm + Authorization vapid)");

// --- 2) Verificar el JWT VAPID ----------------------------------------------
const authMatch = captured.headers.authorization.match(/vapid t=([^,]+),k=(.+)/);
const [h, p, s] = authMatch[1].split(".");
const sig = unb64url(s);
const okJwt = await crypto.subtle.verify(
  { name: "ECDSA", hash: "SHA-256" },
  vapidKeys.publicKey,
  sig,
  enc.encode(`${h}.${p}`),
);
if (!okJwt) throw new Error("Firma VAPID inválida");
const jwtPayload = JSON.parse(new TextDecoder().decode(unb64url(p)));
if (jwtPayload.aud !== "http://127.0.0.1:18765") throw new Error("aud incorrecto");
if (jwtPayload.sub !== "mailto:test@example.com") throw new Error("sub incorrecto");
if (jwtPayload.exp < Date.now() / 1000) throw new Error("exp pasado");
console.log("✓ JWT VAPID verificado (ES256, aud/sub/exp correctos)");

// --- 3) Descifrar el payload como haría el navegador ------------------------
const body = new Uint8Array(captured.body);
const salt = body.slice(0, 16);
const asPublic = body.slice(21, 86);
const ciphertext = body.slice(86);

const uaPrivJwk = await crypto.subtle.exportKey("jwk", uaKeys.privateKey);
const uaPriv = await crypto.subtle.importKey(
  "jwk",
  { kty: "EC", crv: "P-256", x: uaJwk.x, y: uaJwk.y, d: uaPrivJwk.d },
  { name: "ECDH", namedCurve: "P-256" },
  false,
  ["deriveBits"],
);
const asJwk = {
  kty: "EC", crv: "P-256",
  x: b64url(asPublic.slice(1, 33)),
  y: b64url(asPublic.slice(33, 65)),
  ext: true,
};
const asKey = await crypto.subtle.importKey("jwk", asJwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, uaPriv, 256));

const info = concat(enc.encode("WebPush: info"), new Uint8Array([0]), uaPublic, asPublic);
const ikm = await hkdfExpand(await hkdfExtract(authSecret, shared), info, 32);
const prk2 = await hkdfExtract(salt, ikm);
const cek = await hkdfExpand(prk2, enc.encode("Content-Encoding: aes128gcm\0"), 16);
const nonce = await hkdfExpand(prk2, enc.encode("Content-Encoding: nonce\0"), 12);
const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["decrypt"]);
const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aesKey, ciphertext));
// RFC 8188 §2.2: quitar relleno (0x00 finales) y el delimitador 0x02 del último registro.
let dataEnd = plaintext.length;
while (dataEnd > 0 && plaintext[dataEnd - 1] === 0x00) dataEnd--;
if (dataEnd > 0 && plaintext[dataEnd - 1] === 0x02) dataEnd--;
const decrypted = new TextDecoder().decode(plaintext.slice(0, dataEnd));

if (decrypted !== payload) {
  throw new Error(`El payload descifrado no coincide:\n  esperado: ${payload}\n  obtenido: ${decrypted}`);
}
console.log("✓ Payload cifrado/descifrado correctamente (aes128gcm, RFC 8291)");
console.log(`✓ Mensaje: ${JSON.parse(decrypted).body}`);
console.log("\nTodos los tests pasaron ✅");
