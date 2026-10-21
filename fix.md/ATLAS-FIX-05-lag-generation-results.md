# FIX-05 — App lags when a roadmap is generated or a quiz report appears

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- No new dependency, no `eas build/update`, no `git push`.
- Look/colors/copy mat badlo.
- End par `npx tsc --noEmit` aur `npx expo lint` pass hon.
- Is batch mein har sub-step (05a, 05b, ...) ka alag commit allowed hai; message `perf: <sub-step>`.
- **Sirf wahi fix karo jiski wajah code mein evidence se saabit ho.** Andaze par fix mat karo.
- Final report: files changed, kya badla, kaise verify, risks, phone test.

## CONTEXT
User report: jab roadmap generate hota hai ya quiz ka result/report aata hai to poori app lag karti hai. Yeh audit mein as a separate item nahi tha; hypotheses (har ek ko code se verify ya reject karo):

- **H1 (sabse shaq):** `src/lib/events.ts` ka event bus (`PROFILE_CHANGED`, `COURSES_CHANGED`, `FOCUS_CHANGED`, `ROADMAPS_CHANGED`). All ~10 tab scenes stay mounted (`detachInactiveScreens={false}`, preload waves), so one event can make every mounted screen refetch from Supabase and `setState` at the same moment (dashboard, courses, roadmap, leaderboard, friends...). Roadmap generation saves per phase, so it can emit several times.
- **H2:** `roadmap.tsx` (1,300+ lines) re-renders its whole tree (map graph, nodes, level cards) on every phase/state update; graph building in `roadmap-graph.ts` may run each render.
- **H3:** Quiz results screen builds and renders everything at once (score ring animation, per-question breakdown with markdown/code rendering, confetti) while `saveQuizSession` and its events run at the same time.
- **H4:** Preload waves (`_layout.tsx`, timers 2.0-5.0 s) mount heavy screens (quiz, roadmap, assistant) in the background; if the user generates right after login, mounts collide.
- **H5:** The 1 Hz timer tick re-renders consumers (only matters if a session is running).
- **H6:** Several `Animated.loop`s keep running on unfocused screens.

## GOAL
Generating a roadmap and opening quiz results must not drop frames on a mid-range Android. Background work must not hit unfocused screens.

## SCOPE
- `src/lib/events.ts`, `src/hooks/use-focused-event.ts` (NEW)
- All files that call `subscribe(...)/emit(...)` for those events (find with grep)
- `src/app/roadmap.tsx`, `src/components/roadmap/*`, `src/lib/roadmap-graph.ts`
- `src/app/quiz.tsx`, `src/components/quiz/quiz-results.tsx`, `src/lib/quiz-store.ts`
- `src/app/_layout.tsx` (preload waves only)
- `audit/07-lag-rca.md` (NEW, your findings)

## STEPS
### 05a. Investigation (read-only, write `audit/07-lag-rca.md`)
1. List every `emit` and every subscriber of the four events: file, what the handler does (fetch? setState?).
2. Count: for ONE roadmap generation (N phases) and ONE quiz finish, how many emits happen and how many handlers fire, how many network calls result.
3. For each hypothesis H1-H6 write: confirmed / rejected / unverifiable, with file:line evidence. Rank real causes by likely impact.
4. Commit this file alone: `docs: lag root-cause analysis`.

### 05b. Make events screen-aware (if H1 confirmed)
5. Create `useFocusedEvent(event, handler)`: if the screen is focused, run the handler; if not, set a dirty flag and run it once when the screen gains focus. Use the navigation focus APIs expo-router exposes (`useFocusEffect` / `useIsFocused`); mount state is NOT focus state because tabs are siblings.
6. Coalesce bursts in `events.ts`: multiple emits of the same event within ~250 ms trigger subscribers once. Handlers run via `InteractionManager.runAfterInteractions`.
7. Replace direct subscribers with the hook where they only refresh data. Keep behavior identical for the focused screen.

### 05c. Roadmap generation (if H1/H2 confirmed)
8. During generation emit `ROADMAPS_CHANGED`/`COURSES_CHANGED` once when the skeleton is saved and once when generation finishes, not after every phase save.
9. Memoize graph building (`useMemo` keyed on the roadmap nodes/connections), wrap map node components in `React.memo`, and hoist inline style objects/handlers that change every render. Do not change visuals.
10. Phase progress text updates: at most once per phase (not per token/tick).

### 05d. Quiz results (if H3 confirmed)
11. Render the score summary first. Render the per-question breakdown lazily: `FlatList` (or first 5 items, rest on "show more"); markdown/code blocks only for expanded items.
12. Start the remote save and event emission after the first results paint: `InteractionManager.runAfterInteractions` (or `requestAnimationFrame` x2). Score-ring/confetti animations must use the native driver.

### 05e. Preload and loops (if H4/H6 confirmed)
13. Remove quiz, roadmap, assistant and timer from the preload waves (they are stateful/heavy). Keep the cheap ones, run each inside `runAfterInteractions`, one per idle callback, and skip preload entirely while a heavy task is running (add a tiny `isHeavyTaskRunning` flag set by roadmap generation and quiz generation).
14. Stop decorative `Animated.loop`s when their screen is not focused (use the same focus hook).

### 05f. Timer tick (if H5 confirmed; Batch 06 also touches this — do it here only if it directly affects generation)
15. If the tick makes unrelated screens re-render during a session, isolate it (see Batch 06 step 6). Otherwise leave it for Batch 06 and say so.

## DO NOT
- Remove `detachInactiveScreens={false}` or change navigation structure.
- Touch Supabase queries/RPC contracts.

## ACCEPTANCE
- After 05b: one roadmap generation causes at most one refetch per focused screen, zero refetches on unfocused screens (show the counts in the report).
- Quiz results appear in one frame without a stall; the rest fills in after.
- No console errors; tsc + lint clean.

## USER TEST (Zain karega)
1. Roadmap generate karo (same goal, jaisa pehle lag karta tha). Generation ke dauran drawer kholo/band karo aur dusre tab par jao: lag kam hona chahiye.
2. Quiz karo aur result screen par aao: result foran dikhna chahiye, scroll smooth.
3. Phone par Settings > Developer options > "Profile HWUI rendering" / "Show GPU view updates" (agar available) on karke dekho kitni screens flash hoti hain.
4. Naya login karke 5 second ke andar roadmap generate karo (preload collision test).
5. Pehle aur baad ki screen recording mujhe bhejo agar abhi bhi lag lage.
