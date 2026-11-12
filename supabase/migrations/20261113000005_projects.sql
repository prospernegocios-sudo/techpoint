-- Módulo de projetos incentivados (decisão D46).
-- Cadeia: projeto → versão do plano aprovado → meta/indicador → atividades (treinos das equipes do projeto)
--         → beneficiários → registros de presença → relatório emitido (congelado) → retificação.
-- Leitura: gestor e treinador do clube. Escrita: gestor. Atleta não vê projetos.

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 3 and 160),
  process_number text check (char_length(process_number) <= 80),
  sphere text not null default 'federal' check (sphere in ('federal', 'estadual', 'distrital', 'municipal')),
  agency text check (char_length(agency) <= 160),          -- órgão concedente
  program text check (char_length(program) <= 160),        -- ex.: Lei de Incentivo ao Esporte
  proponent text check (char_length(proponent) <= 160),    -- entidade proponente
  starts_on date not null,
  ends_on date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  -- Regras do instrumento (quando aplicáveis): gratuidade ao beneficiário e cota mínima da rede pública.
  free_of_charge boolean not null default true,
  public_school_min_pct int check (public_school_min_pct between 0 and 100),
  notes text check (char_length(notes) <= 2000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index on public.projects (org_id);

-- Versões do plano de trabalho aprovado: nunca são alteradas nem apagadas.
create table public.project_plan_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  version int not null check (version >= 1),
  approved_on date,
  description text check (char_length(description) <= 1000),
  file_path text,                                          -- PDF do plano no armazenamento
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create table public.project_goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  plan_version_id uuid references public.project_plan_versions (id) on delete set null,
  code text check (char_length(code) <= 30),               -- ex.: "Meta 1"
  description text not null check (char_length(description) between 3 and 500),
  indicator text check (char_length(indicator) <= 300),
  -- Como o resultado é apurado. "manual" = lançado pelo gestor com evidência.
  kind text not null check (kind in ('unique_beneficiaries', 'attendances', 'avg_frequency', 'activities_done', 'manual')),
  unit text check (char_length(unit) <= 40),
  target numeric,
  verifier text check (char_length(verifier) <= 300),      -- meio de verificação previsto no plano
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.project_goals (project_id);

-- Resultados lançados à mão (metas "manual"): só inclusão, nunca edição.
create table public.project_goal_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  goal_id uuid not null references public.project_goals (id) on delete cascade,
  value numeric not null,
  reference_date date not null,
  note text check (char_length(note) <= 1000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.project_goal_entries (goal_id, reference_date desc);

-- Equipes (núcleos/turmas) do projeto: seus treinos são as atividades do projeto.
create table public.project_teams (
  project_id uuid not null references public.projects (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, team_id)
);

-- Beneficiários: vínculo com o projeto (entrada/saída) e tipo de escola.
create table public.project_beneficiaries (
  project_id uuid not null references public.projects (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  starts_on date not null,
  ends_on date,
  end_reason text check (end_reason in ('abandono', 'lesao', 'transferencia', 'termino', 'outro')),
  school_type text not null default 'nao_informado' check (school_type in ('publica', 'privada', 'nao_informado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, athlete_id),
  check (ends_on is null or ends_on >= starts_on),
  check ((ends_on is null) = (end_reason is null))
);

-- Patrocinadores do projeto (o acesso deles chega com o painel web, decisão D47).
create table public.project_sponsors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  document text check (char_length(document) <= 30),      -- CNPJ
  contact_name text check (char_length(contact_name) <= 120),
  contact_email text check (contact_email is null or contact_email = lower(contact_email)),
  created_at timestamptz not null default now()
);
create index on public.project_sponsors (project_id);

-- Relatórios emitidos: cópia congelada dos dados + impressão digital. Correção = retificação.
create table public.project_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  number int not null,
  version int not null default 1,                          -- 1 = original; 2+ = retificações
  period_from date not null,
  period_to date not null,
  rectifies_id uuid references public.project_reports (id) on delete restrict,
  rectification_reason text,
  data jsonb not null,
  sha256 text not null,
  issued_by uuid default auth.uid() references public.profiles (id) on delete set null,
  issued_at timestamptz not null default now(),
  unique (project_id, number, version),
  check ((version = 1) = (rectifies_id is null)),
  check (rectifies_id is null or char_length(rectification_reason) >= 5)
);
create index on public.project_reports (project_id, issued_at desc);

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke all on public.projects, public.project_plan_versions, public.project_goals, public.project_goal_entries,
  public.project_teams, public.project_beneficiaries, public.project_sponsors, public.project_reports from anon;
-- Itens que não podem ser reescritos.
revoke update, delete on public.project_plan_versions from authenticated;
revoke update, delete on public.project_goal_entries from authenticated;
revoke insert, update, delete on public.project_reports from authenticated;   -- só pela função de emissão

alter table public.projects              enable row level security;
alter table public.project_plan_versions enable row level security;
alter table public.project_goals         enable row level security;
alter table public.project_goal_entries  enable row level security;
alter table public.project_teams         enable row level security;
alter table public.project_beneficiaries enable row level security;
alter table public.project_sponsors      enable row level security;
alter table public.project_reports       enable row level security;

create function app_private.project_in_org(p_project uuid, p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects p where p.id = p_project and p.org_id = p_org);
$$;

create policy projects_select on public.projects for select to authenticated using (app_private.is_org_staff(org_id));
create policy projects_write on public.projects for all to authenticated
  using (app_private.is_org_manager(org_id)) with check (app_private.is_org_manager(org_id));

create policy plan_select on public.project_plan_versions for select to authenticated using (app_private.is_org_staff(org_id));
create policy plan_insert on public.project_plan_versions for insert to authenticated
  with check (app_private.is_org_manager(org_id) and app_private.project_in_org(project_id, org_id));

create policy goals_select on public.project_goals for select to authenticated using (app_private.is_org_staff(org_id));
create policy goals_write on public.project_goals for all to authenticated
  using (app_private.is_org_manager(org_id))
  with check (app_private.is_org_manager(org_id) and app_private.project_in_org(project_id, org_id)
    and (plan_version_id is null or exists (select 1 from public.project_plan_versions v where v.id = plan_version_id and v.project_id = project_goals.project_id)));

create policy goal_entries_select on public.project_goal_entries for select to authenticated using (app_private.is_org_staff(org_id));
create policy goal_entries_insert on public.project_goal_entries for insert to authenticated
  with check (app_private.is_org_manager(org_id)
    and exists (select 1 from public.project_goals g where g.id = goal_id and g.org_id = project_goal_entries.org_id and g.kind = 'manual'));

create policy project_teams_select on public.project_teams for select to authenticated using (app_private.is_org_staff(org_id));
create policy project_teams_write on public.project_teams for all to authenticated
  using (app_private.is_org_manager(org_id))
  with check (app_private.is_org_manager(org_id) and app_private.project_in_org(project_id, org_id)
    and exists (select 1 from public.teams t where t.id = team_id and t.org_id = project_teams.org_id));

create policy beneficiaries_select on public.project_beneficiaries for select to authenticated using (app_private.is_org_staff(org_id));
create policy beneficiaries_write on public.project_beneficiaries for all to authenticated
  using (app_private.is_org_manager(org_id))
  with check (app_private.is_org_manager(org_id) and app_private.project_in_org(project_id, org_id)
    and exists (select 1 from public.athletes a where a.id = athlete_id and a.org_id = project_beneficiaries.org_id));

create policy sponsors_select on public.project_sponsors for select to authenticated using (app_private.is_org_staff(org_id));
create policy sponsors_write on public.project_sponsors for all to authenticated
  using (app_private.is_org_manager(org_id))
  with check (app_private.is_org_manager(org_id) and app_private.project_in_org(project_id, org_id));

create policy reports_select on public.project_reports for select to authenticated using (app_private.is_org_staff(org_id));

-- Data de atualização automática.
create function app_private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
create trigger projects_touch before update on public.projects for each row execute function app_private.touch_updated_at();
create trigger beneficiaries_touch before update on public.project_beneficiaries for each row execute function app_private.touch_updated_at();

-- Auditoria das mudanças em projetos (quem mudou o quê).
create function app_private.audit_project_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_row jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (actor_id, org_id, action, table_name, record_id, details)
  values (auth.uid(), (v_row->>'org_id')::uuid, lower(tg_op), tg_table_name,
          coalesce(v_row->>'id', v_row->>'project_id'),
          case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
               else jsonb_build_object('row', v_row) end);
  return coalesce(new, old);
end; $$;
create trigger projects_audit after insert or update or delete on public.projects for each row execute function app_private.audit_project_change();
create trigger plan_audit after insert on public.project_plan_versions for each row execute function app_private.audit_project_change();
create trigger goals_audit after insert or update or delete on public.project_goals for each row execute function app_private.audit_project_change();
create trigger goal_entries_audit after insert on public.project_goal_entries for each row execute function app_private.audit_project_change();
create trigger project_teams_audit after insert or delete on public.project_teams for each row execute function app_private.audit_project_change();
create trigger beneficiaries_audit after insert or update or delete on public.project_beneficiaries for each row execute function app_private.audit_project_change();
create trigger sponsors_audit after insert or update or delete on public.project_sponsors for each row execute function app_private.audit_project_change();

-- ---------------------------------------------------------------------
-- Indicadores e retrato completo do projeto num período
-- ---------------------------------------------------------------------
-- Regras de cálculo (pesquisa regulatória R03–R06, R10, R11):
--  * atividade = treino de equipe do projeto, não cancelado, já encerrado, dentro do período e da vigência;
--  * beneficiário conta numa atividade se estava vinculado ao projeto naquele dia e é da equipe do treino;
--  * presença = check-in "valid" (no raio, aprovado pelo treinador ou manual com motivo); pendente não conta;
--  * frequência = presenças ÷ atividades elegíveis; sem atividades = "não aplicável" (null);
--  * beneficiário único = pessoa com ao menos uma presença; atendimento = cada presença.
create function app_private.project_snapshot(p_project_id uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text := 'America/Sao_Paulo';
  v_p public.projects;
  v_from date; v_to date;
  v_result jsonb;
begin
  select * into v_p from public.projects where id = p_project_id;
  if not found then raise exception 'TP_PROJECT_NOT_FOUND'; end if;
  v_from := greatest(p_from, v_p.starts_on);
  v_to := least(p_to, v_p.ends_on);

  with
  tms as (
    select t.id, t.name, t.category from public.project_teams pt join public.teams t on t.id = pt.team_id
    where pt.project_id = v_p.id
  ),
  evs_all as (
    select e.*, (e.starts_at at time zone v_tz)::date as day,
           v.name as venue_name, v.latitude as venue_lat, v.longitude as venue_lng, v.radius_m as venue_radius
    from public.events e join tms on tms.id = e.team_id join public.venues v on v.id = e.venue_id
    where (e.starts_at at time zone v_tz)::date between v_from and v_to
  ),
  evs as (select * from evs_all where status = 'scheduled' and ends_at <= now()),
  ben as (
    select b.*, a.full_name from public.project_beneficiaries b join public.athletes a on a.id = b.athlete_id
    where b.project_id = v_p.id and b.starts_on <= v_to and (b.ends_on is null or b.ends_on >= v_from)
  ),
  elig as (   -- pares beneficiário × atividade elegível
    select b.athlete_id, e.id as event_id, e.team_id
    from ben b
    join public.team_members tm on tm.athlete_id = b.athlete_id
    join evs e on e.team_id = tm.team_id
    where e.day >= b.starts_on and (b.ends_on is null or e.day <= b.ends_on)
  ),
  recs as (
    select r.*, app_private.attendance_code(r) as code,
           rb.full_name as recorded_by_name, rv.full_name as reviewed_by_name
    from public.attendance_records r
    join elig on elig.event_id = r.event_id and elig.athlete_id = r.athlete_id
    left join public.profiles rb on rb.id = r.recorded_by
    left join public.profiles rv on rv.id = r.reviewed_by
    where r.status <> 'rejected'
  ),
  per_ben as (
    select b.athlete_id, b.full_name, b.starts_on, b.ends_on, b.end_reason, b.school_type,
      (select count(*) from elig where elig.athlete_id = b.athlete_id)::int as eligible,
      (select count(*) from recs where recs.athlete_id = b.athlete_id and recs.kind = 'check_in' and recs.status = 'valid')::int as present,
      (select count(*) from recs where recs.athlete_id = b.athlete_id and recs.kind = 'check_in' and recs.status = 'pending')::int as pending
    from ben b
  ),
  totals as (
    select
      (select count(*) from evs)::int as activities_done,
      (select count(*) from evs_all where status = 'canceled')::int as activities_canceled,
      (select count(*) from evs_all where status = 'scheduled' and ends_at > now())::int as activities_upcoming,
      (select count(*) from per_ben)::int as beneficiaries_enrolled,
      (select count(*) from per_ben where present > 0)::int as unique_beneficiaries,
      (select coalesce(sum(present), 0) from per_ben)::int as attendances,
      (select coalesce(sum(eligible), 0) from per_ben)::int as eligible_total,
      (select coalesce(sum(pending), 0) from per_ben)::int as pending_total,
      (select count(*) from per_ben where school_type = 'publica')::int as school_public,
      (select count(*) from per_ben where school_type = 'privada')::int as school_private,
      (select count(*) from per_ben where school_type = 'nao_informado')::int as school_unknown
  ),
  ind as (
    select t.*,
      case when eligible_total > 0 then round(100.0 * attendances / eligible_total, 1) end as avg_frequency_pct,
      case when beneficiaries_enrolled > 0 then round(100.0 * school_public / beneficiaries_enrolled, 1) end as public_school_pct
    from totals t
  ),
  goals as (
    select g.*,
      case g.kind
        when 'unique_beneficiaries' then (select unique_beneficiaries from ind)::numeric
        when 'attendances' then (select attendances from ind)::numeric
        when 'avg_frequency' then (select avg_frequency_pct from ind)
        when 'activities_done' then (select activities_done from ind)::numeric
        else (select ge.value from public.project_goal_entries ge where ge.goal_id = g.id and ge.reference_date <= v_to
              order by ge.reference_date desc, ge.created_at desc limit 1)
      end as result
    from public.project_goals g where g.project_id = v_p.id and g.active
  ),
  plan as (
    select * from public.project_plan_versions where project_id = v_p.id order by version desc limit 1
  )
  select jsonb_build_object(
    'generated_at', now(),
    'timezone', v_tz,
    'period', jsonb_build_object('from', v_from, 'to', v_to, 'requested_from', p_from, 'requested_to', p_to),
    'project', to_jsonb(v_p) - 'created_by' - 'created_at' - 'updated_at',
    'org', (select jsonb_build_object('id', o.id, 'name', o.name) from public.organizations o where o.id = v_p.org_id),
    'plan', (select jsonb_build_object('id', id, 'version', version, 'approved_on', approved_on, 'description', description, 'has_file', file_path is not null) from plan),
    'indicators', (select to_jsonb(ind) from ind),
    'goals', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'code', code, 'description', description, 'indicator', indicator, 'kind', kind, 'unit', unit,
        'target', target, 'verifier', verifier, 'result', result,
        'reached', case when target is not null and result is not null then result >= target end
      ) order by code nulls last, created_at) from goals), '[]'::jsonb),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'category', category) order by name) from tms), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'team_id', team_id, 'type', type, 'title', title, 'starts_at', starts_at, 'ends_at', ends_at,
        'venue', jsonb_build_object('name', venue_name, 'latitude', venue_lat, 'longitude', venue_lng, 'radius_m', venue_radius)
      ) order by starts_at) from evs), '[]'::jsonb),
    'canceled_events', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'team_id', team_id, 'starts_at', starts_at) order by starts_at)
        from evs_all where status = 'canceled'), '[]'::jsonb),
    'beneficiaries', coalesce((select jsonb_agg(jsonb_build_object(
        'athlete_id', athlete_id, 'full_name', full_name, 'starts_on', starts_on, 'ends_on', ends_on, 'end_reason', end_reason,
        'school_type', school_type, 'eligible', eligible, 'present', present, 'pending', pending,
        'frequency_pct', case when eligible > 0 then round(100.0 * present / eligible, 1) end
      ) order by full_name) from per_ben), '[]'::jsonb),
    'eligible', coalesce((select jsonb_agg(jsonb_build_object('athlete_id', athlete_id, 'event_id', event_id)) from elig), '[]'::jsonb),
    'records', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'event_id', event_id, 'athlete_id', athlete_id, 'kind', kind, 'server_at', server_at,
        'client_at', client_at, 'synced_offline', synced_offline,
        'latitude', latitude, 'longitude', longitude, 'accuracy_m', accuracy_m, 'distance_m', distance_m,
        'photo_path', photo_path, 'source', source, 'manual_reason', manual_reason, 'recorded_by_name', recorded_by_name,
        'status', status, 'justification', justification, 'reviewed_by_name', reviewed_by_name, 'reviewed_at', reviewed_at,
        'flags', flags, 'code', code
      ) order by server_at) from recs), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function app_private.project_snapshot from public, anon, authenticated;

