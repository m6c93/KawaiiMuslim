-- Images des e-mails de la newsletter.
-- Les clients mail (Gmail, Outlook, Apple Mail) n’affichent pas les images
-- intégrées en base64 : elles doivent être hébergées sur une URL publique.
-- Ce bucket reçoit les images extraites des e-mails HTML importés dans le studio.
begin;

-- Some long-lived admin sessions created before MFA was enabled do not carry
-- an `aal` claim even though the newsletter API has already authenticated the
-- active administrator. Keep this storage check scoped to active admins and
-- accept those legacy sessions; explicit aal1 sessions remain rejected.
create or replace function public.can_manage_newsletter_images()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal2') = 'aal2'
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'admin'
        and is_active = true
    );
$$;

revoke all on function public.can_manage_newsletter_images() from public;
grant execute on function public.can_manage_newsletter_images() to authenticated;

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
  with check (bucket_id = 'newsletter-images' and public.can_manage_newsletter_images());

-- Supabase Storage requires SELECT in addition to INSERT/UPDATE when x-upsert
-- is enabled, even though the bucket itself is public for e-mail clients.
drop policy if exists "newsletter_images_admin_select" on storage.objects;
create policy "newsletter_images_admin_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'newsletter-images' and public.can_manage_newsletter_images());

drop policy if exists "newsletter_images_admin_update" on storage.objects;
create policy "newsletter_images_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'newsletter-images' and public.can_manage_newsletter_images())
  with check (bucket_id = 'newsletter-images' and public.can_manage_newsletter_images());

drop policy if exists "newsletter_images_admin_delete" on storage.objects;
create policy "newsletter_images_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'newsletter-images' and public.can_manage_newsletter_images());

commit;
