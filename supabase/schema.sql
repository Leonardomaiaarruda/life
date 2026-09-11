-- MetaLife / Supabase — base de migração compatível com o frontend atual.
-- Execute no SQL Editor de um projeto Supabase novo.
-- Segurança: todas as tabelas pessoais usam auth.uid() + RLS.

begin;

create extension if not exists pgcrypto;

create or replace function public.ml_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_version text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabelas de compatibilidade. O campo payload preserva o objeto original do MetaLife,
-- permitindo migrar sem perder campos de versões antigas enquanto o schema é normalizado.
create table if not exists public.goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text,
  target numeric,
  value numeric,
  deadline date,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);

create table if not exists public.daily_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  category text,
  title text,
  value numeric not null default 0,
  target numeric not null default 0,
  unit text,
  goal_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);
create index if not exists daily_items_user_day_idx on public.daily_items(user_id,day desc);

create table if not exists public.weight_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  weight numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);
create index if not exists weight_entries_user_day_idx on public.weight_entries(user_id,day desc);

create table if not exists public.tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  day date,
  title text,
  completed boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);
create index if not exists tasks_user_day_idx on public.tasks(user_id,day desc);

create table if not exists public.habits (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text,
  active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);

create table if not exists public.habit_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id text not null,
  day date not null,
  value numeric not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id,habit_id,day)
);
create index if not exists habit_logs_user_day_idx on public.habit_logs(user_id,day desc);

create table if not exists public.workout_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  name text,
  duration_seconds integer not null default 0,
  total_volume numeric not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);
create index if not exists workout_sessions_user_day_idx on public.workout_sessions(user_id,day desc);

create table if not exists public.workout_sets (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  exercise_id text not null,
  exercise_name text,
  set_index integer not null,
  kg numeric,
  reps numeric,
  rir numeric,
  rpe numeric,
  completed boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id,session_id,exercise_id,set_index)
);
create index if not exists workout_sets_exercise_idx on public.workout_sets(user_id,exercise_id,created_at desc);

create table if not exists public.diet_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,day)
);

create table if not exists public.challenges (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  metric text,
  challenge_type text,
  scope text,
  difficulty text,
  start_day date,
  end_day date,
  target numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);
create index if not exists challenges_user_period_idx on public.challenges(user_id,start_day,end_day);

-- Cria o perfil automaticamente quando alguém se registra no Supabase Auth.
create or replace function public.ml_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id,name)
  values (new.id,coalesce(new.raw_user_meta_data->>'name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ml_on_auth_user_created on auth.users;
create trigger ml_on_auth_user_created
after insert on auth.users
for each row execute procedure public.ml_handle_new_user();

-- updated_at
DO $$
declare t text;
begin
  foreach t in array array['profiles','user_snapshots','goals','daily_items','weight_entries','tasks','habits','workout_sessions','diet_days','challenges']
  loop
    execute format('drop trigger if exists ml_%I_updated_at on public.%I',t,t);
    execute format('create trigger ml_%I_updated_at before update on public.%I for each row execute procedure public.ml_set_updated_at()',t,t);
  end loop;
end $$;

-- RLS: dados pessoais só podem ser acessados pelo dono autenticado.
DO $$
declare t text;
begin
  foreach t in array array['profiles','user_snapshots','goals','daily_items','weight_entries','tasks','habits','habit_logs','workout_sessions','workout_sets','diet_days','challenges']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I','ml_owner_all_'||t,t);
    if t='profiles' then
      execute format('create policy %I on public.%I for all to authenticated using (id = auth.uid()) with check (id = auth.uid())','ml_owner_all_'||t,t);
    elsif t='user_snapshots' then
      execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())','ml_owner_all_'||t,t);
    else
      execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())','ml_owner_all_'||t,t);
    end if;
  end loop;
end $$;

-- Grants explícitos para o papel usado por usuários autenticados.
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.profiles,public.user_snapshots,public.goals,public.daily_items,
  public.weight_entries,public.tasks,public.habits,public.habit_logs,public.workout_sessions,
  public.workout_sets,public.diet_days,public.challenges to authenticated;

commit;
