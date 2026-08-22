-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00002: Calificaciones y notas académicas (Grades)
-- =============================================================================

-- Tabla de notas/calificaciones con ponderaciones
create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  title text not null,
  score numeric(5,2) not null,
  max_score numeric(5,2) not null default 10.0,
  weight_percentage numeric(5,2),
  date date default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grades_user_subject_idx on public.grades (user_id, subject_id);
create index if not exists grades_user_task_idx on public.grades (user_id, task_id);

-- Trigger para updated_at
create trigger grades_set_updated_at before update on public.grades for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.grades enable row level security;

create policy "grades_all_own" on public.grades
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
