-- "Competições" vira "Eventos" (D110): a convocação ganha tipo (competição, reunião, palestra, outro) e horário.
-- O atleta escolhe se um evento realizado entra no currículo. Colunas novas e opcionais: o APK 0.4.0 continua funcionando.
alter table public.convocations add column if not exists kind text not null default 'competicao'
  check (kind in ('competicao', 'reuniao', 'palestra', 'outro'));
alter table public.convocations add column if not exists start_time time;
alter table public.convocation_athletes add column if not exists cv_entry_id uuid references public.athlete_cv_entries (id) on delete set null;

-- Incluir ou tirar do currículo um evento da equipe (só o próprio atleta ou o responsável).
create or replace function public.set_event_in_cv(p_convocation_id uuid, p_athlete_id uuid, p_include boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_row public.convocation_athletes; v_conv public.convocations; v_team text; v_id uuid;
begin
  if not app_private.is_self_or_guardian(p_athlete_id) then
    raise exception 'Somente o atleta ou o responsável alteram o currículo.' using errcode = '42501';
  end if;
  select * into v_row from public.convocation_athletes where convocation_id = p_convocation_id and athlete_id = p_athlete_id;
  if not found then raise exception 'Evento não encontrado para este atleta.' using errcode = 'P0002'; end if;
  select * into v_conv from public.convocations where id = p_convocation_id;
  if not p_include then
    if v_row.cv_entry_id is not null then delete from public.athlete_cv_entries where id = v_row.cv_entry_id; end if;
    update public.convocation_athletes set cv_entry_id = null where convocation_id = p_convocation_id and athlete_id = p_athlete_id;
    return null;
  end if;
  if v_row.cv_entry_id is not null then return v_row.cv_entry_id; end if;
  select t.name into v_team from public.teams t where t.id = v_conv.team_id;
  insert into public.athlete_cv_entries (athlete_id, org_id, kind, title, category, location, started_on, ended_on, created_by)
  values (p_athlete_id, v_conv.org_id,
          case v_conv.kind when 'competicao' then 'competicao' when 'palestra' then 'curso' else 'outro' end,
          left(v_conv.title, 120), left(v_team, 60), left(v_conv.location, 120),
          date_trunc('month', v_conv.starts_on)::date,
          case when v_conv.ends_on is not null and date_trunc('month', v_conv.ends_on) > date_trunc('month', v_conv.starts_on)
               then date_trunc('month', v_conv.ends_on)::date end,
          auth.uid())
  returning id into v_id;
  update public.convocation_athletes set cv_entry_id = v_id where convocation_id = p_convocation_id and athlete_id = p_athlete_id;
  return v_id;
end; $$;
grant execute on function public.set_event_in_cv(uuid, uuid, boolean) to authenticated;

-- Eventos de teste (fictícios) para ver "Próximos" e "Realizados".
do $$
declare v_team uuid; v_conv uuid;
begin
  select t.id into v_team from public.teams t where t.org_id = '00000000-0000-4000-8000-000000000001' and t.name ilike 'Sub 17 Masculino' limit 1;
  if v_team is null or exists (select 1 from public.convocations where title = 'Reunião de pais e atletas (teste)') then return; end if;
  insert into public.convocations (org_id, team_id, kind, title, location, starts_on, start_time, notes, is_demo) values
    ('00000000-0000-4000-8000-000000000001', v_team, 'reuniao', 'Reunião de pais e atletas (teste)', 'Sala de reuniões do clube', current_date + 5, '19:00', 'Planejamento da temporada 2027.', true)
  returning id into v_conv;
  insert into public.convocation_athletes (convocation_id, athlete_id, org_id)
  select v_conv, tm.athlete_id, '00000000-0000-4000-8000-000000000001' from public.team_members tm where tm.team_id = v_team;
  insert into public.convocations (org_id, team_id, kind, title, location, starts_on, start_time, notes, is_demo) values
    ('00000000-0000-4000-8000-000000000001', v_team, 'palestra', 'Palestra: nutrição esportiva (teste)', 'Auditório do clube', current_date - 10, '18:30', 'Com nutricionista convidada.', true)
  returning id into v_conv;
  insert into public.convocation_athletes (convocation_id, athlete_id, org_id, acknowledged_at)
  select v_conv, tm.athlete_id, '00000000-0000-4000-8000-000000000001', now() - interval '12 days' from public.team_members tm where tm.team_id = v_team;
end $$;
