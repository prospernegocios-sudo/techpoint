-- Fase C do incentivo, onda 2: ponto dos profissionais pelo app (decisão 1a), certificados dos cursos do COB
-- (atleta/responsável e equipe, decisão 3a), plano de mídia com fotos e leitura do uso de armazenamento.

-- ---------------------------------------------------------------------
-- Ponto dos profissionais: entrada e saída de cada treino, com localização, foto e hora do servidor
-- ---------------------------------------------------------------------
create table public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('check_in', 'check_out')),
  server_at timestamptz not null default now(),
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m real,
  distance_m double precision,
  photo_path text not null,
  photo_sha256 text,
  device_id text,
  is_mocked_location boolean not null default false,
  status text not null default 'valid' check (status in ('valid', 'pending')),
  justification text check (char_length(justification) <= 500),
  unique (event_id, profile_id, kind)
);
create index on public.staff_attendance (org_id, server_at);
create index on public.staff_attendance (profile_id, server_at);
alter table public.staff_attendance enable row level security;
grant select on public.staff_attendance to authenticated;
-- Vê: o próprio profissional e o gestor/administrador da entidade. Grava: só pela função abaixo.
create policy staff_attendance_select on public.staff_attendance for select to authenticated
  using (profile_id = auth.uid() or app_private.is_org_manager(org_id));

create function public.record_staff_attendance(
  p_event_id uuid, p_kind text, p_latitude double precision, p_longitude double precision, p_accuracy_m real,
  p_photo_path text, p_photo_sha256 text, p_device_id text, p_is_mocked boolean default false, p_justification text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_now timestamptz := now();
  v_event public.events%rowtype; v_venue public.venues%rowtype; v_org public.organizations%rowtype;
  v_distance double precision; v_inside boolean; v_status text; v_id uuid;
  v_just text := nullif(trim(coalesce(p_justification, '')), '');
begin
  if v_uid is null then raise exception 'TP_NOT_AUTHENTICATED'; end if;
  if p_kind not in ('check_in', 'check_out') then raise exception 'TP_INVALID_KIND'; end if;
  select * into v_event from public.events where id = p_event_id;
  if not found then raise exception 'TP_EVENT_NOT_FOUND'; end if;
  if v_event.status = 'canceled' then raise exception 'TP_EVENT_CANCELED'; end if;
  if not app_private.has_org_role(v_event.org_id, array['admin', 'manager', 'coach']::public.org_role[]) then raise exception 'TP_FORBIDDEN'; end if;
  select * into v_venue from public.venues where id = v_event.venue_id;
  select * into v_org from public.organizations where id = v_event.org_id;
  if p_latitude is null or p_longitude is null then raise exception 'TP_LOCATION_REQUIRED'; end if;

  if p_kind = 'check_in' then
    if v_now < v_event.starts_at - make_interval(mins => v_org.checkin_before_min)
       or v_now > v_event.ends_at then raise exception 'TP_OUTSIDE_WINDOW'; end if;
  else
    if v_now < v_event.starts_at or v_now > v_event.ends_at + make_interval(mins => v_org.checkout_after_min) then raise exception 'TP_OUTSIDE_WINDOW'; end if;
    if not exists (select 1 from public.staff_attendance s where s.event_id = p_event_id and s.profile_id = v_uid and s.kind = 'check_in') then
      raise exception 'TP_NO_CHECK_IN';
    end if;
  end if;

  if p_photo_path is null or p_photo_path not like v_event.org_id::text || '/ponto/' || v_uid::text || '/%' then raise exception 'TP_PHOTO_REQUIRED'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'org-docs' and o.name = p_photo_path) then raise exception 'TP_PHOTO_NOT_FOUND'; end if;

  v_distance := public.distance_m(p_latitude, p_longitude, v_venue.latitude, v_venue.longitude);
  v_inside := v_distance <= v_venue.radius_m;
  if v_inside and not coalesce(p_is_mocked, false) then v_status := 'valid';
  elsif v_just is not null then v_status := 'pending';
  else raise exception 'TP_OUTSIDE_RADIUS' using detail = jsonb_build_object('distance_m', round(v_distance), 'radius_m', v_venue.radius_m)::text;
  end if;

  begin
    insert into public.staff_attendance (org_id, event_id, profile_id, kind, server_at, latitude, longitude, accuracy_m, distance_m,
      photo_path, photo_sha256, device_id, is_mocked_location, status, justification)
    values (v_event.org_id, p_event_id, v_uid, p_kind, v_now, p_latitude, p_longitude, p_accuracy_m, v_distance,
      p_photo_path, p_photo_sha256, p_device_id, coalesce(p_is_mocked, false), v_status, v_just)
    returning id into v_id;
  exception when unique_violation then raise exception 'TP_ALREADY_RECORDED';
  end;
  insert into public.audit_log (actor_id, org_id, action, table_name, record_id, details)
  values (v_uid, v_event.org_id, 'staff_attendance.' || p_kind, 'staff_attendance', v_id::text, jsonb_build_object('status', v_status, 'distance_m', round(v_distance)));
  return jsonb_build_object('id', v_id, 'status', v_status, 'server_at', v_now, 'distance_m', round(v_distance), 'radius_m', v_venue.radius_m);
