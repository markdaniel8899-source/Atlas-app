# ATLAS Web — Technical Analysis for Mobile Port

> Read-only audit for planning a React Native (Expo) mobile app. Generated from the web codebase. All secrets are listed by **name only** — no values.

---

## 1. Stack summary

| Layer | Value |
|---|---|
| Build tool | **Vite 8.3.2** (`vite.config.ts`, Rolldown-based) |
| Framework | **React 19.3.0** (SPA, no SSR) |
| Language | **TypeScript 7.0.2** (strict) |
| Node | **v24.15.0** in dev env; no `.nvmrc`, no `engines` field |
| Package manager | **npm** (`package-lock.json`, lockfileVersion 3). No bun/yarn/pnpm lock |
| Router | `react-router-dom` 7.18.4 (client-side) |
| Styling | **Tailwind CSS v4.3.3** (CSS-first via `@theme` in `src/index.css`; no tailwind.config file) + `@tailwindcss/vite` |
| DB/Auth | **Supabase** (PostgreSQL + Auth), `@supabase/supabase-js` 2.117.2 |
| AI backend | **FastAPI** (Python, `backend/`) on Oracle Cloud, exposed via Cloudflare Tunnel |

### `package.json` scripts

```json
"dev": "vite",
"build": "tsc --noEmit && vite build",
"preview": "vite preview",
"typecheck": "tsc --noEmit"
```

### Dependencies (grouped)

| Group | Packages (version) |
|---|---|
| **UI / React** | `react` ^19.3.0, `react-dom` ^19.3.0 |
| **Routing** | `react-router-dom` ^7.18.4 |
| **Styling** | `tailwindcss` ^4.3.3 (dev), `@tailwindcss/vite` ^4.3.3 (dev), `autoprefixer` ^10.6.1 (dev), `postcss` ^8.5.28 (dev) |
| **Animation** | `motion` ^13.5.0 (framer-motion), `gsap` ^3.15.0, `lenis` ^1.3.26 (smooth scroll) |
| **3D/WebGL** | `three` ^0.186.1, `@react-three/fiber` ^9.8.1, `@react-three/drei` ^10.7.9, `@react-three/postprocessing` ^3.1.3, `ogl` ^1.0.11, `@types/three` ^0.186.0 (dev) |
| **Auth/backend SDK** | `@supabase/supabase-js` ^2.117.2 |
| **Editor** | `@monaco-editor/react` ^4.7.0 |
| **Icons** | `lucide-react` ^1.50.0, `lucide` ^1.49.0 |
| **Fonts** | `geist` ^1.7.2, `@fontsource-variable/syne` ^5.3.0 |
| **Math rendering** | `katex` ^0.19.0 |
| **Validation** | `zod` ^4.6.5 |
| **Sanitization** | `dompurify` ^3.4.16 |
| **Utilities** | `@radix-ui/themes` ^3.3.0 (shadcn primitives) |
| **Dev tooling** | `typescript` ^7.0.2, `vite` ^8.3.2, `@vitejs/plugin-react` ^6.1.1, `@types/react` ^19.3.0, `@types/react-dom` ^19.3.0, `@types/node` ^26.6.4, `eslint` ^9.0.0, `eslint-config-expo` ~57.0.2 |

**No data-fetching library** (no react-query/axios/SWR) — plain `fetch` + Supabase JS. **No state library** (no zustand/redux/jotai) — React context + local state + window events.

---

## 2. Folder structure

### `src/` tree (depth 3)

```
src/
├── App.tsx              # Router: all routes, lazy loading, DoubleCurtain mount
├── main.tsx             # Entry; HTTP→HTTPS redirect, font loading
├── index.css            # Tailwind v4 @theme tokens, glass utilities, keyframes
├── vite-env.d.ts
├── assets/              # dither-problem.jpg (357 KB landing image)
├── components/
│   ├── ui/              # Button, Card, CodeEditor, ConfirmDialog, EmptyState, RichTextEditor, SelectMenu, Toaster
│   ├── dashboard/       # PlayerStats, FocusTimerWidget, TodayFocus, ActivityHeatmap
│   ├── landing/         # Hero, CtaSection, ProblemSection, Footer, …
│   ├── roadmap/         # RoadmapMap, RoadmapDetail, RoadmapBuilder, BossConfetti
│   ├── quiz/            # QuizSetup, QuestionInput, CodeBlock, QuizResults, RichText
│   ├── assistant/       # ChatThread, ChatComposer
│   ├── gamification/    # RankBadge, RankProgressionModal
│   ├── profile/         # AvatarPickerModal
│   ├── courses/         # CourseEditorModal
│   ├── effects/         # WebGL: Ferrofluid, SideRays, DitherVeil, LightPillar, Beams, MoltenMetal, LaserFlow
│   ├── site/            # Navbar, Footer, SecondaryPage
│   ├── admin/           # AdminRoute, ErrorState
│   ├── DoubleCurtain.tsx, PageCurtain.tsx, Preloader.tsx, ProtectedRoute.tsx, RevealText.tsx, CustomCursor.tsx, …
├── context/             # TimerContext.tsx (the ONLY context)
├── hooks/               # useCourses, useDashboard, useLenis
├── layouts/             # DashboardLayout.tsx (the /app shell, keep-alive tabs)
├── lib/
│   ├── db/              # Supabase data access: profile, courses, notes, sessions, focus, roadmaps, quizSessions, achievements, leaderboard, squad, activity, types, events
│   ├── ai.ts            # FastAPI client (chat/quiz/roadmap)
│   ├── gamificationApi.ts # FastAPI client (achievements/avatar)
│   ├── auth.ts          # Session helpers, localStorage cache
│   ├── supabase.ts      # Client creation
│   ├── timer.ts         # Timer state machine + localStorage
│   ├── roadmapGraph.ts  # Pure graph model (630 lines, no I/O)
│   ├── quiz.ts, assistant.ts, gamification.ts, calendar.ts, subjects.ts, dicebear.ts, notes.ts, motion.ts, toast.ts, blog.ts, admin.ts, mobile.ts, scroll.ts, repaint.ts, webglDebug.ts, monacoSetup.ts
├── pages/
│   ├── LandingPage.tsx, Auth.tsx
│   ├── site/            # AboutPage, ContactPage, BlogPage, BlogPostPage, PrivacyPage, TermsPage
│   ├── dashboard/       # DashboardHome, RoadmapPage, CoursesPage, NotesPage, QuizPage, TimerPage, AiAssistantPage, SettingsPage, CalendarPage, SquadPage, LeaderboardPage
│   └── admin/           # AdminLogin, AdminLayout, Overview, Users, Posts, Messages, Usage, Settings, ui.tsx
└── seo/                 # Seo.tsx, config.json, metadata.ts, site.ts
```

