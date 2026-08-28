-- Plantado de nuevos árboles: los árboles completados se conservan y se puede
-- plantar otro detrás/delante/a los lados.
alter table public.tree_progress
  add column if not exists trees jsonb not null default '[]'::jsonb,
  add column if not exists trees_planted integer not null default 0;

-- Planta un árbol nuevo: registra el árbol actual completado (nivel máximo) en
-- la lista `trees` y reinicia el progreso del árbol activo a 0.
create or replace function public.plant_tree(p_position text)
returns public.tree_progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_tree jsonb;
  v_result public.tree_progress;
begin
  if v_user is null or p_position not in ('back', 'front', 'left', 'right') then
    raise exception 'Usuario o posición inválida';
  end if;

  v_tree := jsonb_build_object(
    'id', gen_random_uuid(),
    'position', p_position,
    'plantedAt', to_char(now(), 'YYYY-MM-DD')
  );

  insert into public.tree_progress (user_id, xp, level, trees, trees_planted)
  values (v_user, 0, 0, jsonb_build_array(v_tree), 1)
  on conflict (user_id) do update
    set trees = case
          when jsonb_array_length(public.tree_progress.trees) >= 12
            then (public.tree_progress.trees - 0) || v_tree  -- descarta el más antiguo
          else public.tree_progress.trees || v_tree
        end,
        trees_planted = public.tree_progress.trees_planted + 1,
        xp = 0,
        level = 0,
        updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;
