-- Helper script to initialize or update the Supabase Database Schema
-- Run this in the Supabase SQL Editor

-- 1. Create Tables (if they don't exist)
create table if not exists players (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  total_score bigint default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists game_sessions (
  id uuid default gen_random_uuid() primary key,
  host_id uuid references players(id),
  status text default 'waiting', -- waiting, playing, finished
  winner_id uuid references players(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Update Policies (Drop old ones to avoid conflicts and recreate)
alter table players enable row level security;
alter table game_sessions enable row level security;

drop policy if exists "Public Access Players" on players;
create policy "Public Access Players" on players for all using (true) with check (true);

drop policy if exists "Public Access Sessions" on game_sessions;
create policy "Public Access Sessions" on game_sessions for all using (true) with check (true);

-- 3. Add Missing Columns (Safe to run even if columns exist)
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS room_code text;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS mode text;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS game_data jsonb;

-- 4. Verify Schema
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_name IN ('players', 'game_sessions')
ORDER BY 
    table_name, ordinal_position;
