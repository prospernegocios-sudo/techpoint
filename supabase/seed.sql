-- =====================================================================
-- TechPoint — Dados de exemplo (ambiente de TESTE apenas)
-- Clube piloto: DF Vôlei. Atletas são fictícios.
-- Pode rodar várias vezes (não duplica).
-- =====================================================================

insert into public.organizations (id, name, slug)
values ('00000000-0000-4000-8000-000000000001', 'DF Vôlei', 'df-volei')
on conflict (id) do nothing;

insert into public.sports (id, org_id, name, evaluation_criteria, stat_fields)
values ('00000000-0000-4000-8000-000000000101', null, 'Vôlei',
  '["Saque","Recepção","Levantamento","Ataque","Bloqueio","Defesa","Comportamento"]'::jsonb,
  '[{"key":"pontos","label":"Pontos"},{"key":"aces","label":"Aces"},{"key":"bloqueios","label":"Bloqueios"},
    {"key":"ataques_certos","label":"Ataques certos"},{"key":"erros_saque","label":"Erros de saque"},
    {"key":"recepcoes_perfeitas","label":"Recepções perfeitas"}]'::jsonb)
on conflict (id) do nothing;

-- Local de exemplo (ajuste no app com "Estou no local agora").
insert into public.venues (id, org_id, name, address, latitude, longitude, radius_m, created_by)
values ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001',
        'Ginásio DF Vôlei (exemplo)', 'Brasília - DF', -15.7942, -47.8822, 150, null)
on conflict (id) do nothing;

insert into public.teams (id, org_id, sport_id, name, category, season) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000101', 'Sub 15 Masculino', 'Sub 15', '2026'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000101', 'Sub 17 Masculino', 'Sub 17', '2026')
on conflict (id) do nothing;

insert into public.athletes (id, org_id, full_name, birth_date, created_by) values
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001', 'Lucas Andrade',   '2011-03-14', null),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000001', 'Pedro Henrique',  '2011-07-02', null),
  ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000001', 'Rafael Souza',    '2012-01-20', null),
  ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000001', 'Davi Martins',    '2012-09-11', null),
  ('00000000-0000-4000-8000-000000000405', '00000000-0000-4000-8000-000000000001', 'Matheus Lima',    '2011-11-30', null),
  ('00000000-0000-4000-8000-000000000406', '00000000-0000-4000-8000-000000000001', 'Enzo Carvalho',   '2009-04-08', null),
  ('00000000-0000-4000-8000-000000000407', '00000000-0000-4000-8000-000000000001', 'Bruno Ferreira',  '2009-08-19', null),
  ('00000000-0000-4000-8000-000000000408', '00000000-0000-4000-8000-000000000001', 'Caio Ribeiro',    '2010-02-27', null),
  ('00000000-0000-4000-8000-000000000409', '00000000-0000-4000-8000-000000000001', 'Felipe Rocha',    '2010-06-15', null),
  ('00000000-0000-4000-8000-000000000410', '00000000-0000-4000-8000-000000000001', 'Gabriel Nunes',   '2009-12-03', null)
on conflict (id) do nothing;

insert into public.team_members (team_id, athlete_id, jersey_number, position) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000401', 1, 'Levantador'),
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000402', 4, 'Ponteiro'),
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000403', 7, 'Central'),
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000404', 9, 'Oposto'),
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000405', 12, 'Líbero'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000406', 2, 'Levantador'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000407', 5, 'Ponteiro'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000408', 8, 'Central'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000409', 10, 'Oposto'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000410', 6, 'Líbero')
on conflict do nothing;

-- Treinos nas próximas 2 semanas: terças e quintas, 17h às 18h30 (horário de Brasília).
insert into public.events (org_id, team_id, venue_id, type, title, starts_at, ends_at, created_by)
select '00000000-0000-4000-8000-000000000001', t.id, '00000000-0000-4000-8000-000000000201', 'training',
       'Treino ' || t.category,
       (d::date + time '17:00') at time zone 'America/Sao_Paulo',
       (d::date + time '18:30') at time zone 'America/Sao_Paulo',
       null
  from generate_series(current_date, current_date + 14, interval '1 day') d
  cross join public.teams t
 where t.org_id = '00000000-0000-4000-8000-000000000001'
   and extract(isodow from d) in (2, 4)
   and not exists (
     select 1 from public.events e
      where e.team_id = t.id
        and e.starts_at = (d::date + time '17:00') at time zone 'America/Sao_Paulo'
   );

-- ---------------------------------------------------------------------
-- Liga a conta de teste do dono do produto a todos os papéis no DF Vôlei
-- (admin da plataforma, gestor, treinador e atleta do Sub 17).
-- Chamada por scripts/db.mjs seed com SEED_ADMIN_EMAIL do .env.
-- ---------------------------------------------------------------------
create or replace function app_private.seed_admin(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_org uuid := '00000000-0000-4000-8000-000000000001';
  v_athlete uuid := '00000000-0000-4000-8000-000000000499';
begin
  insert into app_private.platform_admin_emails (email) values (v_email) on conflict do nothing;
  update public.profiles set is_platform_admin = true where email = v_email;

  insert into public.memberships (org_id, invited_email, role) values
    (v_org, v_email, 'manager'), (v_org, v_email, 'coach')
  on conflict do nothing;

  insert into public.athletes (id, org_id, full_name, birth_date, email, created_by)
  values (v_athlete, v_org, 'Atleta de Teste (TG)', '1990-01-01', v_email, null)
  on conflict (id) do nothing;
  insert into public.team_members (team_id, athlete_id, jersey_number, position)
  values ('00000000-0000-4000-8000-000000000302', v_athlete, 99, 'Teste')
  on conflict do nothing;

  -- Se a conta já existe, vincula agora.
  perform app_private.link_profile_by_email(p.id, v_email) from public.profiles p where p.email = v_email;
end;
$$;
