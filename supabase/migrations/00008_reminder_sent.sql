-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00008: Marca de recordatorio enviado
--   * reminder_sent en tasks: se pone a true tras enviar el push del
--     recordatorio. La Edge Function send-reminders lo usa para no enviar
--     el mismo aviso dos veces (defensa extra junto a reminder_log).
--     Idempotente: si la columna ya existe (añadida a mano), no hace nada.
-- =============================================================================

alter table public.tasks
  add column if not exists reminder_sent boolean not null default false;
