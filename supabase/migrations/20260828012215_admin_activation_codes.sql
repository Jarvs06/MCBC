-- ============================================================
-- Replace magic-link admin invitations with activation codes
-- ============================================================
--
-- The previous flow generated a Supabase Auth magic link
-- (auth.admin.generateLink) and depended on a redirect URL that
-- had to be resolved differently per platform (web origin vs a
-- native "churchadmin://" deep link), and on the browser/OS
-- reliably following that redirect back into the app. That
-- redirect-URL dependency is what's being removed here.
--
-- The new flow: a Super Admin generates a short, high-entropy
-- code for a Pending administrator and hands it to them
-- out-of-band (no email, no link). The new administrator enters
-- the code directly in the app (see supabase/functions/
-- verify-activation-code and complete-admin-activation), and
-- sets their own password. Identical on localhost, GitHub Pages,
-- and the Android APK, since nothing here depends on a redirect
-- URL or deep link at all.
--
-- Both tables below follow the same RLS philosophy already
-- established in 20260827120000_members_admin_profiles_rls.sql:
-- every read/write goes through an Edge Function using the
-- service-role key (which bypasses RLS), so RLS is left with
-- ZERO policies for `anon`/`authenticated` — a deliberate
-- default-deny, not an oversight. This is what makes "normal
-- users must not be able to read activation-code records" true
-- by construction rather than by policy logic that could
-- accidentally be too permissive.
-- ============================================================

-- ------------------------------------------------------------
-- admin_activation_codes
-- ------------------------------------------------------------
--
-- Only the SHA-256 hash of a code is ever stored (code_hash).
-- The raw code is generated server-side, returned to the Super
-- Admin exactly once in the API response, and never persisted
-- anywhere. See the Edge Functions for the hashing/normalization
-- logic.
--
-- used_at doubles as the "is this code currently valid" flag
-- (NULL = unused). A code is deleted, not flagged, when a Super
-- Admin regenerates it for the same administrator — this app has
-- no audit-trail columns elsewhere either, so keeping "at most
-- one row per administrator" simple was preferred over adding a
-- third state (used / invalidated / valid) to reason about.
-- ------------------------------------------------------------

create table public.admin_activation_codes (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.admin_profiles(id) on delete cascade,
  code_hash   text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.admin_profiles(id) on delete set null
);

-- A code's hash should never collide with another; this also
-- gives verify-activation-code a fast, indexed lookup path.
create unique index admin_activation_codes_code_hash_idx
  on public.admin_activation_codes (code_hash);

-- Enforces "at most one currently-valid code per administrator"
-- at the database level, backing up the application-level
-- delete-then-insert that regenerate-admin-activation-code does.
create unique index admin_activation_codes_admin_id_unused_idx
  on public.admin_activation_codes (admin_id)
  where used_at is null;

alter table public.admin_activation_codes enable row level security;
-- Intentionally zero policies — see file header.

-- ------------------------------------------------------------
-- activation_rate_limits
-- ------------------------------------------------------------
--
-- Brute-force protection for verify-activation-code and
-- complete-admin-activation, both of which are necessarily
-- callable with no Supabase session (the person activating an
-- account doesn't have one yet). A fixed 15-minute window,
-- counted per caller IP address and per action. No external
-- rate-limiting service is used — this project has no Redis/
-- Upstash dependency, and a church admin tool's traffic volume
-- doesn't need one.
-- ------------------------------------------------------------

create table public.activation_rate_limits (
  id             uuid primary key default gen_random_uuid(),
  ip_address     text not null,
  action         text not null check (action in ('verify_code', 'complete_activation')),
  window_start   timestamptz not null,
  attempt_count  integer not null default 1,
  updated_at     timestamptz not null default now()
);

create unique index activation_rate_limits_bucket_idx
  on public.activation_rate_limits (ip_address, action, window_start);

alter table public.activation_rate_limits enable row level security;
-- Intentionally zero policies — see file header.
