-- La importación de Google Classroom hace un upsert con
-- `onConflict: "user_id,classroom_id"`, que requiere una constraint ÚNICA.
-- El índice anterior era normal (no único), por lo que el upsert fallaba.
drop index if exists tasks_user_classroom_idx;
create unique index tasks_user_classroom_idx on public.tasks (user_id, classroom_id);
