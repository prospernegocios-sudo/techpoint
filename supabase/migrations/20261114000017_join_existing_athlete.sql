-- Aprovação de pedido: se a conta já tem cadastro de atleta na entidade, reaproveita (evita duplicar).
create or replace function public.decide_join_request(p_request_id uuid, p_approve boolean, p_link_athlete_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_req public.athlete_join_requests; v_ath uuid; v_email text; v_token text;
begin
  select * into v_req from public.athlete_join_requests where id = p_request_id;
  if not found or not app_private.is_org_staff(v_req.org_id) then raise exception 'TP_FORBIDDEN'; end if;
  if v_req.status <> 'pending' then raise exception 'TP_ALREADY_DECIDED'; end if;
  if not p_approve then
    update public.athlete_join_requests set status = 'rejected', decided_by = v_uid, decided_at = now() where id = p_request_id;
    return jsonb_build_object('status', 'rejected');
  end if;
  select email into v_email from public.profiles where id = v_req.profile_id;
  -- Quem pede já tem cadastro de atleta nesta entidade: usa o mesmo cadastro e só acrescenta o time.
  select id into v_ath from public.athletes where org_id = v_req.org_id and profile_id = v_req.profile_id;
  if v_ath is not null then
    null;
  elsif p_link_athlete_id is not null then
    update public.athletes set profile_id = v_req.profile_id
     where id = p_link_athlete_id and org_id = v_req.org_id and profile_id is null
    returning id into v_ath;
    if v_ath is null then raise exception 'TP_LINK_INVALID'; end if;
  else
    insert into public.athletes (org_id, full_name, birth_date, email, profile_id, status, created_by)
    values (v_req.org_id, v_req.full_name, v_req.birth_date, v_email, v_req.profile_id,
            case when v_req.birth_date > (current_date - interval '18 years')::date then 'pending_consent' else 'active' end, v_uid)
    returning id into v_ath;
  end if;
  insert into public.team_members (team_id, athlete_id) values (v_req.team_id, v_ath) on conflict do nothing;
  insert into public.memberships (org_id, profile_id, role) values (v_req.org_id, v_req.profile_id, 'athlete') on conflict do nothing;
  if coalesce(v_req.guardian_phone, v_req.guardian_email) is not null then
    insert into public.athlete_guardians (org_id, athlete_id, name, phone, email, relationship, created_by)
    values (v_req.org_id, v_ath, v_req.guardian_name, v_req.guardian_phone, v_req.guardian_email, v_req.guardian_relationship, v_uid)
    returning token into v_token;
  end if;
  update public.athlete_join_requests set status = 'approved', athlete_id = v_ath, decided_by = v_uid, decided_at = now() where id = p_request_id;
  return jsonb_build_object('status', 'approved', 'athlete_id', v_ath, 'guardian_token', v_token);
end; $$;
