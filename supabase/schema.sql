-- Apex schema. Run this once in the Supabase SQL editor (Project > SQL Editor).
-- All tables reference auth.users and use open RLS policies (single-user app for now).

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  age int,
  sex text,
  height_inches int,
  weight_lbs float,
  body_fat_percent float,
  goal_mode text,
  target_date date,
  created_at timestamptz not null default now()
);

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  weight_lbs float not null,
  logged_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  description text not null,
  calories float not null default 0,
  protein_g float not null default 0,
  carbs_g float not null default 0,
  fat_g float not null default 0,
  logged_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  amount_oz float not null,
  logged_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists user_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  brand text,
  serving_size text,
  calories_per_serving float,
  protein_g_per_serving float,
  carbs_g_per_serving float,
  fat_g_per_serving float,
  created_at timestamptz not null default now()
);

create table if not exists saved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  description text,
  ingredients jsonb,
  instructions jsonb,
  calories float not null default 0,
  protein_g float not null default 0,
  carbs_g float not null default 0,
  fat_g float not null default 0,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table weight_logs enable row level security;
alter table food_logs enable row level security;
alter table water_logs enable row level security;
alter table user_ingredients enable row level security;
alter table saved_recipes enable row level security;

create policy "open_profiles" on profiles for all using (true) with check (true);
create policy "open_weight_logs" on weight_logs for all using (true) with check (true);
create policy "open_food_logs" on food_logs for all using (true) with check (true);
create policy "open_water_logs" on water_logs for all using (true) with check (true);
create policy "open_user_ingredients" on user_ingredients for all using (true) with check (true);
create policy "open_saved_recipes" on saved_recipes for all using (true) with check (true);

-- Migration: per-user water goal override (null = use bodyweight-based default).
alter table profiles add column if not exists water_goal_oz float;

-- Migration: weekly meal plan slots (each slot points at a saved recipe).
create table if not exists meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid not null references saved_recipes on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, day_of_week, meal_slot, recipe_id)
);

alter table meal_plan_entries enable row level security;
create policy "open_meal_plan_entries" on meal_plan_entries for all using (true) with check (true);

-- Migration: weekly check-in feedback messages shown on the Plan tab.
create table if not exists weekly_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

alter table weekly_feedback enable row level security;
create policy "open_weekly_feedback" on weekly_feedback for all using (true) with check (true);
