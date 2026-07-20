-- ─────────────────────────────────────────────────────────────────────────────
-- MICA Estate Bookings - Database Schema
-- For Supabase PostgreSQL
--
-- Instructions:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Create a new query
-- 3. Paste this entire file
-- 4. Click "Run"
-- 5. Verify tables are created
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Users Table ───────────────────────────────────────────────────────────

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  role text not null default 'student',
  created_at timestamp with time zone default now()
);

create index if not exists idx_users_email on users(email);
create index if not exists idx_users_role on users(role);

-- ─── Bookings Table (Main) ──────────────────────────────────────────────────

create table if not exists bookings (
  id text primary key default gen_random_uuid()::text,

  -- Student Information
  student_name text not null,
  student_roll text not null,
  student_email text not null,

  -- Booking Details
  requested_estate text not null,
  allocated_estate text not null,
  booking_date date not null,
  end_date date not null,
  start_time text not null,
  end_time text not null,
  purpose text not null,
  num_people integer not null,
  description text,

  -- Approval Workflow Status
  status text not null default 'pending',
  -- Values: pending, mcsa_approved, mcsa_rejected,
  --         admin_approved, admin_rejected, admin_comments_pending

  -- MCSA Level Approval
  mcsa_note text,
  mcsa_approved_at timestamp with time zone,

  -- Admin Level Approval
  admin_note text,
  admin_comment text,
  admin_approved_at timestamp with time zone,

  -- Audit
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes for performance
create index if not exists idx_bookings_student_roll on bookings(student_roll);
create index if not exists idx_bookings_status on bookings(status);
create index if not exists idx_bookings_allocated_estate on bookings(allocated_estate);
create index if not exists idx_bookings_booking_date on bookings(booking_date);

-- ─── Daily Compilations Table ───────────────────────────────────────────────

create table if not exists daily_compilations (
  id uuid primary key default gen_random_uuid(),

  compilation_date date not null,
  compiled_by text not null,
  compiled_at timestamp with time zone default now(),

  total_bookings integer not null default 0,
  approved_count integer not null default 0,
  rejected_count integer not null default 0,

  status text not null default 'pending_admin',
  -- Values: pending_admin, admin_reviewed, admin_approved

  admin_reviewed_by text,
  admin_reviewed_at timestamp with time zone,
  notes text,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_compilations_date on daily_compilations(compilation_date);
create index if not exists idx_compilations_status on daily_compilations(status);

-- ─── Enable Row Level Security ──────────────────────────────────────────────

alter table users enable row level security;
alter table bookings enable row level security;
alter table daily_compilations enable row level security;

-- ─── RLS Policies for Users ────────────────────────────────────────────────

-- Students can view only their own profile
create policy "users_student_view_own" on users
  for select
  using (auth.jwt() ->> 'email' = email);

-- MCSA and Admin can view all users
create policy "users_mcsa_admin_view_all" on users
  for select
  using (
    (select role from users where email = auth.jwt() ->> 'email' limit 1) in ('mcsa', 'admin')
  );

-- ─── RLS Policies for Bookings ─────────────────────────────────────────────

-- Students can view only their own bookings
create policy "bookings_student_view_own" on bookings
  for select
  using (student_email = auth.jwt() ->> 'email');

-- Students can insert their own bookings
create policy "bookings_student_insert_own" on bookings
  for insert
  with check (student_email = auth.jwt() ->> 'email');

-- MCSA can view all pending bookings
create policy "bookings_mcsa_view_pending" on bookings
  for select
  using (
    (select role from users where email = auth.jwt() ->> 'email' limit 1) = 'mcsa'
    and status = 'pending'
  );

-- MCSA can approve/reject bookings
create policy "bookings_mcsa_update" on bookings
  for update
  using (
    (select role from users where email = auth.jwt() ->> 'email' limit 1) = 'mcsa'
    and status = 'pending'
  )
  with check (status in ('mcsa_approved', 'mcsa_rejected'));

-- Admin can view all bookings
create policy "bookings_admin_view_all" on bookings
  for select
  using (
    (select role from users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  );

-- Admin can update any approved booking
create policy "bookings_admin_update" on bookings
  for update
  using (
    (select role from users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
    and status in ('mcsa_approved', 'admin_comments_pending')
  )
  with check (status in ('admin_approved', 'admin_rejected', 'admin_comments_pending'));

-- ─── RLS Policies for Daily Compilations ────────────────────────────────────

-- MCSA can create compilations
create policy "compilations_mcsa_insert" on daily_compilations
  for insert
  with check (
    (select role from users where email = auth.jwt() ->> 'email' limit 1) = 'mcsa'
  );

-- MCSA can view their own compilations
create policy "compilations_mcsa_view_own" on daily_compilations
  for select
  using (
    (select role from users where email = auth.jwt() ->> 'email' limit 1) = 'mcsa'
    and compiled_by = auth.jwt() ->> 'email'
  );

-- Admin can view all compilations
create policy "compilations_admin_view_all" on daily_compilations
  for select
  using (
    (select role from users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  );

-- Admin can update compilations
create policy "compilations_admin_update" on daily_compilations
  for update
  using (
    (select role from users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  )
  with check (status in ('admin_reviewed', 'admin_approved'));

-- ─── Insert Test Data (Optional) ────────────────────────────────────────────
-- Uncomment to add test users

-- insert into users (email, name, role) values
-- ('student@mica.edu', 'Test Student', 'student'),
-- ('mcsa@mica.edu', 'MCSA Team', 'mcsa'),
-- ('admin@mica.edu', 'Registrar Admin', 'admin');

-- ─── Done ───────────────────────────────────────────────────────────────────
-- Schema creation complete!
-- Next: Update supabase-client.js with your Project URL and Anon Key
