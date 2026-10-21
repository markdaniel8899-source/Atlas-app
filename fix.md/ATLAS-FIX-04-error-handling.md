# FIX-04 — False success, double-saves, ignored write errors

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- No new dependency, no `eas build/update`, no `git push`.
- Look/colors/copy mat badlo (naye error messages ke alawa).
- End par `npx tsc --noEmit` aur `npx expo lint` pass hon.
- Sirf ek commit: `fix: surface write failures and prevent double-submit`
- Code bayan se alag nikle to wo step ruko aur report mein likho.
- Final report: files changed, kya badla, kaise verify, risks, phone test.

## CONTEXT (audit: BUG-01, 02, 04, 05, 08, 12, 13, SEC-08)
- Friends: `acceptInvite/declineInvite` return void and ignore errors; UI always flashes success.
- Quiz: last "See results" can run `saveQuizSession` twice (double XP/session). Save fallback hides failures.
- Courses: `createTopic/setTopicStatus/removeTopic` ignore errors; form clears even on failure.
- Roadmap: node update + XP + course sync ignore each other's failures; generation has no synchronous re-entrancy guard; confetti timeout not cleared; `updateNodeStatuses` lacks a user scope.
- Invite errors return raw `error.message`.

## GOAL
No success message unless the write succeeded. No double-save. Failures show a short human message and a retry path, and optimistic UI reverts.

## SCOPE
- `src/lib/db/squad.ts`, `src/app/friends.tsx`
- `src/lib/db/quiz-sessions.ts`, `src/lib/quiz-store.ts`, `src/app/quiz.tsx`
- `src/lib/db/courses.ts`, `src/app/courses.tsx`, `src/hooks/use-courses.ts` (only if needed)
- `src/lib/db/roadmaps.ts`, `src/app/roadmap.tsx`

## STEPS
### A. Friends
1. `sendFriendRequest/acceptInvite/declineInvite` return `{ ok: true } | { ok: false; message: string }`. Treat a Supabase `error` AND zero affected rows (use `.select()` on the update) as failure.
2. Map errors to friendly text ("We couldn't send that request. Check the email and try again.", "That request is no longer available."). Never return the raw database message (SEC-08).
3. `friends.tsx`: show the success flash only when `ok`. On failure show an inline banner and keep the request on screen; reload the list either way.

### B. Quiz
4. In `quiz-store.ts` add a module-level `finishing` flag set **synchronously** before any await. A second call while `finishing` returns immediately.
5. Make results appear immediately (`phase: "done"` right after computing the summary), and run the remote save afterwards. Store `saveState: "saving" | "saved" | "failed"`.
6. `quiz.tsx`: disable the final button while `finishing/saving`.
7. `saveQuizSession` returns `{ ok, recorded }` precisely: `recorded` only if some RPC actually succeeded. If both RPCs fail, the results screen says the result was not saved and shows a **Retry save** button; do not claim XP/streak was awarded.

### C. Courses
8. `createTopic/setTopicStatus/removeTopic` return `{ ok, message? }`. `courses.tsx`: revert the optimistic toggle on failure and show an inline error; do not clear the new-topic input unless `ok`.

### D. Roadmap
9. `generate` handler: set `busyRef.current = true` synchronously at the top (before `ensureOnline`); return if already set; reset in `finally`.
10. `updateNodeStatuses`: add the user scope (`.eq("user_id", userId)` if the column exists — check `types.ts`/existing queries; otherwise scope through the roadmap id the user owns), return `{ ok }`, and report partial failure.
11. Completion flow: update the node first; only if it succeeded, sync course progress; award XP only when the update actually changed a row from not-completed to completed (use `.neq("status","completed").select("id")` and check the length). Do not award on failure.
12. Store the confetti `setTimeout` id and clear it on unmount.

## DO NOT
- Change database schema (that is Batch 09).
- Rewrite screens; keep edits local.

## ACCEPTANCE
- Offline accept/decline: error shown, no success flash, request stays.
- Double-tap the last quiz answer/"See results": exactly one `learning_sessions` row and one XP award.
- Offline topic toggle/create: reverts with an error, input kept.
- Double-tap Generate: one roadmap.
- Completing the same node twice awards XP once.

## USER TEST (Zain karega)
1. Airplane mode: friend request accept karo -> error aana chahiye, success nahi.
2. Quiz: aakhri sawal ke baad "See results" par jaldi 3-4 tap karo. Leaderboard/XP mein sirf ek dafa XP barhna chahiye (pehle XP note kar lo).
3. Airplane mode: course mein topic add/toggle karo -> error, input barqarar.
4. Roadmap: ek level complete karo, XP ek dafa; dobara toggle karke complete karo -> dobara XP nahi (agar mile to batao).
5. Generate button par double tap -> sirf ek roadmap.
