# Núcleo — Tu Sistema Operativo Personal

PWA (Progressive Web App) que funciona como un **Sistema Operativo Personal** con un **Secretario IA**. Centraliza la vida académica, deportiva y financiera y genera un contexto real para organizar el día.

## Módulos

| Módulo | Descripción |
| --- | --- |
| **Dashboard / Secretario IA** | Panel central con chat, KPIs, tareas y rutinas del día. |
| **Calendario** | Vista mensual y agenda con tareas, exámenes, entrenamientos e ingresos/gastos. |
| **Estudios** | Asignaturas, tareas, sesiones de estudio y conexión opcional con Google Classroom. |
| **Pomodoro** | Temporizador de la técnica Pomodoro con selector de tarea, notificación persistente en pantalla de bloqueo (tipo Symetry) y aviso sonoro al completar cada sesión (tiempos configurables en Ajustes). |
| **Deporte** | Registro de entrenamientos y seguimiento de hábitos diarios. |
| **Finanzas** | Ingresos, gastos, categorías y presupuesto mensual. |
| **Notas** | Apuntes con contenido de texto y archivos adjuntos opcionales. |

## Stack

- **Next.js 16** con App Router, TypeScript y Turbopack
- **Tailwind CSS v4** y **shadcn/ui v5**
- **Supabase** para PostgreSQL, autenticación y sincronización de datos
- **Vercel AI SDK v7** con proveedores configurables
- **Framer Motion** para animaciones e interacciones
- **Google OAuth 2.0** para login y, opcionalmente, Google Classroom
- PWA instalable mediante Web App Manifest

## Primeros pasos

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

La aplicación funciona también sin Supabase: en ese caso guarda los datos en `localStorage` del navegador. Para que los datos acompañen al usuario entre dispositivos hay que configurar Supabase, activar el login y volver a desplegar después de añadir las variables.

## Configuración de Supabase

### Variables de entorno

Configura estas variables en `.env.local` durante el desarrollo y en Netlify para producción:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

Variables opcionales para funciones del servidor:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` solo debe existir en el entorno del servidor. Nunca la uses en componentes cliente ni la publiques en el repositorio. La clave `anon` es la adecuada para el cliente cuando las políticas RLS están activas.

### Aplicar el esquema

Ejecuta las migraciones desde **Supabase Dashboard → SQL Editor**, en este orden:

1. `supabase/migrations/00001_init.sql`
2. `supabase/migrations/00002_grades.sql`
3. `supabase/migrations/00003_notes.sql`
4. `supabase/migrations/00004_task_sessions.sql`
5. `supabase/migrations/00005_backfill_user_profiles.sql`
6. `supabase/migrations/00006_reminders.sql`
7. `supabase/migrations/00007_remind_before_minutes.sql`
8. `supabase/migrations/00008_reminder_sent.sql`
...
15. `supabase/migrations/00015_planned_expenses.sql`

El esquema incluye:

- Perfil público en `public.users`, enlazado con `auth.users`.
- Tablas de asignaturas, tareas, entrenamientos, hábitos, finanzas, presupuestos, gastos planificados, notas y calificaciones.
- Trigger para crear automáticamente el perfil público al registrarse.
- Políticas RLS para que cada usuario solo acceda a sus propios datos.
- Columnas de sesiones multi-día para tareas.
- Columna `start_time` (hora de inicio) en tareas y entrenamientos.
- Tabla `push_subscriptions` para las suscripciones de notificaciones push.
- Tabla `reminder_log` y columna `reminder_sent` en tareas para no repetir recordatorios.
- Reparación de perfiles de usuarios creados antes de instalar el trigger.

La migración `00005_backfill_user_profiles.sql` es importante si el usuario aparece en **Authentication → Users**, pero no existe en `public.users`. Las tablas de la aplicación tienen una clave extranjera hacia `public.users`.

### Cómo funciona la sincronización

- La aplicación carga primero los datos locales para mantener la interfaz disponible sin conexión.
- Cuando detecta una sesión válida de Supabase, carga los datos remotos del usuario.
- Los datos creados como invitado se intentan migrar al iniciar sesión.
- Cada cuenta tiene su propia clave de `localStorage` en el navegador.
- Las escrituras remotas usan el `user_id` de la sesión actual.
- Si una escritura falla, el error aparece en la consola del navegador con el nombre de la tabla.

## Login con Google

En Supabase ve a **Authentication → Providers → Google** y habilita Google.

En **Authentication → URL Configuration** configura:

- **Site URL**: la URL pública de la aplicación.
- **Redirect URLs**: añade la URL del callback de la aplicación.

Para Netlify:

```text
https://tu-sitio.netlify.app/auth/callback
```

Para desarrollo local:

```text
http://localhost:3000/auth/callback
```

La URL `/auth/callback` de la aplicación intercambia el código OAuth por una sesión de Supabase. La URL de callback de Google Cloud para el login debe ser la URL que muestra Supabase en la configuración del proveedor de Google, normalmente con esta forma:

```text
https://tu-proyecto.supabase.co/auth/v1/callback
```

La URL anterior es diferente del callback de la aplicación `/auth/callback`.

## Despliegue en Netlify

1. Conecta el repositorio de GitHub con Netlify.
2. Configura el comando de build:

```bash
npm run build
```

3. Añade en **Site configuration → Environment variables**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

4. Activa las variables para el contexto de producción.
5. Ejecuta un nuevo deploy después de cambiar cualquier variable `NEXT_PUBLIC_*`.

Estas variables se incorporan al JavaScript durante el build. Guardarlas en Netlify sin volver a desplegar no actualiza la aplicación que ya está publicada.

## Google Classroom opcional

Google Classroom es independiente del login de Google. Para activarlo:

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crea credenciales OAuth 2.0 para una aplicación web.
2. Habilita la **Google Classroom API**.
3. Añade la URI de callback local:

```text
http://localhost:3000/api/classroom/oauth/callback
```

4. En producción añade:

```text
https://tu-sitio.netlify.app/api/classroom/oauth/callback
```

5. Configura las variables:

```env
GOOGLE_CLASSROOM_CLIENT_ID=tu-client-id
GOOGLE_CLASSROOM_CLIENT_SECRET=tu-client-secret
GOOGLE_CLASSROOM_REDIRECT_URI=http://localhost:3000/api/classroom/oauth/callback
```

En Netlify, cambia `GOOGLE_CLASSROOM_REDIRECT_URI` por la URL de producción. Los scopes usados son de solo lectura:

```text
https://www.googleapis.com/auth/classroom.courses.readonly
https://www.googleapis.com/auth/classroom.coursework.me.readonly
```

Los tokens se guardan en `public.google_tokens` asociados al usuario autenticado.

## Configuración de IA

La aplicación puede usar proveedores configurados desde Ajustes o variables del servidor:

```env
AI_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=tu-clave
```

También admite:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=tu-clave

AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=tu-clave

AI_PROVIDER=omniroute
OMNIROUTE_BASE_URL=http://localhost:20128/v1
OMNIROUTE_AUTH_TOKEN=omniroute-local
OMNIROUTE_MODEL=auto
```

