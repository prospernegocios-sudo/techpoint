-- Fase B do incentivo: Projeto Técnico / Plano de Trabalho (Revelar Talentos, Termo de Fomento).
-- Proposta com eixo e valores, textos das seções do modelo do Ministério, público-alvo, metas no formato
-- do Ministério e orçamento Meta → Ação → Etapa com 3 cotações (mesma estrutura que o RCO vai cobrar na Fase C).
-- Valor adotado (decisão do TG em 16/11, opção a): o clube escolhe menor, média ou mediana; fora do menor, justifica.
-- Acesso: gestor e administrador com o módulo "investimentos" (mesma regra da Fase A).

create table public.tech_proposals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,        -- vira projeto depois de aprovada
  title text not null check (char_length(title) between 3 and 200),
  axis text not null check (axis in ('nucleo', 'competicao', 'capacitacao')),
  instrument text not null default 'fomento' check (instrument in ('fomento', 'convenio', 'ted')),
  status text not null default 'rascunho' check (status in ('rascunho', 'enviada', 'aprovada', 'arquivada')),
  mesp_value numeric not null default 0 check (mesp_value >= 0),             -- valor pedido ao Ministério
  counterpart_value numeric not null default 0 check (counterpart_value >= 0),
  starts_on date,                                                             -- início da vigência (mês)
  months int check (months between 1 and 60),                                  -- vigência em meses
  sections jsonb not null default '{}'::jsonb,                                -- textos das seções do modelo
  audience jsonb not null default '{}'::jsonb,                                 -- equipes por fase, comissão técnica, staff, indiretos
  schedule jsonb not null default '[]'::jsonb,                                 -- cronograma de execução: [{action, months:[1..n]}]
  disbursement jsonb not null default '[]'::jsonb,                             -- parcelas: [{who, month, year, value}]
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tech_proposals (org_id, created_at desc);

create table public.proposal_goals (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.tech_proposals (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  position int not null default 1,
  objective text not null check (char_length(objective) between 3 and 500),   -- objetivo específico
  qualitative text check (char_length(qualitative) <= 1000),
  quantitative text check (char_length(quantitative) <= 1000),
  expected_result text check (char_length(expected_result) <= 1000),
  method text check (char_length(method) <= 1000),                             -- metodologia / forma de aferição
  period_months int check (period_months between 1 and 60),
  indicator text not null default 'manual' check (indicator in ('manual', 'avg_frequency', 'unique_beneficiaries', 'attendances')),
  target numeric,
  created_at timestamptz not null default now()
);
create index on public.proposal_goals (proposal_id, position);

create table public.proposal_budget_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.tech_proposals (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  goal_id uuid references public.proposal_goals (id) on delete set null,       -- meta
  action text check (char_length(action) <= 300),                              -- ação
  stage text not null check (stage in ('rh', 'material', 'uniformes', 'passagens', 'hospedagem', 'alimentacao', 'diarias',
                                       'transporte', 'infraestrutura', 'servicos', 'equipamentos', 'outro')),  -- etapa (tipos do RCO)
  description text not null check (char_length(description) between 3 and 1000),
  gnd int not null default 3 check (gnd in (3, 4)),                            -- 3 custeio, 4 investimento
  unit text check (char_length(unit) <= 40),
  quantity numeric not null default 1 check (quantity > 0),
  quotes jsonb not null default '[]'::jsonb,                                    -- até 3: [{supplier, cnpj, value}]
  adopted_rule text not null default 'menor' check (adopted_rule in ('menor', 'media', 'mediana')),
  justification text check (char_length(justification) <= 1000),
  unit_value numeric not null default 0 check (unit_value >= 0),                -- valor unitário adotado (calculado no app)
  rh jsonb,                                                                    -- equipe: {role, duties, profile, contract, workload, months, salary}
  total numeric not null default 0 check (total >= 0),                          -- total do item (com encargos, se CLT)
  start_month int check (start_month between 1 and 60),
  end_month int check (end_month between 1 and 60),
  position int not null default 1,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(quotes) = 'array' and jsonb_array_length(quotes) <= 3),
  check (adopted_rule = 'menor' or char_length(trim(coalesce(justification, ''))) >= 5),
  check (end_month is null or start_month is null or end_month >= start_month)
);
create index on public.proposal_budget_items (proposal_id, position);

-- Metas e itens sempre na mesma entidade da proposta.
create function app_private.proposal_in_org(p_proposal uuid, p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tech_proposals t where t.id = p_proposal and t.org_id = p_org);
$$;
grant execute on function app_private.proposal_in_org(uuid, uuid) to authenticated;

alter table public.tech_proposals enable row level security;
alter table public.proposal_goals enable row level security;
alter table public.proposal_budget_items enable row level security;
grant select, insert, update, delete on public.tech_proposals, public.proposal_goals, public.proposal_budget_items to authenticated;

create policy tech_proposals_all on public.tech_proposals for all to authenticated
  using (app_private.can_habilitate(org_id)) with check (app_private.can_habilitate(org_id));
create policy proposal_goals_all on public.proposal_goals for all to authenticated
  using (app_private.can_habilitate(org_id))
  with check (app_private.can_habilitate(org_id) and app_private.proposal_in_org(proposal_id, org_id));
create policy proposal_items_all on public.proposal_budget_items for all to authenticated
  using (app_private.can_habilitate(org_id))
  with check (app_private.can_habilitate(org_id) and app_private.proposal_in_org(proposal_id, org_id));

create trigger tech_proposals_touch before update on public.tech_proposals
  for each row execute function app_private.touch_updated_at();
create trigger tech_proposals_audit after insert or update or delete on public.tech_proposals
  for each row execute function app_private.audit_project_change();
create trigger proposal_items_audit after insert or update or delete on public.proposal_budget_items
  for each row execute function app_private.audit_project_change();
