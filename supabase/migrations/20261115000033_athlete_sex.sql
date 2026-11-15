-- Sexo do atleta (auditoria, item 08): masculino ou feminino, opcional. Aparece no cabeçalho do perfil
-- e ajusta o texto do convite ao responsável (item 10). Coluna nova e opcional: o APK 0.4.0 continua funcionando.
alter table public.athletes add column if not exists sex text check (sex in ('M', 'F'));

create or replace function public.guardian_invite_info(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('athlete_first_name', split_part(a.full_name, ' ', 1), 'athlete_sex', a.sex, 'org', o.name, 'logo_path', o.logo_path,
                            'status', g.status, 'minor', app_private.athlete_is_minor(a.id))
  from public.athlete_guardians g join public.athletes a on a.id = g.athlete_id join public.organizations o on o.id = g.org_id
  where g.token = p_token;
$$;

-- Dados fictícios de teste: equipes masculinas do DF Vôlei e femininas da Supervôlei.
update public.athletes a set sex = 'M'
 where a.is_demo and a.sex is null and exists (select 1 from public.team_members tm join public.teams t on t.id = tm.team_id where tm.athlete_id = a.id and t.name ilike '%masculino%');
update public.athletes a set sex = 'F'
 where a.is_demo and a.sex is null and exists (select 1 from public.team_members tm join public.teams t on t.id = tm.team_id where tm.athlete_id = a.id and t.name ilike '%feminino%');
