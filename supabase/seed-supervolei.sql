-- Segunda entidade de teste (D96): "Supervôlei", com dados fictícios, para testar o gestor master e a troca
-- entre entidades. Tudo marcado como fictício (is_demo). Idempotente.
insert into public.organizations (id, name, slug, review_status, city, uf, theme_primary, theme_accent)
values ('00000000-0000-4000-8000-000000000002', 'Supervôlei', 'supervolei', 'approved', 'Brasília', 'DF', '#0B4F8A', '#F2B705')
on conflict (id) do nothing;

insert into public.venues (id, org_id, name, address, latitude, longitude, radius_m)
values ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000002', 'Quadra Supervôlei (exemplo)', 'Asa Sul, Brasília - DF', -15.8170, -47.9000, 150)
on conflict (id) do nothing;

insert into public.teams (id, org_id, sport_id, name, category, season) values
  ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101', 'Sub 15 Feminino', 'Sub 15', '2026'),
  ('00000000-0000-4000-8000-000000000312', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101', 'Sub 17 Feminino', 'Sub 17', '2026')
on conflict (id) do nothing;

insert into public.athletes (id, org_id, full_name, birth_date, is_demo) values
  ('00000000-0000-4000-8000-000000000511', '00000000-0000-4000-8000-000000000002', 'Ana Exemplo', '2011-04-10', true),
  ('00000000-0000-4000-8000-000000000512', '00000000-0000-4000-8000-000000000002', 'Bia Exemplo', '2011-08-22', true),
  ('00000000-0000-4000-8000-000000000513', '00000000-0000-4000-8000-000000000002', 'Carol Exemplo', '2010-01-15', true),
  ('00000000-0000-4000-8000-000000000514', '00000000-0000-4000-8000-000000000002', 'Duda Exemplo', '2009-11-03', true),
  ('00000000-0000-4000-8000-000000000515', '00000000-0000-4000-8000-000000000002', 'Elis Exemplo', '2009-06-30', true)
on conflict (id) do nothing;

insert into public.team_members (team_id, athlete_id) values
  ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000511'),
  ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000512'),
  ('00000000-0000-4000-8000-000000000312', '00000000-0000-4000-8000-000000000513'),
  ('00000000-0000-4000-8000-000000000312', '00000000-0000-4000-8000-000000000514'),
  ('00000000-0000-4000-8000-000000000312', '00000000-0000-4000-8000-000000000515')
on conflict do nothing;

-- Treinos de teste: segundas e quartas, 18h às 19h30, próximas 2 semanas.
insert into public.events (org_id, team_id, venue_id, type, title, starts_at, ends_at, is_demo)
select '00000000-0000-4000-8000-000000000002', t.id, '00000000-0000-4000-8000-000000000202', 'training', 'Treino ' || t.category,
       (d::date + time '18:00') at time zone 'America/Sao_Paulo', (d::date + time '19:30') at time zone 'America/Sao_Paulo', true
  from generate_series(current_date, current_date + 14, interval '1 day') d
  cross join public.teams t
 where t.org_id = '00000000-0000-4000-8000-000000000002' and extract(isodow from d) in (1, 3)
   and not exists (select 1 from public.events e where e.team_id = t.id and e.starts_at = (d::date + time '18:00') at time zone 'America/Sao_Paulo');

-- Consentimento em papel de teste para as atletas fictícias menores (nunca usar com dados reais).
insert into public.guardian_consents (org_id, athlete_id, source, terms_version, note)
select a.org_id, a.id, 'paper', 'teste', 'Dados fictícios do ambiente de teste (sem responsável real)'
from public.athletes a
where a.org_id = '00000000-0000-4000-8000-000000000002'
  and app_private.athlete_is_minor(a.id) and not app_private.athlete_has_consent(a.id);
