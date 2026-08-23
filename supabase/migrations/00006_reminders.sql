-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00006: Recordatorios push con hora de inicio
--   * start_time (TIME) en tasks y workouts para saber cuándo empieza
--     una sesión de estudio / examen / entrenamiento.
--   * push_subscriptions: suscripciones Web Push por usuario.
--   * reminder_log: evita enviar el mismo recordatorio dos veces.
-- =============================================================================

-- Hora de inicio (HH:MM) de la tarea / sesión / examen / entrenamiento
alter table public.tasks
  add column if not exists start_time time;

alter table public.workouts
  add column if not exists start_time time;

-- ---------------------------------------------------------------------------
-- Suscripciones de notificaciones push
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_user_endpoint_key unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  using (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Registro de recordatorios enviados (para no repetir)
-- ---------------------------------------------------------------------------
create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('task', 'workout')),
  entity_id text not null,
  remind_at timestamptz not null,
  sent_at timestamptz not null default now()
);

-- Un único recordatorio por (usuario, entidad, momento programado)
create unique index if not exists reminder_log_once_idx
  on public.reminder_log (user_id, entity_type, entity_id, remind_at);

alter table public.reminder_log enable row level security;

create policy "reminder_log_select_own"
  on public.reminder_log for select
  using (auth.uid() = user_id);

create policy "reminder_log_insert_own"
  on public.reminder_log for insert
  with check (auth.uid() = user_id);
