# 07 - Lag while generating a roadmap or showing quiz results

Scope: static code analysis only (no device profiling in this batch). Every
claim below points at the code path that causes it.

## 1. Event bus inventory

`src/lib/events.ts:3-24` - one global `Map<string, Set<Listener>>`; `emit`
calls every listener synchronously.

### Emitters

| Event | Emitters |
|---|---|
| `PROFILE_CHANGED` | `db/quiz-sessions.ts:43` (session RPC success), `:66` (fallback XP), `db/roadmaps.ts:572` (level XP), `db/sessions.ts:55` (focus session), `app/settings.tsx:141,170,218` (profile/avatar writes) |
| `COURSES_CHANGED` | `db/courses.ts:276,334,395,428,517,559,592` (course/topic create, update, delete, focus total, topic sync, recompute) |
| `FOCUS_CHANGED` | `context/timer-context.tsx:294,326,342` (start/pause/resume flush) |
| `ROADMAPS_CHANGED` | `db/roadmaps.ts:361` (skeleton saved), `:456` (every phase append), `:528` (node statuses), `:601` (delete), `:656` (course sync), `db/courses.ts:333` (course delete) |

### Subscribers (all mounted tab scenes stay alive)

| Subscriber | Events | Handler work |
|---|---|---|
| `useDashboard` - dashboard + assistant (`app/index.tsx:36`, `app/assistant.tsx:46`) | profile, courses, focus | `reload()` = `resolveSession` + `fetchProfile` + `fetchHeatmap(365)` + `fetchFocusCourse` = **3 queries per instance**, then widget sync + streak reminder (`hooks/use-dashboard.ts:86-111,128-138`) |
| `useCourses` - courses, notes, quiz, roadmap, settings, timer, timer context, roadmap builder (7-8 instances) | courses, focus | `fetchCourses` = **1 query each** (`hooks/use-courses.ts:31-58`) |
| `useProfile` - `ScreenShell` on every mounted app screen (11 screens) | profile | cached profile immediately; `fetchProfile` only when cache older than 5 min (`hooks/use-profile.ts:23-53`) |
| `friends.tsx:331` | profile | `fetchSquad` = **2 queries** (friendships + profiles; `db/squad.ts:109,127`) |
| `account-sheet.tsx:126` | profile | only while the sheet is open; `fetchProfile` |
| `courses.tsx:376-384` | roadmaps, focus | `fetchRoadmapProgressByCourse` + `fetchCourses` = **2 queries** |
| `roadmap.tsx:268-295` | roadmaps | `fetchCourses` + `fetchLatestRoadmap` = **2-3 queries** (skipped while `busyRef` is true, i.e. during its own generation) |

## 2. Burst counts

### One roadmap generation, N phases

Emits:

- `saveRoadmapSkeleton`: 1 x `ROADMAPS_CHANGED` (`roadmaps.ts:361`)
- `appendRoadmapPhase` per phase: N x `ROADMAPS_CHANGED` (`roadmaps.ts:456`, called from `app/roadmap.tsx:369`)
- final `syncRoadmapProgressToCourse`: 1 x `ROADMAPS_CHANGED` (`roadmaps.ts:656`)
- => **N + 2 roadmap emits**
- `COURSES_CHANGED`: 0-2 (new course created by `linkCourse` -> `courses.ts:428`; topic sync -> `courses.ts:517`)

Handlers / network:

- roadmap's own listener is skipped (`busyRef`), so each roadmap emit still
  runs the always-mounted courses screen handler: **2 queries x (N + 2)**.
- each courses emit runs 7 mounted `useCourses` instances (`fetchCourses`) plus
  2 dashboards (3 queries each): **13 queries per emit**.
- 4 phases + both course emits = `2 x 6 + 2 x 13` = **38 queries**, almost all
  for screens the user is not looking at.
- per roadmap emit the roadmap screen also re-renders the full map
  (`app/roadmap.tsx:389` calls `setGraph` every phase).

### One quiz finish

- `saveQuizSession` emits `PROFILE_CHANGED` exactly once (`quiz-sessions.ts:43`
  or `:66`).
- handlers: 2 dashboards (**6 queries**), friends (**2 queries**), up to 11
  `useProfile` instances (network only if the 5-minute cache is stale), account
  sheet only if open => **8-19 queries and 3-13 `setState` calls** while the
  results screen is rendering.
- `quiz.tsx:358-415` mounts the whole report at once; `quiz-results.tsx:129-226`
  maps every attempt (default quiz length 10, `components/quiz/quiz-setup.tsx:196`)
  with `RichText`/`CodeBlock` in the same commit.

## 3. Hypotheses

| # | Verdict | Evidence |
|---|---|---|
| H1 - event bus makes every mounted screen refetch | **Confirmed, highest impact** | Counts above; `_layout.tsx:165` keeps every tab attached; subscribers are global, not focus-scoped. One roadmap generation = up to 38 queries; one quiz finish = 8-19 queries. |
| H2 - roadmap re-renders its whole tree per phase | **Confirmed, second** | `app/roadmap.tsx:389` sets a new graph object per phase; `RoadmapMap` recomputes layout/trail and maps every node (`components/roadmap/roadmap-map.tsx:178-198,378-520`) on each new graph. Works is partly memoized already (layout/trail are `useMemo`), but every phase still re-renders the full map and cards. |
| H3 - quiz results render everything at once while saving | **Confirmed (partial)** | All 10 review cards + summary render in one commit (`quiz-results.tsx:129-226`); no score-ring animation exists (static SVG, `:48-72`) and quiz has no confetti. The real issue is the all-at-once report plus the profile-event burst starting immediately (`quiz-store.ts` save after `phase: "done"`). |
| H4 - preload waves collide with generation | **Confirmed schedule, impact likely** | `_layout.tsx:63-69,118-127` mounts leaderboard at 2.0 s, notes/courses 2.75 s, quiz/friends 3.5 s, roadmap 4.25 s, timer/assistant/settings 5.0 s. Each mount runs its own fetch hooks. A generate started in the first 5 s overlaps those commits/fetches. |
| H5 - 1 Hz timer tick | **Confirmed but unrelated to this report** | `timer-context.tsx:247-250,417-440` re-renders consumers every second while running; only timer screen + dashboard focus widget consume it (`app/timer.tsx:77`, `components/dashboard/focus-timer-widget.tsx:219`). Defer to FIX-06; it cannot explain generation/result lag unless a session is running. |
| H6 - decorative loops run off-screen | **Confirmed, low impact** | `roadmap-map.tsx:130-149` ActiveHalo loops on the roadmap tab; `rank-badge.tsx:151-171` Conqueror pulse; skeleton loops in `today-focus.tsx:32-64` / `player-stats.tsx:25-59` stop after loading; typing dots only while a reply is pending (`chat-thread.tsx:51-110`). Native driver, no JS-thread sampling, but they keep the UI thread busy on hidden tabs. |

## 4. Fix order

1. **05b** screen-aware + coalesced events - removes the bulk of hidden-screen
   refetches and state churn (H1).
2. **05c** one roadmap emit per generation boundary (skeleton + final) - removes
   the per-phase cross-screen burst (H1/H2).
3. **05d** quiz report: summary first, lazy per-question review, defer the
   remote save until after first paint (H3).
4. **05e** trim heavy preloads, pause the remaining off-screen loops (H4/H6).
5. H5 is left for FIX-06.
