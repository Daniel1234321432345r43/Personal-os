-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00003: Notas / apuntes del usuario (Notes)
-- =============================================================================

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  content text not null default '',
  file_name text,
  file_type text,
  file_data text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_idx on public.notes (user_id);

-- Trigger para updated_at
create trigger notes_set_updated_at before update on public.notes for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.notes enable row level security;

create policy "notes_all_own" on public.notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());