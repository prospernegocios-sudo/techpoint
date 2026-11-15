-- Se o responsável negou o item "documentos" no consentimento, ninguém envia documentos do atleta menor.
create function app_private.consent_allows(p_athlete uuid, p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not app_private.athlete_is_minor(p_athlete)
      or not exists (
        select 1 from public.guardian_consents c
        where c.athlete_id = p_athlete and c.revoked_at is null and c.scope ->> p_key = 'false'
      );
$$;
grant execute on function app_private.consent_allows(uuid, text) to authenticated;

drop policy athlete_documents_insert on public.athlete_documents;
create policy athlete_documents_insert on public.athlete_documents for insert to authenticated
  with check (app_private.can_access_athlete(athlete_id) and app_private.athlete_in_org(athlete_id, org_id)
              and uploaded_by = auth.uid() and app_private.consent_allows(athlete_id, 'documents'));
