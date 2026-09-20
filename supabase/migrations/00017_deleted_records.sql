-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00017: borrados compartidos entre dispositivos (lápidas)
--
-- Problema: la app fusiona "estado local ∪ nube" por id y sube su estado
-- completo. Un dispositivo con copias antiguas volvía a subir las filas que se
-- habían borrado en otro dispositivo, así que el borrado "resucitaba" al
-- recargar en cualquiera de ellos (borras 3 tareas en el móvil y vuelven al
-- abrir el ordenador, que a su vez las vuelve a guardar en la nube).
--
-- Solución: cada borrado deja una fila aquí. Todos los dispositivos leen estas
-- lápidas antes de fusionar y antes de subir, de modo que una fila borrada no
-- vuelve nunca. Además se suscriben a los INSERT de esta tabla (Realtime), así
-- que el borrado desaparece al instante en el otro dispositivo abierto.
--
-- Cómo ejecutarla:
--   • Supabase Dashboard → SQL Editor → pegar y ejecutar, o
--   • `supabase db push` con la CLI local.
-- =============================================================================

create table if not exists public.deleted_records (
  user_id uuid not null references public.users (id) on delete cascade,
  -- Nombre de la tabla afectada ('tasks', 'notes', 'workouts'…).
  table_name text not null,
  -- Clave de la fila borrada: su `id` (o la fecha, en sleep_logs).
  record_key text not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, table_name, record_key)
);

create index if not exists deleted_records_user_idx
  on public.deleted_records (user_id, table_name);

-- ---------------------------------------------------------------------------
-- Row Level Security: cada usuario solo ve y escribe sus propias lápidas
-- ---------------------------------------------------------------------------
alter table public.deleted_records enable row level security;

drop policy if exists "deleted_records_all_own" on public.deleted_records;
create policy "deleted_records_all_own" on public.deleted_records
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime: la fila completa viaja en el evento, así el cliente puede saber
-- qué se ha borrado sin consultar la tabla.
-- ---------------------------------------------------------------------------
alter table public.deleted_records replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'deleted_records'
     )
  then
    alter publication supabase_realtime add table public.deleted_records;
  end if;
end $$;
