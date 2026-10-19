-- ATLAS note sharing - simple direct copy (2026-10-19)
-- Run once in the Supabase SQL editor (project: bzwqiguoihztbvnammqx).
--
-- Share = the note is copied into the recipient's own notes table. There is
-- no inbox table, no import step and no extra tab: the shared note simply
-- shows up in the friend's Notes list.
--
-- The copy has to happen on the server (notes RLS only lets you write your
-- own rows), so this one RPC does the ownership + friendship checks and
-- inserts the copy as the recipient.

-- Cleanup from the earlier inbox design (safe if it was never run).
drop function if exists public.mark_note_share_read(bigint);
drop function if exists public.import_note_share(bigint);
drop function if exists public.share_note(bigint, uuid);
drop table if exists public.note_shares;

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

  -- Snapshot copy in the recipient's notes. The course/topic link is left
  -- empty because course rows belong to the sender, not the recipient.
  insert into public.notes (user_id, title, content)
  values (
    p_recipient_id,
    coalesce(nullif(btrim(left(v_note.title, 160)), ''), 'Untitled note'),
    left(v_note.content, 200000)
  )
  returning id into v_new_note_id;

  return jsonb_build_object('ok', true, 'message', 'Note sent.');
end;
$$;

revoke execute on function public.share_note(bigint, uuid) from public, anon;
grant execute on function public.share_note(bigint, uuid) to authenticated, service_role;
