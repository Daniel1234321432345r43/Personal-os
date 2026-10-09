-- Cierre automático de exámenes.
--
-- El cron de send-reminders da por hecho el examen del día a las 17:00 locales
-- y manda su aviso. `reminder_log` ya evita repetir avisos por
-- (usuario, entidad, momento): aquí solo hay que admitir el nuevo tipo
-- 'exam_done' (igual que se hizo en 00016 con 'sleep').
alter table public.reminder_log drop constraint if exists reminder_log_entity_type_check;
alter table public.reminder_log
  add constraint reminder_log_entity_type_check
  check (entity_type in ('task', 'workout', 'sleep', 'exam_done'));
