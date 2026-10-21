-- ATLAS Migration 001: Cascade course delete
-- Purpose: delete a course and all its related data in ONE transaction.
-- Checks ownership, deletes notes, roadmap (nodes/connections cascade),
-- learning_sessions, and the course itself. Returns boolean.
-- Assumptions:
--   - courses table has columns: id (bigint), user_id (uuid)
--   - notes table has: course_id (bigint), topic_id (bigint), user_id (uuid)
--   - course_topics table has: id (bigint), course_id (bigint), user_id (uuid)
--   - roadmaps table has: course_id (bigint), user_id (uuid)
--   - roadmap_nodes has FK to roadmaps (cascade), roadmap_connections has FK to roadmaps (cascade)
--   - learning_sessions has: course_id (bigint), user_id (uuid)
-- Rollback: drop function if exists public.delete_course_cascade(bigint);

create or replace function public.delete_course_cascade(p_course_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_ok boolean := true;
begin
  if v_me is null then
    return false;
  end if;

  -- Verify ownership
  if not exists (select 1 from public.courses where id = p_course_id and user_id = v_me) then
    return false;
  end if;

  -- Notes linked directly or via topics of this course
  delete from public.notes
  where user_id = v_me
    and (
      course_id = p_course_id
      or topic_id in (select id from public.course_topics where course_id = p_course_id and user_id = v_me)
    );

  -- Roadmap (nodes/connections cascade via FK)
  delete from public.roadmaps
  where course_id = p_course_id and user_id = v_me;

  -- Learning sessions
  delete from public.learning_sessions
  where course_id = p_course_id and user_id = v_me;

  -- Finally the course row
  delete from public.courses
  where id = p_course_id and user_id = v_me;

  return true;
end;
$$;

revoke all on function public.delete_course_cascade(bigint) from public, anon;
grant execute on function public.delete_course_cascade(bigint) to authenticated, service_role;