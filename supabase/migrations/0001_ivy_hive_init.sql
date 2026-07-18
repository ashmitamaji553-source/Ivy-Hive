-- ============================================================================
-- Ivy-Hive — initial schema migration
-- Tables: users, events, goals, weekly_tasks, tags
-- Includes indexes for calendar/date queries and Row Level Security (RLS)
-- so every user can only ever see/change their own rows.
-- ============================================================================

create extension if not exists pgcrypto;   -- provides gen_random_uuid()

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

create type goal_status as enum ('active', 'completed', 'archived');

-- Matches the app's four event categories (Tending/Deep Work/Harvest/Errands)
-- mapped to sage / forest / honey / tan in the design system.
create type event_color as enum ('sage', 'forest', 'honey', 'tan');


-- ============================================================================
-- USERS  (extends auth.users — 1:1, same primary key)
-- ============================================================================

create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  name        text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

comment on table public.users is 'Public profile data for each authenticated user, 1:1 with auth.users.';

-- Auto-create a public.users row whenever someone signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.users enable row level security;

create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

create policy "users_insert_own"
  on public.users for insert
  with check (auth.uid() = id);

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users_delete_own"
  on public.users for delete
  using (auth.uid() = id);


-- ============================================================================
-- TAGS  (custom color-coded labels, user-owned)
-- ============================================================================

create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  name        text not null,
  color_hex   text not null check (color_hex ~* '^#[0-9a-f]{6}$'),
  created_at  timestamptz not null default now(),

  unique (user_id, name)
);

create index idx_tags_user_id on public.tags (user_id);

alter table public.tags enable row level security;

create policy "tags_select_own"
  on public.tags for select
  using (auth.uid() = user_id);

create policy "tags_insert_own"
  on public.tags for insert
  with check (auth.uid() = user_id);

create policy "tags_update_own"
  on public.tags for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tags_delete_own"
  on public.tags for delete
  using (auth.uid() = user_id);


-- ============================================================================
-- EVENTS  (calendar entries)
-- ============================================================================

create table public.events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  title            text not null,
  description      text,
  start_time       timestamptz not null,
  end_time         timestamptz not null,
  color_tag        event_color not null default 'sage',
  recurrence_rule  text,                 -- iCal RRULE string, e.g. 'FREQ=WEEKLY;BYDAY=MO'
  created_at       timestamptz not null default now(),

  check (end_time > start_time)
);

-- user_id alone for "give me all my events"; composite for calendar range
-- queries ("give me my events between date A and B") which is the hot path
-- for the week/month views.
create index idx_events_user_id on public.events (user_id);
create index idx_events_user_start on public.events (user_id, start_time);
create index idx_events_start_time on public.events (start_time);

alter table public.events enable row level security;

create policy "events_select_own"
  on public.events for select
  using (auth.uid() = user_id);

create policy "events_insert_own"
  on public.events for insert
  with check (auth.uid() = user_id);

create policy "events_update_own"
  on public.events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "events_delete_own"
  on public.events for delete
  using (auth.uid() = user_id);


-- ============================================================================
-- GOALS
-- ============================================================================

create table public.goals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  title            text not null,
  description      text,
  deadline         date,
  status           goal_status not null default 'active',
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  created_at       timestamptz not null default now()
);

create index idx_goals_user_id on public.goals (user_id);
create index idx_goals_deadline on public.goals (deadline);
create index idx_goals_user_status on public.goals (user_id, status);

alter table public.goals enable row level security;

create policy "goals_select_own"
  on public.goals for select
  using (auth.uid() = user_id);

create policy "goals_insert_own"
  on public.goals for insert
  with check (auth.uid() = user_id);

create policy "goals_update_own"
  on public.goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "goals_delete_own"
  on public.goals for delete
  using (auth.uid() = user_id);


-- ============================================================================
-- WEEKLY_TASKS  (checklist items under a goal, grouped by week)
--
-- No user_id column here on purpose — ownership is inherited through the
-- parent goal. RLS below checks ownership via an EXISTS subquery against
-- public.goals, so a row is only visible/writable if the *goal* it belongs
-- to belongs to auth.uid().
-- ============================================================================

create table public.weekly_tasks (
  id              uuid primary key default gen_random_uuid(),
  goal_id         uuid not null references public.goals(id) on delete cascade,
  week_start_date date not null,        -- Monday of the relevant week
  title           text not null,
  is_complete     boolean not null default false,
  order_index     integer not null default 0,
  created_at      timestamptz not null default now()
);

create index idx_weekly_tasks_goal_id on public.weekly_tasks (goal_id);
create index idx_weekly_tasks_week_start on public.weekly_tasks (week_start_date);
create index idx_weekly_tasks_goal_week on public.weekly_tasks (goal_id, week_start_date);

alter table public.weekly_tasks enable row level security;

create policy "weekly_tasks_select_own"
  on public.weekly_tasks for select
  using (
    exists (
      select 1 from public.goals g
      where g.id = weekly_tasks.goal_id
        and g.user_id = auth.uid()
    )
  );

create policy "weekly_tasks_insert_own"
  on public.weekly_tasks for insert
  with check (
    exists (
      select 1 from public.goals g
      where g.id = weekly_tasks.goal_id
        and g.user_id = auth.uid()
    )
  );

create policy "weekly_tasks_update_own"
  on public.weekly_tasks for update
  using (
    exists (
      select 1 from public.goals g
      where g.id = weekly_tasks.goal_id
        and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.goals g
      where g.id = weekly_tasks.goal_id
        and g.user_id = auth.uid()
    )
  );

create policy "weekly_tasks_delete_own"
  on public.weekly_tasks for delete
  using (
    exists (
      select 1 from public.goals g
      where g.id = weekly_tasks.goal_id
        and g.user_id = auth.uid()
    )
  );

-- ============================================================================
-- End of migration
-- ============================================================================