### Path aliases

- `tsconfig.json`: `"@/*": ["./*"]` (root-relative). Also `jsx: react-jsx`, `types: ["vite/client"]`, include `["src", "vite.config.ts"]`.
- `components.json` (shadcn): `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks` — **note: `src/lib/utils.ts` (the `cn` helper) does not exist**; alias points at a missing file.

### `backend/` tree (top 2 levels)

```
backend/
├── .env                 # Secrets (names listed in §5)
├── requirements.txt     # 13 packages
├── QUIZ_AI.md           # Quiz design doc
├── app/
│   ├── main.py          # App factory, CORS, scheduler, /health, /api/blog/generate
│   ├── config.py        # Settings dataclass (env names)
│   ├── deps.py          # Supabase JWT verification
│   ├── ai_service.py    # Provider routing (Groq/Gemini/Zen), JSON repair
│   ├── prompts.py       # Prompt builders
│   ├── schemas.py       # Pydantic request/response models
│   ├── quiz_service.py  # Quiz generation orchestration
│   ├── roadmap_graph.py # Roadmap normalization/validation
│   ├── course_context.py# Course bundle fetch via httpx
│   ├── cache.py         # TTL+LRU decorator
│   ├── routers/         # chat.py, quizzes.py, roadmaps.py, gamification.py, blog.py
│   ├── services/        # auto_blog.py (50 KB daily article pipeline)
│   └── plugins/         # seo_checker.py
├── scripts/             # migrate_pollinations_to_pixabay.py
└── tests/               # test_auto_blog, test_cache, test_quiz_service, test_seo_checker
```

### `supabase/` tree

```
supabase/
└── migrations/          # 17 SQL files: 0001_core_schema.sql … 0017_admin_contact_inbox.sql
```

### Docs summary

| File | Purpose / key points |
|---|---|
| `README.md` | Project overview: React 19 + Vite + FastAPI + Supabase; live demo at `atlas-frontend-pearl.vercel.app`; env setup instructions; features (AI quiz/chat, gamification, auto-blog, admin) |
| `audit.md` | **176-line prior audit** — 12 critical issues (role escalation via `profiles.role`, unauthenticated AI endpoints, client-trusted XP, infinite loop in `roadmap_graph.py`, Settings/DashboardHome re-render loops, unhandled timer promise rejections), UI missing states, dead code, SEO gaps. Many items already fixed in migrations 0015/0016. |
| `docs/MASTER_RULES.md` | Design directives: cinematic dark theme, no heavy 3D, no generic templates |
| `docs/DASHBOARD.md` | Living reference of dashboard capabilities/data flow (last updated 2026-10-04) |
| `docs/DESIGN_SYSTEM_RULES.md` | Dark mesh-gradient bg `#030305→#0a0a1a→#0b1026`, glassmorphism cards, Geist font, Z-axis sticky-scroll landing |
| `docs/EXECUTION_PLAN.md` | Step-by-step build plan (setup → landing → dashboard) |
| `docs/SETUP_COMMANDS.md` | npm install + agent-skill pairing notes |

---

## 3. Routing and app flow

### Route table (`src/App.tsx`)

| Path | Component | Access | Layout |
|---|---|---|---|
| `/` | `pages/LandingPage.tsx` | Public | — |
| `/login` | `pages/Auth.tsx` | Public | — |
| `/auth` | `Navigate → /login` | Public | — |
| `/about` | `pages/site/AboutPage.tsx` | Public | — |
| `/contact` | `pages/site/ContactPage.tsx` | Public | — |
| `/blog` | `pages/site/BlogPage.tsx` | Public | — |
| `/blog/:slug` | `pages/site/BlogPostPage.tsx` | Public | — |
| `/privacy` | `pages/site/PrivacyPage.tsx` | Public | — |
| `/terms` | `pages/site/TermsPage.tsx` | Public | — |
| `/app` | `layouts/DashboardLayout.tsx` | **Protected** | `ProtectedRoute` → `DashboardLayout` (TimerProvider) |
| `/app/roadmap`, `/courses`, `/notes`, `/quiz`, `/timer`, `/assistant`, `/settings`, `/calendar`, `/squad`, `/leaderboard` | URL-only routes (`element={null}`) — pages kept mounted by `DashboardLayout` | Protected | same |
| `/app/friends` | `Navigate → /app/squad` | Protected | same |
| `/wp-admin/login` | `pages/admin/AdminLogin.tsx` | Public (admin gate) | — |
| `/wp-admin` (+ children: users, posts, messages, usage, settings) | `pages/admin/AdminLayout.tsx` | **Protected** | `AdminRoute` → `AdminLayout` |
| `*` | `Navigate → /` | — | — |

### Route protection

- **`src/components/ProtectedRoute.tsx`**: calls `resolveSession()` (Supabase `getSession`); loading → spinner; no session → `<Navigate to="/login" state.from>`; else `<Outlet>`.
- **`src/components/admin/AdminRoute.tsx`**: `resolveSession()` + `isAdmin()` (checks `profiles.role === 'admin'`); non-admin → `<Navigate to="/wp-admin/login">`. Real enforcement is DB `is_admin()` + RLS — this is a UX gate.

