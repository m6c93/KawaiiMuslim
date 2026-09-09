-- Images des e-mails de la newsletter.
-- Les clients mail (Gmail, Outlook, Apple Mail) n’affichent pas les images
-- intégrées en base64 : elles doivent être hébergées sur une URL publique.
-- Ce bucket reçoit les images extraites des e-mails HTML importés dans le studio.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'newsletter-images',
  'newsletter-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "newsletter_images_admin_insert" on storage.objects;
create policy "newsletter_images_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'newsletter-images' and public.is_admin());

drop policy if exists "newsletter_images_admin_update" on storage.objects;
create policy "newsletter_images_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'newsletter-images' and public.is_admin())
  with check (bucket_id = 'newsletter-images' and public.is_admin());

drop policy if exists "newsletter_images_admin_delete" on storage.objects;
create policy "newsletter_images_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'newsletter-images' and public.is_admin());

commit;
