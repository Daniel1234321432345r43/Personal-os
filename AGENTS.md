<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Núcleo — Sistema Operativo Personal (Agent Guidelines)

Directrices de desarrollo, arquitectura y convenciones para agentes de IA que trabajan en este repositorio.

---

## 1. Visión general del proyecto

**Núcleo** es una PWA (Progressive Web App) que funciona como un **Sistema Operativo Personal** con un **Secretario IA**. Centraliza la vida académica, deportiva, financiera y hábitos diarios, ofreciendo soporte offline y sincronización en la nube.

### Stack Tecnológico
- **Framework:** Next.js 16 con App Router (React 19, TypeScript 5)
- **Estilos:** Tailwind CSS v4 con `@tailwindcss/postcss` y **shadcn/ui** (estilo `radix-nova`, paleta neutral)
- **Backend & Auth:** Supabase (PostgreSQL, Row Level Security, Auth con Google OAuth 2.0, Edge Functions)
- **IA:** Vercel AI SDK v7 (`ai`, proveedores `@ai-sdk/google`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, y soporte para Omniroute local)
- **Animaciones:** Framer Motion
- **Notificaciones & PWA:** Web Push API con claves VAPID y Service Worker (`public/sw.js`)

---

## 2. Estructura de Directorios

```
personal-os/
├── .agents/               # Habilidades (skills) para agentes de IA
├── public/                # Archivos estáticos (iconos PWA, manifest, sw.js)
├── scripts/               # Scripts de prueba y utilidades (test-*.mjs, generate-vapid-keys.mjs)
├── src/
│   ├── app/
│   │   ├── (app)/         # Rutas de la aplicación protegidas/principales
│   │   │   ├── academic/  # Asignaturas, calificaciones, entregas y exámenes
│   │   │   ├── calendar/  # Calendario mensual y agenda unificada
│   │   │   ├── dashboard/ # Panel principal, secretario IA, KPIs y hábitos del día
│   │   │   ├── finance/   # Ingresos, gastos, movimientos previstos y presupuestos
│   │   │   ├── pomodoro/  # Temporizador pomodoro vinculado a bloques de estudio
│   │   │   ├── settings/  # Configuración, proveedores de IA, objetivos de sueño y push
│   │   │   ├── sport/     # Entrenamientos, hábitos diarios y plan semanal
│   │   │   └── sueno/     # Registro nocturno (selector circular tipo Apple Salud), mapas de calor
│   │   ├── (auth)/        # Pantallas de login/registro
│   │   ├── api/           # Endpoints de API (chat IA, push subscriptions, etc.)
│   │   ├── auth/          # Callbacks OAuth
│   │   ├── globals.css    # Variables CSS y directivas Tailwind v4
│   │   ├── layout.tsx     # Layout raíz con providers
│   │   └── manifest.ts    # Configuración de PWA Manifest
│   ├── components/        # Componentes modulares por dominio y ui/ (shadcn)
│   ├── lib/               # Lógica de negocio, capa de datos, IA, XP y sync
│   └── proxy.ts           # Proxy de sesión Next.js 16 (reemplaza a middleware)
└── supabase/
    ├── config.toml        # Configuración de CLI y programación de cron para Edge Functions
    ├── functions/         # Edge Functions Deno/TypeScript (send-reminders)
    └── migrations/        # Migraciones SQL numeradas (00001_init.sql a 00023_sleep_check.sql)
```

---

## 3. Reglas Críticas para Agentes

### Next.js 16
1. **Asincronía en Parámetros:** `params` y `searchParams` en componentes de página, layouts y Route Handlers son `Promise`. Siempre deben consumirse con `await` (ej. `const { id } = await params;`).
2. **Proxy vs Middleware:** El archivo `src/proxy.ts` gestiona la rotación de cookies de sesión con Supabase. No lo renombre a `middleware.ts`.
3. **Bloque Next.js Agent Rules:** Nunca elimines el bloque `<!-- BEGIN:nextjs-agent-rules --> ... <!-- END:nextjs-agent-rules -->` al editar este archivo.

### Arquitectura Offline-First & Sincronización
1. **Persistencia Local Primero:** La aplicación debe funcionar sin conexión y en modo demo/invitado. Los datos se leen y escriben inicialmente en `localStorage` (`src/lib/data.ts`).
2. **Sincronización con Supabase:** Cuando hay sesión iniciada, los datos se sincronizan con la base de datos remota.
3. **Prevención de Resurrección (Tombstones):** Para borrar datos en local y remoto sin que los registros remotos vuelvan a aparecer tras la sincronización, usa siempre el sistema de *tombstones* en `src/lib/sync-tombstones.ts` (tabla `deleted_records`).
4. **Foreign Keys:** Toda tabla de usuario tiene una clave foránea hacia `public.users(id)` (la cual se enlaza con `auth.users(id)`).

### Diseño y Ergonomía Móvil
1. **Mobile-First:** La app está diseñada para usarse como PWA en smartphones. Respeta los safe areas (`safe-bottom`, `safe-top`), gestos swipe (`src/lib/use-swipe-nav.ts`) y pull-to-refresh (`src/lib/use-pull-refresh.ts`).
2. **Componentes shadcn/ui:** Añade o modifica componentes en `src/components/ui/` respetando los patrones de accesibilidad de Radix UI y `tailwind-merge` (`cn(...)`).
3. **Animaciones:** Usa Framer Motion de forma suave y no intrusiva.

### Edge Functions & Notificaciones Push
1. **WebCrypto en Edge Functions:** `supabase/functions/_shared/web_push.js` implementa el protocolo Web Push usando WebCrypto puro sin dependencias externas de npm.
2. **Cron de Recordatorios:** El cron para `send-reminders` está configurado en `supabase/config.toml` (`schedule = "* * * * *"`). Al desplegar la función, recuerda no eliminar dicha configuración.

---

## 4. Comandos de Desarrollo y Pruebas

```bash
# Desarrollo local (con Turbopack)
npm run dev

# Validación de tipos y compilación de producción
npm run build

# Análisis de código (linter)
npm run lint

# Generar claves VAPID para notificaciones push
npm run vapid:keys

# Ejecución de scripts de prueba de recordatorios y sincronización
node scripts/test-web-push.mjs
node scripts/test-sleep-check.mjs
node scripts/test-workout-check.mjs
node scripts/test-study-alert.mjs
node scripts/test-sync-tombstones.mjs
node scripts/test-exam-done.mjs
```
