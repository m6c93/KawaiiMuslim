-- Boutique des étoiles Kawaii Muslim
create table if not exists public.child_star_wallets (
  child_profile_id uuid primary key references public.child_profiles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.star_shop_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  category text not null check (category in ('stickers','colorings','activities','decorations')),
  cost integer not null check (cost > 0),
  emoji text not null default '🎁',
  accent text not null default '#8d7bd6',
  asset_url text not null default '',
  status text not null default 'active' check (status in ('active','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.star_transactions (
  id uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  event_type text not null,
  source_key text not null,
  description text not null default '',
  item_id uuid references public.star_shop_items(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (child_profile_id, event_type, source_key)
);

create table if not exists public.child_shop_rewards (
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  item_id uuid not null references public.star_shop_items(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (child_profile_id, item_id)
);

alter table public.child_star_wallets enable row level security;
alter table public.star_shop_items enable row level security;
alter table public.star_transactions enable row level security;
alter table public.child_shop_rewards enable row level security;

drop policy if exists "Families read own star wallets" on public.child_star_wallets;
create policy "Families read own star wallets" on public.child_star_wallets
for select to authenticated using (owner_id = auth.uid());

drop policy if exists "Members read active shop items" on public.star_shop_items;
create policy "Members read active shop items" on public.star_shop_items
for select to authenticated using (status = 'active');

drop policy if exists "Families read own star transactions" on public.star_transactions;
create policy "Families read own star transactions" on public.star_transactions
for select to authenticated using (owner_id = auth.uid());

drop policy if exists "Families read own rewards" on public.child_shop_rewards;
create policy "Families read own rewards" on public.child_shop_rewards
for select to authenticated using (owner_id = auth.uid());

create or replace function public.get_child_star_shop(target_child uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_owner uuid := auth.uid();
  wallet_row public.child_star_wallets%rowtype;
  items_json jsonb;
  history_json jsonb;
begin
  if current_owner is null or not exists (
    select 1 from public.child_profiles
    where id = target_child and parent_id = current_owner
  ) then
    raise exception 'Profil enfant non autorisé';
  end if;

  insert into public.child_star_wallets(child_profile_id, owner_id)
  values (target_child, current_owner)
  on conflict (child_profile_id) do nothing;

  select * into wallet_row
  from public.child_star_wallets
  where child_profile_id = target_child;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', i.id, 'slug', i.slug, 'title', i.title,
      'description', i.description, 'category', i.category,
      'cost', i.cost, 'emoji', i.emoji, 'accent', i.accent,
      'asset_url', i.asset_url,
      'owned', (r.item_id is not null),
      'acquired_at', r.acquired_at
    ) order by i.sort_order, i.cost, i.title
  ), '[]'::jsonb)
  into items_json
  from public.star_shop_items i
  left join public.child_shop_rewards r
    on r.item_id = i.id and r.child_profile_id = target_child
  where i.status = 'active';

  select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc), '[]'::jsonb)
  into history_json
  from (
    select id, amount, event_type, description, created_at
    from public.star_transactions
    where child_profile_id = target_child
    order by created_at desc
    limit 30
  ) h;

  return jsonb_build_object(
    'balance', wallet_row.balance,
    'lifetime_earned', wallet_row.lifetime_earned,
    'items', items_json,
    'transactions', history_json
  );
end;
$$;

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

create or replace function public.redeem_star_shop_item(target_child uuid, target_item uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_owner uuid := auth.uid();
  chosen public.star_shop_items%rowtype;
  current_balance integer;
  new_balance integer;
begin
  if current_owner is null or not exists (
    select 1 from public.child_profiles
    where id = target_child and parent_id = current_owner
  ) then
    raise exception 'Profil enfant non autorisé';
  end if;

  select * into chosen from public.star_shop_items
  where id = target_item and status = 'active';
  if not found then raise exception 'Récompense indisponible'; end if;

  if exists (
    select 1 from public.child_shop_rewards
    where child_profile_id = target_child and item_id = target_item
  ) then
    raise exception 'Cette récompense est déjà obtenue';
  end if;

  insert into public.child_star_wallets(child_profile_id, owner_id)
  values (target_child, current_owner)
  on conflict (child_profile_id) do nothing;

  select balance into current_balance
  from public.child_star_wallets
  where child_profile_id = target_child
  for update;

  if current_balance < chosen.cost then
    raise exception 'Il manque % étoiles', chosen.cost - current_balance;
  end if;

  insert into public.child_shop_rewards(child_profile_id, item_id, owner_id)
  values (target_child, target_item, current_owner);

  update public.child_star_wallets
  set balance = balance - chosen.cost, updated_at = now()
  where child_profile_id = target_child
  returning balance into new_balance;

  insert into public.star_transactions(
    child_profile_id, owner_id, amount, event_type, source_key, description, item_id
  ) values (
    target_child, current_owner, -chosen.cost, 'shop_reward',
    'reward:' || target_item::text, 'Récompense choisie : ' || chosen.title, target_item
  );

  return jsonb_build_object('spent', chosen.cost, 'balance', new_balance, 'item', to_jsonb(chosen));
end;
$$;

revoke all on function public.get_child_star_shop(uuid) from public, anon;
revoke all on function public.award_child_stars(uuid,text,text,text) from public, anon;
revoke all on function public.redeem_star_shop_item(uuid,uuid) from public, anon;
grant execute on function public.get_child_star_shop(uuid) to authenticated;
grant execute on function public.award_child_stars(uuid,text,text,text) to authenticated;
grant execute on function public.redeem_star_shop_item(uuid,uuid) to authenticated;

insert into public.star_shop_items(slug,title,description,category,cost,emoji,accent,asset_url,sort_order)
values
('sticker-mimi-lune','Sticker Mimi sous la lune','Un sticker doux à collectionner.','stickers',8,'🌙','#8d7bd6','',10),
('sticker-aya-etoiles','Sticker Aya et les étoiles','Aya célèbre tes efforts avec toi.','stickers',8,'🌟','#df8ab5','',20),
('ciel-lavande','Ciel lavande','Un nouveau ciel apaisant pour ton espace.','decorations',15,'🌌','#7569bd','',30),
('ciel-ramadan','Ciel du Ramadan','Une décoration céleste pour les beaux moments.','decorations',20,'🌙','#4c8d88','',40),
('coloriage-kahf','Coloriage de la grotte','Un coloriage exclusif à ouvrir dans l’atelier.','colorings',25,'🎨','#d994b5','https://pasgxojzybmvbjhuokkk.supabase.co/storage/v1/object/public/content-colorings/0f78be75-2560-4ea5-ab08-70c12221373b/1785230395606-chien-mignon-devant-une-grotte-rocheuse.png',50),
('coloriage-espace','Coloriage voyage étoilé','Une aventure exclusive dans les étoiles.','colorings',25,'🚀','#6989c9','https://pasgxojzybmvbjhuokkk.supabase.co/storage/v1/object/public/content-colorings/0f78be75-2560-4ea5-ab08-70c12221373b/1785232468730-chatgpt-image-28-juil-2026-11-47-50.png',60),
('activite-bonnes-actions','Défi des bonnes actions','Une activité surprise à faire en famille.','activities',35,'🧩','#d69a55','',70),
('certificat-petit-lecteur','Certificat petit lecteur','Un joli certificat pour célébrer ses lectures.','activities',40,'📜','#5fa99d','',80)
on conflict (slug) do update set
title=excluded.title, description=excluded.description, category=excluded.category,
cost=excluded.cost, emoji=excluded.emoji, accent=excluded.accent,
asset_url=excluded.asset_url, sort_order=excluded.sort_order, status='active';
