-- Relatório de frequência para prestação de contas (projetos incentivados / patrocinadores).
-- Só gestor ou treinador do clube. Cada geração fica registrada na auditoria (LGPD).

-- Código de verificação de um registro: impressão digital (SHA-256) dos dados que provam
-- a presença. Se qualquer um desses dados mudar, o código muda. A hora entra como
-- segundos desde 1970 para não depender do fuso horário da sessão.
create function app_private.attendance_code(r public.attendance_records)
returns text language sql stable set search_path = '' as $$
  select upper(substr(encode(sha256(convert_to(concat_ws('|',
    r.id, r.kind, extract(epoch from r.server_at), r.latitude, r.longitude, r.distance_m, r.photo_sha256, r.status, r.source
  ), 'UTF8')), 'hex'), 1, 10));
$$;

create function public.attendance_report(
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

revoke all on function public.attendance_report from public, anon;
grant execute on function public.attendance_report to authenticated;
revoke all on function app_private.attendance_code from public, anon;
