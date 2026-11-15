-- Exclusão automática das fotos de presença (decisão D76, opção A):
-- a foto é apagada depois do prazo da entidade (24 meses), EXCETO quando o registro pertence a um projeto
-- cujo prazo de guarda da documentação (informado pelo gestor) ainda não terminou.
-- O arquivo é apagado pela Edge Function "purge-photos" (a API de arquivos não permite apagar pelo SQL).

alter table public.projects add column records_retention_until date;
comment on column public.projects.records_retention_until is
  'Guardar fotos e registros do projeto até esta data (prazo da prestação de contas exigido pelo financiador/norma).';

alter table public.attendance_records add column photo_purged_at timestamptz;

-- Fotos vencidas: passaram do prazo da entidade e nenhum projeto ativo na data do treino pede guarda maior.
create function app_private.photos_due_for_purge(p_limit int default 500)
returns table (record_id uuid, photo_path text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.photo_path
  from public.attendance_records r
  join public.organizations o on o.id = r.org_id
  join public.events e on e.id = r.event_id
  where r.photo_path is not null
    and r.photo_purged_at is null
    and r.server_at < now() - make_interval(months => o.photo_retention_months)
    and not exists (
      select 1 from public.project_teams pt
      join public.projects p on p.id = pt.project_id
      where pt.team_id = e.team_id
        and (e.starts_at at time zone 'America/Sao_Paulo')::date between p.starts_on and p.ends_on
        and p.records_retention_until is not null
        and p.records_retention_until >= current_date
    )
  order by r.server_at
  limit greatest(1, least(p_limit, 1000));
$$;

-- Usadas só pela Edge Function (chave de serviço). Ninguém do app chama.
create function public.purge_photos_next(p_limit int default 500)
returns table (record_id uuid, photo_path text)
language sql stable security definer set search_path = '' as $$
  select * from app_private.photos_due_for_purge(p_limit);
$$;

create function public.purge_photos_mark(p_record_ids uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  update public.attendance_records r
     set photo_path = null, photo_purged_at = now()
   where r.id = any (p_record_ids) and r.photo_path is not null
     and r.id in (select d.record_id from app_private.photos_due_for_purge(1000) d);
  get diagnostics v = row_count;
  if v > 0 then
    insert into public.audit_log (action, table_name, details)
    values ('photos_purged', 'attendance_records', jsonb_build_object('count', v));
  end if;
  return v;
end; $$;

revoke all on function public.purge_photos_next(int), public.purge_photos_mark(uuid[]) from public, anon, authenticated;
grant execute on function public.purge_photos_next(int), public.purge_photos_mark(uuid[]) to service_role;
