-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00020: quitar Google Classroom y el módulo de Notas
--
-- La app ya no sincroniza con Google Classroom ni tiene un apartado de notas
-- (apuntes y material de estudio). Aquí se retira todo lo que sostenían esas
-- dos funciones en la base de datos, para no dejar columnas ni tablas huérfanas
-- ni políticas RLS sin uso.
--
-- Antes de aplicarla, entiende que BORRA DATOS: las notas guardadas y los
-- tokens de Google. Si solo quieres quitar la interfaz y conservar los datos,
-- no ejecutes esta migración (la app funciona igual sin ella).
--
-- Cómo ejecutarla:
--   • Supabase Dashboard → SQL Editor → pegar y ejecutar, o
--   • `supabase db push` con la CLI local.
-- =============================================================================

-- ── Notas / apuntes ─────────────────────────────────────────────────────────
drop table if exists public.notes;

-- ── Google Classroom ────────────────────────────────────────────────────────
-- Elementos de Classroom ya notificados (los usaba check-classroom).
drop table if exists public.classroom_seen;

-- Tokens OAuth de Google, guardados únicamente para sincronizar Classroom.
drop table if exists public.google_tokens;

-- Vínculo de cada asignatura con su curso de Classroom.
drop index if exists tasks_user_classroom_idx;
alter table public.subjects drop column if exists classroom_course_id;
alter table public.subjects drop column if exists classroom_name;

-- Id del coursework de Classroom en cada tarea.
alter table public.tasks drop column if exists classroom_id;
