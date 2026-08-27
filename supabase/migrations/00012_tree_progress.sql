-- Progreso persistente del árbol y eventos de experiencia.
create table if not exists public.tree_progress (
  user_id uuid primary key references public.users (id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 0 check (level >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.tree_xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  source text not null,
  source_id text not null,
  xp integer not null check (xp > 0),
  created_at timestamptz not null default now(),
  unique (user_id, source, source_id)
);

alter table public.tree_progress enable row level security;
alter table public.tree_xp_events enable row level security;

create policy "tree_progress_all_own" on public.tree_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tree_xp_events_all_own" on public.tree_xp_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.award_tree_xp(
  p_source text,
  p_source_id text,
  p_xp integer
) returns public.tree_progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_inserted boolean;
  v_result public.tree_progress;
begin
  if v_user is null or p_xp <= 0 then
    raise exception 'Usuario o recompensa inválida';
  end if;

  insert into public.tree_xp_events (user_id, source, source_id, xp)
  values (v_user, p_source, p_source_id, p_xp)
  on conflict (user_id, source, source_id) do nothing;
  get diagnostics v_inserted = row_count;

  insert into public.tree_progress (user_id, xp, level)
  values (v_user, case when v_inserted then p_xp else 0 end, 0)
  on conflict (user_id) do update
    set xp = public.tree_progress.xp + case when v_inserted then excluded.xp else 0 end,
        updated_at = now();

  update public.tree_progress
  set level = case
    when xp >= 700 then 3
    when xp >= 300 then 2
    when xp >= 100 then 1
    else 0
  end,
  updated_at = now()
  where user_id = v_user
  returning * into v_result;

  return v_result;
end;
$$;