### Landing → login → dashboard flow

1. `/` renders `LandingPage` (Preloader split-open curtain on first load).
2. Hero/CTA use `doubleCurtainNavigate(navigate, "/login")` → two half-screen panels slide in (0.7s), route swaps, panels part (1.05s).
3. `/login` (`Auth.tsx`): email + password → `signIn()` (`supabase.auth.signInWithPassword`).
4. On success: form fades out (0.3s), then `doubleCurtainNavigate(navigate, from ?? "/app", {replace: true})`.
5. `/app` passes `ProtectedRoute` → `DashboardLayout` mounts `TimerProvider`, sidebar, and keep-alive page slots. First visit mounts `DashboardHome`.

### Double curtain transition

| Aspect | Detail |
|---|---|
| Files | `src/components/DoubleCurtain.tsx` (implementation), `src/components/PageCurtain.tsx` (helpers: `curtainNavigate`, `<CurtainLink>`), `src/App.tsx:114–116,324` (mount + reveal signal), `src/lib/repaint.ts` (post-reveal repaint hack) |
| Library | **framer-motion** (`motion` package) — no GSAP here |
| Trigger | **Only** explicit calls to `doubleCurtainNavigate()` / `curtainNavigate()` / `<CurtainLink>` — not automatic on every nav. Fires on: post-login, landing CTAs, navbar/footer links, dashboard sign-out. Dashboard tab switches use a 0.3s opacity fade instead |
| Close | 0.7s, panels slide from `∓101%` to `0%`, ease `[0.22, 1, 0.36, 1]` |
| Open | 1.05s, 0.18s delay, panels part to `∓101%`; seam-light flare (1px gradient) at 1.4s |
| Reveal sync | React Router `onExitComplete` → `notifyDoubleCurtainRouteExitComplete()`; 500ms fallback for same-group navs |

---

## 4. Authentication

### Client setup

- **`src/lib/supabase.ts`**: `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true })`. Exports `isSupabaseConfigured`.

### Flows

| Flow | File | Supabase call | Redirect logic |
|---|---|---|---|
| **Sign up** | `src/pages/Auth.tsx` → `src/lib/auth.ts:79–100` | `supabase.auth.signUp({email, password, options:{data:{name}}})` | No `emailRedirectTo` set (Supabase dashboard controls it). Returns `needsConfirmation` → UI shows "check your email" |
| **Login** | `Auth.tsx` → `auth.ts:102–117` | `supabase.auth.signInWithPassword` | Success → curtain-navigate to `location.state.from ?? "/app"` |
| **Logout (user)** | `DashboardLayout.tsx:340–343` → `auth.ts:119–122` | Clears `atlas.user` cache + `supabase.auth.signOut()` | Curtain-navigate to `/login` |
| **Logout (admin)** | `pages/admin/AdminLayout.tsx:102–105` | same | Plain `navigate("/login")` — no curtain |
| **Forgot/reset password** | **Not implemented.** No `resetPasswordForEmail`/`updateUser` anywhere. AdminLogin has a dead "Forgot Password" link that just goes to `/login` |
| **Email verification** | Supabase built-in confirmation email; return visit consumed by `detectSessionInUrl: true` |
| **Admin login** | `AdminLogin.tsx:63–110` | `signInWithPassword` + manual `profiles.role` query | `role === 'admin'` → `/wp-admin`; else toast + `/app` |

### Session handling

- **No AuthContext.** Session lives in supabase-js internal localStorage. App-level cache: localStorage key **`"atlas.user"`** = `{id, email, name}` (`src/lib/auth.ts:19`).
- `resolveSession()` (async, `auth.ts:125–142`): `getSession()` → rewrites/clears `atlas.user`.
- `getUser()` (sync, `auth.ts:22–32`): reads `atlas.user` for render-time use. **Caution (audit.md):** returns a fresh object each call → causes re-render loops when used as a `useEffect` dependency.
- Cross-component profile updates via window event `PROFILE_CHANGED_EVENT` (`src/lib/db/profile.ts`).

### Frontend env var **names**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AI_API_URL` (also `VITE_API_URL` referenced as fallback)
- `VITE_SITE_URL` (SEO only)

---

## 5. Data layer and backend API

### Transport

- **AI/gamification HTTP**: plain `fetch` in `src/lib/ai.ts` + `src/lib/gamificationApi.ts`. Base URL: `VITE_API_URL ?? VITE_AI_API_URL`. `Authorization: Bearer <supabase access_token>` via `authHeaders()`. AbortController timeouts: 90s default, 180s roadmap, 120s PDF.
- **Everything else**: direct Supabase via `supabase-js` in `src/lib/db/*` (profiles, courses, notes, sessions, leaderboard, blog reads, admin data). No REST backend for CRUD.

### API endpoints used by the frontend

| Method + path | Frontend fn | Purpose | Streaming? |
|---|---|---|---|
| `POST /api/roadmaps/outline` | `generateRoadmapOutline()` (`ai.ts:245`) | Phase outline | No (JSON) |
| `POST /api/roadmaps/phase` | `generateRoadmapPhase()` (`ai.ts:277`) | One phase's nodes | No (JSON) |
| `POST /api/quizzes/generate` | `generateQuiz()` (`ai.ts:294`) | Quiz questions | No |
| `POST /api/quizzes/generate-pdf` | `generateQuizFromPdf()` (`ai.ts:316`) | Quiz from PDF (multipart) | No |
| `POST /api/quizzes/evaluate` | `evaluateCode()` (`ai.ts:365`) | Grade one answer | No |
| `POST /api/chat` | `chat()` (`ai.ts:385`) | Assistant turn | No |
| `POST /api/achievements/check` | `apiCheckAchievements()` (`gamificationApi.ts:62`) | Server achievement engine | No |
| `POST /api/avatar/select` | `apiSelectAvatar()` (`gamificationApi.ts:70`) | Validate/store DiceBear URL | No |

