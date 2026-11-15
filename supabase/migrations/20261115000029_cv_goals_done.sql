-- Metas com marcação de conquista (D90): cada meta pode ser marcada/desmarcada como conquistada.
alter table public.athlete_cv_profile add column goals_done text[] not null default '{}' check (cardinality(goals_done) <= 10);

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
          'headline', p.headline, 'about', p.about, 'about_align', p.about_align, 'goals', to_jsonb(p.goals), 'goals_done', to_jsonb(p.goals_done), 'photo_path', p.photo_path, 'gallery', to_jsonb(p.gallery),
          'city', p.city, 'show_contacts', p.show_contacts,
          'contact_phone', case when p_private or p.show_contacts then p.contact_phone end,
          'contact_email', case when p_private or p.show_contacts then p.contact_email end,
          'instagram', case when p_private or p.show_contacts then p.instagram end,
          'references', case when p_private or p.show_contacts then p."references" else '[]'::jsonb end)
        from public.athlete_cv_profile p where p.athlete_id = p_athlete)
    );
$$;

