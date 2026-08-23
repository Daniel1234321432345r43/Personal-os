/**
 * Expone la clave pública VAPID para que el navegador pueda suscribirse.
 * La privada nunca sale del servidor.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";

  if (!publicKey) {
    return Response.json(
      { error: "VAPID_PUBLIC_KEY no configurada en el servidor." },
      { status: 501 },
    );
  }

  return Response.json({ publicKey });
}
