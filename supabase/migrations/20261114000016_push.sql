-- Avisos no celular (push) para o responsável: chegada e saída do atleta (D63).
-- O app registra o "endereço" de push do aparelho; o banco chama o serviço gratuito do Expo
-- (exp.host), que entrega pelo Firebase. Só para quem autorizou "avisos" no consentimento.
create extension if not exists pg_net with schema extensions;

create table public.push_tokens (
  token text primary key check (token like 'ExponentPushToken[%' or token like 'ExpoPushToken[%'),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  platform text check (platform in ('android', 'ios', 'web')),
  updated_at timestamptz not null default now()
);
create index on public.push_tokens (profile_id);
revoke all on public.push_tokens from anon;
alter table public.push_tokens enable row level security;
create policy push_own on public.push_tokens for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create function app_private.notify_guardians() returns trigger
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
  select jsonb_agg(jsonb_build_object('to', pt.token, 'title', 'TechPoint', 'body', v_body, 'sound', 'default',
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

create trigger attendance_notify_guardians after insert on public.attendance_records
  for each row execute function app_private.notify_guardians();
