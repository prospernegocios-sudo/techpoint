-- Fase 2 · Onda 1: documentos do atleta (atestado, identidade, etc.) e pedido de exclusão de conta.
-- Quem acessa os documentos de um atleta: a equipe da entidade, o próprio atleta e os responsáveis ligados a ele.

-- ---------------------------------------------------------------------
-- Quem pode ver/enviar documentos deste atleta?
-- ---------------------------------------------------------------------
create function app_private.can_access_athlete(p_athlete uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.athletes a
    where a.id = p_athlete
      and (app_private.is_org_staff(a.org_id)
           or a.profile_id = auth.uid()
           or a.id in (select app_private.my_guarded_athlete_ids()))
  );
$$;

create function app_private.athlete_in_org(p_athlete uuid, p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.athletes a where a.id = p_athlete and a.org_id = p_org);
$$;
grant execute on function app_private.can_access_athlete(uuid), app_private.athlete_in_org(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Documentos
-- ---------------------------------------------------------------------
create table public.athlete_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  kind text not null check (kind in ('atestado', 'identidade', 'cpf', 'comprovante_residencia', 'autorizacao', 'outro')),
  title text check (title is null or char_length(title) <= 120),
  file_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  valid_until date,
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- o arquivo precisa estar na pasta <entidade>/<atleta>/ do próprio atleta
  check (split_part(file_path, '/', 1) = org_id::text and split_part(file_path, '/', 2) = athlete_id::text)
);
create index on public.athlete_documents (athlete_id, created_at desc);
create index on public.athlete_documents (org_id);

alter table public.athlete_documents enable row level security;
grant select, insert, delete on public.athlete_documents to authenticated;

create policy athlete_documents_select on public.athlete_documents for select to authenticated
  using (app_private.can_access_athlete(athlete_id));
create policy athlete_documents_insert on public.athlete_documents for insert to authenticated
  with check (app_private.can_access_athlete(athlete_id) and app_private.athlete_in_org(athlete_id, org_id)
              and uploaded_by = auth.uid());
-- Apagar: a equipe da entidade ou quem enviou.
create policy athlete_documents_delete on public.athlete_documents for delete to authenticated
  using (app_private.is_org_staff(org_id) or uploaded_by = auth.uid());

create trigger athlete_documents_audit after insert or delete on public.athlete_documents
  for each row execute function app_private.audit_project_change();

-- Arquivos: bucket privado, até 10 MB, PDF/PNG/JPG; pasta <entidade>/<atleta>/<arquivo>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('athlete-docs', 'athlete-docs', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy athlete_docs_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'athlete-docs'
    and app_private.athlete_in_org(app_private.try_uuid((storage.foldername(name))[2]), app_private.try_uuid((storage.foldername(name))[1]))
    and app_private.can_access_athlete(app_private.try_uuid((storage.foldername(name))[2]))
  );
create policy athlete_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'athlete-docs' and app_private.can_access_athlete(app_private.try_uuid((storage.foldername(name))[2])));
create policy athlete_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'athlete-docs'
         and (app_private.is_org_staff(app_private.try_uuid((storage.foldername(name))[1])) or owner_id = auth.uid()::text));

-- ---------------------------------------------------------------------
-- Pedido de exclusão de conta e de dados (LGPD art. 18; exigência do Google Play)
-- O pedido é registrado aqui; o atendimento segue a política de retenção aprovada pelo dono do produto.
-- ---------------------------------------------------------------------
create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  email text,
  reason text check (reason is null or char_length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'done', 'rejected', 'canceled')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.profiles (id) on delete set null,
  note text
);
create unique index deletion_requests_one_open on public.deletion_requests (profile_id) where status = 'pending';

alter table public.deletion_requests enable row level security;
grant select on public.deletion_requests to authenticated;
create policy deletion_requests_select on public.deletion_requests for select to authenticated
  using (profile_id = auth.uid() or app_private.is_platform_admin());

create function public.request_account_deletion(p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'TP_FORBIDDEN'; end if;
  select id into v_id from public.deletion_requests where profile_id = auth.uid() and status = 'pending';
  if v_id is not null then return jsonb_build_object('id', v_id, 'already', true); end if;
  select email into v_email from public.profiles where id = auth.uid();
  insert into public.deletion_requests (profile_id, email, reason)
  values (auth.uid(), v_email, nullif(trim(p_reason), '')) returning id into v_id;
  insert into public.audit_log (actor_id, action, table_name, record_id, details)
  values (auth.uid(), 'deletion_requested', 'deletion_requests', v_id::text, '{}'::jsonb);
  return jsonb_build_object('id', v_id, 'already', false);
end; $$;

create function public.cancel_account_deletion() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.deletion_requests set status = 'canceled', processed_at = now()
  where profile_id = auth.uid() and status = 'pending';
end; $$;

revoke all on function public.request_account_deletion(text), public.cancel_account_deletion() from public, anon;
grant execute on function public.request_account_deletion(text), public.cancel_account_deletion() to authenticated;
