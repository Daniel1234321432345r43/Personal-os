# Núcleo — Tu Sistema Operativo Personal

PWA (Progressive Web App) que funciona como un **Sistema Operativo Personal** con un **Secretario IA** (asistente virtual). Centraliza tu vida académica, deportiva y financiera en un solo lugar y responde a partir de tu contexto real.

## Módulos

| Módulo | Descripción |
| --- | --- |
| **Dashboard / Secretario IA** | Panel central con chat conversacional en tiempo real, KPIs globales, tareas y rutinas de hoy. |
| **Calendario** | Vista integral mensual y de agenda con todos tus exámenes, entregas, tareas, ingresos, gastos y entrenamientos centralizados. |
| **Estudios** | Importación automática de asignaturas, entregas y exámenes desde **Google Classroom API**. Recomendaciones de estudio con IA. |
| **Deporte** | Registro simplificado de entrenamientos (tipo de actividad, fecha, duración, notas) y seguimiento de hábitos diarios. |
| **Finanzas** | Registro de ingresos/gastos por categorías y resumen visual del balance mensual frente al presupuesto. |

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Tailwind CSS v4** + **shadcn/ui v5**
- **Supabase** (PostgreSQL + Auth con login de Google)
- **Vercel AI SDK v7** — proveedores configurables: **Google Gemini**, **OpenAI**, **Anthropic Claude**, **Omniroute** o endpoints personalizados compatibles con OpenAI
- **Google Classroom API** (OAuth 2.0)

## Primeros pasos

```bash
npm install
cp .env.example .env.local   # y rellena los valores
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

> **Datos locales:** la app funciona **sin ninguna clave de API**. Tus datos se guardan en el navegador (`localStorage`), así que arranca vacía y todo lo que añadas persiste entre sesiones en ese dispositivo. No hay datos de ejemplo.

## Cómo usar (añadir tus datos)

- **Finanzas** → botón *Nuevo* para añadir un **ingreso** o **gasto** (importe, categoría, fecha, descripción) y *Definir presupuesto* para fijar tu presupuesto mensual.
- **Deporte** → *Nuevo* para registrar un **entrenamiento** (actividad, fecha, duración, notas) y *Añadir* para crear **hábitos** diarios que puedes marcar como hechos.
- **Estudios** → *Nueva asignatura* y *Nueva tarea* para añadir asignaturas, entregas, exámenes y sesiones de estudio, con fecha límite y prioridad.

Todo se refleja al instante en el **Dashboard** (KPIs, rutinas de hoy, próximas entregas) y alimenta el contexto del **Secretario IA**.

## Configuración

> **Opcional.** La app funciona por completo en local sin configurar nada. Estos pasos son solo para activar el login en la nube (Supabase), la sincronización con Google Classroom y el Secretario IA con un modelo real.

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **Project Settings → API** copia `Project URL` y `anon`/`service_role` key a `.env.local`.
3. Ejecuta la migración inicial (`supabase/migrations/00001_init.sql`) desde el **SQL Editor** de Supabase. Crea las tablas, los tipos enum, los triggers (`handle_new_user`, `set_updated_at`) y las políticas RLS.

**Login de Google (Supabase Auth):** en **Authentication → Providers** habilita *Google* y añade las credenciales OAuth de Google Cloud (se reutilizan las mismas que Classroom, ver abajo).

### 2. IA (Vercel AI SDK o Ajustes de la App)

Puedes configurar tu API key y modelo directamente desde la página **Ajustes** en la app (guardado local en el navegador), o mediante variables de entorno en `.env.local`:

```env
AI_PROVIDER=omniroute # openai | google | anthropic | omniroute
OMNIROUTE_BASE_URL=http://localhost:20128/v1
OMNIROUTE_AUTH_TOKEN=omniroute-local
OMNIROUTE_MODEL=auto
```

### 3. Google Classroom (OAuth 2.0)

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crea credenciales **OAuth 2.0 Client** (tipo *Web application*).
2. Habilita la **Google Classroom API**.
3. Añade como *Authorized redirect URI*: `http://localhost:3000/api/classroom/oauth/callback`.
4. Copia `Client ID` y `Client Secret` a `.env.local`.

Los scopes usados son de solo lectura: `classroom.courses.readonly` y `classroom.coursework.me.readonly`.

## Estructura

```
src/
  app/
    (auth)/login/            # Login con Google
    (app)/                   # Rutas protegidas (AppShell con sidebar)
      dashboard/ academic/ sport/ finance/
    api/
      chat/                  # Chat streaming (AI SDK)
      plan/                  # Generación estructurada del Plan del Día
      classroom/             # OAuth + importación de Classroom
    proxy.ts                 # Protección de rutas + refresh de sesión
  components/
    dashboard/               # StatCards, chat, plan, tareas, rutinas
    academic/                # Conexión con Classroom
    layout/app-shell.tsx     # Sidebar + móvil
    ui/                      # Componentes shadcn
  lib/
    supabase/                # Clientes browser / server / admin
    ai/                      # Provider, prompts, tipos del Secretario
    classroom/               # Cliente de la API de Classroom
    data.ts                  # Capa de datos + fallback demo
supabase/migrations/         # Esquema SQL (RLS + triggers)
```

## Scripts

```bash
npm run dev      # Servidor de desarrollo (Turbopack)
npm run build    # Build de producción + typecheck
npm run start    # Servir el build
npm run lint     # ESLint
```

## Notas sobre la PWA

- `src/app/manifest.ts` genera el **web manifest** (instalable, `display: standalone`).
- `src/app/icon.svg` es el icono de la app.
- `next/font` (Geist) para tipografía.