## Notificaciones push (recordatorios)

La aplicación puede avisarte **aunque esté cerrada** cuando va a empezar una sesión de estudio o un examen que tenga hora de inicio. En Ajustes puedes añadir hora a cualquier tarea desde su formulario, y luego activar las notificaciones en **Ajustes → Notificaciones**.

El flujo completo es:

1. **Claves VAPID** (una vez):

```bash
npm run vapid:keys
```

Añade las tres variables a `.env.local` (y a Netlify para producción):

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:tu@email.com
```

2. **Migración**: aplica `supabase/migrations/00006_reminders.sql` desde el SQL Editor de Supabase.

3. **Edge Function** (el cron que envía los recordatorios). Necesitas la CLI de Supabase:

```bash
# Secretos de la función (usa las mismas claves VAPID)
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tu@email.com

# Despliegue de la función
supabase functions deploy send-reminders --no-verify-jwt
```

> **El cron se configura en `supabase/config.toml`**, no con un flag del deploy:
>
> ```toml
> [functions.send-reminders]
> verify_jwt = false
> schedule = "* * * * *"   # cada 60 segundos; ajustable (p. ej. "*/5 * * * *")
> ```
>
> La CLI actual ya no acepta `--schedule` en `functions deploy`, y **redesplegar sin la sección `[functions.send-reminders]` en `config.toml` elimina la programación** — el cron deja de ejecutarse. Si cambias el `schedule`, vuelve a desplegar para aplicarlo.

La función consulta las tareas con `start_time` y envía la notificación. En el formulario de tareas puedes elegir que la alarma avise **5, 10 o 15 minutos antes** (por defecto 10). Tras un envío exitoso, la función marca `reminder_sent = true` en la tarea (migración `00008`) para no repetirla en el siguiente tick del cron. La implementación del protocolo Web Push está en `supabase/functions/_shared/web_push.js` usando solo WebCrypto (sin dependencias npm); `scripts/test-web-push.mjs` la verifica contra una implementación independiente (`http_ece`) para garantizar que los navegadores reales puedan descifrar el payload.

**Zona horaria:** la app guarda la hora de inicio como hora local (HH:MM) y `due_date` como instante UTC (`timestamptz`). Al iniciar sesión, la app escribe la zona horaria real del navegador en `public.users`, y la Edge Function la usa para convertir cada tarea a su instante UTC exacto (con horario de verano incluido), comparando siempre en milisegundos UTC sin desfases manuales. Si la zona del perfil no está definida, la función avisa por logs en vez de fallar en silencio.

4. **En la app**: inicia sesión, ve a **Ajustes → Notificaciones** y pulsa **Activar notificaciones**. Usa **Enviar notificación de prueba** para comprobar que todo funciona.

Para probar la implementación de Web Push localmente:

```bash
node scripts/test-web-push.mjs
```

### Requisitos

- Navegador con soporte de Service Worker y Push API (Chrome, Edge, Firefox, Safari 16.4+).
- Sesión iniciada con Supabase (el endpoint guarda la suscripción asociada al usuario).
- Edge Function desplegada para que los recordatorios lleguen con la app cerrada.

## Diagnóstico de sincronización

Si el usuario puede iniciar sesión, pero los datos no aparecen en Supabase:

1. Abre la aplicación publicada.
2. Pulsa `F12` y entra en **Console**.
3. Recarga la página e inicia sesión.
4. Crea una tarea o asignatura.
5. Busca mensajes que comiencen por:

```text
[Supabase diagnóstico]
[Supabase]
```

Mensajes útiles:

```text
[Supabase diagnóstico] cliente
[Supabase diagnóstico] sesión inicial
[Supabase diagnóstico] petición iniciada: guardar tarea
[Supabase diagnóstico] petición correcta: guardar tarea
```

Errores habituales:

- `configured: false`: las variables `NEXT_PUBLIC_SUPABASE_*` no llegaron al build de Netlify.
- `sesión inicial: ninguna`: el navegador no tiene una sesión válida o el callback OAuth está mal configurado.
- `row-level security policy`: las políticas RLS están rechazando la operación.
- `foreign key constraint`: falta el perfil en `public.users` o una entidad relacionada.
- `relation does not exist`: falta aplicar una migración.
- `Invalid API key`: la URL o la clave pública son incorrectas.

Si no aparece ningún mensaje `[Supabase diagnóstico]`, la aplicación publicada probablemente usa un deploy anterior. Comprueba que Netlify haya desplegado el último commit y haz una recarga forzada con `Ctrl + Shift + R`.

## Estructura

```text
src/
  app/
    (auth)/login/            # Login con Google
    (app)/                   # Rutas de la aplicación
      dashboard/ academic/ pomodoro/ sport/ finance/
    api/
      chat/                  # Chat del Secretario IA
      plan/                  # Plan estructurado del día
      classroom/             # OAuth e importación de Classroom
    auth/callback/           # Callback del login de Supabase
  components/
    dashboard/               # Dashboard, chat, plan y tareas
    academic/                # Estudios y Classroom
    forms/                   # Formularios de datos
    layout/                  # Shell de la aplicación
    providers/               # DataProvider y configuración
    ui/                      # Componentes de interfaz
  lib/
    supabase/                # Clientes browser, server y admin
    ai/                      # Proveedores y prompts de IA
    classroom/               # Cliente de Google Classroom
    data.ts                  # Cálculos y datos del dashboard
