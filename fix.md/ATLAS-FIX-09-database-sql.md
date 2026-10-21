# FIX-09 — Database: atomic updates, safe cascade, share limits (SQL FILES ONLY + compatible client)

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- No new dependency, no `eas build/update`, no `git push`.
- **SQL files sirf likho. Kisi database par run mat karo.** Zain pehle review karwayega phir Supabase SQL Editor mein khud chalayega.
- Har SQL **additive aur re-runnable** ho: `create or replace function`, `add column if not exists`, `create index if not exists`. Koi `drop table/column`, `delete`, `truncate` nahi.
- Har SECURITY DEFINER function mein `set search_path = ''`, `auth.uid()` se ownership check, `revoke execute ... from public, anon; grant execute ... to authenticated`.
- End par `npx tsc --noEmit` aur `npx expo lint` pass hon.
- Do commits: `docs(sql): proposed migrations` aur `feat: use atomic RPCs with legacy fallback`.
- Final report: files changed, assumptions, risks, run-order.

## CONTEXT (audit: SEC-03, SEC-05, DB-01..05, BUG-06)
- The repo has no base schema/RLS. Only `supabase/security-hardening.sql` and `supabase/note-sharing.sql` exist. Table/column names must be inferred from client queries (`src/lib/db/*.ts`, `types.ts`). Where a column or table name is not 100% certain write `-- ASSUMPTION: ...` at the top of that file and keep the statement conservative (`add column if not exists`, guarded `do $$ ... if exists ... $$`).
- Focus counters are read-modify-write in `profile.ts` and `courses.ts`; atomic RPCs `increment_global_focus(integer)` and `increment_course_focus(bigint, integer)` already exist in `security-hardening.sql` but are unused by the client.
- Course delete is 4 separate client deletes with no transaction.
- `share_note` has no rate limit and no provenance.

## GOAL
Server-side atomicity and limits, with a client that works both before and after the SQL is run.

## SCOPE
- `supabase/migrations/` (NEW folder; one file per item, numbered)
- `supabase/rls-audit.sql` (NEW, read-only SELECTs)
- `src/lib/db/profile.ts`, `src/lib/db/courses.ts`, `src/lib/db/roadmaps.ts`, `src/lib/db/shares.ts`, `src/lib/db/focus.ts`
- `src/app/notes.tsx` / share modal (error mapping + small "Shared" tag only)

## STEPS
### SQL files (do not run)
1. `supabase/rls-audit.sql`: SELECT-only queries that list (a) every table in `public` with `rowsecurity` true/false, (b) every policy from `pg_policies` (table, cmd, roles, qual, with_check), (c) function grants for the RPCs the app calls (`record_activity`, `record_quiz_session`, `activity_heatmap`, `share_note`, `increment_*`), (d) columns of every table the client touches. Zain runs it and sends the output back.
2. `001_delete_course_cascade.sql`: `delete_course_cascade(p_course_id bigint)` — checks the caller owns the course, then deletes related notes, roadmap (+ nodes/connections via existing cascade or explicit), learning sessions and the course in ONE transaction; returns boolean.
3. `002_share_note_limits.sql`: `alter table notes add column if not exists shared_by uuid, add column if not exists shared_at timestamptz;` and `create or replace function share_note(...)` keeping the existing checks, plus: set `shared_by/shared_at` on the copy and raise a clear exception (`RATE_LIMIT`) when one sender has already shared 10 notes to the same recipient in the last 24 hours. Keep existing length clamps and grants.
4. `003_roadmap_node_xp_once.sql`: `alter table roadmap_nodes add column if not exists xp_awarded_at timestamptz;` only if the table/column names match what `roadmaps.ts` uses (else leave a commented ASSUMPTION block). Used for award-once.
5. Header comment on every file: purpose, assumptions, how to roll back (`-- rollback:` with the inverse statements, for human use only).

### Client (must work with and without the SQL)
6. Focus: `flushFocus` / course focus use the atomic RPCs. If the RPC returns "function not found" (PostgREST `PGRST202` or Postgres `42883`), fall back once to the old read-modify-write and remember the failure for the session.
7. Course delete: call `delete_course_cascade`; fall back to the current multi-step delete if the RPC is missing.
8. Share: map the `RATE_LIMIT` exception to a friendly message ("You've shared a lot of notes with this friend today. Try again tomorrow."); show a small "Shared" tag on notes where `shared_by` is not null (no username lookup).
9. Roadmap XP award-once: when completing a node, first try `update roadmap_nodes set xp_awarded_at = now() where id = ? and xp_awarded_at is null returning id` (+ user scope) and award XP only if a row came back; if the column is missing, fall back to the Batch 04 transition guard.

## DO NOT
- Run SQL, change RLS policies, or touch auth.
- Rename or drop anything existing.

## ACCEPTANCE
- All SQL files parse (state how you checked, e.g. read-through; do not claim execution).
- App behaves exactly as before when none of the SQL has been run.
- After the SQL is run: two devices adding focus concurrently do not lose seconds; deleting a course is all-or-nothing; the 11th share in a day shows the friendly limit message; completing a node twice awards XP once.

## USER TEST (Zain karega — SQL chalane ke BAAD)
1. Pehle `rls-audit.sql` ka output mujhe bhejo, main review karunga.
2. Meri review ke baad migrations ek ek karke chalao (file ka naam batate hue).
3. 2 phones/accounts se ek hi waqt timer save karo: totals sahi barhe.
4. Test course delete karo; notes/roadmap bhi gaye, kuch adhura nahi.
5. Dost account ko 11 notes share karne ki koshish: 11vi par friendly error.
