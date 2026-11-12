-- =====================================================================
-- TechPoint — Migração 1: estrutura base, funções de acesso e RLS
-- =====================================================================
-- Regra de ouro: toda tabela tem Row Level Security (RLS) ligada.
-- Quem não tem política que permita, não vê nem altera nada.
-- =====================================================================

create schema if not exists app_private;
grant usage on schema app_private to authenticated;

-- ---------------------------------------------------------------------
-- Organizações
-- ---------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  photo_retention_months int not null default 12 check (photo_retention_months between 1 and 60),
  checkin_before_min int not null default 30 check (checkin_before_min between 0 and 240),
  checkin_after_min int not null default 30 check (checkin_after_min between 0 and 240),
  checkout_after_min int not null default 60 check (checkout_after_min between 0 and 480),
  offline_max_hours int not null default 24 check (offline_max_hours between 1 and 168),
  default_radius_m int not null default 150 check (default_radius_m between 20 and 2000),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Perfis (1 por conta de login)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- E-mails que viram administradores da plataforma no primeiro login.
-- Fica no schema privado: não é acessível pelo app.
create table app_private.platform_admin_emails (
  email text primary key
);

-- ---------------------------------------------------------------------
-- Vínculo pessoa ↔ organização ↔ papel
-- ---------------------------------------------------------------------
create type public.org_role as enum ('manager', 'coach', 'athlete', 'guardian');

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  invited_email text check (invited_email is null or invited_email = lower(invited_email)),
  role public.org_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (profile_id is not null or invited_email is not null),
  unique (org_id, profile_id, role),
  unique (org_id, invited_email, role)
);
create index on public.memberships (profile_id);

-- ---------------------------------------------------------------------
-- Estrutura esportiva
-- ---------------------------------------------------------------------
create table public.sports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade, -- nulo = esporte global
  name text not null,
  evaluation_criteria jsonb not null default '[]'::jsonb,
  stat_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  address text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_m int not null default 150 check (radius_m between 20 and 2000),
  active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.venues (org_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  sport_id uuid references public.sports (id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  category text,
  season text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.teams (org_id);

create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null, -- atleta pode não ter conta
  full_name text not null check (char_length(full_name) between 2 and 120),
  birth_date date not null check (birth_date > date '1900-01-01'),
  email text check (email is null or email = lower(email)),
  avatar_path text,
  status text not null default 'active' check (status in ('pending_consent', 'active', 'inactive')),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, profile_id)
);
create index on public.athletes (org_id);
create index on public.athletes (profile_id);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  jersey_number int check (jersey_number between 0 and 999),
  position text,
  created_at timestamptz not null default now(),
  primary key (team_id, athlete_id)
);
create index on public.team_members (athlete_id);

create table public.team_staff (
  team_id uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'head_coach' check (role in ('head_coach', 'assistant')),
  created_at timestamptz not null default now(),
  primary key (team_id, profile_id)
);

-- ---------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete restrict,
  type text not null default 'training' check (type in ('training', 'match')),
  title text,
  opponent text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'canceled')),
  series_id uuid,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.events (org_id, starts_at);
create index on public.events (team_id, starts_at);

-- ---------------------------------------------------------------------
-- Presença: 1 registro por ação (check-in OU check-out)
-- ---------------------------------------------------------------------
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  kind text not null check (kind in ('check_in', 'check_out')),
  server_at timestamptz not null default now(),   -- hora do servidor (fonte da verdade)
  client_at timestamptz,                          -- hora do aparelho (informativa / offline)
  synced_offline boolean not null default false,
  latitude double precision,
  longitude double precision,
  accuracy_m real,
  distance_m real,                                -- calculada no servidor
  photo_path text,
  photo_sha256 text,
  source text not null check (source in ('app', 'manual')),
  manual_reason text,
  recorded_by uuid references public.profiles (id) on delete set null,
  status text not null check (status in ('valid', 'pending', 'rejected')),
  justification text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  device_id text,
  is_mocked_location boolean not null default false,
  flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  check (source <> 'manual' or (manual_reason is not null and char_length(manual_reason) >= 3))
);
-- Só um check-in (e um check-out) "vivo" por atleta e evento.
create unique index attendance_one_per_kind
  on public.attendance_records (event_id, athlete_id, kind)
  where status <> 'rejected';
create index on public.attendance_records (athlete_id, server_at desc);
create index on public.attendance_records (photo_sha256);
create index on public.attendance_records (device_id);

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  org_id uuid,
  action text not null,
  table_name text,
  record_id text,
  details jsonb not null default '{}'::jsonb
);
create index on public.audit_log (org_id, at desc);