supabase/migrations/         # Esquema SQL, RLS y reparación de perfiles
supabase/functions/          # Edge Functions (send-reminders + _shared/)
supabase/config.toml         # Configuración de la CLI (schedule del cron)
```

## Scripts

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción y comprobación de tipos
npm run start        # Servir el build de producción
npm run lint         # ESLint
npm run vapid:keys   # Generar claves VAPID para notificaciones push
node scripts/test-web-push.mjs  # Prueba end-to-end del protocolo Web Push
node scripts/test-reminder-time.mjs  # Pruebas de las utilidades de fecha/hora de recordatorios
```

## Animaciones e interacción

Todas las animaciones se apoyan en **Framer Motion** y respetan `prefers-reduced-motion`.

- **Swipe gestual en móvil**: el contenido de la página sigue al dedo 1:1 al deslizar entre secciones (Hoy → Calendario → Estudios → …). Al soltar por debajo del umbral vuelve con un rebote elástico; si supera el umbral (o hay velocidad de lanzamiento), la página sale deslizada y la siguiente entra desde el lado contrario. Los umbrales y la resistencia se ajustan en `src/lib/use-swipe-nav.ts`.
- **Transiciones de página**: cada navegación anima la entrada de la nueva página (fade + subida suave, o deslizamiento direccional si vienes de un swipe).
- **Navegación**: la sidebar de escritorio y la barra inferior móvil tienen una píldora animada (layout animation) que se desliza hasta el elemento activo.
- **Micro-interacciones**: los botones se comprimen al pulsar, las tarjetas del dashboard se elevan al pasar el ratón y los checks de tareas aparecen con un efecto de resorte.
- **Transiciones de tareas**: las listas de tareas entran escalonadas y animan su salida al eliminarse (con reflujo suave del resto).
- **Pomodoro**: anillo de progreso animado, halo que respira mientras corre, pulso al completar cada sesión, cambio animado entre modo trabajo/descanso y contador de pomodoros con rebote.

## PWA

- `src/app/manifest.ts` genera el Web App Manifest.
- `src/app/icon.svg` es el icono de la aplicación.
- `public/sw.js` es el Service Worker que recibe notificaciones push y gestiona la notificación persistente del Pomodoro en pantalla de bloqueo.
- `next/font` proporciona la tipografía Geist.
