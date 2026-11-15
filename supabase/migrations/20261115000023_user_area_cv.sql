-- Área do usuário e currículo esportivo (D78).
-- 1a: CPF e endereço opcionais; 2a: currículo visto por atleta, responsáveis e equipe + link de compartilhamento;
-- 3a: altura, peso e mão dominante só para atleta e responsáveis, salvo se marcarem para mostrar no currículo.

-- ---------------------------------------------------------------------
-- Dados pessoais da própria conta (responsável, treinador, gestor): endereço e nascimento
-- ---------------------------------------------------------------------
alter table public.profile_private
  add column birth_date date check (birth_date is null or birth_date > date '1900-01-01'),
  add column cep text check (cep is null or cep ~ '^\d{8}$'),
  add column street text check (street is null or char_length(street) <= 160),
  add column street_number text check (street_number is null or char_length(street_number) <= 20),
  add column complement text check (complement is null or char_length(complement) <= 80),
  add column district text check (district is null or char_length(district) <= 80),
  add column city text check (city is null or char_length(city) <= 80),
  add column uf text check (uf is null or uf ~ '^[A-Z]{2}$');

-- ---------------------------------------------------------------------
-- Atleta "próprio ou responsável" (não inclui a equipe da entidade)
-- ---------------------------------------------------------------------
create function app_private.is_self_or_guardian(p_athlete uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.athletes a where a.id = p_athlete and a.profile_id = auth.uid())
      or p_athlete in (select app_private.my_guarded_athlete_ids());