-- =====================================================================
-- Funções de apoio às regras de acesso (rodam com privilégio elevado,
-- mas só leem; ficam num schema não exposto pela API).
-- =====================================================================
create function app_private.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_platform_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create function app_private.has_org_role(p_org uuid, p_roles public.org_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.profile_id = auth.uid() and m.active and m.role = any (p_roles)
  );
$$;

create function app_private.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_platform_admin() or exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.profile_id = auth.uid() and m.active
  );
$$;

-- Gestor ou treinador (ou admin da plataforma)
create function app_private.is_org_staff(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_platform_admin()
      or app_private.has_org_role(p_org, array['manager', 'coach']::public.org_role[]);
$$;

create function app_private.is_org_manager(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_platform_admin()
      or app_private.has_org_role(p_org, array['manager']::public.org_role[]);
$$;

-- Atletas ligados à conta logada
create function app_private.my_athlete_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select a.id from public.athletes a where a.profile_id = auth.uid();
$$;

-- A conta logada é atleta de alguma equipe deste time?
create function app_private.is_team_athlete(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members tm
    join public.athletes a on a.id = tm.athlete_id
    where tm.team_id = p_team and a.profile_id = auth.uid() and a.status = 'active'
  );
$$;

-- O perfil alvo pertence a uma organização onde eu sou gestor/treinador?
create function app_private.can_see_profile(p_profile uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships target
    join public.memberships me on me.org_id = target.org_id
    where target.profile_id = p_profile
      and me.profile_id = auth.uid() and me.active
      and me.role in ('manager', 'coach')
  );
$$;

grant execute on all functions in schema app_private to authenticated;

-- =====================================================================
-- Ligação automática por e-mail
-- Quando alguém entra pela 1ª vez, o perfil é criado e os convites
-- (memberships por e-mail) e o cadastro de atleta com o mesmo e-mail
-- são vinculados à conta. Atleta só é vinculado com 10 anos ou mais.
-- =====================================================================
create function app_private.link_profile_by_email(p_profile uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email is null or v_email = '' then return; end if;

  update public.memberships
     set profile_id = p_profile
   where invited_email = v_email and profile_id is null
     and not exists (
       select 1 from public.memberships m2
       where m2.org_id = memberships.org_id and m2.profile_id = p_profile and m2.role = memberships.role
     );

  update public.athletes a
     set profile_id = p_profile
   where a.email = v_email and a.profile_id is null
     and a.birth_date <= (current_date - interval '10 years')
     and not exists (select 1 from public.athletes a2 where a2.org_id = a.org_id and a2.profile_id = p_profile);

  -- Atleta vinculado ganha o papel "athlete" na organização.
  insert into public.memberships (org_id, profile_id, role)
  select a.org_id, p_profile, 'athlete'
    from public.athletes a
   where a.profile_id = p_profile
  on conflict do nothing;
end;
$$;

create function app_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, is_platform_admin)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    exists (select 1 from app_private.platform_admin_emails e where e.email = lower(new.email))
  );
  perform app_private.link_profile_by_email(new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- Se o gestor cadastrar um atleta/convite com e-mail de quem já tem conta,
-- o vínculo acontece na hora.
create function app_private.link_existing_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_profile uuid;
begin
  if tg_table_name = 'athletes' then v_email := new.email; else v_email := new.invited_email; end if;
  if v_email is null then return null; end if;
  select p.id into v_profile from public.profiles p where p.email = v_email;
  if v_profile is not null then
    perform app_private.link_profile_by_email(v_profile, v_email);
  end if;
  return null;
end;
$$;

create trigger athletes_link_profile
  after insert or update of email, birth_date on public.athletes
  for each row execute function app_private.link_existing_profile();

create trigger memberships_link_profile
  after insert or update of invited_email on public.memberships
  for each row when (new.profile_id is null)
  execute function app_private.link_existing_profile();

-- =====================================================================
-- Permissões de tabela (o anônimo não acessa nada)
-- =====================================================================
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Perfil: o próprio usuário só pode mudar nome e foto.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- Atleta: o vínculo com a conta (profile_id) só é feito pelo sistema.
revoke insert, update on public.athletes from authenticated;
grant insert (org_id, full_name, birth_date, email, avatar_path, status) on public.athletes to authenticated;
grant update (full_name, birth_date, email, avatar_path, status) on public.athletes to authenticated;

-- Presença e auditoria: só pelas funções do servidor.
revoke insert, update, delete on public.attendance_records from authenticated;
revoke insert, update, delete on public.audit_log from authenticated;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.organizations      enable row level security;
alter table public.profiles           enable row level security;
alter table public.memberships        enable row level security;
alter table public.sports             enable row level security;
alter table public.venues             enable row level security;
alter table public.teams              enable row level security;
alter table public.athletes           enable row level security;
alter table public.team_members       enable row level security;
alter table public.team_staff         enable row level security;
alter table public.events             enable row level security;
alter table public.attendance_records enable row level security;
alter table public.audit_log          enable row level security;

-- Organizações
create policy org_select on public.organizations for select to authenticated
  using (app_private.is_org_member(id));
create policy org_insert on public.organizations for insert to authenticated
  with check (app_private.is_platform_admin());
create policy org_update on public.organizations for update to authenticated
  using (app_private.is_org_manager(id)) with check (app_private.is_org_manager(id));
create policy org_delete on public.organizations for delete to authenticated
  using (app_private.is_platform_admin());

-- Perfis
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or app_private.is_platform_admin() or app_private.can_see_profile(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Vínculos (papéis)
create policy memberships_select on public.memberships for select to authenticated
  using (profile_id = auth.uid() or app_private.is_org_staff(org_id));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (app_private.is_org_manager(org_id));
create policy memberships_update on public.memberships for update to authenticated
  using (app_private.is_org_manager(org_id)) with check (app_private.is_org_manager(org_id));
create policy memberships_delete on public.memberships for delete to authenticated
  using (app_private.is_org_manager(org_id));

-- Esportes (globais são visíveis a todos os logados)
create policy sports_select on public.sports for select to authenticated
  using (org_id is null or app_private.is_org_member(org_id));
create policy sports_write on public.sports for all to authenticated
  using (org_id is not null and app_private.is_org_manager(org_id))
  with check (org_id is not null and app_private.is_org_manager(org_id));

-- Locais
create policy venues_select on public.venues for select to authenticated
  using (app_private.is_org_member(org_id));
create policy venues_write on public.venues for all to authenticated
  using (app_private.is_org_manager(org_id)) with check (app_private.is_org_manager(org_id));

-- Equipes
create policy teams_select on public.teams for select to authenticated
  using (app_private.is_org_member(org_id));
create policy teams_write on public.teams for all to authenticated
  using (app_private.is_org_manager(org_id)) with check (app_private.is_org_manager(org_id));

-- Atletas: gestor/treinador veem a organização; o atleta vê só a si mesmo.
create policy athletes_select on public.athletes for select to authenticated
  using (app_private.is_org_staff(org_id) or profile_id = auth.uid());
create policy athletes_insert on public.athletes for insert to authenticated
  with check (app_private.is_org_staff(org_id));
create policy athletes_update on public.athletes for update to authenticated
  using (app_private.is_org_staff(org_id)) with check (app_private.is_org_staff(org_id));
create policy athletes_delete on public.athletes for delete to authenticated
  using (app_private.is_org_manager(org_id));

-- Elenco das equipes
create policy team_members_select on public.team_members for select to authenticated
  using (
    exists (select 1 from public.teams t where t.id = team_id and app_private.is_org_staff(t.org_id))
    or athlete_id in (select app_private.my_athlete_ids())
  );
create policy team_members_write on public.team_members for all to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and app_private.is_org_staff(t.org_id)))
  with check (
    exists (
      select 1 from public.teams t join public.athletes a on a.org_id = t.org_id
      where t.id = team_id and a.id = athlete_id and app_private.is_org_staff(t.org_id)
    )
  );

-- Comissão técnica
create policy team_staff_select on public.team_staff for select to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and app_private.is_org_member(t.org_id)));
create policy team_staff_write on public.team_staff for all to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and app_private.is_org_manager(t.org_id)))
  with check (exists (select 1 from public.teams t where t.id = team_id and app_private.is_org_manager(t.org_id)));

-- Eventos: staff vê tudo da organização; atleta vê os da sua equipe.
create policy events_select on public.events for select to authenticated
  using (app_private.is_org_staff(org_id) or app_private.is_team_athlete(team_id));
create policy events_write on public.events for all to authenticated
  using (app_private.is_org_staff(org_id))
  with check (
    app_private.is_org_staff(org_id)
    and exists (select 1 from public.teams t where t.id = team_id and t.org_id = events.org_id)
    and exists (select 1 from public.venues v where v.id = venue_id and v.org_id = events.org_id)
  );

-- Presença: staff vê a organização; atleta vê só os próprios registros.
create policy attendance_select on public.attendance_records for select to authenticated
  using (app_private.is_org_staff(org_id) or athlete_id in (select app_private.my_athlete_ids()));

-- Auditoria: só gestor da organização e admin da plataforma.
create policy audit_select on public.audit_log for select to authenticated
  using (app_private.is_platform_admin() or (org_id is not null and app_private.is_org_manager(org_id)));
