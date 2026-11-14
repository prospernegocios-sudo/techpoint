-- Relatórios: atleta menor sem consentimento ativo não aparece (D63).

create or replace function public.attendance_report(
  p_org_id uuid,
  p_team_ids uuid[],
  p_from date,
  p_to date,
  p_project jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tz text := 'America/Sao_Paulo';
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'TP_NOT_AUTHENTICATED'; end if;
  if not app_private.is_org_staff(p_org_id) then raise exception 'TP_FORBIDDEN'; end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'TP_INVALID_PERIOD'; end if;
  if p_to - p_from > 366 then raise exception 'TP_PERIOD_TOO_LONG'; end if;
  if coalesce(array_length(p_team_ids, 1), 0) = 0 then raise exception 'TP_TEAMS_REQUIRED'; end if;

  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;

  with
  tms as (
    select t.id, t.name, t.category from public.teams t
    where t.org_id = p_org_id and t.id = any (p_team_ids)
  ),
  evs as (
    -- Só treinos já encerrados contam (um treino futuro não pode gerar falta).
    select e.*, v.name as venue_name, v.latitude as venue_lat, v.longitude as venue_lng, v.radius_m as venue_radius
    from public.events e
    join tms on tms.id = e.team_id
    join public.venues v on v.id = e.venue_id
    where e.org_id = p_org_id and e.status = 'scheduled'
      and e.starts_at >= v_start and e.starts_at < v_end and e.ends_at <= now()
  ),
  mem as (
    select tm.team_id, a.id as athlete_id, a.full_name, tm.created_at as joined_at
    from public.team_members tm
    join tms on tms.id = tm.team_id
    join public.athletes a on a.id = tm.athlete_id
    where app_private.athlete_cleared(a.id)   -- menor sem consentimento fica fora (D63)
  ),
  recs as (
    select r.*, app_private.attendance_code(r) as code,
           rb.full_name as recorded_by_name, rv.full_name as reviewed_by_name
    from public.attendance_records r
    join evs on evs.id = r.event_id
    left join public.profiles rb on rb.id = r.recorded_by
    left join public.profiles rv on rv.id = r.reviewed_by
    where r.status <> 'rejected'
  )
  select jsonb_build_object(
    'generated_at', now(),
    'generated_by', (select p.full_name from public.profiles p where p.id = v_uid),
    'timezone', v_tz,
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'project', coalesce(p_project, '{}'::jsonb),
    'org', (select jsonb_build_object('id', o.id, 'name', o.name) from public.organizations o where o.id = p_org_id),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'category', category) order by name) from tms), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'team_id', team_id, 'type', type, 'title', title, 'starts_at', starts_at, 'ends_at', ends_at,
        'venue', jsonb_build_object('name', venue_name, 'latitude', venue_lat, 'longitude', venue_lng, 'radius_m', venue_radius)
      ) order by starts_at) from evs), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object(
        'team_id', team_id, 'athlete_id', athlete_id, 'full_name', full_name, 'joined_at', joined_at
      ) order by full_name) from mem), '[]'::jsonb),
    'records', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'event_id', event_id, 'athlete_id', athlete_id, 'kind', kind, 'server_at', server_at,
        'client_at', client_at, 'synced_offline', synced_offline,
        'latitude', latitude, 'longitude', longitude, 'accuracy_m', accuracy_m, 'distance_m', distance_m,
        'photo_path', photo_path, 'source', source, 'manual_reason', manual_reason, 'recorded_by_name', recorded_by_name,
        'status', status, 'justification', justification, 'reviewed_by_name', reviewed_by_name, 'reviewed_at', reviewed_at,
        'flags', flags, 'code', code
      ) order by server_at) from recs), '[]'::jsonb)
  ) into v_result;

  insert into public.audit_log (actor_id, org_id, action, table_name, details)
  values (v_uid, p_org_id, 'report_generated', 'attendance_records',
          jsonb_build_object('teams', p_team_ids, 'from', p_from, 'to', p_to,
                             'events', jsonb_array_length(v_result->'events'),
                             'records', jsonb_array_length(v_result->'records'),
                             'project', p_project));
  return v_result;
end;
$$;

create or replace function app_private.project_snapshot(p_project_id uuid, p_from date, p_to date)
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
      and app_private.athlete_cleared(b.athlete_id)   -- menor sem consentimento fica fora (D63)
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
