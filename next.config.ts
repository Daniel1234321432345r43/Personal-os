import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // En desarrollo, Next.js bloquea por defecto las peticiones a recursos
  // (_next/static, HMR) cuando el Host/Origin no coincide exactamente con el
  // del servidor. Permitir localhost y 127.0.0.1 evita 403 al abrir la app
  // desde la vista previa o con otro host local.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
