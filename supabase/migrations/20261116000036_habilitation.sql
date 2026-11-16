-- Fase A do módulo de incentivo: "Clube apto" (Revelar Talentos / Termo de Fomento).
-- Pasta de habilitação da entidade, dirigentes com dados pessoais de acesso restrito (decisão do TG em 16/11: 1a)
-- e dados de apoio para gerar as declarações (Anexos I a XV, em Word: decisão 2a).
-- Acesso: só administrador e gestor da entidade, e só com o módulo "investimentos" ativo.

create function app_private.can_habilitate(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.is_platform_admin()
      or (app_private.is_org_manager(p_org) and app_private.org_has_module(p_org, 'investimentos'));
$$;
grant execute on function app_private.can_habilitate(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Dados de apoio (preenchem as declarações e as regras automáticas)
-- ---------------------------------------------------------------------
create table public.org_habil_profile (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  founded_on date,                                                         -- abertura do CNPJ (regra dos 3 anos)
  proposal_number text check (char_length(proposal_number) <= 40),         -- nº da proposta no Transferegov.br
  partnership_object text check (char_length(partnership_object) <= 600), -- objeto da parceria
  execution_place text check (char_length(execution_place) <= 200),       -- local de execução
  sport text check (char_length(sport) <= 120),                            -- esporte/modalidade/categoria
  space_name text check (char_length(space_name) <= 200),                  -- espaço físico (Anexo III)
  space_address text check (char_length(space_address) <= 300),
  space_owner text check (char_length(space_owner) <= 200),
  execution_period text check (char_length(execution_period) <= 120),
  counterpart_value numeric check (counterpart_value is null or counterpart_value >= 0), -- Anexo XIII
  counterpart_account text check (char_length(counterpart_account) <= 200),
  signatory_id uuid,                                                        -- dirigente que assina as declarações
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.org_habil_profile enable row level security;
grant select, insert, update on public.org_habil_profile to authenticated;
create policy habil_profile_all on public.org_habil_profile for all to authenticated
  using (app_private.can_habilitate(org_id)) with check (app_private.can_habilitate(org_id));
create trigger habil_profile_audit after insert or update on public.org_habil_profile
  for each row execute function app_private.audit_project_change();

-- ---------------------------------------------------------------------
-- Dirigentes (relação nominal do Anexo IX). Dados pessoais: sem acesso direto à tabela;
-- leitura e gravação só pelas funções abaixo, e toda leitura fica no histórico (audit_log).
-- ---------------------------------------------------------------------
create table public.org_officers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 3 and 160),
  role_title text not null check (char_length(role_title) between 2 and 80),   -- cargo conforme o estatuto
  cpf text check (cpf is null or (cpf ~ '^\d{11}$' and app_private.valid_cpf(cpf))),
  rg text check (char_length(rg) <= 30),
  rg_issuer text check (char_length(rg_issuer) <= 30),
  birth_date date,
  address text check (char_length(address) <= 300),
  phone text check (phone is null or phone ~ '^\d{10,11}$'),
  email text check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  term_start date,
  term_end date,
  is_signatory boolean not null default false,                                  -- representante legal que assina
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (term_end is null or term_start is null or term_end >= term_start)
);
create index on public.org_officers (org_id);
alter table public.org_officers enable row level security;
revoke all on public.org_officers from anon, authenticated;
alter table public.org_habil_profile
  add constraint habil_profile_signatory_fk foreign key (signatory_id) references public.org_officers (id) on delete set null;
create trigger org_officers_audit after insert or update or delete on public.org_officers
  for each row execute function app_private.audit_project_change();

create function public.list_org_officers(p_org uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if not app_private.can_habilitate(p_org) then raise exception 'TP_FORBIDDEN'; end if;
  select coalesce(jsonb_agg(to_jsonb(o) - 'org_id' order by o.is_signatory desc, o.full_name), '[]'::jsonb) into v
  from public.org_officers o where o.org_id = p_org;
  insert into public.audit_log (actor_id, org_id, action, table_name, record_id, details)
  values (auth.uid(), p_org, 'officers_viewed', 'org_officers', p_org::text, jsonb_build_object('count', jsonb_array_length(v)));
  return v;
end; $$;

create function public.save_org_officer(p_org uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := nullif(p->>'id', '')::uuid;
begin
  if not app_private.can_habilitate(p_org) then raise exception 'TP_FORBIDDEN'; end if;
  if v_id is null then
    insert into public.org_officers (org_id, full_name, role_title, cpf, rg, rg_issuer, birth_date, address, phone, email, term_start, term_end, is_signatory)
    values (p_org, trim(p->>'full_name'), trim(p->>'role_title'), nullif(p->>'cpf', ''), nullif(trim(p->>'rg'), ''), nullif(trim(p->>'rg_issuer'), ''),
            nullif(p->>'birth_date', '')::date, nullif(trim(p->>'address'), ''), nullif(p->>'phone', ''), nullif(lower(trim(p->>'email')), ''),
            nullif(p->>'term_start', '')::date, nullif(p->>'term_end', '')::date, coalesce((p->>'is_signatory')::boolean, false))
    returning id into v_id;
  else
    update public.org_officers set
      full_name = trim(p->>'full_name'), role_title = trim(p->>'role_title'), cpf = nullif(p->>'cpf', ''),
      rg = nullif(trim(p->>'rg'), ''), rg_issuer = nullif(trim(p->>'rg_issuer'), ''), birth_date = nullif(p->>'birth_date', '')::date,
      address = nullif(trim(p->>'address'), ''), phone = nullif(p->>'phone', ''), email = nullif(lower(trim(p->>'email')), ''),
      term_start = nullif(p->>'term_start', '')::date, term_end = nullif(p->>'term_end', '')::date,
      is_signatory = coalesce((p->>'is_signatory')::boolean, false), updated_at = now()
    where id = v_id and org_id = p_org;
    if not found then raise exception 'TP_NOT_FOUND'; end if;
  end if;
  return v_id;
end; $$;

create function public.delete_org_officer(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.org_officers where id = p_id;
  if v_org is null or not app_private.can_habilitate(v_org) then raise exception 'TP_FORBIDDEN'; end if;
  delete from public.org_officers where id = p_id;
end; $$;

revoke all on function public.list_org_officers(uuid), public.save_org_officer(uuid, jsonb), public.delete_org_officer(uuid) from public, anon;
grant execute on function public.list_org_officers(uuid), public.save_org_officer(uuid, jsonb), public.delete_org_officer(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Pasta de habilitação: um registro por envio (o mais recente vale; os anteriores ficam de histórico).
-- item_code = código do item no checklist do Ministério (ex.: '1.2', '4.1'). O catálogo fica no app.
-- status 'nao_aplica' marca itens condicionais (ex.: contrapartida só acima de R$ 1 milhão).
-- ---------------------------------------------------------------------
create table public.org_habil_docs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  item_code text not null check (item_code ~ '^\d{1,2}\.\d{1,2}(\.\d{1,2})?$'),
  status text not null default 'enviado' check (status in ('enviado', 'confirmado', 'nao_aplica')),
  file_path text unique,
  mime_type text check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer check (size_bytes > 0 and size_bytes <= 10485760),
  issued_on date,
  valid_until date,
  note text check (char_length(note) <= 500),
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((file_path is null) = (mime_type is null)),
  check (file_path is null or split_part(file_path, '/', 1) = org_id::text),
  check (status <> 'enviado' or file_path is not null),
  check (status <> 'nao_aplica' or char_length(note) >= 3),
  check (valid_until is null or issued_on is null or valid_until >= issued_on)
);
create index on public.org_habil_docs (org_id, item_code, created_at desc);
alter table public.org_habil_docs enable row level security;
grant select, insert, delete on public.org_habil_docs to authenticated;
create policy habil_docs_select on public.org_habil_docs for select to authenticated using (app_private.can_habilitate(org_id));
create policy habil_docs_insert on public.org_habil_docs for insert to authenticated
  with check (app_private.can_habilitate(org_id) and uploaded_by = auth.uid());
create policy habil_docs_delete on public.org_habil_docs for delete to authenticated using (app_private.can_habilitate(org_id));
create trigger habil_docs_audit after insert or delete on public.org_habil_docs
  for each row execute function app_private.audit_project_change();

-- Registro de abertura de arquivo (o app chama antes de abrir; a leitura do arquivo em si exige a mesma permissão).
create function public.log_habil_doc_open(p_doc uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_item text;
begin
  select org_id, item_code into v_org, v_item from public.org_habil_docs where id = p_doc;
  if v_org is null or not app_private.can_habilitate(v_org) then raise exception 'TP_FORBIDDEN'; end if;
  insert into public.audit_log (actor_id, org_id, action, table_name, record_id, details)
  values (auth.uid(), v_org, 'habil_doc_opened', 'org_habil_docs', p_doc::text, jsonb_build_object('item', v_item));
end; $$;
revoke all on function public.log_habil_doc_open(uuid) from public, anon;
grant execute on function public.log_habil_doc_open(uuid) to authenticated;

-- Arquivos: bucket privado, até 10 MB, PDF/PNG/JPG; pasta <entidade>/habilitacao/<arquivo>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-docs', 'org-docs', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy org_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'org-docs' and (storage.foldername(name))[2] = 'habilitacao'
              and app_private.can_habilitate(app_private.try_uuid((storage.foldername(name))[1])));
create policy org_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'org-docs' and app_private.can_habilitate(app_private.try_uuid((storage.foldername(name))[1])));
create policy org_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'org-docs' and app_private.can_habilitate(app_private.try_uuid((storage.foldername(name))[1])));
