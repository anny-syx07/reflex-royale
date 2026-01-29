-- Create a table for Players
create table players (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  total_score bigint default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a table for Game Sessions (Rooms)
create table game_sessions (
  id uuid default gen_random_uuid() primary key,
  host_id uuid references players(id), -- Link to the player who hosted
  status text default 'waiting', -- waiting, playing, finished
  winner_id uuid references players(id), -- Link to the winner
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (Optional, but good practice)
alter table players enable row level security;
alter table game_sessions enable row level security;

-- Create a policy that allows anyone to read/write (since we are controlling from backend or need simple access initially)
-- WARNING: For production, you should restrict this!
create policy "Public Access" on players for all using (true);
create policy "Public Access" on game_sessions for all using (true);
