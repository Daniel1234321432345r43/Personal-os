-- ===========================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00018: registro de estudio compartido entre dispositivos
--
-- Problema: los minutos estudiados (y por tanto las tarjetas de "hoy" y "esta
-- semana") vivían solo en localStorage, así que lo estudiado en el ordenador
-- no aparecía en el móvil de la misma cuenta.
--
-- Solución: una fila por sesión de estudio, con el id generado por el cliente.
-- Ese id es la clave de la fusión: al sincronizar solo se insertan las sesiones
-- que faltan (`on conflict do nothing`), así que se puede subir el registro
-- entero sin duplicar nada. El registro es de solo-añadir: una sesión nunca se
-- edita, únicamente se insertan nuevas (y se borran todas con "Restablecer
-- todo").
--
-- Cómo ejecutarla:
--   • Supabase Dashboard → SQL Editor → pegar y ejecutar, o
--   • `supabase db push` con la CLI local.
-- ===========================================================================

create table if not exists public.study_sessions (
  -- Id del cliente (uuid o `study-…`): identifica la sesión en todos los
  -- dispositivos y evita duplicados al reconciliar.
  id text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  -- Tarea a la que se dedicó el tiempo (null = estudio sin tarea asignada).
  task_id text,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  -- Día LOCAL del dispositivo (YYYY-MM-DD): es el que agrupa las métricas
  -- ("hoy", "esta semana"), no la fecha UTC del servidor.
  date date not null,
  -- Instante en que se estudió (ISO del dispositivo). Es el cursor de la
  -- sincronización incremental.
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Consultas: sesiones desde una fecha (métricas) y desde un instante (sync).
create index if not exists study_sessions_user_date_idx
  on public.study_sessions (user_id, date);
create index if not exists study_sessions_user_completed_idx
  on public.study_sessions (user_id, completed_at);

-- ---------------------------------------------------------------------------
-- Row Level Security: cada usuario solo ve y escribe sus propias sesiones
-- ---------------------------------------------------------------------------
alter table public.study_sessions enable row level security;

drop policy if exists "study_sessions_all_own" on public.study_sessions;
create policy "study_sessions_all_own" on public.study_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
