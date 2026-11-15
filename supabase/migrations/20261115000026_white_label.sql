-- White label (D83): a entidade é a marca. Página de entrada por endereço (techpoint.app.br/<endereco>),
-- endereço editável pelo administrador e avisos no celular com o nome da entidade.

-- Endereços que não podem virar marca (são telas do app).
create function app_private.valid_brand_slug(p text) returns boolean language sql immutable set search_path = '' as $$
  select p ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$' and p not in (
    'login','convite','responsavel','cv','privacidade','excluir-conta','atleta','evento','equipe','projeto','cadastro',
    'entidade','curriculo','checkin','consentimento','auth-callback','acao','gestao','perfil','relatorios','documentos',
    'atletas','index','api','admin','app','www','techpoint','suporte','ajuda');
$$;
alter table public.organizations add constraint organizations_slug_brand check (app_private.valid_brand_slug(slug)) not valid;
update public.organizations set slug = 'dfvolei' where slug = 'df-volei';
grant update (slug) on public.organizations to authenticated;

-- Marca pública da entidade (sem login): só o que aparece na tela de entrada.
create function public.org_brand(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'logo_path', o.logo_path,
                            'primary', o.theme_primary, 'accent', o.theme_accent)
  from public.organizations o where o.slug = lower(p_slug) and o.review_status <> 'suspended';
$$;
revoke all on function public.org_brand(text) from public;
grant execute on function public.org_brand(text) to anon, authenticated;

create or replace function app_private.notify_guardians() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text; v_team text; v_time text; v_body text; v_msgs jsonb;
begin
  if new.status = 'rejected' then return new; end if;
  select split_part(a.full_name, ' ', 1) into v_name from public.athletes a where a.id = new.athlete_id;
  select t.name into v_team from public.events e join public.teams t on t.id = e.team_id where e.id = new.event_id;
  v_time := to_char(coalesce(case when new.synced_offline then new.client_at end, new.server_at) at time zone 'America/Sao_Paulo', 'HH24:MI');
  v_body := v_name || case when new.kind = 'check_in' then ' chegou ao treino' else ' saiu do treino' end
            || coalesce(' do ' || v_team, '') || ' às ' || v_time || '.';
  select jsonb_agg(jsonb_build_object('to', pt.token, 'title', coalesce((select o.name from public.organizations o where o.id = new.org_id), 'TechPoint'), 'body', v_body, 'sound', 'default',
                                      'channelId', 'avisos', 'data', jsonb_build_object('athlete_id', new.athlete_id)))
    into v_msgs
  from public.athlete_guardians g
  join public.push_tokens pt on pt.profile_id = g.profile_id
  where g.athlete_id = new.athlete_id and g.status = 'active'
    -- respeita o consentimento: sem "avisos" marcado, não envia
    and exists (select 1 from public.guardian_consents c where c.athlete_id = new.athlete_id and c.revoked_at is null
                and coalesce((c.scope->>'notifications')::boolean, true));
  if v_msgs is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_msgs,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  end if;
  return new;
exception when others then
  return new; -- aviso nunca impede o registro da presença
end; $$;
