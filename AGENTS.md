# ATLAS Mobile App — Agent Working Notes

## Read Me First (New Session)
- **90 agent skills were installed globally in the previous session** at `C:\Users\HM.ZAIN\.agents\skills\` (also `~/.claude/skills`).
- They appear in the session's available-skills list automatically. **Before starting any task, LOAD the matching skill(s) with the skill tool and follow them.**
- If a skill is missing from the list, read it directly: `C:\Users\HM.ZAIN\.agents\skills\<skill-name>\SKILL.md`.
- Load multiple skills when relevant (e.g. design + expo + testing).

### Which skill for what (this project)
| Task | Skills to load |
|---|---|
| Any codebase/architecture question | `graphify` (if graphify-out/ exists), `react-native-architecture` |
| Copy web dashboard → native UI | `image-to-code`, `explain-interface`, `agent-browser`, `playwright-cli`, `web-design-guidelines` |
| Exact colors / palette / contrast | `better-colors`, `design-taste-frontend`, `apple-design` |
| UI polish / spacing / typography | `impeccable`, `better-ui`, `better-layout`, `better-typography`, `better-interface`, `emil-design-eng`, `high-end-visual-design`, `minimalist-ui` |
| Building screens / components | `expo-overview`, `expo-router`, `expo-native-ui`, `expo-design-system`, `expo-ui`, `building`-related expo skills |
| Animations | `expo-animation`, `animate-expo`, `improve-animations`, `review-animations`, `animation-vocabulary` |
| Data / backend | `supabase`, `supabase-postgres-best-practices`, `expo-data-fetching` |
| AI assistant feature | `ai-sdk` |
| Performance | `argent-react-native-optimization`, `performance`, `vercel-react-native-skills` |
| Visual compare (web vs app screenshots) | `argent-screenshot-diff`, `image-to-code` |
| Testing / QA | `limrun-maestro-testing`, `break`, `variant` |
| Monitoring / production | `sentry-react-native-sdk`, `eas-update`, `eas-deployment`, `eas-app-stores` |
| React Native general | `react-native-best-practices`, `mobile-native`, `design-mobile-apps` |

## Project Context
- Expo SDK 57 (React Native 0.86) app at `C:\Scrap\App`. Entry: `src/app` (expo-router).
- App identity: `app.json` → name ATLAS, slug `atlas-mobile`, EAS projectId `e3da5166-3d70-4bfa-ae8f-0a703790c725`.
- Backend: Supabase. Env in `.env` (kept after reset; gitignored).
- `package.json` keeps ALL previous deps installed (supabase-js, reanimated, expo-*, nativewind, etc.) even though configs were stripped — node_modules is intact, no reinstall needed.
- The project was once reset to a minimal black-screen skeleton (commit `64a5f5b`) and has since been fully rebuilt into the complete app. Older code also lives in history (`git show e67c1d2:src/...`). Repo: `https://github.com/markdaniel8899-source/Atlas-app`.

## Current State (as of 2026-10-16)
- **Full web dashboard parity is COMPLETE.** The web app (`C:\Scrap\learning tracker`, read-only reference) was ported section by section; every page is shipped to main:
  - Dashboard home, auth (`056e5cd` scope), Timer, Leaderboard, Friends, Settings → `056e5cd`
  - Roadmap → `62ee1fe` · Courses → `d074046` · Notes → `7e63389` · Quiz → `62e216c` · Assistant → `3e6bb0e`
  - CalendarPage was intentionally skipped (not reachable via the web nav either).
