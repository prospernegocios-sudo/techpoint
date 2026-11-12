-- Corrige o cadastro da entidade: o primeiro administrador é criado pela própria função de cadastro.
create or replace function app_private.guard_admin_membership() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid := coalesce(new.org_id, old.org_id);
begin
  -- O primeiro administrador é criado pela função de cadastro da entidade (marcador só desta transação).
  if auth.uid() is not null and coalesce(current_setting('techpoint.registering_org', true), '') <> 'on'
     and ((tg_op <> 'DELETE' and new.role = 'admin') or (tg_op <> 'INSERT' and old.role = 'admin'))
     and not app_private.is_org_admin(v_org) then
    raise exception 'TP_ADMIN_ONLY';
  end if;
  if tg_op <> 'INSERT' and old.role = 'admin' and old.active
     and (tg_op = 'DELETE' or not new.active or new.role <> 'admin')
     and not exists (select 1 from public.memberships m
                     where m.org_id = old.org_id and m.role = 'admin' and m.active and m.profile_id is not null and m.id <> old.id) then
    raise exception 'TP_LAST_ADMIN';
  end if;
  return coalesce(new, old);
end; $$;

