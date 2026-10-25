-- =============================================================================
-- Núcleo — Sistema Operativo Personal
-- Migración 00024: Gastos e ingresos recurrentes (mensualidades) y Webhook de Apple Wallet
--
-- 1) Añade soporte de periodicidad a planned_expenses (once, monthly, weekly, yearly).
-- 2) Crea la tabla finance_webhooks para enlazar tokens de automatización (Atajos de iOS,
--    Apple Wallet, webhooks externos) de forma segura con cada usuario.
--
-- Cómo ejecutarla:
--   • Supabase Dashboard → SQL Editor → pegar y ejecutar, o
--   • `supabase db push` con la CLI local.
-- =============================================================================

-- 1. Periodicidad en movimientos previstos / mensualidades
alter table public.planned_expenses
  add column if not exists recurrence text not null default 'once';

alter table public.planned_expenses drop constraint if exists planned_expenses_recurrence_check;
alter table public.planned_expenses
  add constraint planned_expenses_recurrence_check
  check (recurrence in ('once', 'monthly', 'weekly', 'yearly'));

-- 2. Tokens de webhook para Apple Wallet / Atajos de iOS
create table if not exists public.finance_webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token text not null unique,
  name text not null default 'Apple Wallet / Atajos',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists finance_webhooks_user_idx on public.finance_webhooks (user_id);
create index if not exists finance_webhooks_token_idx on public.finance_webhooks (token);

-- RLS para finance_webhooks
alter table public.finance_webhooks enable row level security;

drop policy if exists "finance_webhooks_all_own" on public.finance_webhooks;
create policy "finance_webhooks_all_own" on public.finance_webhooks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
