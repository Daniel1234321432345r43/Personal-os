-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración inicial del esquema (Supabase / PostgreSQL)
--
-- Cómo ejecutarla:
--   • Supabase Dashboard → SQL Editor → pegar y ejecutar, o
--   • `supabase db push` con la CLI local.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type task_status as enum ('pending', 'in_progress', 'done');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type task_type as enum ('task', 'assignment', 'exam', 'study_session');
create type task_category as enum ('personal', 'academic', 'sport', 'finance');
create type transaction_type as enum ('income', 'expense');
create type habit_frequency as enum ('daily', 'weekly');

-- ---------------------------------------------------------------------------
-- TABLAS
-- ---------------------------------------------------------------------------

-- Perfil público del usuario, enlazado con auth.users de Supabase Auth.
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  timezone text not null default 'Europe/Madrid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Asignaturas / cursos (sincronizables con Google Classroom).
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  classroom_course_id text,
  classroom_name text,
  created_at timestamptz not null default now(),
  unique (user_id, classroom_course_id)
);

-- Tareas, entregas, exámenes y sesiones de estudio.
-- `classroom_id` guarda el ID del coursework en Google Classroom para
-- sincronizar importaciones sin generar duplicados.
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  description text,
  status task_status not null default 'pending',
  priority task_priority not null default 'medium',
  type task_type not null default 'task',
  category task_category not null default 'personal',
  due_date timestamptz,
  estimated_minutes integer,
  subject_id uuid references public.subjects (id) on delete set null,
  classroom_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_due_idx on public.tasks (user_id, due_date);
create index if not exists tasks_user_classroom_idx on public.tasks (user_id, classroom_id);

-- Entrenamientos (registro simplificado por tipo de actividad).
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  activity_type text not null,
  title text,
  date date not null default current_date,
  duration_minutes integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists workouts_user_date_idx on public.workouts (user_id, date);

-- Hábitos (tracker diario).
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  emoji text not null default '✅',
  frequency habit_frequency not null default 'daily',
  created_at timestamptz not null default now()
);

-- Cumplimiento diario de hábitos.
create table if not exists public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  completed_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (habit_id, completed_on)
);

-- Finanzas: ingresos y gastos categorizados.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type transaction_type not null,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  description text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date);

-- Presupuestos mensuales (alimentan el "presupuesto disponible" del Secretario).
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  month date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

-- Tokens OAuth de Google (Classroom). Se almacenan aquí para refrescar el acceso.
create table if not exists public.google_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ---------------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------------

-- Crea el perfil público automáticamente al registrarse un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantiene `updated_at` al día.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger google_tokens_set_updated_at before update on public.google_tokens for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Cada usuario solo puede ver y modificar sus propios datos.
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.subjects enable row level security;
alter table public.tasks enable row level security;
alter table public.workouts enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.google_tokens enable row level security;

create policy "users_select_own" on public.users
  for select using (id = auth.uid());
create policy "users_update_own" on public.users
  for update using (id = auth.uid());

create policy "subjects_all_own" on public.subjects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tasks_all_own" on public.tasks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workouts_all_own" on public.workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "habits_all_own" on public.habits
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "habit_completions_all_own" on public.habit_completions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transactions_all_own" on public.transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "budgets_all_own" on public.budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "google_tokens_all_own" on public.google_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
