-- Fase C do incentivo, onda 1: proposta aprovada vira projeto de execução (automático, decisão do TG em 16/11),
-- repasses recebidos, despesas ligadas ao orçamento combinado (pactuado) e comprovantes por despesa.
-- Comprovantes no TechPoint, com fotos reduzidas no app (decisão 2a). Acesso: gestor/administrador com o módulo.

-- ---------------------------------------------------------------------
-- Projeto ligado à proposta; proposta aprovada fica travada (o orçamento vira o valor combinado)
-- ---------------------------------------------------------------------
alter table public.projects
  add column proposal_id uuid unique references public.tech_proposals (id) on delete set null,
  add column signed_on date;                                            -- assinatura do termo

alter table public.proposal_budget_items
  add column exec_status text not null default 'normal' check (exec_status in ('normal', 'substituido', 'nao_adquirido')),
  add column exec_note text check (char_length(exec_note) <= 1000);    -- justificativa de troca ou não aquisição (RCO)

create function app_private.proposal_editable(p_proposal uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tech_proposals t where t.id = p_proposal and t.status <> 'aprovada');
$$;
grant execute on function app_private.proposal_editable(uuid) to authenticated;

drop policy proposal_goals_all on public.proposal_goals;
drop policy proposal_items_all on public.proposal_budget_items;
create policy proposal_goals_select on public.proposal_goals for select to authenticated using (app_private.can_habilitate(org_id));
create policy proposal_goals_write on public.proposal_goals for all to authenticated
  using (app_private.can_habilitate(org_id) and app_private.proposal_editable(proposal_id))
  with check (app_private.can_habilitate(org_id) and app_private.proposal_in_org(proposal_id, org_id) and app_private.proposal_editable(proposal_id));
create policy proposal_items_select on public.proposal_budget_items for select to authenticated using (app_private.can_habilitate(org_id));
create policy proposal_items_write on public.proposal_budget_items for all to authenticated
  using (app_private.can_habilitate(org_id) and app_private.proposal_editable(proposal_id))
  with check (app_private.can_habilitate(org_id) and app_private.proposal_in_org(proposal_id, org_id) and app_private.proposal_editable(proposal_id));

-- Proposta aprovada: só muda de situação pela função de aprovação; depois disso não volta a ser editada.
create function app_private.guard_approved_proposal() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'aprovada' and coalesce(current_setting('techpoint.approving', true), '') <> 'on' then
    raise exception 'TP_PROPOSAL_LOCKED';
  end if;
  if new.status = 'aprovada' and old.status <> 'aprovada' and coalesce(current_setting('techpoint.approving', true), '') <> 'on' then
    raise exception 'TP_USE_APPROVE';
  end if;
  return new;
end; $$;
create trigger tech_proposals_guard before update on public.tech_proposals
  for each row execute function app_private.guard_approved_proposal();
create function app_private.guard_approved_delete() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'aprovada' then raise exception 'TP_PROPOSAL_LOCKED'; end if;
  return old;
end; $$;
create trigger tech_proposals_guard_delete before delete on public.tech_proposals
  for each row execute function app_private.guard_approved_delete();

