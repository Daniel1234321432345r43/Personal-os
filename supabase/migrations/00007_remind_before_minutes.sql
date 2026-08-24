-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00007: Minutos de antelación del recordatorio
--   * remind_before_minutes en tasks: cuántos minutos antes de la hora de
--     inicio se envía la notificación push (5, 10 o 15; por defecto 10).
--     Solo tiene efecto cuando la tarea tiene start_time.
-- =============================================================================

alter table public.tasks
  add column if not exists remind_before_minutes integer default 10
  check (remind_before_minutes in (5, 10, 15));
