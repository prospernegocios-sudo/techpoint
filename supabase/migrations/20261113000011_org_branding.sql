-- Logo da entidade e tema com as cores do logo (decisão D57).
alter table public.organizations
  add column logo_path text check (char_length(logo_path) <= 300),
  add column theme_primary text check (theme_primary is null or theme_primary ~ '^#[0-9A-F]{6}$'),
  add column theme_accent text check (theme_accent is null or theme_accent ~ '^#[0-9A-F]{6}$');

-- Só o administrador troca logo e cores (as demais colunas já seguem a regra de update).
grant update (logo_path, theme_primary, theme_accent) on public.organizations to authenticated;

-- Logos são públicos (aparecem no app, no site e nos PDFs); só o administrador da entidade envia.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-logos', 'org-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy org_logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'org-logos' and app_private.is_org_admin(app_private.try_uuid((storage.foldername(name))[1])));
create policy org_logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'org-logos' and app_private.is_org_admin(app_private.try_uuid((storage.foldername(name))[1])));