Response types are defined in `ai.ts:42–173` (`RoadmapOutlineResult`, `QuizResult`, `Evaluation`, `ChatResult`, …). Backend request/response Pydantic models: `backend/app/schemas.py`.

### AI providers (backend)

| Endpoint | Provider / model |
|---|---|
| `/api/chat` | Groq `openai/gpt-oss-20b` (fallback `gpt-oss-120b`) |
| `/api/quizzes/generate` (+PDF, evaluate) | Groq `qwen/qwen3.8-27b` (MCQ grading is deterministic, no AI) |
| `/api/roadmaps/outline` + `/phase` | Gemini `gemini-3.5-flash` (fallback Groq `openai/gpt-oss-120b`) |
| Blog pipeline (backend-only) | Gemini + Tavily + NVIDIA + Pixabay |

**No streaming anywhere** — all endpoints return complete JSON. Roadmap generation is chunked at the API level (outline → per-phase calls), each saved immediately.

### Supabase objects used from the frontend

**Tables**: `profiles`, `courses`, `course_topics`, `learning_sessions`, `notes`, `roadmaps`, `roadmap_nodes`, `roadmap_connections`, `friendships`, `achievements`, `user_achievements`, `quiz_sessions`, `blog_posts`, `contact_messages` (admin), `quizzes`/`quiz_attempts` (admin read-only).

**RPCs**: `activity_heatmap(p_days)`, `record_activity(p_xp)`, `record_quiz_session(...)`, `check_user_achievements`, `invite_friend(p_email)`, `admin_list_users()`, `admin_delete_user(uuid)`.

**Storage buckets**: **None implemented.** Avatars are external DiceBear URLs.

### Database schema summary (17 migrations)

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | Identity + gamification | `id→auth.users`, `username`, `display_name`, `xp`, `streak`, `weekly_xp`, `total_focus_seconds`, `role` ('user'/'admin'), `avatar_url` |
| `courses` | User courses | `user_id`, `title`, `status`, `accent`, `position`, `total_focus_seconds`, `domain` |
| `course_topics` | Topics in course | `course_id CASCADE`, `title`, `position`, `status`, `progress_percentage` |
| `learning_sessions` | Focus sessions (heatmap source) | `user_id`, `course_id`, `topic_id`, `started_at`, `ended_at`, `total_seconds` |
| `notes` | Notes | `user_id`, `title`, `content`, `course_id`, `topic_id`, `tags[]` |
| `quizzes` / `quiz_attempts` | Stored quizzes (admin only from client) | `prompt`, `options jsonb`, `correct_answer`, `kind`, `difficulty` |
| `friendships` | Social graph | `requester_id`, `addressee_id`, `status` |
| `roadmaps` | AI roadmap header | `user_id→profiles`, `course_id`, `goal`, `title`, `phases jsonb` |
| `roadmap_nodes` | Graph nodes | `roadmap_id CASCADE`, `title`, `phase_number`, `status`, `prerequisites uuid[]`, `position_x/y`, `estimated_hours` |
| `roadmap_connections` | Graph edges | `from_node_id`, `to_node_id`, unique per roadmap |
| `achievements` | Badge catalog | `code`, `title`, `icon`, `tier` |
| `user_achievements` | Unlocks | `user_id`, `achievement_id`, `unlocked_at` |
| `quiz_sessions` | Quiz results → XP/achievements | `topic`, `kind`, `correct`, `total`, `xp` |
| `blog_posts` | AI-generated blog | `title`, `slug`, `content`, `published_at`, `tags[]` |
| `contact_messages` | Contact inbox | `name`, `email`, `subject`, `message`, `is_read` |

**RLS**: enabled on all tables; own-row policies use `(select auth.uid())`. Admin functions gated by `is_admin()`. XP/streak/role protected by `protect_gamification_columns()` trigger + `prevent_role_change()` (migration 0015) + XP caps (0016).

---

## 6. Dashboard (most important section)

### Component tree

```
DashboardLayout (src/layouts/DashboardLayout.tsx)
├── TimerProvider (src/context/TimerContext.tsx)
├── Mesh gradient background (fixed)
├── Sidebar (desktop) → Logo + NavLinks (10 items)
├── Header (h-16): mobile menu, page title, profile dropdown
│     └── profile menu: About, Help, Admin (if role), Sign out
├── Mobile drawer (framer-motion)
├── Main → PageSlot × 11 (keep-alive: mount once, CSS show/hide, 0.3s opacity fade)
│     ├── DashboardHome (index)
│     ├── RoadmapPage, CoursesPage, NotesPage, QuizPage, TimerPage
│     ├── AiAssistantPage, SettingsPage, CalendarPage, SquadPage, LeaderboardPage
│     └── Footer: Privacy / Terms / Contact
└── SessionCompleteCard (8s auto-hide toast, uses useTimer)
```

**Keep-alive mechanic**: pages stay mounted after first visit (state survives tab switches). Tab switches do NOT play the curtain — only 0.3s opacity fade.

**Sidebar NAV** (`DashboardLayout.tsx:53–64`): Dashboard `/app`, Roadmap `/app/roadmap`, Courses `/app/courses`, Notes `/app/notes`, Quiz `/app/quiz`, Timer `/app/timer`, Friends `/app/squad`, Leaderboard `/app/leaderboard`, Assistant `/app/assistant`, Settings `/app/settings`. **`/app/calendar` has no sidebar entry** (URL-only). `?courseId=` query param is shared across roadmap/courses/notes/timer tabs.

### Home page sections (`src/pages/dashboard/DashboardHome.tsx`)

