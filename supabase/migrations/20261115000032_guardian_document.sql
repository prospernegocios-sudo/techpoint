-- Documento de identificação do responsável (D98): RG, CNH ou passaporte, guardado na pasta do atleta
-- e ligado ao responsável. Um por responsável: o novo substitui o anterior (fica como versão anterior).
alter table public.athlete_documents drop constraint athlete_documents_kind_check;
alter table public.athlete_documents add constraint athlete_documents_kind_check
  check (kind in ('atestado', 'identidade', 'cpf', 'comprovante_residencia', 'autorizacao', 'doc_responsavel', 'outro'));
alter table public.athlete_documents add column guardian_id uuid references public.athlete_guardians (id) on delete set null;

create or replace function app_private.supersede_document() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('identidade', 'comprovante_residencia', 'cpf') then
    update public.athlete_documents
       set superseded_at = now(), superseded_by = new.id
     where athlete_id = new.athlete_id and kind = new.kind and id <> new.id and superseded_at is null;
  elsif new.kind = 'doc_responsavel' and new.guardian_id is not null then
    update public.athlete_documents
       set superseded_at = now(), superseded_by = new.id
     where athlete_id = new.athlete_id and kind = 'doc_responsavel' and guardian_id = new.guardian_id
       and id <> new.id and superseded_at is null;
  end if;
  return new;
end; $$;
