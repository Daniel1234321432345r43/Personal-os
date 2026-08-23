-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00005: Repara perfiles públicos de usuarios existentes
-- =============================================================================
--
-- Las tablas de la aplicación referencian public.users(id), mientras que el
-- login vive en auth.users. El trigger de 00001 solo actúa para usuarios
-- creados después de instalarlo; esta migración cubre los usuarios anteriores.

insert into public.users (id, email, full_name, avatar_url)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name'),
  au.raw_user_meta_data ->> 'avatar_url'
from auth.users as au
on conflict (id) do update set
  email = excluded.email,
  full_name = coalesce(full_name, excluded.full_name),
  avatar_url = coalesce(avatar_url, excluded.avatar_url);
