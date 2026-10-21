# FIX-08 — Confirmations, refresh/stale states, copy, local-day correctness

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- No new dependency, no `eas build/update`, no `git push`.
- Look same rahe; naye dialogs existing `ConfirmDialog` style mein.
- End par `npx tsc --noEmit` aur `npx expo lint` pass hon.
- Is batch mein 2 commits allowed: `feat: confirmations, refresh and stale states` aur `fix: consistent local-day handling`.
- Code bayan se alag nikle to wo step ruko aur report mein likho.
- Final report: files changed, kya badla, kaise verify, risks, phone test.

## CONTEXT (audit: UX-05, 09, 10, 11, BUG-14, DOC-01, DOC-02)
- Note delete, logout and timer Stop are immediate; course delete already has a `ConfirmDialog`.
- Leaderboard/notes/courses/friends silently show cached data when a refresh fails; no pull-to-refresh on dashboard/friends/notes/courses; friends only loads on mount.
- Heatmap, streak reminder, widget and week keys mix UTC and local days, so for UTC+5 users evening activity can land on the wrong day.
- Copy claims "sanitized with DOMPurify" (not true); privacy page makes claims the client cannot verify.

## GOAL
No accidental destructive taps, clear freshness/offline state, consistent "today", honest copy.

## SCOPE
- `src/app/notes.tsx`, `src/components/account-sheet.tsx`, `src/app/timer.tsx`
- `src/components/ui/confirm-dialog.tsx` (reuse; extend only if needed)
- `src/app/index.tsx`, `src/app/friends.tsx`, `src/app/courses.tsx`, `src/app/leaderboard.tsx`
- `src/components/dashboard/activity-heatmap.tsx`, `src/lib/notifications.ts`, `src/lib/widgets/*`
- `src/lib/day.ts` (NEW)
- `src/app/privacy.tsx`, `AGENTS.md`

## STEPS (commit 1)
1. **Confirm dialogs** with the existing `ConfirmDialog`: note delete ("Delete this note? This can't be undone."), logout ("Log out of ATLAS?"), timer Stop ("End this session? Your time so far will be saved.").
2. **Pull-to-refresh** (`RefreshControl`) on dashboard, friends, notes, courses; leaderboard keeps its own. Refresh calls the existing loaders.
3. **Stale/offline note:** when a screen serves cached data because the refresh failed or the device is offline, show a small non-blocking line ("Showing saved data - couldn't refresh" + Retry). When a refresh succeeds it disappears. One reusable component.
4. **Friends focus refresh:** if not already done in Batch 06 step 7, refetch on focus (debounced).
5. **Copy fixes:** notes footnote -> "Content is sanitized before saving and saved as you type."; privacy page: remove the unverifiable "deleted immediately / never stored" wording and soften to what the app can promise ("PDFs are sent to our AI provider to generate your quiz and are not kept in your account"), and add a line that notes/PDF excerpts are processed by an AI provider. Do NOT invent retention numbers. Keep the email deletion line for now.
6. **AGENTS.md:** correct the widget section to the two shipped widgets (`AtlasWidget`, `AtlasNotesWidget`); remove the non-existent sticky widget.

## STEPS (commit 2)
7. Create `src/lib/day.ts`: `localDayKey(date = new Date())` (device-local `YYYY-MM-DD`), `isSameLocalDay(a, b)`, `daysBetweenLocal(a, b)`.
8. Use it where the UI decides "today": heatmap "today" cell/labels, streak reminder decision in `notifications.ts`, widget week/day formatting. Server dates stay as stored; convert server timestamps to the device-local day only for display and for "did I study today" checks.
9. Add a Node-runnable sanity script in the report (not committed) that simulates 23:30 at UTC+5 and shows today's session lands in today's cell and the reminder is not wrongly cancelled/armed.

## DO NOT
- Change how streak/XP is computed on the server.
- Touch AI/network code.

## ACCEPTANCE
- Delete/logout/stop each show a dialog; cancel does nothing.
- Pull-to-refresh works on the four screens; stale line appears offline and disappears online.
- No "DOMPurify" string remains (`grep -rn DOMPurify src` empty).
- Today's heatmap cell matches the device's local date at 23:30 UTC+5.

## USER TEST (Zain karega)
1. Note delete, logout, timer stop: dialog aaye; Cancel se kuch na ho.
2. Airplane mode: Leaderboard/Friends/Notes kholo -> "Showing saved data" line; data wapas on karke pull-to-refresh.
3. Raat 11-12 baje (ya phone ka time/timezone badal kar) session karo: heatmap mein aaj ke din par dikhe, kal par nahi.
4. Notes ke neeche line aur Privacy page parho: sach lagti hain?