| # | Section | Component | Data | Source |
|---|---|---|---|---|
| 1 | Greeting header | `RevealText` | "Hi {name}, here's your terrain." | `useDashboard().profile` |
| 2 | Player stats | `components/dashboard/PlayerStats.tsx` | Streak, rank badge, XP bar, @username | Supabase `profiles` via `fetchProfile()`; rank math client-side (`src/lib/gamification.ts`) |
| 3 | Focus timer widget | `components/dashboard/FocusTimerWidget.tsx` | Total focus time, active course, start/pause/stop, quick-start presets | `useTimer()` (context) |
| 4 | Today's focus | `components/dashboard/TodayFocus.tsx` | Active course, next topic, progress % | `useDashboard().focus` ← `fetchFocusCourse()` → `courses` + `course_topics` |
| 5 | Activity heatmap | `components/dashboard/ActivityHeatmap.tsx` | 53-week grid, active days, total hours | `fetchHeatmap(365)` → `rpc("activity_heatmap")` → aggregates `learning_sessions` |

Side effect: `runAchievementChecks()` on `requestIdleCallback` → `POST /api/achievements/check` (fallback `rpc("check_user_achievements")`).

### Hooks

- **`useDashboard`** (`src/hooks/useDashboard.ts`): `{profile, heatmap, focus, loading}` + `reload()`; refetches on `PROFILE_CHANGED_EVENT`, `COURSES_CHANGED_EVENT`, `FOCUS_CHANGED_EVENT`.
- **`useCourses`** (`src/hooks/useCourses.ts`): `{courses, loading, reload}`; Supabase `courses` + nested `course_topics`.

### Global state management

**Exactly one React context**: `TimerContext` (see §7d). No Zustand/Redux/Jotai. Cross-component sync via:
1. Window CustomEvents: `atlas:roadmaps-changed`, `atlas:focus-changed`, `atlas:courses-changed`, `atlas:profile-changed` (`src/lib/db/events.ts`).
2. Module-level localStorage stores: `atlas.timer` (live timer, cross-tab via `storage` event), `atlas.sessions` (session history).
3. Toast bus: `src/lib/toast.ts` (module `Set` of listeners).

---

## 7. Feature inventory

### a. Roadmaps

| Aspect | Detail |
|---|---|
| Files | `pages/dashboard/RoadmapPage.tsx` (880 lines), `lib/db/roadmaps.ts` (610), `lib/roadmapGraph.ts` (630, **pure**), `components/roadmap/*` |
| AI generation | Outline → save skeleton → loop per phase: `POST /api/roadmaps/phase` → `appendRoadmapPhase()`. Each chunk persisted immediately; failure keeps saved phases |
| Loading UX | `busy` (page), `generating` (per-phase pill), `nodeBusy`. **No streaming** — plain JSON |
| State | Local useState + `?courseId=` URL param; refresh on `ROADMAPS_CHANGED_EVENT` |
| Persistence | `roadmaps`, `roadmap_nodes`, `roadmap_connections` (+ linked `courses` row). XP via `rpc("record_activity", {p_xp: 50/200})` |
| Limitations | In-progress generation not resumable across reloads; roadmap graph layout is client-computed |

### b. Quizzes

| Aspect | Detail |
|---|---|
| Files | `pages/dashboard/QuizPage.tsx` (473), `components/quiz/*`, `lib/quiz.ts`, `lib/db/quizSessions.ts` |
| AI generation | `POST /api/quizzes/generate` (90s) or `/generate-pdf` (120s, multipart). "mixed" kind = 4 parallel requests (`Promise.allSettled`), shuffled. MCQ graded locally; others call `/api/quizzes/evaluate` |
| State | Phase machine `setup → loading → running → done`; all local useState. **In-progress quiz NOT persisted** — lost on unmount (mitigated by keep-alive) |
| Persistence | On finish only: `rpc("record_quiz_session", {...})` → `quiz_sessions` + XP + achievement codes |
| Limitations | No resume; no server-side quiz storage for the client; `quizzes`/`quiz_attempts` tables are admin-read-only |

### c. Notes

| Aspect | Detail |
|---|---|
| Files | `pages/dashboard/NotesPage.tsx` (549), `lib/db/notes.ts` (192), `lib/notes.ts` (sanitize) |
| Schema | `notes` table: `id, title, content (HTML), user_id, course_id, topic_id, tags[], updated_at`. Client type `Note = {id, title, html, updatedAt, courseId, topicId, courseTitle}` |
| Editor | Raw `contentEditable` div + `document.execCommand` toolbar (deprecated API). DOMPurify sanitizes before save |
| Save model | Optimistic + debounced: `onInput` → 600ms debounce → `persist()` (pending patch Map + local state) → 700ms `flush()` → `supabase.from("notes").update()`. Title saves immediately. Unmount flushes |
| Persistence | Server (Supabase). **No offline queue** — failed flushes are silent (audit.md flags this) |
| Limitations | `execCommand` deprecated; no versioning; no offline support |

### d. Focus timer / sessions

| Aspect | Detail |
|---|---|
| Files | `context/TimerContext.tsx` (311), `lib/timer.ts` (189), `lib/db/focus.ts` (67), `pages/dashboard/TimerPage.tsx` (282), `components/dashboard/FocusTimerWidget.tsx`, `components/SessionCompleteCard.tsx` |
| Time tracking | **Client-side, timestamp-derived** — `elapsed = accumulatedMs + (running ? now - startedAt : 0)`. 1Hz interval only forces re-render. Not tick-counting |
| Start | `toggle()` idle→running (`startedAt = Date.now()`), or `startQuick(minutes)`. `setTarget`/`selectCourse` only while idle |
| Pause | Computes `delta = floor((elapsed - flushedMs)/1000)`, bumps DB bases optimistically, `flushFocus()` → `profiles.total_focus_seconds` + `courses.total_focus_seconds` |
| End (`stop()`) | 1) Reset local state. 2) `commitFocus()`: flush queued DB writes; if ≥60s → append to `localStorage["atlas.sessions"]` + insert `learning_sessions` row + `rpc("record_activity", {p_xp: 1/minute})`. 3) Notify + flash |
| Auto-complete | When `elapsed >= targetMin*60_000`: show `SessionCompleteCard` for 8s, then `stop()` |
| Live persistence | `localStorage["atlas.timer"]` on every change; cross-tab via `storage` event + listener set. Running states older than 24h discarded |
| Session end determination | **Client wall-clock** — no server timestamp validation (server trusts client `started_at`/`ended_at`) |

