-- ATLAS backend hardening (2026-10-17)
-- Run in the Supabase SQL editor (project: bzwqiguoihztbvnammqx).
-- Every statement is safe on a live database (NOT VALID constraints still
-- apply to all new writes without validating existing rows).
--
-- Verified by live probes on 2026-10-17 (throwaway user atlas.probe.1017):
--   * record_activity already clamps p_xp server-side (999999 -> daily cap
--     1440; negative values are a no-op). No client fix needed.
--   * notes / learning_sessions / profiles return nothing for anonymous
--     requests (RLS row isolation works).
--   * contact_messages accepts anonymous inserts (public contact form works).

-- ---------------------------------------------------------------- 1. Length caps
alter table contact_messages
  add constraint contact_messages_name_len
    check (char_length(name) <= 120) not valid,
  add constraint contact_messages_email_len
    check (char_length(email) <= 200) not valid,
  add constraint contact_messages_subject_len
    check (char_length(subject) <= 200) not valid,
  add constraint contact_messages_message_len
    check (char_length(message) <= 8000) not valid;

alter table profiles
  add constraint profiles_display_name_len
    check (char_length(coalesce(display_name, '')) <= 80) not valid,
  add constraint profiles_username_len
    check (char_length(username) between 3 and 32) not valid;

alter table notes
  add constraint notes_title_len
    check (char_length(title) <= 200) not valid,
  add constraint notes_content_len
    check (char_length(content) <= 200000) not valid;

-- ------------------------------------------------- 2. Avatar URL host allowlist
-- Mirrors the client allowlist (lib/dicebear.ts): DiceBear API or this
-- project's public storage bucket only.
alter table profiles
  add constraint profiles_avatar_url_host check (
    avatar_url is null
    or avatar_url like 'https://api.dicebear.com/%'
    or avatar_url like 'https://bzwqiguoihztbvnammqx.supabase.co/storage/v1/object/public/%'
  ) not valid;

-- ------------------------------------------ 3. Atomic focus counters (optional)
-- The client currently does read-modify-write on total_focus_seconds, which
-- can lose updates if two devices study at once. Switch the app to these
-- RPCs when ready (call with the elapsed seconds delta):
--   select increment_global_focus(300);
--   select increment_course_focus(<course_id>, 300);
create or replace function increment_global_focus(p_seconds integer)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles
     set total_focus_seconds =
           coalesce(total_focus_seconds, 0)
         + least(greatest(coalesce(p_seconds, 0), 0), 86400)
   where id = auth.uid();
$$;

create or replace function increment_course_focus(p_course_id bigint, p_seconds integer)
returns void
language sql
security definer
set search_path = public
as $$
  update courses
     set total_focus_seconds =
           coalesce(total_focus_seconds, 0)
         + least(greatest(coalesce(p_seconds, 0), 0), 86400)
   where id = p_course_id
     and user_id = auth.uid();
$$;

revoke all on function increment_global_focus(integer) from public;
revoke all on function increment_course_focus(bigint, integer) from public;
grant execute on function increment_global_focus(integer) to authenticated;
grant execute on function increment_course_focus(bigint, integer) to authenticated;

-- ------------------------------------------------------- 4. RLS policy audit
-- Run and check that every table with a user_id column has SELECT/UPDATE/
-- DELETE policies of the form  auth.uid() = user_id  (the client also scopes
-- its writes now, but RLS is the real gate):
--
--   select tablename, policyname, cmd, qual, with_check
--     from pg_policies
--    where schemaname = 'public'
--    order by tablename, cmd;
--
-- Pay special attention to: notes, courses, course_topics, roadmaps,
-- roadmap_nodes, learning_sessions, profiles, friendships.
