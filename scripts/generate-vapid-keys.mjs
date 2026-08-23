// Genera un par de claves VAPID para las notificaciones push.
// Uso: npm run vapid:keys
// Luego añade las tres variables a tu .env.local (app) y a los secretos de
// la Edge Function en Supabase.
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\nCopia estas claves a tu .env.local:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:tu@email.com`);
console.log("\nY también a los secretos de la Edge Function (Supabase):\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:tu@email.com`);
console.log("\n");