-- Painel de indicadores (não grava nada).
create function public.project_indicators(p_project_id uuid, p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_p public.projects; v_snap jsonb;
begin
  if auth.uid() is null then raise exception 'TP_NOT_AUTHENTICATED'; end if;
  select * into v_p from public.projects where id = p_project_id;
  if not found or not app_private.is_org_staff(v_p.org_id) then raise exception 'TP_FORBIDDEN'; end if;
  v_snap := app_private.project_snapshot(p_project_id, coalesce(p_from, v_p.starts_on),
                                          coalesce(p_to, least(v_p.ends_on, (now() at time zone 'America/Sao_Paulo')::date)));
  return v_snap - 'records' - 'eligible' - 'events' - 'canceled_events';
end;
$$;

-- Emissão do relatório: congela os dados, numera e registra. Retificação mantém o número e sobe a versão.
create function public.issue_project_report(
  p_project_id uuid, p_from date, p_to date,
  p_rectifies_id uuid default null, p_reason text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_p public.projects;
  v_orig public.project_reports;
  v_number int; v_version int := 1;
  v_data jsonb; v_hash text; v_id uuid;
begin
  if v_uid is null then raise exception 'TP_NOT_AUTHENTICATED'; end if;
  select * into v_p from public.projects where id = p_project_id;
  if not found or not app_private.is_org_staff(v_p.org_id) then raise exception 'TP_FORBIDDEN'; end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'TP_INVALID_PERIOD'; end if;
  if p_to - p_from > 366 then raise exception 'TP_PERIOD_TOO_LONG'; end if;
  if not exists (select 1 from public.project_teams where project_id = p_project_id) then raise exception 'TP_PROJECT_NO_TEAMS'; end if;

  -- Uma emissão por vez neste projeto (numeração sem buracos nem repetição).
  perform pg_advisory_xact_lock(hashtext(p_project_id::text));

  if p_rectifies_id is not null then
    select * into v_orig from public.project_reports where id = p_rectifies_id and project_id = p_project_id;
    if not found then raise exception 'TP_REPORT_NOT_FOUND'; end if;
    if char_length(coalesce(trim(p_reason), '')) < 5 then raise exception 'TP_REASON_REQUIRED'; end if;
    v_number := v_orig.number;
    select max(version) + 1 into v_version from public.project_reports where project_id = p_project_id and number = v_number;
  else
    select coalesce(max(number), 0) + 1 into v_number from public.project_reports where project_id = p_project_id;
  end if;

  v_data := app_private.project_snapshot(p_project_id, p_from, p_to)
    || jsonb_build_object(
         'issue', jsonb_build_object('number', v_number, 'version', v_version,
                                     'rectifies_version', case when v_orig.id is not null then v_orig.version end,
                                     'rectification_reason', nullif(trim(p_reason), '')),
         'generated_by', (select full_name from public.profiles where id = v_uid));
  v_hash := encode(sha256(convert_to(v_data::text, 'UTF8')), 'hex');

  insert into public.project_reports (org_id, project_id, number, version, period_from, period_to,
                                      rectifies_id, rectification_reason, data, sha256, issued_by)
  values (v_p.org_id, p_project_id, v_number, v_version, p_from, p_to,
          p_rectifies_id, nullif(trim(p_reason), ''), v_data, v_hash, v_uid)
  returning id into v_id;

  insert into public.audit_log (actor_id, org_id, action, table_name, record_id, details)
  values (v_uid, v_p.org_id, 'report_issued', 'project_reports', v_id::text,
          jsonb_build_object('project', p_project_id, 'number', v_number, 'version', v_version,
                             'from', p_from, 'to', p_to, 'sha256', v_hash, 'rectifies', p_rectifies_id));

  return jsonb_build_object('id', v_id, 'number', v_number, 'version', v_version, 'sha256', v_hash);
end;
$$;

revoke all on function public.project_indicators from public, anon;
revoke all on function public.issue_project_report from public, anon;
grant execute on function public.project_indicators to authenticated;
grant execute on function public.issue_project_report to authenticated;

-- ---------------------------------------------------------------------
-- Arquivos dos projetos (PDF do plano aprovado): pasta <org>/<projeto>/
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-files', 'project-files', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

-- Converte o nome da pasta em uuid sem gerar erro (nome inválido = sem acesso).
create function app_private.try_uuid(p text) returns uuid language plpgsql immutable set search_path = '' as $$
begin return p::uuid; exception when others then return null; end; $$;

create policy project_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and app_private.is_org_manager(app_private.try_uuid((storage.foldername(name))[1]))
    and app_private.project_in_org(app_private.try_uuid((storage.foldername(name))[2]), app_private.try_uuid((storage.foldername(name))[1]))
  );
create policy project_files_select on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and app_private.is_org_staff(app_private.try_uuid((storage.foldername(name))[1])));
