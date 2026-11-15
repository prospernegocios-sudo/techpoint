-- Currículo automático (D82): total de treinos registrados com prova (check-in válido) desde o primeiro.
-- Campos novos no JSON; o APK 0.4.0 ignora o que não conhece (compatível, D80).
create or replace function app_private.build_cv(p_athlete uuid, p_include_body boolean) returns jsonb
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
    'trainings_total', (select count(distinct r.event_id) from public.attendance_records r
                        where r.athlete_id = a.id and r.kind = 'check_in' and r.status = 'valid'),
    'first_training', (select min(r.server_at)::date from public.attendance_records r
                        where r.athlete_id = a.id and r.kind = 'check_in' and r.status = 'valid'),
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

