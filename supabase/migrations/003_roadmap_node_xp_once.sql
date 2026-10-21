-- ATLAS Migration 003: roadmap_nodes xp_awarded_at (award-once guard)
-- Purpose: add column to track when XP was awarded for completing a node,
-- so completing the same node twice only awards XP once.
-- Assumptions (from roadmaps.ts):
--   - roadmap_nodes table has: id (uuid), roadmap_id (uuid), status (text), completed_at (timestamptz)
--   - roadmaps table has: user_id (uuid) for ownership
--   - The client will do: update roadmap_nodes set xp_awarded_at = now() where id = ? and xp_awarded_at is null returning id
-- Rollback: alter table roadmap_nodes drop column if exists xp_awarded_at;

-- 1. Add column if table/columns match expectations
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'roadmap_nodes'
      and column_name = 'id'
      and data_type = 'uuid'
  ) then
    alter table public.roadmap_nodes
      add column if not exists xp_awarded_at timestamptz;
  else
    -- ASSUMPTION FAILED: roadmap_nodes.id is not uuid or table missing.
    -- Leave commented block for manual review.
    -- alter table public.roadmap_nodes add column if not exists xp_awarded_at timestamptz;
    raise notice 'ASSUMPTION: roadmap_nodes.id is not uuid or table missing. Skipping column add.';
  end if;
end;
$$;

-- 2. Index for the award-once query
create index if not exists roadmap_nodes_xp_awarded_idx
  on public.roadmap_nodes (id) where xp_awarded_at is null;