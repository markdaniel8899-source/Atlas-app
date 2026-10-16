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
- Next sensible steps: side-by-side visual diff vs mobile web (`argent-screenshot-diff`), device QA in Expo Go (kill/reopen to avoid stale bundles), then optional `eas build` for native changes.

## Workflow Preferences (user)
- User communicates in **Roman Urdu** — reply concisely in Roman Urdu.
- Do not ask for confirmation mid-task; finish the task, then report.
- After completing a task: run `npx tsc --noEmit` + `npx expo lint`, then `git add -A`, commit (short imperative message), `git push origin main`.
- OTA publish only when appropriate: `$env:CI=1; eas update --branch production --platform android --environment production --message "..."`. NEVER publish unfinished/black-screen builds to production.
- Native changes (icons/splash/app.json plugins) require `eas build` — mention this to the user when relevant.
