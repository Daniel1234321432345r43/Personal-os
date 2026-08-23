-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00004: Añade columnas de sesiones multi-día a tasks
-- =============================================================================

alter table public.tasks
  add column if not exists session_index integer,
  add column if not exists total_sessions integer,
  add column if not exists parent_task_id uuid;

-- Índice para agrupar sesiones hermanas
create index if not exists tasks_parent_idx on public.tasks (parent_task_id);