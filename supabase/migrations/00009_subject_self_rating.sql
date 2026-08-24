-- Autoevaluación de asignatura: puntuación del 1 al 10 de cómo se lleva
-- la materia (opcional, por defecto NULL = sin puntuar).
alter table public.subjects
  add column if not exists self_rating smallint check (self_rating >= 1 and self_rating <= 10);
