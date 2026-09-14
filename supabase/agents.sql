-- Kawaii Muslim World — Studio d’agents IA
-- Agents personnalisés, conversations et mémoire, réservés aux administratrices.
begin;

create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  role text not null default '' check (char_length(role) <= 120),
  mission text not null default '' check (char_length(mission) <= 4000),
  tone text not null default 'douce' check (char_length(tone) <= 60),
  avatar jsonb not null default '{}'::jsonb,
  tools jsonb not null default '["web_search","web_fetch","memory"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nouvelle mission' check (char_length(title) <= 160),
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists ai_conversations_agent_idx on public.ai_conversations(agent_id, updated_at desc);
create index if not exists ai_memories_agent_idx on public.ai_memories(agent_id, created_at desc);

alter table public.ai_agents enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_memories enable row level security;

drop policy if exists "ai_agents_admin" on public.ai_agents;
create policy "ai_agents_admin" on public.ai_agents for all to authenticated
  using (owner_id = auth.uid() and public.is_admin())
  with check (owner_id = auth.uid() and public.is_admin());

drop policy if exists "ai_conversations_admin" on public.ai_conversations;
create policy "ai_conversations_admin" on public.ai_conversations for all to authenticated
  using (owner_id = auth.uid() and public.is_admin())
  with check (owner_id = auth.uid() and public.is_admin());

drop policy if exists "ai_memories_admin" on public.ai_memories;
create policy "ai_memories_admin" on public.ai_memories for all to authenticated
  using (owner_id = auth.uid() and public.is_admin())
  with check (owner_id = auth.uid() and public.is_admin());

grant select, insert, update, delete on public.ai_agents, public.ai_conversations, public.ai_memories to authenticated;

commit;
