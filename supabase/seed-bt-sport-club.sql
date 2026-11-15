-- Terceira entidade de demonstração (D111): "BT Sport Club", 100% fictícia, para fotos do hotsite e
-- dos manuais. Nomes de pessoas inventados (nome e sobrenome). Tudo marcado como fictício (is_demo). Idempotente.
-- Contas: atletabtsport@, treinadorbtsport@, gestorbtsport@ e administradorbtsport@guerreiro.com.br.
insert into public.organizations (id, name, slug, review_status, city, uf, theme_primary, theme_accent)
values ('00000000-0000-4000-8000-000000000003', 'BT Sport Club', 'btsportclub', 'approved', 'Brasília', 'DF', '#14532D', '#F59E0B')
on conflict (id) do nothing;

insert into public.venues (id, org_id, name, address, latitude, longitude, radius_m)
values ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000003', 'Arena BT (exemplo)', 'Lago Sul, Brasília - DF', -15.8400, -47.8700, 150)
on conflict (id) do nothing;

insert into public.teams (id, org_id, sport_id, name, category, season) values
  ('00000000-0000-4000-8000-000000000321', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000101', 'Sub 15 Masculino', 'Sub 15', '2026'),
  ('00000000-0000-4000-8000-000000000322', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000101', 'Sub 17 Masculino', 'Sub 17', '2026')
on conflict (id) do nothing;

insert into public.athletes (id, org_id, full_name, birth_date, sex, is_demo) values
  ('00000000-0000-4000-8000-000000000521', '00000000-0000-4000-8000-000000000003', 'Gabriel Moreira', '2009-07-14', 'M', true),
  ('00000000-0000-4000-8000-000000000522', '00000000-0000-4000-8000-000000000003', 'Lucas Andrade Vieira', '2009-03-02', 'M', true),
  ('00000000-0000-4000-8000-000000000523', '00000000-0000-4000-8000-000000000003', 'Mateus Carvalho', '2010-01-21', 'M', true),
  ('00000000-0000-4000-8000-000000000524', '00000000-0000-4000-8000-000000000003', 'Rafael Teixeira', '2009-09-30', 'M', true),
  ('00000000-0000-4000-8000-000000000525', '00000000-0000-4000-8000-000000000003', 'Henrique Barros', '2010-05-11', 'M', true),
  ('00000000-0000-4000-8000-000000000526', '00000000-0000-4000-8000-000000000003', 'Davi Rezende', '2009-12-08', 'M', true),
  ('00000000-0000-4000-8000-000000000527', '00000000-0000-4000-8000-000000000003', 'Bruno Cavalcanti', '2011-02-17', 'M', true),
  ('00000000-0000-4000-8000-000000000528', '00000000-0000-4000-8000-000000000003', 'Arthur Fontes', '2011-06-25', 'M', true),
  ('00000000-0000-4000-8000-000000000529', '00000000-0000-4000-8000-000000000003', 'Samuel Pacheco', '2011-10-03', 'M', true)
on conflict (id) do nothing;

insert into public.team_members (team_id, athlete_id) values
  ('00000000-0000-4000-8000-000000000322', '00000000-0000-4000-8000-000000000521'),
  ('00000000-0000-4000-8000-000000000322', '00000000-0000-4000-8000-000000000522'),
  ('00000000-0000-4000-8000-000000000322', '00000000-0000-4000-8000-000000000523'),
  ('00000000-0000-4000-8000-000000000322', '00000000-0000-4000-8000-000000000524'),
  ('00000000-0000-4000-8000-000000000322', '00000000-0000-4000-8000-000000000525'),
  ('00000000-0000-4000-8000-000000000322', '00000000-0000-4000-8000-000000000526'),
  ('00000000-0000-4000-8000-000000000321', '00000000-0000-4000-8000-000000000527'),
  ('00000000-0000-4000-8000-000000000321', '00000000-0000-4000-8000-000000000528'),
  ('00000000-0000-4000-8000-000000000321', '00000000-0000-4000-8000-000000000529')
on conflict do nothing;

-- Contas de teste ligadas à entidade e ao atleta Gabriel Moreira.
insert into public.memberships (org_id, profile_id, role)
select '00000000-0000-4000-8000-000000000003', p.id, x.role::public.org_role
from (values ('treinadorbtsport@guerreiro.com.br','coach'), ('gestorbtsport@guerreiro.com.br','manager'),
             ('administradorbtsport@guerreiro.com.br','admin'), ('atletabtsport@guerreiro.com.br','athlete')) x(email, role)
join public.profiles p on p.email = x.email
on conflict do nothing;
update public.athletes a set profile_id = p.id, email = p.email
  from public.profiles p where p.email = 'atletabtsport@guerreiro.com.br' and a.id = '00000000-0000-4000-8000-000000000521' and a.profile_id is null;

-- Treinos: terças e quintas, 18h às 19h30, das últimas 2 semanas às próximas 2.
insert into public.events (org_id, team_id, venue_id, type, title, starts_at, ends_at, is_demo)
select '00000000-0000-4000-8000-000000000003', t.id, '00000000-0000-4000-8000-000000000203', 'training', 'Treino ' || t.category,
       (d::date + time '18:00') at time zone 'America/Sao_Paulo', (d::date + time '19:30') at time zone 'America/Sao_Paulo', true
  from generate_series(current_date - 14, current_date + 14, interval '1 day') d
  cross join public.teams t
 where t.org_id = '00000000-0000-4000-8000-000000000003' and extract(isodow from d) in (2, 4)
   and not exists (select 1 from public.events e where e.team_id = t.id and e.starts_at = (d::date + time '18:00') at time zone 'America/Sao_Paulo');

-- Consentimento em papel de teste para os menores (dados fictícios, sem responsável real).
insert into public.guardian_consents (org_id, athlete_id, source, terms_version, note)
select a.org_id, a.id, 'paper', 'teste', 'Dados fictícios de demonstração (sem responsável real)'
from public.athletes a
where a.org_id = '00000000-0000-4000-8000-000000000003'
  and app_private.athlete_is_minor(a.id) and not app_private.athlete_has_consent(a.id);

-- Eventos da equipe (Sub 17): competição e reunião futuras, palestra realizada.
do $$
declare v_team uuid := '00000000-0000-4000-8000-000000000322'; v_org uuid := '00000000-0000-4000-8000-000000000003'; v uuid;
begin
  if exists (select 1 from public.convocations where org_id = v_org) then return; end if;
  insert into public.convocations (org_id, team_id, kind, title, location, starts_on, ends_on, start_time, notes, is_demo)
  values (v_org, v_team, 'competicao', 'Copa Planalto Sub 17', 'Ginásio Central, Brasília - DF', current_date + 12, current_date + 13, '08:00',
          'Concentração 1 hora antes do primeiro jogo, com uniforme completo.', true) returning id into v;
  insert into public.convocation_athletes (convocation_id, athlete_id, org_id, acknowledged_at)
  select v, tm.athlete_id, v_org, case when tm.athlete_id in ('00000000-0000-4000-8000-000000000522','00000000-0000-4000-8000-000000000523','00000000-0000-4000-8000-000000000524') then now() - interval '1 day' end
  from public.team_members tm where tm.team_id = v_team;
  insert into public.convocations (org_id, team_id, kind, title, location, starts_on, start_time, notes, is_demo)
  values (v_org, v_team, 'reuniao', 'Reunião de pais e atletas', 'Sala de reuniões do clube', current_date + 4, '19:00',
          'Planejamento da temporada 2027.', true) returning id into v;
  insert into public.convocation_athletes (convocation_id, athlete_id, org_id)
  select v, tm.athlete_id, v_org from public.team_members tm where tm.team_id = v_team;
  insert into public.convocations (org_id, team_id, kind, title, location, starts_on, start_time, notes, is_demo)
  values (v_org, v_team, 'palestra', 'Palestra: alimentação do atleta', 'Auditório do clube', current_date - 8, '18:30',
          'Com nutricionista convidada.', true) returning id into v;
  insert into public.convocation_athletes (convocation_id, athlete_id, org_id, acknowledged_at)
  select v, tm.athlete_id, v_org, now() - interval '10 days' from public.team_members tm where tm.team_id = v_team;
end $$;
