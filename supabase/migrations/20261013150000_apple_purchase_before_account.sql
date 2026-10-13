begin;
-- A device reserves an opaque token before paying. No account or access is created.
create table public.apple_purchase_reservations (
  account_token uuid primary key,
  secret_hash text not null check (length(secret_hash)=64),
  source_hash text not null,
  created_at timestamptz not null default now(),
  user_id uuid references public.profiles(id) on delete cascade,
  original_transaction_id text unique
);
alter table public.apple_purchase_reservations enable row level security;
revoke all on public.apple_purchase_reservations from public,anon,authenticated;

create function public.reserve_apple_purchase(p_token uuid,p_secret_hash text,p_source_hash text)
returns void language plpgsql security definer set search_path=public as $$
declare existing text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_source_hash,0));
  select secret_hash into existing from apple_purchase_reservations where account_token=p_token;
  if found then
    if existing<>p_secret_hash then raise exception 'Reservation mismatch'; end if;
    return;
  end if;
  if (select count(*) from apple_purchase_reservations where source_hash=p_source_hash and created_at>now()-interval '1 hour')>=5 then
    raise exception 'Reservation rate limit';
  end if;
  insert into apple_purchase_reservations(account_token,secret_hash,source_hash) values(p_token,p_secret_hash,p_source_hash);
end $$;

create function public.claim_apple_purchase(p_token uuid,p_secret_hash text,p_owner uuid,p_entitlement jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare reservation apple_purchase_reservations%rowtype;
begin
  select * into reservation from apple_purchase_reservations where account_token=p_token for update;
  if not found or reservation.secret_hash<>p_secret_hash then raise exception 'Reservation proof invalid'; end if;
  if reservation.user_id is not null and reservation.user_id<>p_owner then raise exception 'Purchase already assigned'; end if;
  if p_entitlement->>'user_id'<>p_owner::text then raise exception 'Owner mismatch'; end if;
  if reservation.original_transaction_id is not null and reservation.original_transaction_id<>p_entitlement->>'original_transaction_id' then raise exception 'Transaction mismatch'; end if;
  if not exists(select 1 from profiles where id=p_owner and role='parent' and is_active=true) then raise exception 'Parent required'; end if;
  update apple_purchase_reservations set user_id=p_owner,original_transaction_id=p_entitlement->>'original_transaction_id' where account_token=p_token;
  perform save_verified_apple_subscription(p_entitlement);
end $$;
revoke all on function public.reserve_apple_purchase(uuid,text,text) from public,anon,authenticated;
revoke all on function public.claim_apple_purchase(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_apple_purchase(uuid,text,text) to service_role;
grant execute on function public.claim_apple_purchase(uuid,text,uuid,jsonb) to service_role;
commit;
