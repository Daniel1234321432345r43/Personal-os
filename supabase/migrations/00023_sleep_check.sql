-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00023: pregunta matinal de sueño
--   * reminder_log admite el tipo 'sleep_check': el aviso de lunes a viernes a
--     las 07:15 que pregunta cuánto has dormido. Una fila por usuario y mañana
--     (deja de preguntar en cuanto la noche está registrada o el aviso ya salió).
-- =============================================================================

alter table public.reminder_log drop constraint if exists reminder_log_entity_type_check;
alter table public.reminder_log
  add constraint reminder_log_entity_type_check
  check (entity_type in ('task', 'workout', 'sleep', 'exam_done', 'study_alert', 'workout_check', 'sleep_check'));
