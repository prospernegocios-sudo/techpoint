-- Administrador da entidade, dados cadastrais da entidade, responsáveis legais e
-- cadastro de nova entidade pelo próprio interessado com análise posterior (D54, D55).

-- ---------------------------------------------------------------------
-- Validação de CPF e CNPJ (dígitos verificadores)
-- ---------------------------------------------------------------------
create function app_private.valid_cpf(p text) returns boolean language plpgsql immutable set search_path = '' as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g'); s int; r int; i int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0; for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d, 10, 1)::int then return false; end if;
  s := 0; for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = substr(d, 11, 1)::int;
end; $$;

create function app_private.valid_cnpj(p text) returns boolean language plpgsql immutable set search_path = '' as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2]; w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2]; s int; r int; i int;
begin
  if length(d) <> 14 or d ~ '^(\d)\1{13}$' then return false; end if;
  s := 0; for i in 1..12 loop s := s + substr(d, i, 1)::int * w1[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  if r <> substr(d, 13, 1)::int then return false; end if;
  s := 0; for i in 1..13 loop s := s + substr(d, i, 1)::int * w2[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  return r = substr(d, 14, 1)::int;
end; $$;

-- ---------------------------------------------------------------------
-- Dados da entidade
-- ---------------------------------------------------------------------
alter table public.organizations
  add column legal_name text check (char_length(legal_name) <= 200),            -- razão social
  add column trade_name text check (char_length(trade_name) <= 200),            -- nome fantasia
  add column cnpj text unique check (cnpj is null or (cnpj ~ '^\d{14}$' and app_private.valid_cnpj(cnpj))),
  add column state_registration text check (char_length(state_registration) <= 30),     -- IE ou 'ISENTO'
  add column municipal_registration text check (char_length(municipal_registration) <= 30),
  add column cep text check (cep is null or cep ~ '^\d{8}$'),
  add column street text check (char_length(street) <= 200),
  add column street_number text check (char_length(street_number) <= 20),
  add column complement text check (char_length(complement) <= 100),
  add column district text check (char_length(district) <= 100),
  add column city text check (char_length(city) <= 100),
  add column uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  add column phone text check (phone is null or phone ~ '^\d{10,11}$'),
  add column email text check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  add column email_verified_at timestamptz,                                      -- código por e-mail: D51 (lançamento)
  add column website text check (char_length(website) <= 200),
  add column receita_status text,                                                -- situação cadastral lida na BrasilAPI
  add column created_via text not null default 'platform' check (created_via in ('platform', 'self_signup')),
  add column terms_version text,
  add column terms_accepted_at timestamptz,
  add column terms_accepted_by uuid references public.profiles (id) on delete set null,
  -- Análise posterior pela plataforma (D55): a entidade já funciona; "suspended" bloqueia o acesso.
  add column review_status text not null default 'approved' check (review_status in ('pending', 'approved', 'suspended')),
  add column review_notes text check (char_length(review_notes) <= 4000),
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  add column reviewed_at timestamptz;

-- Cargo da pessoa na entidade (ex.: Presidente, Diretor esportivo).
alter table public.memberships add column title text check (char_length(title) <= 80);

-- Dados pessoais sensíveis (CPF, telefone) separados do perfil, com acesso restrito.
create table public.profile_private (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  cpf text unique check (cpf is null or (cpf ~ '^\d{11}$' and app_private.valid_cpf(cpf))),
  phone text check (phone is null or phone ~ '^\d{10,11}$'),
  updated_at timestamptz not null default now()
);

-- Responsáveis legais pelo CNPJ (quem assina pela entidade).
create table public.org_legal_representatives (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 3 and 160),
  cpf text check (cpf is null or (cpf ~ '^\d{11}$' and app_private.valid_cpf(cpf))),
  role_title text check (char_length(role_title) <= 80),
  email text check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text check (phone is null or phone ~ '^\d{10,11}$'),
  term_start date,
  term_end date,
  profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (term_end is null or term_start is null or term_end >= term_start)
);
create index on public.org_legal_representatives (org_id);

-- ---------------------------------------------------------------------
-- Papéis: administrador faz tudo que o gestor faz. Entidade suspensa perde o acesso.
-- ---------------------------------------------------------------------
create or replace function app_private.has_org_role(p_org uuid, p_roles public.org_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m join public.organizations o on o.id = m.org_id
    where m.org_id = p_org and m.profile_id = auth.uid() and m.active and m.role = any (p_roles)
      and o.review_status <> 'suspended'
  );
$$;

create or replace function app_private.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_platform_admin() or app_private.has_org_role(p_org, array['admin','manager','coach','athlete','guardian']::public.org_role[]);
$$;

create or replace function app_private.is_org_staff(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_platform_admin()
      or app_private.has_org_role(p_org, array['admin', 'manager', 'coach']::public.org_role[]);
$$;

create or replace function app_private.is_org_manager(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_platform_admin()
      or app_private.has_org_role(p_org, array['admin', 'manager']::public.org_role[]);
$$;

create function app_private.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_platform_admin() or app_private.has_org_role(p_org, array['admin']::public.org_role[]);
$$;
grant execute on function app_private.is_org_admin(uuid) to authenticated;

-- Só administrador mexe em vínculo de administrador; o último administrador ativo não pode sair.
create function app_private.guard_admin_membership() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid := coalesce(new.org_id, old.org_id);
begin
  -- O primeiro administrador é criado pela função de cadastro da entidade (marcador só desta transação).
  if auth.uid() is not null and coalesce(current_setting('techpoint.registering_org', true), '') <> 'on'
     and ((tg_op <> 'DELETE' and new.role = 'admin') or (tg_op <> 'INSERT' and old.role = 'admin'))
     and not app_private.is_org_admin(v_org) then
    raise exception 'TP_ADMIN_ONLY';
  end if;
  if tg_op <> 'INSERT' and old.role = 'admin' and old.active
     and (tg_op = 'DELETE' or not new.active or new.role <> 'admin')
     and not exists (select 1 from public.memberships m
                     where m.org_id = old.org_id and m.role = 'admin' and m.active and m.profile_id is not null and m.id <> old.id) then
    raise exception 'TP_LAST_ADMIN';
  end if;
  return coalesce(new, old);
end; $$;
create trigger memberships_guard_admin before insert or update or delete on public.memberships
  for each row execute function app_private.guard_admin_membership();

-- ---------------------------------------------------------------------
-- Permissões e regras de acesso
-- ---------------------------------------------------------------------
revoke all on public.profile_private, public.org_legal_representatives from anon;

-- Dados da entidade: só administrador (ou a plataforma) altera. Análise e criação via funções.
drop policy org_update on public.organizations;
create policy org_update on public.organizations for update to authenticated
  using (app_private.is_org_admin(id)) with check (app_private.is_org_admin(id));
revoke update on public.organizations from authenticated;
grant update (name, legal_name, trade_name, state_registration, municipal_registration, cep, street, street_number,
              complement, district, city, uf, phone, email, website,
              photo_retention_months, checkin_before_min, checkin_after_min, checkout_after_min, offline_max_hours, default_radius_m)
  on public.organizations to authenticated;

-- Dados pessoais: a própria pessoa; administradores da entidade em que ela é administradora/gestora; a plataforma.
alter table public.profile_private enable row level security;
create policy profile_private_select on public.profile_private for select to authenticated
  using (profile_id = auth.uid() or app_private.is_platform_admin() or exists (
    select 1 from public.memberships m
    where m.profile_id = profile_private.profile_id and m.role in ('admin', 'manager') and app_private.is_org_admin(m.org_id)));
create policy profile_private_upsert on public.profile_private for insert to authenticated with check (profile_id = auth.uid());
create policy profile_private_update on public.profile_private for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

alter table public.org_legal_representatives enable row level security;
create policy reps_select on public.org_legal_representatives for select to authenticated using (app_private.is_org_admin(org_id));
create policy reps_write on public.org_legal_representatives for all to authenticated
  using (app_private.is_org_admin(org_id)) with check (app_private.is_org_admin(org_id));

-- Auditoria também das mudanças na própria entidade (a organização é o seu próprio org_id).
create or replace function app_private.audit_project_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_row jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (actor_id, org_id, action, table_name, record_id, details)
  values (auth.uid(),
          coalesce(v_row->>'org_id', case when tg_table_name = 'organizations' then v_row->>'id' end)::uuid,
          lower(tg_op), tg_table_name, coalesce(v_row->>'id', v_row->>'project_id'),
          case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
               else jsonb_build_object('row', v_row) end);
  return coalesce(new, old);
end; $$;

create trigger reps_audit after insert or update or delete on public.org_legal_representatives
  for each row execute function app_private.audit_project_change();
create trigger orgs_audit after update on public.organizations
  for each row execute function app_private.audit_project_change();
create trigger profile_private_touch before update on public.profile_private
  for each row execute function app_private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Cadastro de nova entidade pelo próprio interessado (D55)
-- ---------------------------------------------------------------------
create function public.register_organization(p_admin jsonb, p_org jsonb, p_reps jsonb, p_terms_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_cnpj text := regexp_replace(coalesce(p_org->>'cnpj', ''), '\D', '', 'g');
  v_cpf text := regexp_replace(coalesce(p_admin->>'cpf', ''), '\D', '', 'g');
  v_name text := coalesce(nullif(trim(p_org->>'trade_name'), ''), trim(p_org->>'legal_name'));
  v_slug text; v_org uuid; v_rep jsonb;
begin
  if v_uid is null then raise exception 'TP_NOT_AUTHENTICATED'; end if;
  if not app_private.valid_cnpj(v_cnpj) then raise exception 'TP_INVALID_CNPJ'; end if;
  if not app_private.valid_cpf(v_cpf) then raise exception 'TP_INVALID_CPF'; end if;
  if char_length(coalesce(trim(p_org->>'legal_name'), '')) < 3 then raise exception 'TP_LEGAL_NAME_REQUIRED'; end if;
  if char_length(coalesce(trim(p_admin->>'full_name'), '')) < 3 then raise exception 'TP_NAME_REQUIRED'; end if;
  if coalesce(trim(p_terms_version), '') = '' then raise exception 'TP_TERMS_REQUIRED'; end if;
  if exists (select 1 from public.organizations where cnpj = v_cnpj) then raise exception 'TP_CNPJ_EXISTS'; end if;
  if exists (select 1 from public.profile_private where cpf = v_cpf and profile_id <> v_uid) then raise exception 'TP_CPF_IN_USE'; end if;

  v_slug := left(regexp_replace(regexp_replace(lower(translate(v_name,
              'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
              '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'), 40);
  if char_length(v_slug) < 2 then v_slug := 'entidade'; end if;
  v_slug := v_slug || '-' || right(v_cnpj, 6);

  insert into public.organizations (name, slug, legal_name, trade_name, cnpj, state_registration, municipal_registration,
      cep, street, street_number, complement, district, city, uf, phone, email, website, receita_status,
      created_via, terms_version, terms_accepted_at, terms_accepted_by, review_status, photo_retention_months)
  values (left(v_name, 120), v_slug, trim(p_org->>'legal_name'), nullif(trim(p_org->>'trade_name'), ''), v_cnpj,
      nullif(upper(trim(p_org->>'state_registration')), ''), nullif(trim(p_org->>'municipal_registration'), ''),
      nullif(regexp_replace(coalesce(p_org->>'cep', ''), '\D', '', 'g'), ''), nullif(trim(p_org->>'street'), ''),
      nullif(trim(p_org->>'street_number'), ''), nullif(trim(p_org->>'complement'), ''), nullif(trim(p_org->>'district'), ''),
      nullif(trim(p_org->>'city'), ''), nullif(upper(trim(p_org->>'uf')), ''),
      nullif(regexp_replace(coalesce(p_org->>'phone', ''), '\D', '', 'g'), ''), nullif(lower(trim(p_org->>'email')), ''),
      nullif(trim(p_org->>'website'), ''), nullif(trim(p_org->>'receita_status'), ''),
      'self_signup', p_terms_version, now(), v_uid, 'pending', 24)
  returning id into v_org;

  perform set_config('techpoint.registering_org', 'on', true);
  insert into public.memberships (org_id, profile_id, role, title)
  values (v_org, v_uid, 'admin', nullif(trim(p_admin->>'title'), ''));
  perform set_config('techpoint.registering_org', 'off', true);

  insert into public.profile_private (profile_id, cpf, phone)
  values (v_uid, v_cpf, nullif(regexp_replace(coalesce(p_admin->>'phone', ''), '\D', '', 'g'), ''))
  on conflict (profile_id) do update set cpf = excluded.cpf, phone = coalesce(excluded.phone, public.profile_private.phone);

  update public.profiles set full_name = trim(p_admin->>'full_name') where id = v_uid;

  for v_rep in select * from jsonb_array_elements(coalesce(p_reps, '[]'::jsonb)) loop
    insert into public.org_legal_representatives (org_id, full_name, cpf, role_title, email, phone, term_start, term_end, profile_id)
    values (v_org, trim(v_rep->>'full_name'),
      nullif(regexp_replace(coalesce(v_rep->>'cpf', ''), '\D', '', 'g'), ''), nullif(trim(v_rep->>'role_title'), ''),
      nullif(lower(trim(v_rep->>'email')), ''), nullif(regexp_replace(coalesce(v_rep->>'phone', ''), '\D', '', 'g'), ''),
      nullif(v_rep->>'term_start', '')::date, nullif(v_rep->>'term_end', '')::date,
      case when coalesce((v_rep->>'is_me')::boolean, false) then v_uid end);
  end loop;

  insert into public.audit_log (actor_id, org_id, action, table_name, record_id, details)
  values (v_uid, v_org, 'organization_registered', 'organizations', v_org::text,
          jsonb_build_object('cnpj', v_cnpj, 'terms_version', p_terms_version, 'receita_status', p_org->>'receita_status'));
  return jsonb_build_object('org_id', v_org);
end;
$$;

-- Análise posterior pela plataforma: aprovar, voltar para análise ou suspender, com anotações do contato.
create function public.review_organization(p_org_id uuid, p_status text, p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'TP_FORBIDDEN'; end if;
  if p_status not in ('pending', 'approved', 'suspended') then raise exception 'TP_INVALID_STATUS'; end if;
  update public.organizations
     set review_status = p_status, review_notes = nullif(trim(p_notes), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_org_id;
  if not found then raise exception 'TP_ORG_NOT_FOUND'; end if;
end;
$$;

revoke all on function public.register_organization from public, anon;
revoke all on function public.review_organization from public, anon;
grant execute on function public.register_organization to authenticated;
grant execute on function public.review_organization to authenticated;

-- A plataforma vê os dados pessoais dos administradores na lista de análise.
create function public.platform_org_review_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'TP_FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'org', to_jsonb(o) - 'terms_accepted_by' - 'reviewed_by',
      'admins', (select coalesce(jsonb_agg(jsonb_build_object('full_name', p.full_name, 'email', p.email, 'title', m.title,
                    'phone', pp.phone, 'cpf', pp.cpf)), '[]'::jsonb)
                 from public.memberships m join public.profiles p on p.id = m.profile_id
                 left join public.profile_private pp on pp.profile_id = p.id
                 where m.org_id = o.id and m.role = 'admin' and m.active),
      'athletes', (select count(*) from public.athletes a where a.org_id = o.id and a.status = 'active'),
      'users', (select count(distinct m.profile_id) from public.memberships m where m.org_id = o.id and m.active)
    ) order by (o.review_status = 'pending') desc, o.created_at desc) from public.organizations o), '[]'::jsonb);
end;
$$;
revoke all on function public.platform_org_review_list from public, anon;
grant execute on function public.platform_org_review_list to authenticated;
