-- VoxCare: schema + seed data
-- Paste this whole file into the Supabase SQL editor and run it once. It is safe to run again.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables

create table if not exists public.patients (
  id            uuid primary key default gen_random_uuid(),
  photo_url     text,
  name          text,
  help_phone    text not null,
  help_name     text,
  help_email         text,                -- set by the help person when they join
  help_join_token    text unique,         -- random; goes in the link the patient sends
  help_confirmed_at  timestamptz,
  consented_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  token_hash    text                      -- sha256 of the secret token kept on the patient's device
);

-- Re-running on an older database: add the new columns
alter table public.patients add column if not exists help_email text;
alter table public.patients add column if not exists help_join_token text unique;
alter table public.patients add column if not exists help_confirmed_at timestamptz;

create table if not exists public.doctors (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  mdcn_number  text not null,
  verified     boolean not null default false,
  pin          text not null              -- sha256('voxcare:' || pin)
);

create table if not exists public.facts (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients(id) on delete cascade,
  type         text not null check (type in ('condition','allergy','medicine','blood_group','event_history','body_fact')),
  value        text not null,
  status       text not null default 'self_reported' check (status in ('self_reported','doctor_verified')),
  verified_by  uuid references public.doctors(id),
  verified_at  timestamptz
);
create index if not exists facts_patient_idx on public.facts (patient_id);

create table if not exists public.visits (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete set null,   -- null for a walk-in
  doctor_id   uuid references public.doctors(id),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  transcript  jsonb not null default '[]'::jsonb,
  summary     text
);

create table if not exists public.briefings (
  patient_id  uuid not null references public.patients(id) on delete cascade,
  language    text not null check (language in ('en','yo','ig','ha')),
  text_hash   text not null,              -- sha256 of the English briefing text it was made from
  audio_url   text not null,
  created_at  timestamptz not null default now(),
  primary key (patient_id, language)
);

create table if not exists public.alerts (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  sent_at     timestamptz not null default now(),
  lat         double precision,
  lng         double precision
);
create index if not exists alerts_patient_time_idx on public.alerts (patient_id, sent_at desc);

-- ---------------------------------------------------------------- security
-- The browser never talks to these tables directly. All reads and writes go through the /api
-- functions, which use the service role key (it bypasses RLS). With RLS on and no policies,
-- the anon key can read and write nothing.

alter table public.patients  enable row level security;
alter table public.doctors   enable row level security;
alter table public.facts     enable row level security;
alter table public.visits    enable row level security;
alter table public.briefings enable row level security;
alter table public.alerts    enable row level security;

-- The API connects as service_role. Make sure it can use the tables (anon and authenticated get nothing).
grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- ---------------------------------------------------------------- storage buckets
-- Public buckets: file names are unguessable (a random id, or a sha256 of the text).

insert into storage.buckets (id, name, public) values ('briefings', 'briefings', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('photos',    'photos',    true) on conflict (id) do nothing;

-- ---------------------------------------------------------------- seed data

-- Doctor: Dr. Ngozi Okafor, MDCN verified, PIN 1234
insert into public.doctors (id, name, mdcn_number, verified, pin)
values (
  'd0c70000-0000-4000-8000-000000000001',
  'Dr. Ngozi Okafor',
  'MDCN/R/12345',
  true,
  encode(extensions.digest('voxcare:1234', 'sha256'), 'hex')
)
on conflict (id) do nothing;

-- Demo patient, already confirmed. The API replaces help_phone and help_email with the
-- DEMO_HELP_PHONE and DEMO_HELP_EMAIL environment variables for this patient, so the
-- alert email goes to your teammate. The client refers to it as "demo".
insert into public.patients (id, name, help_phone, help_name, help_join_token, help_confirmed_at)
values ('00000000-0000-4000-8000-000000000001', 'Chinedu', '08000000000', 'Mum', 'demo-join-token', now())
on conflict (id) do update set help_join_token = excluded.help_join_token, help_confirmed_at = excluded.help_confirmed_at;

delete from public.facts where patient_id = '00000000-0000-4000-8000-000000000001';

insert into public.facts (patient_id, type, value, status, verified_by, verified_at) values
  ('00000000-0000-4000-8000-000000000001', 'condition',   'Asthma',            'doctor_verified', 'd0c70000-0000-4000-8000-000000000001', now()),
  ('00000000-0000-4000-8000-000000000001', 'allergy',     'Penicillin',        'doctor_verified', 'd0c70000-0000-4000-8000-000000000001', now()),
  ('00000000-0000-4000-8000-000000000001', 'blood_group', 'O+',                'doctor_verified', 'd0c70000-0000-4000-8000-000000000001', now()),
  ('00000000-0000-4000-8000-000000000001', 'condition',   'Fainting sometimes','self_reported',   null, null);
