-- Pedido de correção de um registro pelo atleta (achado de UX nº 17): o treinador resolve,
-- e tudo fica na auditoria. O registro em si só muda pelas funções do servidor.
create table public.attendance_correction_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  record_id uuid not null references public.attendance_records (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  reason text not null check (char_length(reason) between 5 and 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution_note text check (char_length(resolution_note) <= 500),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz
);
create index on public.attendance_correction_requests (org_id, status);
create unique index correction_one_open on public.attendance_correction_requests (record_id) where status = 'open';

revoke all on public.attendance_correction_requests from anon;
revoke update on public.attendance_correction_requests from authenticated;
grant update (status, resolution_note, resolved_by, resolved_at) on public.attendance_correction_requests to authenticated;
alter table public.attendance_correction_requests enable row level security;

create policy corr_select on public.attendance_correction_requests for select to authenticated
  using (app_private.is_org_staff(org_id) or athlete_id in (select app_private.my_athlete_ids()));
create policy corr_insert on public.attendance_correction_requests for insert to authenticated
  with check (
    athlete_id in (select app_private.my_athlete_ids())
    and exists (select 1 from public.attendance_records r
                where r.id = record_id and r.athlete_id = attendance_correction_requests.athlete_id and r.org_id = attendance_correction_requests.org_id)
  );
create policy corr_update on public.attendance_correction_requests for update to authenticated
  using (app_private.is_org_staff(org_id)) with check (app_private.is_org_staff(org_id));

create trigger corr_audit after insert or update on public.attendance_correction_requests
  for each row execute function app_private.audit_project_change();