-- ---------------------------------------------------------------------
-- Aprovação: cria o projeto com vigência, equipes, beneficiários, metas e plano versão 1
-- ---------------------------------------------------------------------
create function public.approve_proposal(p_proposal uuid, p_agreement text, p_signed_on date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.tech_proposals;
  v_org public.organizations;
  v_project uuid; v_plan uuid; v_start date; v_end date; g record; n int := 0;
begin
  select * into v from public.tech_proposals where id = p_proposal;
  if v.id is null or not app_private.can_habilitate(v.org_id) then raise exception 'TP_FORBIDDEN'; end if;
  if v.status = 'aprovada' then raise exception 'TP_ALREADY_APPROVED'; end if;
  if char_length(trim(coalesce(p_agreement, ''))) < 3 then raise exception 'TP_AGREEMENT_REQUIRED'; end if;
  select * into v_org from public.organizations where id = v.org_id;
  v_start := coalesce(v.starts_on, p_signed_on, (now() at time zone 'America/Sao_Paulo')::date);
  v_end := (v_start + make_interval(months => coalesce(v.months, 12)) - interval '1 day')::date;

  insert into public.projects (org_id, name, process_number, sphere, agency, program, proponent, starts_on, ends_on, status, proposal_id, signed_on, notes)
  values (v.org_id, left(v.title, 160), trim(p_agreement), 'federal', 'Ministério do Esporte – Secretaria Nacional de Excelência Esportiva',
          'Revelar Talentos – Termo de Fomento', left(coalesce(v_org.legal_name, v_org.name), 160), v_start, v_end, 'active', v.id, p_signed_on,
          left('Criado automaticamente a partir do Projeto Técnico aprovado.', 2000))
  returning id into v_project;

  insert into public.project_plan_versions (org_id, project_id, version, approved_on, description)
  values (v.org_id, v_project, 1, p_signed_on, left('Projeto Técnico aprovado: ' || v.title, 1000))
  returning id into v_plan;

  -- Equipes do público-alvo e os atletas delas viram beneficiários a partir do início da vigência.
  insert into public.project_teams (project_id, team_id, org_id)
  select v_project, (t->>'team_id')::uuid, v.org_id
  from jsonb_array_elements(coalesce(v.audience->'teams', '[]'::jsonb)) t
  where exists (select 1 from public.teams tm where tm.id = (t->>'team_id')::uuid and tm.org_id = v.org_id)
  on conflict do nothing;
  insert into public.project_beneficiaries (project_id, athlete_id, org_id, starts_on)
  select distinct v_project, tmb.athlete_id, v.org_id, v_start
  from public.project_teams pt join public.team_members tmb on tmb.team_id = pt.team_id
  join public.athletes a on a.id = tmb.athlete_id and a.status <> 'inactive'
  where pt.project_id = v_project
  on conflict do nothing;

  -- Metas: o objetivo e a meta quantitativa viram metas do projeto; as de check-in continuam automáticas.
  for g in select * from public.proposal_goals where proposal_id = v.id order by position, created_at loop
    n := n + 1;
    insert into public.project_goals (org_id, project_id, plan_version_id, code, description, indicator, kind, unit, target, verifier)
    values (v.org_id, v_project, v_plan, 'Meta ' || n, left(g.objective, 500), left(coalesce(g.quantitative, g.qualitative), 300),
            g.indicator, case g.indicator when 'avg_frequency' then '%' when 'unique_beneficiaries' then 'atletas' when 'attendances' then 'presenças' else null end,
            g.target, left(g.method, 300));
  end loop;

  perform set_config('techpoint.approving', 'on', true);
  update public.tech_proposals set status = 'aprovada', project_id = v_project where id = v.id;
  perform set_config('techpoint.approving', 'off', true);
  return v_project;
end; $$;
revoke all on function public.approve_proposal(uuid, text, date) from public, anon;
grant execute on function public.approve_proposal(uuid, text, date) to authenticated;

-- Situação de um item na execução (trocado / não adquirido), com justificativa: único ajuste permitido depois de aprovado.
create function public.set_item_execution(p_item uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.proposal_budget_items where id = p_item;
  if v_org is null or not app_private.can_habilitate(v_org) then raise exception 'TP_FORBIDDEN'; end if;
  if p_status <> 'normal' and char_length(trim(coalesce(p_note, ''))) < 5 then raise exception 'TP_JUSTIFY'; end if;
  update public.proposal_budget_items set exec_status = p_status, exec_note = nullif(trim(p_note), '') where id = p_item;
end; $$;
revoke all on function public.set_item_execution(uuid, text, text) from public, anon;
grant execute on function public.set_item_execution(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Repasses recebidos e despesas
-- ---------------------------------------------------------------------
create table public.project_transfers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  source text not null default 'concedente' check (source in ('concedente', 'convenente')),
  received_on date not null,
  value numeric not null check (value > 0),
  note text check (char_length(note) <= 500),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.project_transfers (project_id, received_on);

create table public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  item_id uuid not null references public.proposal_budget_items (id) on delete restrict,   -- item do orçamento combinado
  description text check (char_length(description) <= 500),
  supplier text not null check (char_length(supplier) between 2 and 200),
  supplier_doc text check (supplier_doc is null or supplier_doc ~ '^(\d{11}|\d{14})$'),     -- CPF ou CNPJ
  doc_number text check (char_length(doc_number) <= 60),                                     -- nº da nota fiscal ou recibo
  quantity numeric check (quantity is null or quantity > 0),
  value numeric not null check (value > 0),
  spent_on date not null,                                                                   -- data da nota/recibo
  paid_on date,
  payment_method text not null default 'transferencia' check (payment_method in ('transferencia', 'outro')),
  note text check (char_length(note) <= 1000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.project_expenses (project_id, spent_on);
create index on public.project_expenses (item_id);

create table public.expense_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  expense_id uuid not null references public.project_expenses (id) on delete cascade,
  kind text not null check (kind in ('nota', 'recibo', 'pagamento', 'cotacao', 'foto', 'lista', 'embarque', 'encargos', 'contrato', 'outro')),
  file_path text not null unique check (split_part(file_path, '/', 1) = org_id::text and split_part(file_path, '/', 2) = 'execucao'),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.expense_files (expense_id);

-- Despesa, item e projeto sempre da mesma entidade, e o item precisa ser do orçamento da proposta do projeto.
create function app_private.expense_consistent(p_project uuid, p_item uuid, p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects pr join public.proposal_budget_items i on i.proposal_id = pr.proposal_id
    where pr.id = p_project and i.id = p_item and pr.org_id = p_org
  );
$$;
-- app_private.project_in_org já existe (migração de projetos) e é reutilizada.
create function app_private.expense_in_org(p_expense uuid, p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.project_expenses e where e.id = p_expense and e.org_id = p_org);
$$;
grant execute on function app_private.expense_consistent(uuid, uuid, uuid), app_private.expense_in_org(uuid, uuid) to authenticated;

alter table public.project_transfers enable row level security;
alter table public.project_expenses enable row level security;
alter table public.expense_files enable row level security;
grant select, insert, update, delete on public.project_transfers, public.project_expenses to authenticated;
grant select, insert, delete on public.expense_files to authenticated;

create policy transfers_all on public.project_transfers for all to authenticated
  using (app_private.can_habilitate(org_id)) with check (app_private.can_habilitate(org_id) and app_private.project_in_org(project_id, org_id));
create policy expenses_all on public.project_expenses for all to authenticated
  using (app_private.can_habilitate(org_id)) with check (app_private.can_habilitate(org_id) and app_private.expense_consistent(project_id, item_id, org_id));
create policy expense_files_select on public.expense_files for select to authenticated using (app_private.can_habilitate(org_id));
create policy expense_files_insert on public.expense_files for insert to authenticated
  with check (app_private.can_habilitate(org_id) and app_private.expense_in_org(expense_id, org_id) and uploaded_by = auth.uid());
create policy expense_files_delete on public.expense_files for delete to authenticated using (app_private.can_habilitate(org_id));

create trigger transfers_audit after insert or update or delete on public.project_transfers for each row execute function app_private.audit_project_change();
create trigger expenses_audit after insert or update or delete on public.project_expenses for each row execute function app_private.audit_project_change();
create trigger expense_files_audit after insert or delete on public.expense_files for each row execute function app_private.audit_project_change();

-- Arquivos da execução na pasta <entidade>/execucao/ do bucket privado org-docs.
drop policy org_docs_insert on storage.objects;
create policy org_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'org-docs' and (storage.foldername(name))[2] in ('habilitacao', 'execucao')
              and app_private.can_habilitate(app_private.try_uuid((storage.foldername(name))[1])));
