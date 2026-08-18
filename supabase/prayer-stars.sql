-- Deux étoiles par prière obligatoire, une seule fois par enfant et par jour.
create or replace function public.award_child_stars(
  target_child uuid,
  event_type text,
  source_key text,
  event_description text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_owner uuid := auth.uid();
  base_points integer;
  earned_today integer;
  prayer_count integer;
  prayer_day text;
  points integer;
  inserted_id uuid;
  new_balance integer;
begin
  if current_owner is null or not exists (
    select 1 from public.child_profiles
    where id = target_child and parent_id = current_owner
  ) then
    raise exception 'Profil enfant non autorisé';
  end if;

  base_points := case event_type
    when 'book_complete' then 2
    when 'activity_complete' then 1
    when 'invocation_learned' then 3
    when 'invocation_review' then 1
    when 'weekly_discovery' then 2
    when 'prayer_complete' then 2
    else 0
  end;

  if base_points = 0 or coalesce(trim(source_key), '') = '' then
    raise exception 'Récompense invalide';
  end if;

  if exists (
    select 1 from public.star_transactions
    where child_profile_id = target_child
      and star_transactions.event_type = award_child_stars.event_type
      and star_transactions.source_key = award_child_stars.source_key
  ) then
    select coalesce(balance, 0) into new_balance
    from public.child_star_wallets where child_profile_id = target_child;
    return jsonb_build_object('awarded', 0, 'balance', coalesce(new_balance, 0), 'reason', 'already_awarded');
  end if;

  if event_type = 'prayer_complete' then
    if source_key !~ '^prayer:[0-9]{4}-[0-9]{2}-[0-9]{2}:(Fajr|Dhuhr|Asr|Maghrib|Isha)$' then
      raise exception 'Récompense de prière invalide';
    end if;
    prayer_day := split_part(source_key, ':', 2);
    select count(*) into prayer_count
    from public.star_transactions
    where child_profile_id = target_child
      and star_transactions.event_type = 'prayer_complete'
      and star_transactions.source_key like 'prayer:' || prayer_day || ':%';
    points := case when prayer_count < 5 then 2 else 0 end;
  else
    select coalesce(sum(amount), 0) into earned_today
    from public.star_transactions
    where child_profile_id = target_child
      and amount > 0
      and star_transactions.event_type <> 'prayer_complete'
      and created_at >= date_trunc('day', now());
    points := greatest(0, least(base_points, 5 - earned_today));
  end if;

  insert into public.child_star_wallets(child_profile_id, owner_id)
  values (target_child, current_owner)
  on conflict (child_profile_id) do nothing;

  if points = 0 then
    select balance into new_balance from public.child_star_wallets where child_profile_id = target_child;
    return jsonb_build_object('awarded', 0, 'balance', new_balance, 'reason', 'daily_limit');
  end if;

  insert into public.star_transactions(
    child_profile_id, owner_id, amount, event_type, source_key, description
  ) values (
    target_child, current_owner, points, event_type, left(source_key, 200),
    coalesce(nullif(left(event_description, 180), ''), 'Bravo, une étape terminée !')
  )
  on conflict (child_profile_id, event_type, source_key) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    select balance into new_balance from public.child_star_wallets where child_profile_id = target_child;
    return jsonb_build_object('awarded', 0, 'balance', new_balance, 'reason', 'already_awarded');
  end if;

  update public.child_star_wallets
  set balance = balance + points,
      lifetime_earned = lifetime_earned + points,
      updated_at = now()
  where child_profile_id = target_child
  returning balance into new_balance;

  return jsonb_build_object('awarded', points, 'balance', new_balance, 'reason', 'earned');
end;
$$;

revoke all on function public.award_child_stars(uuid,text,text,text) from public, anon;
grant execute on function public.award_child_stars(uuid,text,text,text) to authenticated;
