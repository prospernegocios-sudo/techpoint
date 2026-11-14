-- Fase 2: convite do atleta por link, pedido de entrada aprovado pelo treinador, responsáveis
-- e consentimento LGPD (D37, D63–D65). Atleta menor de 18 anos sem consentimento ativo não
-- tem presença registrada nem aparece nos relatórios.

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  active boolean not null default true,
  expires_at timestamptz not null default now() + interval '60 days',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.team_invites (team_id);

create table public.athlete_join_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  invite_id uuid references public.team_invites (id) on delete set null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 3 and 120),
  birth_date date not null,
  guardian_name text check (char_length(guardian_name) <= 120),
  guardian_phone text check (guardian_phone is null or guardian_phone ~ '^\d{10,11}$'),
  guardian_email text check (guardian_email is null or guardian_email = lower(guardian_email)),
  guardian_relationship text check (char_length(guardian_relationship) <= 40),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  athlete_id uuid references public.athletes (id) on delete set null,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index join_one_pending on public.athlete_join_requests (team_id, profile_id) where status = 'pending';
create index on public.athlete_join_requests (org_id, status);

create table public.athlete_guardians (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,          -- preenchido quando o responsável aceita
  name text check (char_length(name) <= 120),
  phone text check (phone is null or phone ~ '^\d{10,11}$'),
  email text check (email is null or email = lower(email)),
  relationship text check (char_length(relationship) <= 40),                 -- mãe, pai, responsável legal...
  token text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  status text not null default 'invited' check (status in ('invited', 'active', 'revoked')),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index on public.athlete_guardians (athlete_id);
create index on public.athlete_guardians (profile_id);
create unique index guardian_once on public.athlete_guardians (athlete_id, profile_id) where profile_id is not null and status <> 'revoked';

-- Consentimento: pelo app (responsável) ou em papel (registrado pela equipe, com motivo).
create table public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  guardian_profile_id uuid references public.profiles (id) on delete set null,
  source text not null default 'app' check (source in ('app', 'paper')),
  terms_version text not null,
  scope jsonb not null default '{}'::jsonb,       -- ex.: {"photos":true,"sponsors":true,"notifications":true}
  note text check (char_length(note) <= 500),
  recorded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  check (source = 'paper' or guardian_profile_id is not null)
);
create index on public.guardian_consents (athlete_id);

-- ---------------------------------------------------------------------
-- Regras auxiliares
-- ---------------------------------------------------------------------
create function app_private.athlete_is_minor(p_athlete uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select a.birth_date > (current_date - interval '18 years')::date from public.athletes a where a.id = p_athlete), false);
$$;

create function app_private.athlete_has_consent(p_athlete uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.guardian_consents c where c.athlete_id = p_athlete and c.revoked_at is null);
$$;