### e. Progress tracking

| Concern | Files | Source |
|---|---|---|
| Heatmap (dashboard) | `ActivityHeatmap.tsx`, `lib/db/activity.ts` | `rpc("activity_heatmap")` over `learning_sessions` |
| Heatmap (calendar page) | `CalendarPage.tsx`, `lib/calendar.ts` | **`localStorage["atlas.sessions"]` only** — different source than dashboard |
| XP | `lib/db/sessions.ts` (1/min), `lib/db/roadmaps.ts` (50/200), `lib/quiz.ts` (10/correct) | `rpc("record_activity")`, `rpc("record_quiz_session")` — server-computed since migration 0016 |
| Streak | `profiles.streak` | Mutated inside RPCs only |
| Ranks | `lib/gamification.ts` (`getRankFromXP`), `RankBadge.tsx` | **Pure client-side** thresholds on `profile.xp` |
| Achievements | `lib/db/achievements.ts`, `gamificationApi.ts` | `POST /api/achievements/check`, fallback `rpc("check_user_achievements")` |
| Leaderboard | `LeaderboardPage.tsx`, `lib/db/leaderboard.ts` | `profiles` ordered by `weekly_xp desc, xp desc`, limit 50 |

### f. Chatbot

| Aspect | Detail |
|---|---|
| Files | `pages/dashboard/AiAssistantPage.tsx` (161), `components/assistant/*`, `lib/assistant.ts` (126), `lib/ai.ts` |
| Transport | `POST /api/chat` — **NOT streaming**. Single fetch, full reply as one turn |
| Request | `{message, history[], user_name}` — history = system turn (learner context: name, level, XP, streak, current course + topics) + last 12 turns (8000 chars each) |
| State | Local `useState` (`turns, draft, thinking, error`). **No persistence** — conversation dies with tab (survives `/app` tab switches via keep-alive only) |
| Errors | `classify()` → offline/timeout/message banner; `lastSent` retained for Retry button |

### g. Other dashboard pages

| Page | Data source | One-liner |
|---|---|---|
| CoursesPage | `courses` + `course_topics` + `roadmaps`/`roadmap_nodes` (progress ring) | CRUD courses/syllabus, topic checkboxes, Start Focus |
| SquadPage | `friendships` + `profiles` + `rpc("invite_friend")` | Friends list w/ presence, invite by email, accept/decline |
| LeaderboardPage | `profiles` (weekly_xp) | Weekly XP ranking, medals |
| CalendarPage | `localStorage["atlas.sessions"]` only | Contribution grid + streak tiles |
| SettingsPage | `profiles`, `courses`, `POST /api/avatar/select` | Profile edit, avatar picker, course delete |
| Admin (6 pages) | `rpc("admin_list_users")`, `blog_posts`, `contact_messages`, `quiz_attempts` | Users/Posts/Messages/Usage/Overview/Settings |

---

## 8. UI, theme and assets

### Styling approach

- **Tailwind CSS v4** (CSS-first): tokens in `@theme {}` in `src/index.css`. No tailwind.config file. Wired via `@tailwindcss/vite`.
- **shadcn/ui** configured (`components.json`: new-york style, neutral base, lucide icons) but `src/lib/utils.ts` (`cn` helper) is **missing**.
- Custom utilities: `glass`, `card-sheen`, `atlas-glow`, `no-scrollbar`.
- Glassmorphism: `bg-white/[0.03]`, `backdrop-blur-2xl`, `border border-white/[0.08]`.

### Design tokens

| Token | Value |
|---|---|
| `--color-void` | `#030305` (page bg) |
| `--color-ink` | `#0a0a1a` |
| `--color-midnight` | `#0b1026` |
| `--color-star` | `#9db4ff` (accent/focus) |
| Lilac accent | `#cf9eff` (used everywhere; default `courses.accent`) |
| Body text | `rgba(255,255,255,0.7)`; headings `#ffffff` |
| Selection | `rgba(157,180,255,0.28)` |
| `--font-sans` | Geist (self-hosted variable woff2) |
| `--font-mono` | Geist Mono |
| `--font-display`/`--font-outfit` | Outfit (Google Fonts) |
| `--font-syne` | Syne (@fontsource-variable) |
| Breakpoint | `--breakpoint-3xl: 1920px` |

**Dark-only** — `color-scheme: dark`, no light mode, no `prefers-color-scheme`, no `dark:` variant usage.

### Icons and animation

- **Icons**: `lucide-react` (56 import sites, ~50 distinct icons).
- **Animation**: framer-motion (`motion` package, 49 files), GSAP (2 files: `TextType.tsx`, `useLenis.ts`), Lenis smooth scroll. `MotionConfig` wraps the tree in `App.tsx`.

### Assets

| Asset | Path | Format |
|---|---|---|
| Favicon | `public/favicon.svg` | SVG (4-point star on `#030305`) |
| Blog OG fallback | `public/fallback-blog.svg` | SVG 800×450 |
| Landing image | `src/assets/dither-problem.jpg` | JPEG 357 KB |
| Logo | **No image file** — ATLAS wordmark is inline JSX (`DashboardLayout.tsx:132`, `Navbar.tsx:23`) |

### Reusable UI components (`src/components/ui/`)