- Port rules in use: plain RN StyleSheet (no NativeWind), legacy Animated only, no hover states, glass = rgba panels, RN-Image can't render SVG (use expo-image/png), Hermes-safe regexes (no lookbehind), no raw `'` in JSX text (use `’`), never `<View>` inside `<Svg>`.
- Quiz backend sync uses the `record_quiz_session` RPC (fallback `record_activity`) — server-side XP/streak/achievement logic stays authoritative.
- **Post-parity polish batch (2026-10-16):**
  - Roadmap: marching-dash FlowLight + particles/washes removed (perf on device), bigger level nodes, translucent map card; builder redesigned (segmented level/commitment, template grid).
  - Assistant: ChatGPT-style layout (`src/app/assistant.tsx` — no ScreenShell), thread persists 24h via `src/lib/assistant-store.ts` (AsyncStorage, `atlas.assistant.thread.v1`, owner-scoped with `claimAssistantChat`, in-flight request survives navigation).
  - Quiz: session lives in `src/lib/quiz-store.ts` (module-level) so generation/grading continue across tab switches; `quiz.tsx` is a subscriber.
  - Notes: all writes go through the persistent offline queue `src/lib/notes-queue.ts` (latest-wins per note, temp `local-…` ids for offline-created notes + id-swap events, retry on edit / 15s interval / app foreground); `db/notes.ts` `updateNote`/`deleteNote` now return booleans, `insertNote` exported. "Offline · N to sync" indicator in the editor header.
  - Dashboard quick-note widget (`src/components/dashboard/quick-note.tsx`) saves into Notes/General (offline-safe). In-app widget only — a home-screen OS widget needs a dev build, not Expo Go. **Removed again on user request** — Notes is the single capture surface.
  - Friends cards use expo-blur (`dimezisBlurView` + tint overlay).
- **Polish batch 2 (2026-10-16, `8faf284..c9ad881`):**
  - Today's focus card: buttons were dead (no `onPress`) — now push `/timer?courseId`, `/roadmap?courseId`, `/courses`; Start session = primary (white), Roadmap = lilac-tinted outline.
  - Roadmap: map card got a `BlurView` backdrop (`dimezisBlurView`, intensity 28); level nodes up again (`LEVEL_D 118`, `LEVEL_BOSS_D 158`, `TRAIL_ROW_H 184`); level cards wider (196) with bigger type; empty-state compass "black box" replaced by soft circular glow (Android elevation shadow was the black square); builder header icon made circular.
  - RoadmapDetail: `topInset` prop from the screen — safe-area insets read as 0 inside a `Modal` on Android, which pushed the heading off-screen. `safeTop = Math.max(insets.top, topInset, 12)`.
  - `AppHeader`: `HEADER_HEIGHT = 76` exported; all content paddings must use it (`insets.top + HEADER_HEIGHT + …`) — previously hardcoded `+ 64`.
  - New `src/components/account-sheet.tsx`: avatar tap opens a bottom sheet with profile (name, @username, Level/XP/streak chips), 2-col quick links to every page, and Log out (`signOut()` → `/login`). Wired automatically by `AppHeader` unless `onAccountPress` is passed.
- **Polish batch 3 (2026-10-16, `362b381..27f05e6`):**
  - New info pages ported from the web site (`C:\Scrap\learning tracker\src\pages\site\*` + landing Footer): `/about`, `/help` (new FAQ), `/privacy`, `/terms`, `/contact`. Shared blocks in `src/components/info-blocks.tsx` (InfoSection/InfoSubheading/InfoParagraph/InfoBullets). Contact form inserts into `contact_messages` (same shape as web: subject = `Message from <name>`).
  - Dashboard + `ScreenShell` footer links now navigate to those pages; account sheet shows only info links (About Us, Help & Support, Privacy Policy, Terms & Conditions, Contact Us) + Log out; Log out REMOVED from `NavigationDrawer` on user request.
  - Roadmap level nodes changed from circles to rounded squares (`borderRadius ≈ size * 0.28`; ActiveHalo matches).
- Next sensible steps: side-by-side visual diff vs mobile web (`argent-screenshot-diff`), device QA in Expo Go (kill/reopen to avoid stale bundles), then optional `eas build` for native changes.

## Workflow Preferences (user)
- User communicates in **Roman Urdu** — reply concisely in Roman Urdu.
- Do not ask for confirmation mid-task; finish the task, then report.
- After completing a task: run `npx tsc --noEmit` + `npx expo lint`, then `git add -A`, commit (short imperative message), `git push origin main`.
- OTA publish only when appropriate: `$env:CI=1; eas update --branch production --platform android --environment production --message "..."`. NEVER publish unfinished/black-screen builds to production.
- Native changes (icons/splash/app.json plugins) require `eas build` — mention this to the user when relevant.
