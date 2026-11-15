-- Convocações para competições com ciência do atleta (auditoria, item 05) e
-- justificativa de falta registrada pelo atleta ou responsável (item 16).
-- Tabelas novas: o APK 0.4.0 continua funcionando.

create table public.convocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  title text not null check (length(trim(title)) between 3 and 120),
  location text check (length(location) <= 160),
  starts_on date not null,
  ends_on date,
  notes text check (length(notes) <= 1000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default false,
  check (ends_on is null or ends_on >= starts_on)
);
create table public.convocation_athletes (
  convocation_id uuid not null references public.convocations (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles (id) on delete set null,
  primary key (convocation_id, athlete_id)
);
create index on public.convocation_athletes (athlete_id);
alter table public.convocations enable row level security;
alter table public.convocation_athletes enable row level security;

create policy convocations_staff on public.convocations for all
  using (app_private.is_org_staff(org_id)) with check (app_private.is_org_staff(org_id));
create policy convocations_athlete on public.convocations for select
  using (exists (select 1 from public.convocation_athletes ca where ca.convocation_id = id and app_private.is_self_or_guardian(ca.athlete_id)));
create policy conv_athletes_staff on public.convocation_athletes for all
  using (app_private.is_org_staff(org_id)) with check (app_private.is_org_staff(org_id));
create policy conv_athletes_self on public.convocation_athletes for select
  using (app_private.is_self_or_guardian(athlete_id));

-- Ciência: só o próprio atleta ou o responsável marcam; não existe "recusar".
create or replace function public.acknowledge_convocation(p_convocation_id uuid, p_athlete_id uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v timestamptz;
begin
  if not app_private.is_self_or_guardian(p_athlete_id) then
    raise exception 'Somente o atleta convocado ou o responsável confirmam a ciência.' using errcode = '42501';
  end if;
  update public.convocation_athletes set acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by = coalesce(acknowledged_by, auth.uid())
   where convocation_id = p_convocation_id and athlete_id = p_athlete_id
  returning acknowledged_at into v;
  if v is null then raise exception 'Convocação não encontrada para este atleta.' using errcode = 'P0002'; end if;
  return v;
end; $$;
grant execute on function public.acknowledge_convocation(uuid, uuid) to authenticated;

-- Justificativa de falta (antes ou depois do treino). Uma por atleta e treino; pode ser atualizada.
create table public.absence_justifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  reason text not null check (reason in ('saude', 'escola', 'viagem', 'familia', 'outro')),
  details text check (length(details) <= 500),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, athlete_id)
);
alter table public.absence_justifications enable row level security;
create policy justif_staff_read on public.absence_justifications for select using (app_private.is_org_staff(org_id));
create policy justif_self_read on public.absence_justifications for select using (app_private.is_self_or_guardian(athlete_id));
create policy justif_self_write on public.absence_justifications for insert
  with check (app_private.is_self_or_guardian(athlete_id) and created_by = auth.uid()
    and exists (select 1 from public.events e join public.team_members tm on tm.team_id = e.team_id
                where e.id = event_id and e.org_id = absence_justifications.org_id and tm.athlete_id = absence_justifications.athlete_id));
create policy justif_self_update on public.absence_justifications for update
  using (app_private.is_self_or_guardian(athlete_id)) with check (app_private.is_self_or_guardian(athlete_id));

-- Convocação de teste (fictícia): Taça Brasília, DF Vôlei Sub 17 Masculino.
do $$
declare v_conv uuid; v_team uuid;
begin
  select t.id into v_team from public.teams t where t.org_id = '00000000-0000-4000-8000-000000000001' and t.name ilike 'Sub 17 Masculino' limit 1;
  if v_team is null or exists (select 1 from public.convocations where title = 'Taça Brasília (teste)') then return; end if;
  insert into public.convocations (org_id, team_id, title, location, starts_on, ends_on, notes, is_demo)
  values ('00000000-0000-4000-8000-000000000001', v_team, 'Taça Brasília (teste)', 'Ginásio Nilson Nelson, Brasília - DF',
          current_date + 14, current_date + 15, 'Convocação de teste. Concentração 1 hora antes do primeiro jogo, com uniforme completo.', true)
  returning id into v_conv;
  insert into public.convocation_athletes (convocation_id, athlete_id, org_id)
  select v_conv, tm.athlete_id, '00000000-0000-4000-8000-000000000001' from public.team_members tm where tm.team_id = v_team;
end $$;
