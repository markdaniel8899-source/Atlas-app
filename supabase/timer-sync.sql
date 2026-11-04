-- Cross-device focus timer (mobile app + website).
-- One row per account mirrors the live TimerState so a session started on the
-- website continues in the app and vice versa. Run once in the Supabase SQL
-- editor. Safe to re-run.

create table if not exists public.focus_timers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mode text not null default 'idle'
    check (mode in ('idle', 'running', 'paused')),
  started_at timestamptz,
  accumulated_ms bigint not null default 0 check (accumulated_ms >= 0),
  target_min integer not null default 25
    check (target_min between 1 and 1440),
  course_id bigint references public.courses (id) on delete set null,
  flushed_ms bigint not null default 0 check (flushed_ms >= 0),
  device_id text,
  updated_at timestamptz not null default now(),
  constraint focus_timers_running_started
    check (mode <> 'running' or started_at is not null)
);

create or replace function public.touch_focus_timer()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists focus_timers_touch on public.focus_timers;
create trigger focus_timers_touch
before update on public.focus_timers
for each row execute function public.touch_focus_timer();

alter table public.focus_timers enable row level security;

drop policy if exists "focus_timers_select_own" on public.focus_timers;
create policy "focus_timers_select_own"
  on public.focus_timers for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "focus_timers_insert_own" on public.focus_timers;
create policy "focus_timers_insert_own"
  on public.focus_timers for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "focus_timers_update_own" on public.focus_timers;
create policy "focus_timers_update_own"
  on public.focus_timers for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "focus_timers_delete_own" on public.focus_timers;
create policy "focus_timers_delete_own"
  on public.focus_timers for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on public.focus_timers from anon;
grant select, insert, update, delete on public.focus_timers to authenticated;
grant all on public.focus_timers to service_role;

-- Realtime keeps both clients live while both are open.
do $$
begin
  begin
    alter publication supabase_realtime add table public.focus_timers;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

-- Optional cleanup for sessions logged before the target-cap fix:
-- delete from public.learning_sessions where total_seconds > 86400;
