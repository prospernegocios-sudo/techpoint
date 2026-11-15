-- Fase 2.5 · Módulos contratados por entidade (D69, D72, D81).
-- O Plano Base é sempre incluso. "investimentos" (projetos incentivados e prestação de contas) e "reservas"
-- são adicionais pagos: desligados, ficam fechados no servidor, não só escondidos na tela.

create table public.org_modules (
  org_id uuid not null references public.organizations (id) on delete cascade,
  module text not null check (module in ('investimentos', 'reservas')),
  status text not null default 'active' check (status in ('active', 'trial', 'suspended')),
  starts_on date not null default current_date,
  ends_on date,
  updated_at timestamptz not null default now(),
  primary key (org_id, module)
);
alter table public.org_modules enable row level security;
grant select on public.org_modules to authenticated;
create policy org_modules_select on public.org_modules for select to authenticated
  using (app_private.is_org_member(org_id) or app_private.is_platform_admin());
-- Ligar e desligar: só a plataforma (contrato), pela função abaixo.

create function app_private.org_has_module(p_org uuid, p_module text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.org_modules m
    where m.org_id = p_org and m.module = p_module and m.status in ('active', 'trial')
      and m.starts_on <= current_date and (m.ends_on is null or m.ends_on >= current_date)
  );
$$;
grant execute on function app_private.org_has_module(uuid, text) to authenticated;

create function public.set_org_module(p_org_id uuid, p_module text, p_status text, p_ends_on date default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'TP_FORBIDDEN'; end if;
  insert into public.org_modules (org_id, module, status, ends_on) values (p_org_id, p_module, p_status, p_ends_on)
  on conflict (org_id, module) do update set status = excluded.status, ends_on = excluded.ends_on, updated_at = now();
  insert into public.audit_log (actor_id, org_id, action, table_name, record_id, details)
  values (auth.uid(), p_org_id, 'module_' || p_status, 'org_modules', p_module, jsonb_build_object('ends_on', p_ends_on));
end; $$;
revoke all on function public.set_org_module(uuid, text, text, date) from public, anon;
grant execute on function public.set_org_module(uuid, text, text, date) to authenticated;

-- Projetos e prestação de contas: só com o módulo "investimentos" (regra restritiva, soma às que já existem).
do $$
declare t text;
begin
  foreach t in array array['projects', 'project_plan_versions', 'project_goals', 'project_goal_entries', 'project_teams',
                           'project_beneficiaries', 'project_sponsors', 'project_reports'] loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (app_private.org_has_module(org_id, ''investimentos'') or app_private.is_platform_admin()) with check (app_private.org_has_module(org_id, ''investimentos'') or app_private.is_platform_admin())',
      t || '_module_gate', t);
  end loop;
end $$;
