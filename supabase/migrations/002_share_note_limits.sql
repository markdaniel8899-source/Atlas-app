-- ATLAS Migration 002: share_note rate limits + provenance columns
-- Purpose: add shared_by/shared_at to notes, and enforce 10 shares/day limit
-- per sender->recipient pair in share_note RPC.
-- Assumptions:
--   - notes table has: id (bigint), user_id (uuid), title, content, updated_at
--   - friendships table has: requester_id (uuid), addressee_id (uuid), status
--   - existing share_note RPC from note-sharing.sql already exists
-- Rollback:
--   alter table notes drop column if exists shared_by;
--   alter table notes drop column if exists shared_at;
--   drop function if exists public.share_note(bigint, uuid);
--   (then re-run note-sharing.sql to restore original)

-- 1. Provenance columns on notes
alter table public.notes
  add column if not exists shared_by uuid,
  add column if not exists shared_at timestamptz;

-- 2. Index for the rate-limit query
create index if not exists notes_shared_by_recipient_idx
  on public.notes (shared_by, shared_at desc);

-- 3. Updated share_note with rate limit
create or replace function public.share_note(
  p_note_id bigint,
  p_recipient_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_note public.notes%rowtype;
  v_is_friend boolean;
  v_new_note_id bigint;
  v_recent_shares bigint;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'message', 'You are not signed in.');
  end if;

  if p_note_id is null or p_recipient_id is null then
    return jsonb_build_object('ok', false, 'message', 'Pick a note and a friend.');
  end if;

  if p_recipient_id = v_me then
    return jsonb_build_object('ok', false, 'message', 'You cannot share a note with yourself.');
  end if;

  -- Only the owner can share the note.
  select * into v_note
  from public.notes
  where id = p_note_id and user_id = v_me;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'That note could not be found.');
  end if;

  if not exists (select 1 from auth.users u where u.id = p_recipient_id) then
    return jsonb_build_object('ok', false, 'message', 'That account no longer exists.');
  end if;

  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = v_me and f.addressee_id = p_recipient_id)
        or (f.requester_id = p_recipient_id and f.addressee_id = v_me)
      )
  ) into v_is_friend;

  if not v_is_friend then
    return jsonb_build_object('ok', false, 'message', 'You can only share notes with accepted friends.');
  end if;

  -- Rate limit: max 10 shares from this sender to this recipient in last 24h
  select count(*) into v_recent_shares
  from public.notes
  where shared_by = v_me
    and user_id = p_recipient_id
    and shared_at > now() - interval '24 hours';

  if v_recent_shares >= 10 then
    return jsonb_build_object('ok', false, 'message', 'RATE_LIMIT');
  end if;

  -- Snapshot copy in the recipient's notes. Course/topic link left empty.
  insert into public.notes (user_id, title, content, shared_by, shared_at)
  values (
    p_recipient_id,
    coalesce(nullif(btrim(left(v_note.title, 160)), ''), 'Untitled note'),
    left(v_note.content, 200000),
    v_me,
    now()
  )
  returning id into v_new_note_id;

  return jsonb_build_object('ok', true, 'message', 'Note sent.');
end;
$$;

revoke execute on function public.share_note(bigint, uuid) from public, anon;
grant execute on function public.share_note(bigint, uuid) to authenticated, service_role;