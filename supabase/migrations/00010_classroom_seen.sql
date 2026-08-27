-- Rastrea los anuncios/materiales de Google Classroom ya notificados para
-- que la Edge Function check-classroom no repita avisos.
create table if not exists public.classroom_seen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null,        -- 'coursework' | 'announcement'
  external_id text not null, -- id del elemento en Google
  title text,
  created_at timestamptz not null default now(),
  unique (user_id, kind, external_id)
);

alter table public.classroom_seen enable row level security;

create policy "classroom_seen_all_own" on public.classroom_seen
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
