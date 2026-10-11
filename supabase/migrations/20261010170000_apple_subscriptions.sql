begin;
-- Apple and Stripe remain independent: one provider never overwrites the other.
create table public.apple_subscriptions (
  original_transaction_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id text not null,
  environment text not null check (environment in ('Production','Sandbox')),
  product_id text not null check (product_id in ('com.kawaiimuslimworld.family1.monthly','com.kawaiimuslimworld.family2.monthly','com.kawaiimuslimworld.family3.monthly')),
  child_limit smallint not null check (child_limit between 1 and 3),
  apple_status smallint not null check (apple_status between 1 and 5),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  signed_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.apple_subscriptions enable row level security;
revoke all on public.apple_subscriptions from anon,authenticated;
grant select on public.apple_subscriptions to authenticated;
create policy apple_subscription_owner_read on public.apple_subscriptions for select to authenticated using (user_id=auth.uid());

-- Called only after signed Apple data + current subscription status verification.
create function public.save_verified_apple_subscription(p jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
  insert into public.apple_subscriptions(original_transaction_id,user_id,transaction_id,environment,product_id,child_limit,apple_status,expires_at,revoked_at,signed_at)
  values(p->>'original_transaction_id',(p->>'user_id')::uuid,p->>'transaction_id',p->>'environment',p->>'product_id',(p->>'child_limit')::smallint,(p->>'apple_status')::smallint,(p->>'expires_at')::timestamptz,(p->>'revoked_at')::timestamptz,(p->>'signed_at')::timestamptz)
  on conflict(original_transaction_id) do update set transaction_id=excluded.transaction_id,product_id=excluded.product_id,child_limit=excluded.child_limit,apple_status=excluded.apple_status,expires_at=excluded.expires_at,revoked_at=excluded.revoked_at,signed_at=excluded.signed_at,updated_at=now()
  where apple_subscriptions.user_id=excluded.user_id
    and apple_subscriptions.environment=excluded.environment
    and apple_subscriptions.signed_at <= excluded.signed_at;
  if not found then raise exception 'Transaction owner mismatch or stale transaction'; end if;
end $$;
revoke all on function public.save_verified_apple_subscription(jsonb) from public,anon,authenticated;
grant execute on function public.save_verified_apple_subscription(jsonb) to service_role;

create function public.family_subscription_for(owner uuid)
returns table(plan_code text,child_limit smallint,status text,cancel_at_period_end boolean,current_period_end timestamptz,price_id text,provider text)
language sql stable security definer set search_path=public as $$
  select * from (
    select s.plan_code,s.child_limit,s.status,s.cancel_at_period_end,s.current_period_end,s.price_id,'stripe'::text as provider
    from public.subscriptions s where s.user_id=owner and s.status in ('active','trialing','past_due')
    union all
    select case a.child_limit when 1 then 'family_1_child' when 2 then 'family_2_children' else 'family_3_children' end,
      a.child_limit,'active'::text,false,a.expires_at,a.product_id,'apple'::text
    from public.apple_subscriptions a where a.user_id=owner and a.revoked_at is null and a.apple_status in (1,4) and a.expires_at>now()
  ) available where exists(select 1 from public.profiles p where p.id=owner and p.is_active=true) order by child_limit desc,current_period_end desc nulls last limit 1;
$$;
revoke all on function public.family_subscription_for(uuid) from public,anon,authenticated;

create function public.get_family_subscription()
returns table(plan_code text,child_limit smallint,status text,cancel_at_period_end boolean,current_period_end timestamptz,price_id text,provider text)
language sql stable security definer set search_path=public as $$ select * from public.family_subscription_for(auth.uid()); $$;
revoke all on function public.get_family_subscription() from public,anon;
grant execute on function public.get_family_subscription() to authenticated;

create or replace function public.enforce_child_profile_limit() returns trigger
language plpgsql security definer set search_path=public as $$
declare allowed integer; existing integer;
begin
  select coalesce(max(child_limit),1) into allowed from public.family_subscription_for(new.parent_id);
  select count(*) into existing from public.child_profiles where parent_id=new.parent_id and id is distinct from new.id;
  if existing >= allowed then raise exception 'Cette offre permet au maximum % profil(s) enfant.',allowed; end if;
  return new;
end $$;
revoke all on function public.enforce_child_profile_limit() from public,anon,authenticated;

drop policy if exists content_books_subscriber_read on storage.objects;
create policy content_books_subscriber_read on storage.objects for select to authenticated using (
  bucket_id='content-books' and (public.can_manage_content() or exists(select 1 from public.get_family_subscription()))
);
commit;