-- Pode ter os dados usados? Maior de idade, ou menor com consentimento ativo.
create function app_private.athlete_cleared(p_athlete uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not app_private.athlete_is_minor(p_athlete) or app_private.athlete_has_consent(p_athlete);
$$;

create function app_private.my_guarded_athlete_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select g.athlete_id from public.athlete_guardians g where g.profile_id = auth.uid() and g.status = 'active';
$$;

grant execute on function app_private.athlete_is_minor(uuid), app_private.athlete_has_consent(uuid),
  app_private.athlete_cleared(uuid), app_private.my_guarded_athlete_ids() to authenticated;

-- Presença de menor sem consentimento é recusada (no app e na presença manual).
create function app_private.require_consent() returns trigger language plpgsql set search_path = '' as $$
begin
  if not app_private.athlete_cleared(new.athlete_id) then
    raise exception 'TP_CONSENT_REQUIRED';
  end if;
  return new;
end; $$;
create trigger attendance_require_consent before insert on public.attendance_records
  for each row execute function app_private.require_consent();

-- ---------------------------------------------------------------------
-- Permissões e visibilidade
-- ---------------------------------------------------------------------
revoke all on public.team_invites, public.athlete_join_requests, public.athlete_guardians, public.guardian_consents from anon;
revoke insert, update, delete on public.athlete_join_requests, public.guardian_consents from authenticated;
revoke update on public.athlete_guardians from authenticated;
grant update (status) on public.athlete_guardians to authenticated;

alter table public.team_invites enable row level security;
alter table public.athlete_join_requests enable row level security;
alter table public.athlete_guardians enable row level security;
alter table public.guardian_consents enable row level security;

create policy invites_select on public.team_invites for select to authenticated using (app_private.is_org_staff(org_id));
create policy invites_write on public.team_invites for all to authenticated
  using (app_private.is_org_staff(org_id))
  with check (app_private.is_org_staff(org_id) and exists (select 1 from public.teams t where t.id = team_id and t.org_id = team_invites.org_id));

create policy join_select on public.athlete_join_requests for select to authenticated
  using (app_private.is_org_staff(org_id) or profile_id = auth.uid());

create policy guardians_select on public.athlete_guardians for select to authenticated
  using (app_private.is_org_staff(org_id) or profile_id = auth.uid() or athlete_id in (select app_private.my_athlete_ids()));
create policy guardians_insert on public.athlete_guardians for insert to authenticated
  with check (
    status = 'invited' and profile_id is null
    and exists (select 1 from public.athletes a where a.id = athlete_id and a.org_id = athlete_guardians.org_id)
    and (app_private.is_org_staff(org_id) or athlete_id in (select app_private.my_athlete_ids()))
  );
-- Só a equipe revoga um vínculo (status = 'revoked').
create policy guardians_update on public.athlete_guardians for update to authenticated
  using (app_private.is_org_staff(org_id)) with check (app_private.is_org_staff(org_id) and status = 'revoked');

create policy consents_select on public.guardian_consents for select to authenticated
  using (app_private.is_org_staff(org_id) or guardian_profile_id = auth.uid() or athlete_id in (select app_private.my_athlete_ids()));

-- Responsável vê o filho, a equipe, os treinos e a presença do filho.
create policy athletes_select_guardian on public.athletes for select to authenticated
  using (id in (select app_private.my_guarded_athlete_ids()));
create policy team_members_select_guardian on public.team_members for select to authenticated
  using (athlete_id in (select app_private.my_guarded_athlete_ids()));
create policy events_select_guardian on public.events for select to authenticated
  using (exists (select 1 from public.team_members tm where tm.team_id = events.team_id and tm.athlete_id in (select app_private.my_guarded_athlete_ids())));
create policy attendance_select_guardian on public.attendance_records for select to authenticated
  using (athlete_id in (select app_private.my_guarded_athlete_ids()));

create trigger invites_audit after insert or update on public.team_invites for each row execute function app_private.audit_project_change();
create trigger join_audit after insert or update on public.athlete_join_requests for each row execute function app_private.audit_project_change();
create trigger guardians_audit after insert or update on public.athlete_guardians for each row execute function app_private.audit_project_change();
create trigger consents_audit after insert or update on public.guardian_consents for each row execute function app_private.audit_project_change();

-- ---------------------------------------------------------------------
-- Funções do fluxo
-- ---------------------------------------------------------------------
-- Dados públicos mínimos de um convite (para a página do link, antes do login).
create function public.invite_info(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('team', t.name, 'org', o.name, 'logo_path', o.logo_path,
                            'theme_primary', o.theme_primary, 'theme_accent', o.theme_accent,
                            'valid', i.active and i.expires_at > now())
  from public.team_invites i join public.teams t on t.id = i.team_id join public.organizations o on o.id = i.org_id
  where i.token = p_token;
$$;

-- Atleta pede para entrar no time pelo link.
create function public.request_to_join(p_token text, p_full_name text, p_birth_date date, p_guardian jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_inv public.team_invites; v_id uuid;
begin
  if v_uid is null then raise exception 'TP_NOT_AUTHENTICATED'; end if;
  select * into v_inv from public.team_invites where token = p_token;
  if not found or not v_inv.active or v_inv.expires_at < now() then raise exception 'TP_INVITE_INVALID'; end if;
  if p_birth_date is null or p_birth_date > (current_date - interval '10 years')::date then raise exception 'TP_TOO_YOUNG'; end if;
  if char_length(coalesce(trim(p_full_name), '')) < 3 then raise exception 'TP_NAME_REQUIRED'; end if;
  if exists (select 1 from public.team_members tm join public.athletes a on a.id = tm.athlete_id
             where tm.team_id = v_inv.team_id and a.profile_id = v_uid) then raise exception 'TP_ALREADY_MEMBER'; end if;
  -- Menor de idade precisa informar o responsável.
  if p_birth_date > (current_date - interval '18 years')::date
     and coalesce(nullif(trim(p_guardian->>'phone'), ''), nullif(trim(p_guardian->>'email'), '')) is null then
    raise exception 'TP_GUARDIAN_REQUIRED';
  end if;
  insert into public.athlete_join_requests (org_id, team_id, invite_id, profile_id, full_name, birth_date,
      guardian_name, guardian_phone, guardian_email, guardian_relationship)
  values (v_inv.org_id, v_inv.team_id, v_inv.id, v_uid, trim(p_full_name), p_birth_date,
      nullif(trim(p_guardian->>'name'), ''), nullif(regexp_replace(coalesce(p_guardian->>'phone', ''), '\D', '', 'g'), ''),
      nullif(lower(trim(p_guardian->>'email')), ''), nullif(trim(p_guardian->>'relationship'), ''))
  returning id into v_id;
  return jsonb_build_object('request_id', v_id);
exception when unique_violation then raise exception 'TP_REQUEST_EXISTS';
end; $$;

-- Treinador aprova (cria ou liga o cadastro) ou recusa o pedido.
create function public.decide_join_request(p_request_id uuid, p_approve boolean, p_link_athlete_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_req public.athlete_join_requests; v_ath uuid; v_email text; v_token text;
begin
  select * into v_req from public.athlete_join_requests where id = p_request_id;
  if not found or not app_private.is_org_staff(v_req.org_id) then raise exception 'TP_FORBIDDEN'; end if;
  if v_req.status <> 'pending' then raise exception 'TP_ALREADY_DECIDED'; end if;
  if not p_approve then
    update public.athlete_join_requests set status = 'rejected', decided_by = v_uid, decided_at = now() where id = p_request_id;
    return jsonb_build_object('status', 'rejected');
  end if;
  select email into v_email from public.profiles where id = v_req.profile_id;
  if p_link_athlete_id is not null then
    update public.athletes set profile_id = v_req.profile_id
     where id = p_link_athlete_id and org_id = v_req.org_id and profile_id is null
    returning id into v_ath;
    if v_ath is null then raise exception 'TP_LINK_INVALID'; end if;
  else
    insert into public.athletes (org_id, full_name, birth_date, email, profile_id, status, created_by)
    values (v_req.org_id, v_req.full_name, v_req.birth_date, v_email, v_req.profile_id,
            case when v_req.birth_date > (current_date - interval '18 years')::date then 'pending_consent' else 'active' end, v_uid)
    returning id into v_ath;
  end if;
  insert into public.team_members (team_id, athlete_id) values (v_req.team_id, v_ath) on conflict do nothing;
  insert into public.memberships (org_id, profile_id, role) values (v_req.org_id, v_req.profile_id, 'athlete') on conflict do nothing;
  if coalesce(v_req.guardian_phone, v_req.guardian_email) is not null then
    insert into public.athlete_guardians (org_id, athlete_id, name, phone, email, relationship, created_by)
    values (v_req.org_id, v_ath, v_req.guardian_name, v_req.guardian_phone, v_req.guardian_email, v_req.guardian_relationship, v_uid)
    returning token into v_token;
  end if;
  update public.athlete_join_requests set status = 'approved', athlete_id = v_ath, decided_by = v_uid, decided_at = now() where id = p_request_id;
  return jsonb_build_object('status', 'approved', 'athlete_id', v_ath, 'guardian_token', v_token);
end; $$;

-- Dados mínimos do convite de responsável (para a página do link).
create function public.guardian_invite_info(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('athlete_first_name', split_part(a.full_name, ' ', 1), 'org', o.name, 'logo_path', o.logo_path,
                            'status', g.status, 'minor', app_private.athlete_is_minor(a.id))
  from public.athlete_guardians g join public.athletes a on a.id = g.athlete_id join public.organizations o on o.id = g.org_id
  where g.token = p_token;
$$;

-- Responsável aceita o convite e fica ligado ao atleta.
create function public.accept_guardian_invite(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_g public.athlete_guardians;
begin
  if v_uid is null then raise exception 'TP_NOT_AUTHENTICATED'; end if;
  select * into v_g from public.athlete_guardians where token = p_token;
  if not found or v_g.status = 'revoked' then raise exception 'TP_INVITE_INVALID'; end if;
  if exists (select 1 from public.athletes a where a.id = v_g.athlete_id and a.profile_id = v_uid) then raise exception 'TP_GUARDIAN_SELF'; end if;
  if v_g.status = 'active' and v_g.profile_id <> v_uid then raise exception 'TP_INVITE_USED'; end if;
  if exists (select 1 from public.athlete_guardians x where x.athlete_id = v_g.athlete_id and x.profile_id = v_uid and x.status = 'active' and x.id <> v_g.id) then
    return jsonb_build_object('athlete_id', v_g.athlete_id, 'already', true);
  end if;
  update public.athlete_guardians set profile_id = v_uid, status = 'active', accepted_at = now() where id = v_g.id;
  insert into public.memberships (org_id, profile_id, role) values (v_g.org_id, v_uid, 'guardian') on conflict do nothing;
  return jsonb_build_object('athlete_id', v_g.athlete_id);
end; $$;

-- Responsável dá o consentimento (pelo app).
create function public.grant_consent(p_athlete_id uuid, p_terms_version text, p_scope jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_id uuid;
begin
  if not (p_athlete_id in (select app_private.my_guarded_athlete_ids())) then raise exception 'TP_FORBIDDEN'; end if;
  if coalesce(trim(p_terms_version), '') = '' then raise exception 'TP_TERMS_REQUIRED'; end if;
  select org_id into v_org from public.athletes where id = p_athlete_id;
  insert into public.guardian_consents (org_id, athlete_id, guardian_profile_id, source, terms_version, scope)
  values (v_org, p_athlete_id, v_uid, 'app', p_terms_version, coalesce(p_scope, '{}'::jsonb)) returning id into v_id;
  update public.athletes set status = 'active' where id = p_athlete_id and status = 'pending_consent';
  return jsonb_build_object('consent_id', v_id);
end; $$;

-- Equipe registra um consentimento assinado em papel.
create function public.record_paper_consent(p_athlete_id uuid, p_terms_version text, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_id uuid;
begin
  select org_id into v_org from public.athletes where id = p_athlete_id;
  if v_org is null or not app_private.is_org_manager(v_org) then raise exception 'TP_FORBIDDEN'; end if;
  if char_length(coalesce(trim(p_note), '')) < 5 then raise exception 'TP_REASON_REQUIRED'; end if;
  insert into public.guardian_consents (org_id, athlete_id, source, terms_version, note)
  values (v_org, p_athlete_id, 'paper', coalesce(nullif(trim(p_terms_version), ''), 'papel'), trim(p_note)) returning id into v_id;
  update public.athletes set status = 'active' where id = p_athlete_id and status = 'pending_consent';
  return jsonb_build_object('consent_id', v_id);
end; $$;

-- Responsável (ou a equipe, para o consentimento em papel) revoga.
create function public.revoke_consent(p_consent_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_c public.guardian_consents;
begin
  select * into v_c from public.guardian_consents where id = p_consent_id;
  if not found or v_c.revoked_at is not null then raise exception 'TP_FORBIDDEN'; end if;
  if not (v_c.guardian_profile_id = auth.uid() or app_private.is_org_manager(v_c.org_id)) then raise exception 'TP_FORBIDDEN'; end if;
  update public.guardian_consents set revoked_at = now(), revoked_by = auth.uid() where id = p_consent_id;
  if app_private.athlete_is_minor(v_c.athlete_id) and not app_private.athlete_has_consent(v_c.athlete_id) then
    update public.athletes set status = 'pending_consent' where id = v_c.athlete_id and status = 'active';
  end if;
end; $$;

revoke all on function public.invite_info, public.request_to_join, public.decide_join_request, public.guardian_invite_info,
  public.accept_guardian_invite, public.grant_consent, public.record_paper_consent, public.revoke_consent from public;
grant execute on function public.invite_info, public.guardian_invite_info to anon, authenticated;
grant execute on function public.request_to_join, public.decide_join_request, public.accept_guardian_invite,
  public.grant_consent, public.record_paper_consent, public.revoke_consent to authenticated;
