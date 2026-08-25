-- Kawaii Muslim World — rendre les PDF des livres privés
-- À exécuter après billing.sql et admin-professional.sql.

begin;

update storage.buckets
set public = false
where id = 'content-books';

drop policy if exists "content_books_subscriber_read" on storage.objects;
create policy "content_books_subscriber_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'content-books'
    and (
      public.can_manage_content()
      or exists (
        select 1
        from public.subscriptions subscription
        where subscription.user_id = auth.uid()
          and subscription.status in ('active', 'trialing', 'past_due')
      )
    )
  );

commit;