$$;
grant execute on function app_private.is_self_or_guardian(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Dados do atleta: documento, contato, endereço e esporte
-- ---------------------------------------------------------------------
create table public.athlete_details (
  athlete_id uuid primary key references public.athletes (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  cpf text check (cpf is null or (cpf ~ '^\d{11}$' and app_private.valid_cpf(cpf))),
  phone text check (phone is null or phone ~ '^\d{10,11}$'),
  cep text check (cep is null or cep ~ '^\d{8}$'),
  street text check (street is null or char_length(street) <= 160),
  street_number text check (street_number is null or char_length(street_number) <= 20),
  complement text check (complement is null or char_length(complement) <= 80),
  district text check (district is null or char_length(district) <= 80),
  city text check (city is null or char_length(city) <= 80),
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  modality text check (modality is null or char_length(modality) <= 60),
  position text check (position is null or char_length(position) <= 60),
  sport_started_on date check (sport_started_on is null or (extract(day from sport_started_on) = 1 and sport_started_on > date '1950-01-01')),
  updated_at timestamptz not null default now(),
  check (app_private.athlete_in_org(athlete_id, org_id))
);
alter table public.athlete_details enable row level security;
grant select, insert, update on public.athlete_details to authenticated;
create policy athlete_details_select on public.athlete_details for select to authenticated using (app_private.can_access_athlete(athlete_id));
create policy athlete_details_insert on public.athlete_details for insert to authenticated with check (app_private.can_access_athlete(athlete_id));
create policy athlete_details_update on public.athlete_details for update to authenticated
  using (app_private.can_access_athlete(athlete_id)) with check (app_private.can_access_athlete(athlete_id));
create trigger athlete_details_audit after insert or update on public.athlete_details
  for each row execute function app_private.audit_project_change();

-- Corpo (dado sensível de menor): só o atleta e os responsáveis.
create table public.athlete_body (
  athlete_id uuid primary key references public.athletes (id) on delete cascade,
  height_cm int check (height_cm is null or height_cm between 80 and 250),
  weight_kg numeric(5,1) check (weight_kg is null or weight_kg between 15 and 250),
  dominant_hand text check (dominant_hand is null or dominant_hand in ('direita', 'esquerda', 'ambas')),
  show_in_cv boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.athlete_body enable row level security;
grant select, insert, update on public.athlete_body to authenticated;
create policy athlete_body_select on public.athlete_body for select to authenticated using (app_private.is_self_or_guardian(athlete_id));
create policy athlete_body_insert on public.athlete_body for insert to authenticated with check (app_private.is_self_or_guardian(athlete_id));
create policy athlete_body_update on public.athlete_body for update to authenticated
  using (app_private.is_self_or_guardian(athlete_id)) with check (app_private.is_self_or_guardian(athlete_id));

-- ---------------------------------------------------------------------
-- Currículo esportivo: itens da linha do tempo
-- ---------------------------------------------------------------------
create table public.athlete_cv_entries (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('clube', 'competicao', 'titulo', 'selecao', 'curso', 'outro')),
  title text not null check (char_length(title) between 2 and 120),
  institution text check (institution is null or char_length(institution) <= 120),
  category text check (category is null or char_length(category) <= 60),
  location text check (location is null or char_length(location) <= 120),
  started_on date not null check (extract(day from started_on) = 1),
  ended_on date check (ended_on is null or (extract(day from ended_on) = 1 and ended_on >= started_on)),
  description text check (description is null or char_length(description) <= 600),
  document_id uuid references public.athlete_documents (id) on delete set null,
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (app_private.athlete_in_org(athlete_id, org_id))
);
create index on public.athlete_cv_entries (athlete_id, started_on desc);
alter table public.athlete_cv_entries enable row level security;
grant select, insert, update, delete on public.athlete_cv_entries to authenticated;
create policy cv_select on public.athlete_cv_entries for select to authenticated using (app_private.can_access_athlete(athlete_id));
create policy cv_insert on public.athlete_cv_entries for insert to authenticated with check (app_private.can_access_athlete(athlete_id));
create policy cv_update on public.athlete_cv_entries for update to authenticated
  using (app_private.can_access_athlete(athlete_id)) with check (app_private.can_access_athlete(athlete_id));
create policy cv_delete on public.athlete_cv_entries for delete to authenticated using (app_private.can_access_athlete(athlete_id));

-- Selo "Confirmado pela entidade": só a equipe confirma (pela função); qualquer edição tira o selo.
create function app_private.guard_cv_verification() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('techpoint.verifying_cv', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.verified_by := null; new.verified_at := null;
  else
    new.verified_by := null; new.verified_at := null;
  end if;
  return new;
end; $$;
create trigger cv_verification_guard before insert or update on public.athlete_cv_entries
  for each row execute function app_private.guard_cv_verification();
create trigger cv_audit after insert or update or delete on public.athlete_cv_entries
  for each row execute function app_private.audit_project_change();

create function public.verify_cv_entry(p_entry_id uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.athlete_cv_entries where id = p_entry_id;
  if v_org is null or not app_private.is_org_staff(v_org) then raise exception 'TP_FORBIDDEN'; end if;
  perform set_config('techpoint.verifying_cv', 'on', true);
  update public.athlete_cv_entries
     set verified_by = case when p_verified then auth.uid() end,
         verified_at = case when p_verified then now() end
   where id = p_entry_id;
  perform set_config('techpoint.verifying_cv', '', true);
end; $$;
revoke all on function public.verify_cv_entry(uuid, boolean) from public, anon;
grant execute on function public.verify_cv_entry(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Currículo montado (dados digitados + o que o TechPoint já sabe)
-- ---------------------------------------------------------------------
create function app_private.build_cv(p_athlete uuid, p_include_body boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  with a as (select * from public.athletes where id = p_athlete),
  d as (select * from public.athlete_details where athlete_id = p_athlete),
  b as (select * from public.athlete_body where athlete_id = p_athlete),
  ev as (
    select e.id from public.events e
    join public.team_members tm on tm.team_id = e.team_id and tm.athlete_id = p_athlete
    where e.status <> 'canceled' and e.ends_at < now() and e.ends_at > now() - interval '12 months' and e.starts_at >= tm.created_at - interval '1 day'
  ),
  pres as (
    select count(distinct r.event_id) n from public.attendance_records r
    where r.athlete_id = p_athlete and r.kind = 'check_in' and r.status = 'valid' and r.event_id in (select id from ev)
  )
  select jsonb_build_object(
    'athlete_id', a.id,
    'full_name', a.full_name,
    'age', extract(year from age(current_date, a.birth_date))::int,
    'org', (select o.name from public.organizations o where o.id = a.org_id),
    'modality', d.modality, 'position', d.position, 'sport_started_on', d.sport_started_on,
    'body', case when p_include_body or coalesce(b.show_in_cv, false)
                 then jsonb_build_object('height_cm', b.height_cm, 'weight_kg', b.weight_kg, 'dominant_hand', b.dominant_hand, 'show_in_cv', coalesce(b.show_in_cv, false)) end,
    'teams', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'category', t.category, 'since', tm.created_at::date) order by tm.created_at)
                       from public.team_members tm join public.teams t on t.id = tm.team_id where tm.athlete_id = a.id), '[]'::jsonb),
    'attendance_12m', jsonb_build_object('events', (select count(*) from ev), 'present', (select n from pres),
                       'pct', case when (select count(*) from ev) > 0 then round(100.0 * (select n from pres) / (select count(*) from ev), 1) end),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'title', c.title, 'institution', c.institution,
                       'category', c.category, 'location', c.location, 'started_on', c.started_on, 'ended_on', c.ended_on,
                       'description', c.description, 'verified', c.verified_at is not null,
                       'verified_by_org', case when c.verified_at is not null then (select o.name from public.organizations o where o.id = c.org_id) end)
                       order by c.started_on desc) from public.athlete_cv_entries c where c.athlete_id = a.id), '[]'::jsonb)
  )
  from a left join d on true left join b on true;