end; $$;
revoke all on function public.record_staff_attendance(uuid, text, double precision, double precision, real, text, text, text, boolean, text) from public, anon;
grant execute on function public.record_staff_attendance(uuid, text, double precision, double precision, real, text, text, text, boolean, text) to authenticated;

-- Fotos do ponto: pasta <entidade>/ponto/<profissional>/ no bucket privado org-docs. O profissional envia a própria;
-- gestor e administrador (com o módulo) veem todas.
create policy org_docs_ponto_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'org-docs' and (storage.foldername(name))[2] = 'ponto' and (storage.foldername(name))[3] = auth.uid()::text
              and app_private.is_org_staff(app_private.try_uuid((storage.foldername(name))[1])));
create policy org_docs_ponto_select on storage.objects for select to authenticated
  using (bucket_id = 'org-docs' and (storage.foldername(name))[2] = 'ponto' and (storage.foldername(name))[3] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Cursos obrigatórios do COB
-- Atleta: novo tipo de documento do atleta (o próprio atleta, o responsável ou a equipe enviam).
-- Equipe: certificado por profissional, enviado pelo gestor/administrador.
-- ---------------------------------------------------------------------
alter table public.athlete_documents drop constraint athlete_documents_kind_check;
alter table public.athlete_documents add constraint athlete_documents_kind_check
  check (kind in ('atestado', 'identidade', 'cpf', 'comprovante_residencia', 'autorizacao', 'doc_responsavel', 'cob_antirracismo', 'cob_manipulacao', 'outro'));

create table public.staff_certificates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  course text not null check (course in ('cob_antirracismo', 'cob_manipulacao')),
  file_path text not null unique check (split_part(file_path, '/', 1) = org_id::text and split_part(file_path, '/', 2) = 'execucao'),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.staff_certificates (org_id, profile_id);
alter table public.staff_certificates enable row level security;
grant select, insert, delete on public.staff_certificates to authenticated;
create policy staff_cert_select on public.staff_certificates for select to authenticated using (app_private.can_habilitate(org_id) or profile_id = auth.uid());
create policy staff_cert_insert on public.staff_certificates for insert to authenticated with check (app_private.can_habilitate(org_id) and uploaded_by = auth.uid());
create policy staff_cert_delete on public.staff_certificates for delete to authenticated using (app_private.can_habilitate(org_id));

-- ---------------------------------------------------------------------
-- Plano de mídia: fotos de placas, banners e redes com a marca do Governo Federal
-- ---------------------------------------------------------------------
create table public.project_media (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('placa', 'banner', 'rede_social', 'uniforme', 'materia', 'outro')),
  description text check (char_length(description) <= 500),
  link text check (char_length(link) <= 500),
  taken_on date,
  file_path text unique check (file_path is null or (split_part(file_path, '/', 1) = org_id::text and split_part(file_path, '/', 2) = 'execucao')),
  mime_type text check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (file_path is not null or link is not null)
);
create index on public.project_media (project_id, created_at);
alter table public.project_media enable row level security;
grant select, insert, delete on public.project_media to authenticated;
create policy media_all on public.project_media for all to authenticated
  using (app_private.can_habilitate(org_id)) with check (app_private.can_habilitate(org_id) and app_private.project_in_org(project_id, org_id));
create trigger media_audit after insert or delete on public.project_media for each row execute function app_private.audit_project_change();
create trigger staff_cert_audit after insert or delete on public.staff_certificates for each row execute function app_private.audit_project_change();

-- ---------------------------------------------------------------------
-- Uso do armazenamento (plano grátis do Supabase: 1 GB). Só a equipe TechPoint vê o total.
-- ---------------------------------------------------------------------
create function public.storage_usage() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not app_private.is_platform_admin() then raise exception 'TP_FORBIDDEN'; end if;
  select jsonb_build_object(
    'total_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0),
    'by_bucket', coalesce((select jsonb_object_agg(bucket_id, bytes) from (select bucket_id, sum((metadata->>'size')::bigint) bytes from storage.objects group by bucket_id) x), '{}'::jsonb),
    'limit_bytes', 1073741824)
  into v;
  return v;
end; $$;
revoke all on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated;
