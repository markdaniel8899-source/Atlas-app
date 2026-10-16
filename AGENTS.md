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
- **Polish batch 4 (2026-10-16, `95a890d`):**
  - Roadmap level nodes reverted to CIRCLES (`borderRadius: size / 2`; ActiveHalo round again) — user preferred the old shape.
  - Level cards beside nodes enlarged: `labelWrap` 224 wide, `labelCard` padding 14 + radius 16, title 13.5/19, chips 11.5, boss badge 10.
  - Builder header compass icon back to rounded square (`headerIcon` radius 999 → 14). Empty-state compass regained its rounded-square badge (76×76, radius 24, lilac25 border, lilac10 bg, NO elevation — Android elevation = black box) inside the soft circular glow.
  - Info pages: `InfoSection` is now a glass card (radius 20, w06 border, `overflow hidden`) with a lilac accent bar + 16px title; subheads 13.5, body 14.5/23, consistent 10–16 margins. Each section card has a `BlurView` backdrop.
  - **expo-blur new API everywhere**: `experimentalBlurMethod` is gone. BlurViews now use `blurMethod="dimezisBlurViewSdk31Plus"` + `blurTarget={useBlurTargetRef() ?? undefined}`. `ScreenShell` wraps `MeshBackground` in a `BlurTargetView` (absoluteFill, `pointerEvents="none"`) and shares its ref through `BlurTargetRefContext` (`src/components/blur-target.tsx`). Any new BlurView inside a ScreenShell page MUST pass that ref or Android falls back to no-blur with a warning.
  - iOS-only BlurViews (AppHeader, NavigationDrawer, AccountSheet) need no changes — they are platform-gated and don't set a blur method.
- **Polish batch 5 (2026-10-16, `4bf26b6..6b94235`):**
  - Dead code removed (scan-verified, no orphan files remain): roadmap-graph's old phase-column layout cluster (`layoutGraph`, `flowEdgeKeys`, `edgePath`, `graphFromRoadmap`, `insertBossLevels`, `nodesOfPhase`, `LayoutBox`/`MapLayout` + `NODE_*`/`PHASE_*`/`MAP_PAD_*`), plus unused `getAiHealth`/`AiHealth`, `isDicebearUrl`, `fetchMyWeeklyRank`, `getRankProgression`, `feedbackTone`, `getUser`.
  - Perf: all 5 progress bars (today-focus, player-stats, focus-timer-widget, timer, friends) now animate with `scaleX` transforms on the **native driver** (were JS-thread width animations). Detail: `.fill`/`.progressFill` styles carry `width: "100%"` + `transformOrigin: "left"`; scaleX interpolates `[0,1]`/`[0,100]` → `0..percent/100`.
  - `_layout.tsx`: Stack transitions on — `animation: "slide_from_right"` (240ms) globally, `login` screen fades (300ms).
  - Auth rebuilt in `src/app/login.tsx` — single screen, 5 modes: login/signup/verify/forgot/reset. Animated orbs background (`src/components/auth/orbs.tsx`, native-driver loops), glass card (`Card glass` prop reads `BlurTargetRefContext`; the screen wraps MeshBackground in `BlurTargetView` and provides the ref), animated mode transitions (fade + rise via `formAnim`), Forgot password → reset code → new password, standalone OTP card (`src/components/auth/otp-input.tsx`: 6 boxes, one hidden TextInput, paste + `one-time-code` autofill, 60s resend cooldown, auto-submit on 6th digit).
  - `src/lib/auth.ts` additions: `verifyEmailOtp(email, token, "signup" | "recovery")`, `resendConfirmationOtp`, `requestPasswordReset`, `updatePassword`; `signIn` flags `unverifiedEmail`; readableError covers OTP expired/rate-limit/old-password cases.
  - **Supabase requirements for the OTP flow (user enables these):** Authentication → enable **Confirm email**; add `{{ .Token }}` to the **Confirm signup** and **Reset password** email templates (default templates only contain links, so the app's 6-digit code needs it).
- **Polish batch 6 (2026-10-16):**
  - Login background: `AuthOrbs` replaced by `AuthMesh` (`src/components/auth/auth-mesh.tsx`) — 4 large radial-blob mesh gradients drifting on native-driver loops under the glass card; old `orbs.tsx` deleted.
  - Login fields: floating-label inputs (resting label sits as the placeholder, floats up on focus/filled, 180ms) + animated lilac border glow and colored shadow on focus; Name field got a User icon; labels on all fields.
  - Login: log-in/sign-up text tabs replaced by `ModeToggle` — a capsule segmented control whose pill slides 450ms between segments; the old bottom "New here?" link is gone.
  - Legal line under the form links to `/privacy` & `/terms`.
  - Password: `secureTextEntry` dots + eye toggle reveal (Android/iOS briefly flash the last typed character — OS behavior, can’t remove without a native dev build).
  - **Driver rule (crash fix):** never mix js-driver + native-driver animations on the same animated component — RN moves the whole style node to native and then throws on the JS animation. Login animations are strictly native-driver (opacity/transform only); the field focus glow is an opacity-faded overlay ring (`fieldGlow`), label color is a two-layer crossfade.
- Next sensible steps: side-by-side visual diff vs mobile web (`argent-screenshot-diff`), device QA in Expo Go (kill/reopen to avoid stale bundles), then optional `eas build` for native changes.

## Workflow Preferences (user)
- User communicates in **Roman Urdu** — reply concisely in Roman Urdu.
- Do not ask for confirmation mid-task; finish the task, then report.
- After completing a task: run `npx tsc --noEmit` + `npx expo lint`, then `git add -A`, commit (short imperative message), `git push origin main`.
- OTA publish only when appropriate: `$env:CI=1; eas update --branch production --platform android --environment production --message "..."`. NEVER publish unfinished/black-screen builds to production.
- Native changes (icons/splash/app.json plugins) require `eas build` — mention this to the user when relevant.
