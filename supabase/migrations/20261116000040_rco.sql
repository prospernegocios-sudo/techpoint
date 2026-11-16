-- Fase C (onda 1): textos do RCO no projeto e número de beneficiários previstos na aprovação (real × previsto no RCO).
alter table public.projects
  add column rco jsonb not null default '{}'::jsonb,        -- textos do RCO: resultados por meta, links, ajustes, mídia, conclusão
  add column planned_beneficiaries int check (planned_beneficiaries >= 0);

create or replace function public.approve_proposal(p_proposal uuid, p_agreement text, p_signed_on date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.tech_proposals;
  v_org public.organizations;
  v_project uuid; v_plan uuid; v_start date; v_end date; g record; n int := 0; v_bens int;
begin
  select * into v from public.tech_proposals where id = p_proposal;
  if v.id is null or not app_private.can_habilitate(v.org_id) then raise exception 'TP_FORBIDDEN'; end if;
  if v.status = 'aprovada' then raise exception 'TP_ALREADY_APPROVED'; end if;
  if char_length(trim(coalesce(p_agreement, ''))) < 3 then raise exception 'TP_AGREEMENT_REQUIRED'; end if;
  select * into v_org from public.organizations where id = v.org_id;
  v_start := coalesce(v.starts_on, p_signed_on, (now() at time zone 'America/Sao_Paulo')::date);
  v_end := (v_start + make_interval(months => coalesce(v.months, 12)) - interval '1 day')::date;

  insert into public.projects (org_id, name, process_number, sphere, agency, program, proponent, starts_on, ends_on, status, proposal_id, signed_on, notes)
  values (v.org_id, left(v.title, 160), trim(p_agreement), 'federal', 'Ministério do Esporte – Secretaria Nacional de Excelência Esportiva',
          'Revelar Talentos – Termo de Fomento', left(coalesce(v_org.legal_name, v_org.name), 160), v_start, v_end, 'active', v.id, p_signed_on,
          left('Criado automaticamente a partir do Projeto Técnico aprovado.', 2000))
  returning id into v_project;

  insert into public.project_plan_versions (org_id, project_id, version, approved_on, description)
  values (v.org_id, v_project, 1, p_signed_on, left('Projeto Técnico aprovado: ' || v.title, 1000))
  returning id into v_plan;

  -- Equipes do público-alvo e os atletas delas viram beneficiários a partir do início da vigência.
  insert into public.project_teams (project_id, team_id, org_id)
  select v_project, (t->>'team_id')::uuid, v.org_id
  from jsonb_array_elements(coalesce(v.audience->'teams', '[]'::jsonb)) t
  where exists (select 1 from public.teams tm where tm.id = (t->>'team_id')::uuid and tm.org_id = v.org_id)
  on conflict do nothing;
  insert into public.project_beneficiaries (project_id, athlete_id, org_id, starts_on)
  select distinct v_project, tmb.athlete_id, v.org_id, v_start
  from public.project_teams pt join public.team_members tmb on tmb.team_id = pt.team_id
  join public.athletes a on a.id = tmb.athlete_id and a.status <> 'inactive'
  where pt.project_id = v_project
  on conflict do nothing;
  get diagnostics v_bens = row_count;
  update public.projects set planned_beneficiaries = v_bens where id = v_project;

  -- Metas: o objetivo e a meta quantitativa viram metas do projeto; as de check-in continuam automáticas.
  for g in select * from public.proposal_goals where proposal_id = v.id order by position, created_at loop
    n := n + 1;
    insert into public.project_goals (org_id, project_id, plan_version_id, code, description, indicator, kind, unit, target, verifier)
    values (v.org_id, v_project, v_plan, 'Meta ' || n, left(g.objective, 500), left(coalesce(g.quantitative, g.qualitative), 300),
            g.indicator, case g.indicator when 'avg_frequency' then '%' when 'unique_beneficiaries' then 'atletas' when 'attendances' then 'presenças' else null end,
            g.target, left(g.method, 300));
  end loop;

  perform set_config('techpoint.approving', 'on', true);
  update public.tech_proposals set status = 'aprovada', project_id = v_project where id = v.id;
  perform set_config('techpoint.approving', 'off', true);
  return v_project;
end; $$;
