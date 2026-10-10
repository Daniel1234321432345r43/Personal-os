-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00022: plan semanal de entrenamientos y nuevos avisos
--
--   * workout_schedule: los días en los que toca entrenar, con su actividad,
--     su hora y su duración. Se configura en Ajustes y lo lee el cron
--     (send-reminders) para preguntar «Hoy deberías haber ido a X, ¿has ido?»
--     cuando el entreno ya ha terminado.
--   * reminder_log admite dos tipos nuevos: 'study_alert' (el aviso diario de
--     estudio de las 15:00) y 'workout_check' (la pregunta por el entreno).
--
-- Cómo ejecutarla:
--   • Supabase Dashboard → SQL Editor → pegar y ejecutar, o
--   • `supabase db push` con la CLI local.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Plan semanal de entrenamientos
-- ---------------------------------------------------------------------------
create table if not exists public.workout_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- 0 = domingo … 6 = sábado (igual que Date.getUTCDay()).
  weekday smallint not null check (weekday between 0 and 6),
  activity_type text not null,
  title text,
  -- Hora de inicio en formato HH:MM.
  time text not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workout_schedule_user_idx
  on public.workout_schedule (user_id, weekday);

create trigger workout_schedule_set_updated_at before update on public.workout_schedule
  for each row execute function public.set_updated_at();

alter table public.workout_schedule enable row level security;

drop policy if exists "workout_schedule_all_own" on public.workout_schedule;
create policy "workout_schedule_all_own" on public.workout_schedule
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Tipos de aviso nuevos en reminder_log
-- ---------------------------------------------------------------------------
alter table public.reminder_log drop constraint if exists reminder_log_entity_type_check;
alter table public.reminder_log
  add constraint reminder_log_entity_type_check
  check (entity_type in ('task', 'workout', 'sleep', 'exam_done', 'study_alert', 'workout_check'));
