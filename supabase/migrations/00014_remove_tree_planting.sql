-- El bosque vuelve a tener un único árbol activo.
drop function if exists public.plant_tree(text);
alter table public.tree_progress
  drop column if exists trees,
  drop column if exists trees_planted;
