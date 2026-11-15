-- Currículo esportivo completo (D84, D85): perfil do atleta (foto, título, sobre mim, metas, contatos,
-- referências, galeria), "Conquista" nos itens, tipo "Prêmio individual".
-- Contatos e referências no link público só se o atleta/responsável ligar "mostrar contatos" (2a).

alter table public.athlete_cv_entries drop constraint athlete_cv_entries_kind_check;
alter table public.athlete_cv_entries add constraint athlete_cv_entries_kind_check
  check (kind in ('clube', 'competicao', 'titulo', 'premio', 'selecao', 'curso', 'outro'));
alter table public.athlete_cv_entries add column result text check (result is null or char_length(result) <= 80);

create table public.athlete_cv_profile (
  athlete_id uuid primary key references public.athletes (id) on delete cascade,
  headline text check (headline is null or char_length(headline) <= 80),
  about text check (about is null or char_length(about) <= 1500),
  goals text[] not null default '{}' check (cardinality(goals) <= 10),
  photo_path text,
  gallery text[] not null default '{}' check (cardinality(gallery) <= 6),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 30),
  contact_email text check (contact_email is null or char_length(contact_email) <= 120),
  instagram text check (instagram is null or char_length(instagram) <= 60),
  city text check (city is null or char_length(city) <= 80),
  show_contacts boolean not null default false,
  "references" jsonb not null default '[]'::jsonb check (jsonb_typeof("references") = 'array' and jsonb_array_length("references") <= 4),
  updated_at timestamptz not null default now()
);
alter table public.athlete_cv_profile enable row level security;
grant select, insert, update on public.athlete_cv_profile to authenticated;
-- O currículo é do atleta: ele e os responsáveis editam; a equipe da entidade vê.
create policy cv_profile_select on public.athlete_cv_profile for select to authenticated using (app_private.can_access_athlete(athlete_id));
create policy cv_profile_insert on public.athlete_cv_profile for insert to authenticated with check (app_private.is_self_or_guardian(athlete_id));
create policy cv_profile_update on public.athlete_cv_profile for update to authenticated
  using (app_private.is_self_or_guardian(athlete_id)) with check (app_private.is_self_or_guardian(athlete_id));

-- Fotos do currículo: <atleta>/<arquivo>. Atleta e responsáveis enviam; equipe vê;
-- quem tem um link ativo de currículo também vê (o link mostra as fotos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('athlete-cv', 'athlete-cv', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create function app_private.cv_shared(p_athlete uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.athlete_cv_shares s where s.athlete_id = p_athlete and s.revoked_at is null and s.expires_at > now())
     and app_private.athlete_cleared(p_athlete);
$$;
grant execute on function app_private.cv_shared(uuid) to anon, authenticated;

create policy athlete_cv_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'athlete-cv' and app_private.is_self_or_guardian(app_private.try_uuid((storage.foldername(name))[1])));
create policy athlete_cv_delete on storage.objects for delete to authenticated
  using (bucket_id = 'athlete-cv' and app_private.is_self_or_guardian(app_private.try_uuid((storage.foldername(name))[1])));
create policy athlete_cv_select on storage.objects for select to authenticated
  using (bucket_id = 'athlete-cv' and (app_private.can_access_athlete(app_private.try_uuid((storage.foldername(name))[1]))
         or app_private.cv_shared(app_private.try_uuid((storage.foldername(name))[1]))));
create policy athlete_cv_select_public on storage.objects for select to anon
  using (bucket_id = 'athlete-cv' and app_private.cv_shared(app_private.try_uuid((storage.foldername(name))[1])));

-- Currículo montado: inclui o perfil; contatos e referências só para quem é "de dentro" ou se o atleta liberou.
create or replace function app_private.build_cv_full(p_athlete uuid, p_include_body boolean, p_private boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select app_private.build_cv(p_athlete, p_include_body)
    || jsonb_build_object(
      'entries', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'title', c.title, 'institution', c.institution,
                     'category', c.category, 'location', c.location, 'started_on', c.started_on, 'ended_on', c.ended_on,
                     'description', c.description, 'result', c.result, 'verified', c.verified_at is not null,
                     'verified_by_org', case when c.verified_at is not null then (select o.name from public.organizations o where o.id = c.org_id) end)
                     order by c.started_on desc) from public.athlete_cv_entries c where c.athlete_id = p_athlete), '[]'::jsonb),
      'profile', (select jsonb_build_object(
          'headline', p.headline, 'about', p.about, 'goals', to_jsonb(p.goals), 'photo_path', p.photo_path, 'gallery', to_jsonb(p.gallery),
          'city', p.city, 'show_contacts', p.show_contacts,
          'contact_phone', case when p_private or p.show_contacts then p.contact_phone end,
          'contact_email', case when p_private or p.show_contacts then p.contact_email end,
          'instagram', case when p_private or p.show_contacts then p.instagram end,
          'references', case when p_private or p.show_contacts then p."references" else '[]'::jsonb end)
        from public.athlete_cv_profile p where p.athlete_id = p_athlete)
    );
$$;

create or replace function public.athlete_cv(p_athlete_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.can_access_athlete(p_athlete_id) then raise exception 'TP_FORBIDDEN'; end if;
  return app_private.build_cv_full(p_athlete_id, app_private.is_self_or_guardian(p_athlete_id), true);
end; $$;

create or replace function public.public_cv(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_athlete uuid;
begin
  select s.athlete_id into v_athlete from public.athlete_cv_shares s
  where s.token = p_token and s.revoked_at is null and s.expires_at > now();
  if v_athlete is null or not app_private.athlete_cleared(v_athlete) then return null; end if;
  return app_private.build_cv_full(v_athlete, false, false);
end; $$;

-- Importação gratuita (D85): limite de uso por pessoa para evitar abuso da leitura de PDF.
create table public.cv_import_log (
  id bigint generated always as identity primary key,
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  source text not null check (source in ('pdf', 'texto', 'assistente')),
  items int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.cv_import_log enable row level security;
grant select, insert on public.cv_import_log to authenticated;
create policy cv_import_insert on public.cv_import_log for insert to authenticated
  with check (profile_id = auth.uid() and app_private.can_access_athlete(athlete_id));
create policy cv_import_select on public.cv_import_log for select to authenticated using (profile_id = auth.uid());
