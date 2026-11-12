-- Cadastro da entidade: liga o marcador que permite criar o primeiro administrador.
create or replace function public.register_organization(p_admin jsonb, p_org jsonb, p_reps jsonb, p_terms_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_cnpj text := regexp_replace(coalesce(p_org->>'cnpj', ''), '\D', '', 'g');
  v_cpf text := regexp_replace(coalesce(p_admin->>'cpf', ''), '\D', '', 'g');
  v_name text := coalesce(nullif(trim(p_org->>'trade_name'), ''), trim(p_org->>'legal_name'));
  v_slug text; v_org uuid; v_rep jsonb;
begin
  if v_uid is null then raise exception 'TP_NOT_AUTHENTICATED'; end if;
  if not app_private.valid_cnpj(v_cnpj) then raise exception 'TP_INVALID_CNPJ'; end if;
  if not app_private.valid_cpf(v_cpf) then raise exception 'TP_INVALID_CPF'; end if;
  if char_length(coalesce(trim(p_org->>'legal_name'), '')) < 3 then raise exception 'TP_LEGAL_NAME_REQUIRED'; end if;
  if char_length(coalesce(trim(p_admin->>'full_name'), '')) < 3 then raise exception 'TP_NAME_REQUIRED'; end if;
  if coalesce(trim(p_terms_version), '') = '' then raise exception 'TP_TERMS_REQUIRED'; end if;
  if exists (select 1 from public.organizations where cnpj = v_cnpj) then raise exception 'TP_CNPJ_EXISTS'; end if;
  if exists (select 1 from public.profile_private where cpf = v_cpf and profile_id <> v_uid) then raise exception 'TP_CPF_IN_USE'; end if;

  v_slug := left(regexp_replace(regexp_replace(lower(translate(v_name,
              'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
              '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'), 40);
  if char_length(v_slug) < 2 then v_slug := 'entidade'; end if;
  v_slug := v_slug || '-' || right(v_cnpj, 6);

  insert into public.organizations (name, slug, legal_name, trade_name, cnpj, state_registration, municipal_registration,
      cep, street, street_number, complement, district, city, uf, phone, email, website, receita_status,
      created_via, terms_version, terms_accepted_at, terms_accepted_by, review_status, photo_retention_months)
  values (left(v_name, 120), v_slug, trim(p_org->>'legal_name'), nullif(trim(p_org->>'trade_name'), ''), v_cnpj,
      nullif(upper(trim(p_org->>'state_registration')), ''), nullif(trim(p_org->>'municipal_registration'), ''),
      nullif(regexp_replace(coalesce(p_org->>'cep', ''), '\D', '', 'g'), ''), nullif(trim(p_org->>'street'), ''),
      nullif(trim(p_org->>'street_number'), ''), nullif(trim(p_org->>'complement'), ''), nullif(trim(p_org->>'district'), ''),
      nullif(trim(p_org->>'city'), ''), nullif(upper(trim(p_org->>'uf')), ''),
      nullif(regexp_replace(coalesce(p_org->>'phone', ''), '\D', '', 'g'), ''), nullif(lower(trim(p_org->>'email')), ''),
      nullif(trim(p_org->>'website'), ''), nullif(trim(p_org->>'receita_status'), ''),
      'self_signup', p_terms_version, now(), v_uid, 'pending', 24)
  returning id into v_org;

  perform set_config('techpoint.registering_org', 'on', true);
  insert into public.memberships (org_id, profile_id, role, title)
  values (v_org, v_uid, 'admin', nullif(trim(p_admin->>'title'), ''));
  perform set_config('techpoint.registering_org', 'off', true);

  insert into public.profile_private (profile_id, cpf, phone)
  values (v_uid, v_cpf, nullif(regexp_replace(coalesce(p_admin->>'phone', ''), '\D', '', 'g'), ''))
  on conflict (profile_id) do update set cpf = excluded.cpf, phone = coalesce(excluded.phone, public.profile_private.phone);

  update public.profiles set full_name = trim(p_admin->>'full_name') where id = v_uid;

  for v_rep in select * from jsonb_array_elements(coalesce(p_reps, '[]'::jsonb)) loop
    insert into public.org_legal_representatives (org_id, full_name, cpf, role_title, email, phone, term_start, term_end, profile_id)
    values (v_org, trim(v_rep->>'full_name'),
      nullif(regexp_replace(coalesce(v_rep->>'cpf', ''), '\D', '', 'g'), ''), nullif(trim(v_rep->>'role_title'), ''),
      nullif(lower(trim(v_rep->>'email')), ''), nullif(regexp_replace(coalesce(v_rep->>'phone', ''), '\D', '', 'g'), ''),
      nullif(v_rep->>'term_start', '')::date, nullif(v_rep->>'term_end', '')::date,
      case when coalesce((v_rep->>'is_me')::boolean, false) then v_uid end);
  end loop;

  insert into public.audit_log (actor_id, org_id, action, table_name, record_id, details)
  values (v_uid, v_org, 'organization_registered', 'organizations', v_org::text,
          jsonb_build_object('cnpj', v_cnpj, 'terms_version', p_terms_version, 'receita_status', p_org->>'receita_status'));
  return jsonb_build_object('org_id', v_org);
end;
$$;

