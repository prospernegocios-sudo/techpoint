-- Check-in atrasado não é bloqueado (decisão D58): aceito até o fim do treino e marcado como atrasado.
create or replace function public.record_attendance(
  p_event_id uuid,
  p_kind text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m real,
  p_photo_path text,
  p_photo_sha256 text,
  p_device_id text,
  p_is_mocked boolean default false,
  p_client_at timestamptz default null,
  p_synced_offline boolean default false,
  p_justification text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_event public.events%rowtype;
  v_venue public.venues%rowtype;
  v_org public.organizations%rowtype;
  v_athlete_id uuid;
  v_ref_time timestamptz;
  v_distance double precision;
  v_inside boolean;
  v_status text;
  v_flags text[] := '{}';
  v_id uuid;
  v_justification text := nullif(trim(coalesce(p_justification, '')), '');
begin
  if v_uid is null then raise exception 'TP_NOT_AUTHENTICATED'; end if;
  if p_kind not in ('check_in', 'check_out') then raise exception 'TP_INVALID_KIND'; end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then raise exception 'TP_EVENT_NOT_FOUND'; end if;
  if v_event.status = 'canceled' then raise exception 'TP_EVENT_CANCELED'; end if;
  select * into v_venue from public.venues where id = v_event.venue_id;
  select * into v_org from public.organizations where id = v_event.org_id;

  -- O atleta logado precisa estar ativo e na equipe do evento.
  select a.id into v_athlete_id
    from public.athletes a
    join public.team_members tm on tm.athlete_id = a.id and tm.team_id = v_event.team_id
   where a.profile_id = v_uid and a.org_id = v_event.org_id and a.status = 'active';
  if v_athlete_id is null then raise exception 'TP_NOT_IN_TEAM'; end if;

  if p_latitude is null or p_longitude is null then raise exception 'TP_LOCATION_REQUIRED'; end if;

  -- Hora de referência: a do servidor; offline usa a do aparelho, com limites.
  if p_synced_offline then
    if p_client_at is null
       or p_client_at > v_now + interval '5 minutes'
       or p_client_at < v_now - make_interval(hours => v_org.offline_max_hours) then
      raise exception 'TP_OFFLINE_TOO_OLD';
    end if;
    v_ref_time := p_client_at;
    v_flags := array_append(v_flags, 'offline_sync');
  else
    v_ref_time := v_now;
  end if;

  -- Janela de horário.
  if p_kind = 'check_in' then
    -- Check-in abre antes do início e vai até o fim do treino. Depois da tolerância
    -- (checkin_after_min) não é bloqueado: fica registrado com a hora real e marcado como atrasado.
    if v_ref_time < v_event.starts_at - make_interval(mins => v_org.checkin_before_min)
       or v_ref_time > v_event.ends_at then
      raise exception 'TP_OUTSIDE_WINDOW';
    end if;
    if v_ref_time > v_event.starts_at + make_interval(mins => v_org.checkin_after_min) then
      v_flags := array_append(v_flags, 'late');
    end if;
  else
    if v_ref_time < v_event.starts_at
       or v_ref_time > v_event.ends_at + make_interval(mins => v_org.checkout_after_min) then
      raise exception 'TP_OUTSIDE_WINDOW';
    end if;
    if not exists (select 1 from public.attendance_records r
                   where r.event_id = p_event_id and r.athlete_id = v_athlete_id
                     and r.kind = 'check_in' and r.status <> 'rejected') then
      raise exception 'TP_NO_CHECK_IN';
    end if;
  end if;

  -- Foto: obrigatória, já enviada ao armazenamento, na pasta do próprio atleta.
  if p_photo_path is null or p_photo_path not like v_athlete_id::text || '/' || p_event_id::text || '/%' then
    raise exception 'TP_PHOTO_REQUIRED';
  end if;
  if not exists (select 1 from storage.objects o
                 where o.bucket_id = 'attendance-photos' and o.name = p_photo_path) then
    raise exception 'TP_PHOTO_NOT_FOUND';
  end if;

  -- Raio.
  v_distance := public.distance_m(p_latitude, p_longitude, v_venue.latitude, v_venue.longitude);
  v_inside := v_distance <= v_venue.radius_m;

  -- Sinais de suspeita.
  if coalesce(p_is_mocked, false) then v_flags := array_append(v_flags, 'mock_location'); end if;
  if p_accuracy_m is not null and p_accuracy_m > 100 then v_flags := array_append(v_flags, 'low_accuracy'); end if;
  if p_photo_sha256 is not null and exists (
       select 1 from public.attendance_records r
        where r.photo_sha256 = p_photo_sha256 and r.athlete_id <> v_athlete_id) then
    v_flags := array_append(v_flags, 'duplicate_photo');
  end if;
  if p_device_id is not null and exists (
       select 1 from public.attendance_records r
        where r.event_id = p_event_id and r.device_id = p_device_id
          and r.athlete_id <> v_athlete_id and r.source = 'app') then
    v_flags := array_append(v_flags, 'shared_device');
  end if;

  -- Status.
  if v_inside and not coalesce(p_is_mocked, false) then
    v_status := 'valid';
  elsif v_justification is not null or coalesce(p_is_mocked, false) then
    v_status := 'pending';  -- vai para aprovação do treinador
  else
    raise exception 'TP_OUTSIDE_RADIUS'
      using detail = jsonb_build_object('distance_m', round(v_distance), 'radius_m', v_venue.radius_m)::text;
  end if;
  if not v_inside then v_flags := array_append(v_flags, 'outside_radius'); end if;

  begin
    insert into public.attendance_records (
      org_id, event_id, athlete_id, kind, server_at, client_at, synced_offline,
      latitude, longitude, accuracy_m, distance_m, photo_path, photo_sha256,
      source, recorded_by, status, justification, device_id, is_mocked_location, flags)
    values (
      v_event.org_id, p_event_id, v_athlete_id, p_kind, v_now, p_client_at, coalesce(p_synced_offline, false),
      p_latitude, p_longitude, p_accuracy_m, v_distance, p_photo_path, p_photo_sha256,
      'app', v_uid, v_status, v_justification, p_device_id, coalesce(p_is_mocked, false), v_flags)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'TP_ALREADY_RECORDED';
  end;

  insert into public.audit_log (actor_id, org_id, action, table_name, record_id, details)
  values (v_uid, v_event.org_id, 'attendance.' || p_kind, 'attendance_records', v_id::text,
          jsonb_build_object('status', v_status, 'flags', v_flags));

  return jsonb_build_object('id', v_id, 'status', v_status, 'server_at', v_now,
                            'distance_m', round(v_distance), 'radius_m', v_venue.radius_m, 'flags', v_flags);
end;
$$;
