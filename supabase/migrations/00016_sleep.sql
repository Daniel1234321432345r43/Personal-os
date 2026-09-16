-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00016: Módulo de Sueño (registros, objetivo y recordatorio)
--   * sleep_logs: horas dormidas por noche (una fila por usuario y fecha).
--     `date` es el día en que el usuario se DESPERTÓ (la mañana de esa noche),
--     que es como se registra de forma natural al levantarse.
--   * sleep_settings: objetivo de sueño (horas, hora de acostarse y de
--     despertar) y si quiere el aviso push 15 min antes de acostarse.
--   * reminder_log: admite ya el tipo 'sleep' para no enviar dos veces el aviso
--     de la misma noche.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Registros de sueño
-- ---------------------------------------------------------------------------
create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  -- Hora a la que se acostó y a la que se despertó (opcionales: se puede
  -- registrar solo el total de horas si el usuario no recuerda las horas).
  bedtime time,
  wake_time time,
  hours numeric(4, 2) not null check (hours >= 0 and hours <= 24),
  -- Valoración subjetiva del descanso (1-5), opcional.
  quality integer check (quality between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Una única noche por fecha y usuario: el registro se actualiza, no se duplica.
  constraint sleep_logs_user_date_key unique (user_id, date)
);

create index if not exists sleep_logs_user_date_idx on public.sleep_logs (user_id, date desc);

-- Mantiene updated_at al día (misma función que usan tasks/notes/grades).
drop trigger if exists sleep_logs_set_updated_at on public.sleep_logs;
create trigger sleep_logs_set_updated_at
  before update on public.sleep_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Objetivo de sueño y preferencias
-- ---------------------------------------------------------------------------
create table if not exists public.sleep_settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  target_hours numeric(4, 2) not null default 8 check (target_hours > 0 and target_hours <= 24),
  bedtime time not null default '23:00',
  wake_time time not null default '07:00',
  -- El aviso push 15 min antes de acostarse solo se envía si esto es true.
  reminder_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists sleep_settings_set_updated_at on public.sleep_settings;
create trigger sleep_settings_set_updated_at
  before update on public.sleep_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: cada usuario solo accede a sus propios datos
-- ---------------------------------------------------------------------------
alter table public.sleep_logs enable row level security;
alter table public.sleep_settings enable row level security;

drop policy if exists "sleep_logs_all_own" on public.sleep_logs;
create policy "sleep_logs_all_own" on public.sleep_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "sleep_settings_all_own" on public.sleep_settings;
create policy "sleep_settings_all_own" on public.sleep_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Recordatorios: el cron de send-reminders también avisa de la hora de dormir
-- ---------------------------------------------------------------------------
alter table public.reminder_log drop constraint if exists reminder_log_entity_type_check;
alter table public.reminder_log
  add constraint reminder_log_entity_type_check
  check (entity_type in ('task', 'workout', 'sleep'));
