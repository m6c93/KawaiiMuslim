-- Thème visuel fille / garçon pour chaque profil enfant.
-- Les profils existants restent sur le thème Aya (fille) jusqu'à modification.

alter table public.child_profiles
  add column if not exists gender text not null default 'girl';

alter table public.child_profiles
  drop constraint if exists child_profiles_gender_check;

alter table public.child_profiles
  add constraint child_profiles_gender_check check (gender in ('girl', 'boy'));