| Component | Props summary |
|---|---|
| `Button` | `variant: primary/ghost/outline`, motion.button |
| `Card` | Glass card, spring hover-lift, lilac glow |
| `CodeEditor` | Monaco wrapper: `language`, `height`, `disabled` |
| `ConfirmDialog` | Accessible modal: focus trap, Escape/backdrop close, danger/neutral |
| `EmptyState` | `icon`, eyebrow, title, description |
| `RichTextEditor` | Markdown textarea + toolbar (NOT used by NotesPage) |
| `SelectMenu` | Generic typed dropdown: label, options, icons, hints |
| `Toaster` | Fixed viewport subscribing to `lib/toast.ts` bus |

---

## 9. Mobile portability analysis

### Web-only dependencies → Expo equivalents

| Web dependency | RN/Expo equivalent |
|---|---|
| `react-router-dom` | **expo-router** (file-based) |
| Tailwind CSS v4 + `@theme` | **NativeWind v4** (shares Tailwind classes; different config format) |
| `motion` / framer-motion | **react-native-reanimated** 3+ (or keep `motion` if targeting RN Web only) |
| `gsap`, `lenis` | No direct equivalent — replace with Reanimated scroll handlers / `react-native-reanimated` |
| `three`, `@react-three/*`, `ogl` (7 WebGL effects) | **expo-gl** + `three` (limited) or drop effects; suggest `expo-gl` + lightweight shaders, or static gradients |
| `@monaco-editor/react` | **`@rivascva/react-native-codeeditor`** or simple `TextInput` + syntax colors; Monaco has no RN port |
| `lucide-react` | **`lucide-react-native`** (same icon names) |
| `dompurify` | No DOM in RN — use `sanitize-html` or sanitize server-side before save |
| `katex` | `react-native-katex` (WebView) or render math server-side to images/HTML |
| `@radix-ui/themes` | **react-native-reusables** or custom components |
| `geist` fonts | `expo-font` + woff2/ttf via `expo-font` asset |
| `localStorage` (timer, sessions, user cache) | **`@react-native-async-storage/async-storage`** |
| `window` events (`PROFILE_CHANGED_EVENT` etc.) | React context or event emitter (`DeviceEventEmitter`) |
| `requestIdleCallback` (achievement checks) | `InteractionManager.runAfterInteractions` or `setTimeout` |
| `document.execCommand` (Notes editor) | Replace with `react-native-pell-rich-editor` or Markdown `TextInput` |
| `AbortController` timeouts | Works in RN ≥0.60 (via `fetch` polyfill) — keep |

### Reusable as-is (pure TypeScript, no DOM)

| File | Purpose |
|---|---|
| `src/lib/db/types.ts` | Shared domain types |
| `src/lib/roadmapGraph.ts` | Graph model, layout, status derivation (630 lines, zero I/O) |
| `src/lib/subjects.ts` | Subject classifier |
| `src/lib/gamification.ts` | Rank/tier math |
| `src/lib/calendar.ts` | Contribution-grid math |
| `src/lib/dicebear.ts` | Avatar URL builder |
| `src/lib/motion.ts` | Easing tuple + transition variants |
| `src/lib/toast.ts` | Toast event bus (no DOM) |
| `src/lib/quiz.ts` types/constants | Quiz types + `XP_PER_CORRECT` (extract the `./ai` import) |
| `src/lib/assistant.ts` types/builders | Turn/context builders (extract `./ai` import) |
| `src/seo/*` | N/A for mobile |

### Needs rewrite (DOM/CSS/browser APIs)

`src/lib/ai.ts` (fetch+FormData OK but base-URL/env handling differs), `src/lib/auth.ts` (localStorage → AsyncStorage), `src/lib/timer.ts` (localStorage/window → AsyncStorage + AppState), `src/lib/notes.ts` (DOMPurify), `src/lib/mobile.ts`, `src/lib/scroll.ts`, `src/lib/repaint.ts`, `src/lib/webglDebug.ts`, `src/lib/db/events.ts` (window events), `src/lib/gamificationApi.ts` (fetch OK, env differs), all of `src/components/**` (JSX → RN), all of `src/pages/**`, `src/layouts/**`, `src/context/TimerContext.tsx` (mostly portable logic, swap storage).

### Recommended shared-code extraction

Create a `shared/` package (or folder) consumed by both web and mobile:

```
shared/
├── types/          # from src/lib/db/types.ts + ai.ts interfaces
├── api/
│   ├── aiClient.ts       # base-URL-agnostic (injected fetch/baseURL)
│   └── gamificationClient.ts
├── logic/
│   ├── roadmapGraph.ts
│   ├── gamification.ts
│   ├── calendar.ts
│   ├── subjects.ts
│   ├── dicebear.ts
│   └── quizConstants.ts
└── schemas/        # zod schemas (zod already a dep) shared for validation
```

The Supabase client creation must stay per-platform (browser vs RN AsyncStorage adapter), but all `src/lib/db/*` query functions are platform-agnostic once the client is injected.

### Risks / blockers

1. **Auth redirects**: `detectSessionInUrl` + email-confirmation links assume a web origin. Mobile needs deep links (`expo-linking`) + Supabase redirect URL config. `emailRedirectTo` is currently unset.
2. **Streaming**: not used today (all JSON) — no blocker, but long roadmap/quiz generations (90–180s) need mobile-friendly UX (background task or resumable).
3. **Timer reliability**: client wall-clock timer dies if the OS suspends the app. Needs `expo-task-manager`/`expo-background-timer` + local notifications.
4. **WebGL/3D effects** (7 components): not portable — budget for static/animated-gradient replacements.
5. **Monaco editor**: no RN port — Notes editor must be redesigned (the existing `RichTextEditor` component or a WebView).
6. **Version alignment**: web uses React 19.3 / TS 7; Expo SDK 57 pins React 19.2 / TS ~5.x — shared package must target the lower common denominator.
7. **XP trust model**: `record_activity`/`record_quiz_session` accept client XP with caps (0016). Mobile must call the same RPCs; server-side hardening recommended before shipping mobile.
8. **Backend CORS**: `ALLOWED_ORIGINS` is a fixed web list — mobile calls need either the same HTTPS tunnel (CORS bypass via native fetch not subject to CORS, but JWT origin checks may apply) or a native-friendly config.
9. **`getUser()` fresh-object pattern** (audit.md critical): if copied to mobile hooks, it will reproduce the re-render loops — use primitive `userId` deps.

