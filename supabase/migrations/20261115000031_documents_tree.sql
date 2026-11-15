-- Documentos em árvore (D94): tipos únicos (identidade, comprovante de residência, CPF antigo) são substituídos
-- pelo envio mais novo; o anterior fica como "versão anterior". Atestados, autorizações e outros: vários, sem limite.
alter table public.athlete_documents
  add column superseded_at timestamptz,
  add column superseded_by uuid references public.athlete_documents (id) on delete set null;

create function app_private.supersede_document() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('identidade', 'comprovante_residencia', 'cpf') then
    update public.athlete_documents
       set superseded_at = now(), superseded_by = new.id
     where athlete_id = new.athlete_id and kind = new.kind and id <> new.id and superseded_at is null;
  end if;
  return new;
end; $$;
create trigger athlete_documents_supersede after insert on public.athlete_documents
  for each row execute function app_private.supersede_document();

-- Atestados vencidos ou vencendo (30 dias) na entidade, para o painel da equipe.
create function public.org_documents_alerts(p_org_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not app_private.is_org_staff(p_org_id) then null else jsonb_build_object(
    'expiring', (select count(*) from public.athlete_documents d where d.org_id = p_org_id and d.kind = 'atestado'
                 and d.superseded_at is null and d.valid_until between current_date and current_date + 30),
    'expired', (select count(distinct d.athlete_id) from public.athlete_documents d where d.org_id = p_org_id and d.kind = 'atestado'
                and d.valid_until < current_date
                and not exists (select 1 from public.athlete_documents n where n.athlete_id = d.athlete_id and n.kind = 'atestado'
                                and (n.valid_until is null or n.valid_until >= current_date)))
  ) end;
$$;
revoke all on function public.org_documents_alerts(uuid) from public, anon;
grant execute on function public.org_documents_alerts(uuid) to authenticated;
