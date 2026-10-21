# FIX-03 — Account isolation and robust sign-out

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- No new dependency, no `eas build/update`, no `git push`.
- Look/colors/copy mat badlo.
- End par `npx tsc --noEmit` aur `npx expo lint` pass hon.
- Sirf ek commit: `fix: isolate per-account runtime state and harden sign-out`
- Code bayan se alag nikle to wo step ruko aur report mein likho.
- Final report: files changed, kya badla, kaise verify, risks, phone test.

## CONTEXT (audit: ARC-03, BUG-03, BUG-10, BUG-11)
Sign-out clears AsyncStorage/caches/widget, but not live in-memory state: `timer-context.tsx`, `quiz-store.ts`, `assistant-store.ts`. Timer storage keys (`atlas.timer`, `atlas.sessions`, `atlas.focus.base`) are global, and the global-focus base only ever syncs upward (max), so account B can inherit A's numbers. `signOut()` awaits `supabase.auth.signOut()` before local cleanup with no try/finally, and `account-sheet.tsx` calls `void signOut().then(...)` with no catch.

## GOAL
After logout (or any change of the signed-in user) the next account sees nothing from the previous one: timer idle, quiz at setup, assistant empty, totals from the server. Logout always completes locally even offline.

## SCOPE
- `src/lib/session-reset.ts` (NEW)
- `src/lib/auth.ts`
- `src/context/timer-context.tsx`, `src/lib/timer.ts`
- `src/lib/quiz-store.ts`
- `src/lib/assistant-store.ts`
- `src/components/account-sheet.tsx`
- `src/app/_layout.tsx` (only to place/reset TimerProvider if needed)
- `src/hooks/use-dashboard.ts`, `src/lib/data-cache.ts`, `src/lib/profile-cache.ts` (verify; edit only if they can serve another user's data)

## STEPS
1. Create `src/lib/session-reset.ts` with a tiny registry: `registerResetHandler(fn): () => void` and `runResetHandlers(): void`. No imports from feature modules (avoids circular imports).
2. Each stateful module registers its own reset at module load:
   - `quiz-store.ts`: `resetQuizStore()` returns phase/summary/attempts/topic to the initial state and cancels any pending timers.
   - `assistant-store.ts`: clear thread + `persistedOwner`.
   - `timer-context.tsx`: expose a reset that stops the interval, clears state (phase, elapsed, target, course, flash, completion card) and `globalBase` (re-read from server for the new user).
3. Scope timer storage per user: key names include the user id (e.g. `atlas.timer.<uid>`), or store `{ownerId, ...}` and ignore a payload whose owner differs from the current user. Old unscoped keys must be removed on first run. `globalBase` must initialize from the NEW account's server value, not `max(local, server)` across accounts.
4. `auth.ts`:
   - `signOut()` becomes: `try { await supabase.auth.signOut() } catch { /* ignore network error */ } finally { clear timer storage, caches, notifications, widget data; runResetHandlers() }`.
   - In `subscribeAuth`, when the user id changes (A -> B, or session expiry then another login), call `runResetHandlers()` before exposing the new user.
5. `account-sheet.tsx`: handle the signOut promise with `.catch(() => {})` and always navigate to `/login` afterwards. (Confirmation dialog is Batch 08, not here.)
6. `_layout.tsx`: `TimerProvider` currently sits outside the keyed `Tabs`. Either keep it where it is and rely on the reset handler, or move it inside the keyed tree — choose the smaller change. State which in the report.
7. Add a guard so a late response for the old user cannot overwrite the new user's state (compare `ownerId` before `setState` in `use-dashboard` / caches). Edit only where the code can actually race.

## DO NOT
- Touch `notes-queue.ts` (already owner-scoped) or its on-disk data.
- Delete the user's server data.

## ACCEPTANCE
- A runs a timer for 1 minute, logs out; B logs in: timer idle, no A sessions in the log, total focus equals B's server value.
- A finishes a quiz, logs out; B logs in: Quiz tab shows setup.
- Assistant: no A messages for B.
- Logout in airplane mode: lands on login, local data cleared, no unhandled promise rejection.

## USER TEST (Zain karega — 2 accounts chahiye)
1. Account A: timer 1-2 min chalao, quiz khatam karo, assistant se ek message bhejo, logout.
2. Account B se login karo: timer idle? quiz setup screen? assistant khali? focus total B ka apna?
3. Airplane mode on karo, logout karo: login screen aani chahiye.
4. Dobara A se login: A ka apna data wapas aana chahiye.
