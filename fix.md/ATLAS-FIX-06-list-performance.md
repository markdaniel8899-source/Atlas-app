# FIX-06 — List and timer performance

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- No new dependency, no `eas build/update`, no `git push`.
- Look/colors/copy mat badlo (blur hatane wali jagah par flat translucent surface wohi look de).
- End par `npx tsc --noEmit` aur `npx expo lint` pass hon.
- Sirf ek commit: `perf: virtualize lists, isolate timer tick, trim animations`
- Code bayan se alag nikle to wo step ruko aur report mein likho.
- Final report: files changed, kya badla, kaise verify, risks, phone test.

## CONTEXT (audit: PERF-03, 04, 05, 06, 07, 08, BUG-07, BUG-09)
- Leaderboard renders up to 51 rows in a `ScrollView` and runs three infinite shine loops; the current user is appended as a 51st entry so the shown rank can be wrong.
- Notes list is non-virtualized; the title persists to AsyncStorage on every keystroke (re-serializes the whole queue).
- Friends cards each have a `BlurView`.
- Activity heatmap auto-scrolls to the end on every data change.
- `timer-context.tsx` exposes a 1 Hz `tick` in the context value, so every consumer re-renders each second.
- Splash overlay always holds 650 ms + 450 ms exit.

## GOAL
60 fps scrolling on the long screens, correct leaderboard rank, no needless per-second re-renders, no keystroke storage writes.

## SCOPE
- `src/app/leaderboard.tsx`, `src/lib/db/leaderboard.ts`
- `src/app/notes.tsx`, `src/lib/notes-queue.ts` (write batching only)
- `src/app/friends.tsx`
- `src/components/dashboard/activity-heatmap.tsx`, `src/components/dashboard/focus-timer-widget.tsx`
- `src/context/timer-context.tsx`, `src/app/timer.tsx`
- `src/components/splash-overlay.tsx`, `src/app/_layout.tsx` (splash hand-off only)

## STEPS
1. **Leaderboard list:** replace `ScrollView + entries.map` with `FlatList` (`keyExtractor`, memoized row component, `initialNumToRender` ~10, `windowSize` ~7, `removeClippedSubviews` on Android). Keep podium + header as `ListHeaderComponent`.
2. **Leaderboard rank:** stop appending the user as a 51st row. If the user is outside the top N, fetch their rank separately (a count query of users with higher weekly XP + 1) and show a pinned "You" row; list index must not define rank. If the weekly-XP data model makes this impossible client-side, say so and keep the pinned row with the best available value.
3. **Leaderboard animations:** one shared shine value (or stop after one cycle) and stop it when the screen is unfocused.
4. **Notes title:** keep local input state immediate, debounce `persist` for the title (500 ms) like the body, and flush on blur/unmount/navigation. In `notes-queue.ts` coalesce `persistOps` writes (one AsyncStorage write per ~300 ms burst).
5. **Notes list:** render the grouped list via `SectionList`/`FlatList` with headers; keep the editor behavior untouched.
6. **Timer tick:** keep the 1 Hz value out of the shared context value. Provide the elapsed seconds through a separate subscribe-style hook (e.g. `useTimerElapsed()` using `useSyncExternalStore`) used only by components that actually show the clock (timer screen clock, dashboard timer widget display). Other consumers read stable state (phase, target, course) that changes only on start/pause/stop. Do not create duplicate intervals.
7. **Friends:** replace per-card `BlurView` with a flat translucent surface that matches the current look; use `expo-image` with `cachePolicy="memory-disk"` for avatars; memoize rows. Also refetch on screen focus (use the focus hook from Batch 05 if it exists, else `useFocusEffect`, debounced 300 ms).
8. **Heatmap:** scroll to "today" only on first layout and when the user changes; later data refreshes must not reset the scroll position.
9. **Splash:** hold for the lesser of 650 ms or until fonts + first session resolution are done; on warm start (cached auth user present and fonts loaded) skip the extra hold. Keep the exit animation and the native-splash hand-off exactly as is (no white flash).

## DO NOT
- Change data contracts, theme, or copy.
- Remove `detachInactiveScreens={false}`.

## ACCEPTANCE
- Leaderboard with 50+ rows scrolls smoothly; "You" shows the true server-derived rank and there is no duplicate/51st row.
- Typing a 100-character note title writes to storage at most 2-3 times.
- React DevTools/profiler (or log counters) shows only the clock re-rendering each second during a session.
- Heatmap keeps its scroll position after a refresh.
- Cold start still hides the native splash with no flash.

## USER TEST (Zain karega)
1. Leaderboard: scroll karo; apna rank dekho (kam az kam 2 accounts se compare).
2. Notes: lamba title tez type karo -> koi atkan nahi; note band karke dobara kholo -> title save hai.
3. Timer chalao aur dusre tabs mein scroll karo -> smooth rahe.
4. Dashboard heatmap peeche scroll karo, kisi aur screen par ja kar wapas aao -> position na bhule.
5. App kill karke kholo: splash se app tak koi safed/kala flash nahi.
