-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00015: Gastos planificados / previstos en el presupuesto
-- =============================================================================

-- Tabla de gastos futuros previstos (aún no ejecutados)
create table if not exists public.planned_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  description text,
  date date,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists planned_expenses_user_idx on public.planned_expenses (user_id);

-- Row Level Security
alter table public.planned_expenses enable row level security;

create policy "planned_expenses_all_own" on public.planned_expenses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