$$;

create function public.athlete_cv(p_athlete_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.can_access_athlete(p_athlete_id) then raise exception 'TP_FORBIDDEN'; end if;
  return app_private.build_cv(p_athlete_id, app_private.is_self_or_guardian(p_athlete_id));
end; $$;
revoke all on function public.athlete_cv(uuid) from public, anon;
grant execute on function public.athlete_cv(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Link de compartilhamento (atleta ou responsável gera; vale 90 dias; pode revogar)
-- ---------------------------------------------------------------------
create table public.athlete_cv_shares (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  revoked_at timestamptz
);
alter table public.athlete_cv_shares enable row level security;
grant select, insert, update on public.athlete_cv_shares to authenticated;
create policy cv_shares_select on public.athlete_cv_shares for select to authenticated using (app_private.is_self_or_guardian(athlete_id));
create policy cv_shares_insert on public.athlete_cv_shares for insert to authenticated
  with check (app_private.is_self_or_guardian(athlete_id) and app_private.athlete_cleared(athlete_id) and created_by = auth.uid());
create policy cv_shares_update on public.athlete_cv_shares for update to authenticated
  using (app_private.is_self_or_guardian(athlete_id)) with check (app_private.is_self_or_guardian(athlete_id));
revoke update on public.athlete_cv_shares from authenticated;
grant update (revoked_at) on public.athlete_cv_shares to authenticated;
create trigger cv_shares_audit after insert or update on public.athlete_cv_shares
  for each row execute function app_private.audit_project_change();

-- Página pública do link: só o currículo (sem CPF, endereço, documentos ou data de nascimento).
create function public.public_cv(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_athlete uuid;
begin
  select s.athlete_id into v_athlete from public.athlete_cv_shares s
  where s.token = p_token and s.revoked_at is null and s.expires_at > now();
  if v_athlete is null or not app_private.athlete_cleared(v_athlete) then return null; end if;
  return app_private.build_cv(v_athlete, false);
end; $$;
revoke all on function public.public_cv(text) from public;
grant execute on function public.public_cv(text) to anon, authenticated;
