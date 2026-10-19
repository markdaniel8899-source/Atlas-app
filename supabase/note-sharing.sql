-- ATLAS note sharing (2026-10-19)
-- Run in the Supabase SQL editor (project: bzwqiguoihztbvnammqx).
-- Safe to re-run: every statement is idempotent.
--
-- Design:
--   * note_shares stores a SNAPSHOT (title/content/course title) at share
--     time. The recipient never gains access to the sender's notes row.
--   * Rows are written ONLY through security-definer RPCs (no INSERT/UPDATE
--     policies), so a client cannot fake a sender, skip the friendship check
--     or bypass the hourly rate limit.
--   * The recipient can read/delete rows addressed to them; the sender can
--     read/delete rows they sent.
--   * import_note_share copies the snapshot into the recipient's own notes.

-- ------------------------------------------------------------ 1. Table
create table if not exists public.note_shares (
  id bigint generated always as identity primary key,
  note_id bigint references public.notes (id) on delete set null,
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  content text not null default '',
  course_title text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  imported_at timestamptz,
  constraint note_shares_no_self check (sender_id <> recipient_id),
  -- mirrors notes.title (1..160) so import_note_share can never fail
  constraint note_shares_title_len check (char_length(title) between 1 and 160),
  constraint note_shares_content_len check (char_length(content) <= 200000)
);

-- Re-assert the CHECKs so re-running this file after a bound change
-- (title was 1..200 in an earlier draft) actually updates them.
update public.note_shares
   set title = coalesce(nullif(btrim(left(title, 160)), ''), 'Untitled note'),
       content = left(content, 200000)
 where char_length(title) not between 1 and 160
    or char_length(content) > 200000;

alter table public.note_shares
  drop constraint if exists note_shares_no_self,
  drop constraint if exists note_shares_title_len,
  drop constraint if exists note_shares_content_len;

alter table public.note_shares
  add constraint note_shares_no_self check (sender_id <> recipient_id),
  add constraint note_shares_title_len check (char_length(title) between 1 and 160),
  add constraint note_shares_content_len check (char_length(content) <= 200000);

create index if not exists note_shares_recipient_idx
  on public.note_shares (recipient_id, created_at desc);
create index if not exists note_shares_recipient_unread_idx
  on public.note_shares (recipient_id) where read_at is null;
create index if not exists note_shares_sender_idx
  on public.note_shares (sender_id, created_at desc);
-- FK lookup index: deleting a note must not scan the shares table.
create index if not exists note_shares_note_idx
  on public.note_shares (note_id);

alter table public.note_shares enable row level security;

-- RLS: both parties may see a share; either may delete it.
drop policy if exists "note_shares_select_parties" on public.note_shares;
create policy "note_shares_select_parties"
  on public.note_shares for select to authenticated
  using (
    sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  );

drop policy if exists "note_shares_delete_parties" on public.note_shares;
create policy "note_shares_delete_parties"
  on public.note_shares for delete to authenticated
  using (
    sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  );

-- No INSERT / UPDATE policies on purpose: writes go through the RPCs below.
revoke all on public.note_shares from public, anon;
revoke insert, update, truncate, references, trigger
  on public.note_shares from authenticated;
grant select, delete on public.note_shares to authenticated;

-- --------------------------------------------------- 2. share_note RPC
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
  v_course_title text;
  v_share_id bigint;
  v_recent integer;
  v_is_friend boolean;
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

  -- Ownership is enforced here (RLS alone would not be enough for a definer).
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

  -- Abuse guard: at most 60 shares per sender per rolling hour.
  select count(*) into v_recent
  from public.note_shares s
  where s.sender_id = v_me and s.created_at > now() - interval '1 hour';

  if v_recent >= 60 then
    return jsonb_build_object('ok', false, 'message', 'Too many shares in the last hour. Try again later.');
  end if;

  -- Snapshot the course title the sender sees (direct link or via topic).
  if v_note.course_id is not null then
    select c.title into v_course_title
    from public.courses c
    where c.id = v_note.course_id;
  elsif v_note.topic_id is not null then
    select c.title into v_course_title
    from public.course_topics t
    join public.courses c on c.id = t.course_id
    where t.id = v_note.topic_id;
  end if;

  -- Clamp legacy rows (older UI allowed 200-char titles) so the snapshot
  -- always satisfies the notes-compatible CHECKs.
  insert into public.note_shares (
    note_id, sender_id, recipient_id, title, content, course_title
  ) values (
    v_note.id,
    v_me,
    p_recipient_id,
    coalesce(nullif(btrim(left(v_note.title, 160)), ''), 'Untitled note'),
    left(v_note.content, 200000),
    v_course_title
  )
  returning id into v_share_id;

  return jsonb_build_object('ok', true, 'message', 'Note sent.', 'share_id', v_share_id);
end;
$$;

revoke execute on function public.share_note(bigint, uuid) from public, anon;
grant execute on function public.share_note(bigint, uuid) to authenticated, service_role;

-- --------------------------------------------- 3. import_note_share RPC
create or replace function public.import_note_share(p_share_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_share public.note_shares%rowtype;
  v_note_id bigint;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'message', 'You are not signed in.');
  end if;

  select * into v_share
  from public.note_shares
  where id = p_share_id and recipient_id = v_me;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'That shared note could not be found.');
  end if;

  if v_share.imported_at is not null then
    return jsonb_build_object('ok', false, 'message', 'You already imported this note.');
  end if;

  insert into public.notes (user_id, title, content)
  values (v_me, v_share.title, v_share.content)
  returning id into v_note_id;

  update public.note_shares
     set imported_at = now(),
         read_at = coalesce(read_at, now())
   where id = v_share.id;

  return jsonb_build_object('ok', true, 'message', 'Note added to your notes.', 'note_id', v_note_id);
end;
$$;

revoke execute on function public.import_note_share(bigint) from public, anon;
grant execute on function public.import_note_share(bigint) to authenticated, service_role;

-- ------------------------------------------ 4. mark_note_share_read RPC
create or replace function public.mark_note_share_read(p_share_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.note_shares
     set read_at = coalesce(read_at, now())
   where id = p_share_id
     and recipient_id = auth.uid();
$$;

revoke execute on function public.mark_note_share_read(bigint) from public, anon;
grant execute on function public.mark_note_share_read(bigint) to authenticated, service_role;
