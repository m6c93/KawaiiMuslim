begin;
-- Do not let public reservations shadow legacy parent-owned Apple tokens.
create or replace function public.reserve_apple_purchase(p_token uuid,p_secret_hash text,p_source_hash text)
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
  if exists(select 1 from profiles where id=p_token) then raise exception 'Account token reserved for an existing parent'; end if;
  insert into apple_purchase_reservations(account_token,secret_hash,source_hash) values(p_token,p_secret_hash,p_source_hash);
end $$;

commit;