---

## 10. Notes for offline, widgets and notifications

### Notes — current save/fetch model (for offline-first redesign)

- **Schema**: `notes(id uuid, user_id, title text, content text /*HTML*/, course_id, topic_id, tags text[], updated_at)`.
- **Fetch**: `fetchNotes(scope?)` in `lib/db/notes.ts` — scoped by `course_id`/`topic_id` or all, ordered `updated_at desc`; extra queries resolve `courseTitle`.
- **Save**: optimistic local patch → 700ms `flush()` → `supabase.from("notes").update({title, content: sanitizeHtml(html)})`. Insert on create. **No offline queue, no sync cursor, no conflict resolution, no versioning.**
- **Mobile recommendation**: local SQLite/WatermelonDB with `updated_at` + `dirty` flag; background sync via Supabase upsert; last-write-wins is acceptable given single-user editing.

### Timer/session end (for local notifications)

- Session end is determined **entirely on the client**: `elapsedMs = accumulatedMs + (now - startedAt)` compared against `targetMin * 60_000`. Auto-complete fires in a React effect when the 1Hz re-render detects `elapsed >= target`.
- On stop: client writes `started_at`/`ended_at`/`total_seconds` to `learning_sessions` — **server does not validate** timestamps.
- **Mobile**: schedule a local notification at `Date.now() + targetMin*60_000` via `expo-notifications` when the session starts; cancel on pause/stop. Persist timer state in AsyncStorage with `startedAt` so a killed app can recompute elapsed on relaunch (same 24h guard).

### Home-screen widget candidates

| Widget data | Source | Notes |
|---|---|---|
| Today's focus / active course | `fetchFocusCourse()` → `courses` + `course_topics` | Easy — same query |
| Streak + XP + rank | `fetchProfile()` → `profiles` | Easy; rank is client math on `xp` |
| Next roadmap step | `fetchLatestRoadmap()` → `roadmap_nodes` (first `active` node) | Moderate — need cached graph |
| Session history (today) | `learning_sessions` where `started_at` today, or local store | Easy if mirrored locally |
| Weekly leaderboard rank | `profiles` ordered by `weekly_xp` | Moderate (n+1 to find self) |

Widget refresh: use App Groups / `expo-widget` style bridge or a background fetch hitting Supabase directly with the anon key + user JWT (RLS-scoped).

---

## 11. Open questions and issues

Carried from the in-repo `audit.md` (176 lines) — highest-priority items to fix before/while cloning to mobile:

### Critical (from audit.md)

| Issue | File |
|---|---|
| **Role escalation**: client can `PATCH profiles {role:'admin'}` — `protect_gamification_columns` doesn't freeze `role` | `supabase/migrations/0001:164`, `0014:18` (partially addressed by 0015 `prevent_role_change` — verify on live DB) |
| **AI endpoints anonymous + no rate limit** — frontend sends JWT but backend only uses it to scope a course fetch, not to authenticate on chat/quizzes/roadmaps | `backend/app/routers/{chat,quizzes,roadmaps}.py` |
| **Client-trusted XP** — `record_activity(p_xp)` accepts arbitrary XP (capped 1440/day in 0016); leaderboard is cheatable | `0011`, `0016`; `src/lib/db/sessions.ts`, `roadmaps.ts` |
| **`/api/blog/generate` unauthenticated** (admin secret only), writes via service-role, no frontend caller | `backend/app/main.py:210` |
| **Infinite loop** in roadmap node-key collision (`key` truncated to 70 then suffix truncated away) | `backend/app/roadmap_graph.py:405–414` |
| **Settings/DashboardHome re-render loops** — `[user]` dep on fresh `getUser()` object | `SettingsPage.tsx:35`, `DashboardHome.tsx:21` |
| **Unhandled timer promise rejections** — `flushFocus`/`commitFocus` have no `.catch` | `TimerContext.tsx:149–183` |
| **AI base URL falls back to `http://localhost:8000`** if env unset | `src/lib/ai.ts:4–6` |

### Pre-mobile cleanup recommendations

1. **Extract shared logic first** (`roadmapGraph.ts`, `gamification.ts`, `calendar.ts`, `subjects.ts`, `types.ts`, quiz/assistant types) into `shared/` — these are verified pure.
2. **Fix the timer data-loss path** (add `.catch` + offline queue) before porting TimerContext — otherwise the same silent-loss bug ships to mobile.
3. **Decide the notes editor** on mobile now (pell-rich-editor vs Markdown vs WebView) — it drives the notes data model (`content` is HTML today).
4. **Add forgot-password flow** — web has none; mobile onboarding typically needs it.
5. **Unify heatmap sources** — dashboard uses `learning_sessions` via RPC; CalendarPage uses `localStorage["atlas.sessions"]`. Pick the server source for mobile + widget.
6. **Verify `prevent_role_change` (0015) and XP caps (0016) are applied on the live database** — migrations exist in the repo but live state wasn't checked.
7. **Remove dead code** before sharing packages: 7 unimported landing/gamification components, unused exports (`fetchMyWeeklyRank`, `invalidateTimer`, `XP_PER_MINUTE`, …) — listed in audit.md.
8. **Backend timeout mismatch**: server allows 180s×3 retries; client aborts at 90s — align before mobile (mobile networks are slower).
9. **CORS/backend exposure**: confirm the Cloudflare Tunnel endpoint allows native app origins (no cookie-based CORS needed if using Bearer JWT only).
10. **`site_traffic` table** referenced in audit scope doesn't exist in migrations — verify on live DB; if present, it may have RLS disabled.

---

*Generated read-only from the ATLAS web codebase. Only this file was created. No secrets, keys or token values are included.*
