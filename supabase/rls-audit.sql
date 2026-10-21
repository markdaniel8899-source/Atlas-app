-- ATLAS RLS Audit (read-only SELECTs)
-- Run in Supabase SQL editor. Output this result and send to Zain for review.
-- Purpose: list every table with RLS status, all policies, function grants,
-- and columns of tables the client touches. No writes.

-- 1. Tables with rowsecurity status
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- 2. All policies from pg_policies
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 3. Function grants for RPCs the app calls
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  array_agg(
    case
      when has_function_privilege(r.rolname, p.oid, 'execute') then r.rolname
    end
  ) filter (where r.rolname is not null) as granted_to_roles
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join pg_roles r on has_function_privilege(r.rolname, p.oid, 'execute')
where n.nspname = 'public'
  and p.proname in (
    'record_activity',
    'record_quiz_session',
    'activity_heatmap',
    'share_note',
    'increment_global_focus',
    'increment_course_focus',
    'invite_friend',
    'delete_course_cascade'
  )
group by p.oid, p.proname, pg_get_function_identity_arguments(p.oid), p.prosecdef
order by p.proname;

-- 4. Columns of every table the client touches
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'profiles',
    'courses',
    'course_topics',
    'roadmaps',
    'roadmap_nodes',
    'roadmap_connections',
    'notes',
    'learning_sessions',
    'friendships',
    'contact_messages',
    'quiz_sessions',
    'quiz_attempts'
  )
order by table_name, ordinal_position;