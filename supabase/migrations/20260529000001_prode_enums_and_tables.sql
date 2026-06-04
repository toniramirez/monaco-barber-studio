-- Prode Mundial 2026 — tablas base (ADITIVO, scopeado a la org Monaco)
-- Org Monaco: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-- No toca ninguna tabla existente. Solo crea objetos nuevos prode_*.

-- ===== Enums (idempotentes) =====
do $$ begin create type prode_tournament_status as enum ('upcoming','active','finished'); exception when duplicate_object then null; end $$;
do $$ begin create type prode_match_stage as enum ('group','round_of_32','round_of_16','quarter_final','semi_final','third_place','final'); exception when duplicate_object then null; end $$;
do $$ begin create type prode_match_status as enum ('scheduled','live','finished','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type prode_match_outcome as enum ('home','draw','away'); exception when duplicate_object then null; end $$;
do $$ begin create type prode_question_kind as enum ('champion','runner_up','top_scorer','surprise_team','team_stage','bonus'); exception when duplicate_object then null; end $$;

-- ===== Tablas =====
create table if not exists prode_tournament (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  name text not null,
  season text not null default '2026',
  status prode_tournament_status not null default 'upcoming',
  predictions_lock_at timestamptz,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists prode_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  tournament_id uuid not null references prode_tournament(id) on delete cascade,
  external_id text,
  name text not null,
  short_name text,
  code text,
  group_label text,
  flag_url text,
  created_at timestamptz not null default now(),
  unique (tournament_id, external_id)
);

create table if not exists prode_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  tournament_id uuid not null references prode_tournament(id) on delete cascade,
  external_id text,
  stage prode_match_stage not null default 'group',
  group_label text,
  matchday int,
  home_team_id uuid references prode_teams(id) on delete set null,
  away_team_id uuid references prode_teams(id) on delete set null,
  home_team_label text,
  away_team_label text,
  kickoff_at timestamptz not null,
  venue text,
  status prode_match_status not null default 'scheduled',
  home_score int,
  away_score int,
  is_featured boolean not null default false,
  result_processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, external_id)
);

create table if not exists prode_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  client_id uuid not null references clients(id) on delete cascade,
  tournament_id uuid not null references prode_tournament(id) on delete cascade,
  display_name text not null,
  last_name text,
  email text,
  dni text,
  birthdate date,
  consent_marketing boolean not null default false,
  consent_at timestamptz,
  phone_verified_at timestamptz,
  profile_completed_at timestamptz,
  welcome_reward_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, client_id),
  unique (tournament_id, dni)
);

create table if not exists prode_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  tournament_id uuid not null references prode_tournament(id) on delete cascade,
  kind prode_question_kind not null,
  label text not null,
  help_text text,
  answer_type text not null default 'team',
  options jsonb,
  points int not null default 10,
  sort_order int not null default 0,
  correct_answer text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists prode_question_predictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  participant_id uuid not null references prode_participants(id) on delete cascade,
  question_id uuid not null references prode_questions(id) on delete cascade,
  answer text not null,
  points_awarded int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, question_id)
);

create table if not exists prode_match_predictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  participant_id uuid not null references prode_participants(id) on delete cascade,
  match_id uuid not null references prode_matches(id) on delete cascade,
  outcome prode_match_outcome not null,
  home_score int,
  away_score int,
  points_awarded int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, match_id)
);

create table if not exists prode_leagues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  tournament_id uuid not null references prode_tournament(id) on delete cascade,
  name text not null,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  is_public boolean not null default false,
  is_house boolean not null default false,
  owner_participant_id uuid references prode_participants(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists prode_league_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  league_id uuid not null references prode_leagues(id) on delete cascade,
  participant_id uuid not null references prode_participants(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (league_id, participant_id)
);

create table if not exists prode_otp (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ===== Índices =====
create index if not exists idx_prode_teams_tournament on prode_teams(tournament_id);
create index if not exists idx_prode_matches_tournament_kickoff on prode_matches(tournament_id, kickoff_at);
create index if not exists idx_prode_matches_open on prode_matches(status) where status <> 'finished';
create index if not exists idx_prode_matches_featured on prode_matches(tournament_id, is_featured) where is_featured;
create index if not exists idx_prode_participants_client on prode_participants(client_id);
create index if not exists idx_prode_participants_tournament on prode_participants(tournament_id);
create index if not exists idx_prode_qpred_question on prode_question_predictions(question_id);
create index if not exists idx_prode_qpred_participant on prode_question_predictions(participant_id);
create index if not exists idx_prode_mpred_match on prode_match_predictions(match_id);
create index if not exists idx_prode_mpred_participant on prode_match_predictions(participant_id);
create index if not exists idx_prode_league_members_participant on prode_league_members(participant_id);
create index if not exists idx_prode_league_members_league on prode_league_members(league_id);
create index if not exists idx_prode_otp_phone on prode_otp(phone, created_at desc);
