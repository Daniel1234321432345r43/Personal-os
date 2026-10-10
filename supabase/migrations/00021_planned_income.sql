-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00021: ingresos programados (no solo gastos previstos)
--
-- `planned_expenses` guardaba únicamente dinero que iba a salir. Ahora la misma
-- tabla sirve para las dos direcciones: un `kind` distingue el gasto previsto
-- ('expense', el valor de siempre) del ingreso previsto ('income', una nómina o
-- un trabajo que esperas cobrar).
--
-- Las filas existentes se quedan como gastos: el valor por defecto lo garantiza.
--
-- Cómo ejecutarla:
--   • Supabase Dashboard → SQL Editor → pegar y ejecutar, o
--   • `supabase db push` con la CLI local.
-- =============================================================================

alter table public.planned_expenses
  add column if not exists kind text not null default 'expense';

alter table public.planned_expenses drop constraint if exists planned_expenses_kind_check;
alter table public.planned_expenses
  add constraint planned_expenses_kind_check check (kind in ('income', 'expense'));
