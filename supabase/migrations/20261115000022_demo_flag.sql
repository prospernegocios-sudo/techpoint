-- Marca de dados fictícios (D77): separa o que é teste do que é real, SEM apagar nada.
-- Tudo o que existe hoje é fictício (fase de testes). Daqui em diante, o que for criado por uma
-- conta de teste também nasce marcado como fictício. Equipes e locais não são marcados: são a
-- estrutura real do DF Vôlei e serão usados no piloto.

alter table public.profiles   add column is_demo boolean not null default false;
alter table public.athletes   add column is_demo boolean not null default false;
alter table public.events     add column is_demo boolean not null default false;
alter table public.projects   add column is_demo boolean not null default false;

update public.profiles set is_demo = true where email like '%@guerreiro.com.br';
update public.athletes set is_demo = true;
update public.events   set is_demo = true;
update public.projects set is_demo = true;

-- Quem cria pelo app com conta de teste gera dado fictício.
create function app_private.mark_demo_from_creator() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.is_demo and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_demo) then
    new.is_demo := true;
  end if;
  return new;
end; $$;

create trigger athletes_demo before insert on public.athletes for each row execute function app_private.mark_demo_from_creator();
create trigger events_demo   before insert on public.events   for each row execute function app_private.mark_demo_from_creator();
create trigger projects_demo before insert on public.projects for each row execute function app_private.mark_demo_from_creator();

-- Ninguém se marca ou se desmarca como conta de teste pelo app.
create function app_private.guard_profile_demo() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and new.is_demo is distinct from old.is_demo and not app_private.is_platform_admin() then
    raise exception 'TP_FORBIDDEN';
  end if;
  return new;
end; $$;
create trigger profiles_demo_guard before update on public.profiles for each row execute function app_private.guard_profile_demo();

-- Contas de teste novas (@guerreiro.com.br) já entram marcadas.
create function app_private.mark_demo_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.email like '%@guerreiro.com.br' then new.is_demo := true; end if;
  return new;
end; $$;
create trigger profiles_demo_insert before insert on public.profiles for each row execute function app_private.mark_demo_profile();
