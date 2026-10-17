# ATLAS — Production Audit & Feature Report

> **Date:** 2026-10-18 · **Commit:** `3e7aac6` · **Branch:** main · **App:** ATLAS (Expo SDK 57 / RN 0.86)
> Ye file app ki current **production readiness**, tamam **shipped features** aur overall **state** ka single source of truth hai. Koi bhi naya session isay pehle parh le.

---

## 1. Executive Summary

**Production readiness: ~95%** — App code, security aur data-integrity tayyar hai. Launch se pehle ye baqi hai:

| # | Blocker | Severity | Owner | Status |
|---|---------|----------|-------|--------|
| 1 | Focus RPCs se `anon` execute revoke (2 SQL lines) | High (2 min ka kaam) | User | ⏳ Pending |
| 2 | **Naya APK build (versionCode 3)** — notifications + widget native modules ke liye | High | User (build) | ✅ Built `7830c669` (2026-10-18) |
| 3 | AI backend stable hosting (abhi temporary trycloudflare tunnel) | High | User (decide) | ⚠️ Temp |
| 4 | Crash / error monitoring (Sentry type) | Medium | Next dev batch | ❌ |
| 5 | Play Store logistics (listing, screenshots, signing track) | Medium | User | ❌ |

---

## 2. Production Readiness Scorecard

| Area | Status | Notes |
|------|--------|-------|
| Auth & Account | ✅ Done | 5 modes, OTP, SecureStore sessions |
| Dashboard | ✅ Done | Focus card, stats, quick links |
| Focus Timer | ✅ Done | Offline-safe, server-authoritative XP |
| Roadmap | ✅ Done | Map + builder + AI generation + resources |
| Courses | ✅ Done | Topics CRUD, progress recompute, user-scoped |
| Notes | ✅ Done | Rich editor, offline queue, sanitizer |
| Quiz | ✅ Done | AI generation, tab-switch proof store, honest sync note |
| AI Assistant | ✅ Done | Thread 24h persist, in-flight survival (backend-dependent) |
| Leaderboard | ✅ Done | Weekly, honest error/empty states |
| Friends / Squad | ✅ Done | Invite/accept/decline, scoped |
| Settings & Profile | ✅ Done | Validated inputs, avatar allowlist |
| Info Pages | ✅ Done | About / Help / Privacy / Terms / Contact |
| Onboarding | ✅ Done | One-time first-launch gate (fresh install → onboarding → login) |
| Offline & Sync | ✅ Done | Guards + banner + queues |
| Notifications | ✅ Built (vc3) | Session-end alert (expo-notifications) — vc3 APK mein active |
| Android Widget | ✅ Built (vc3) | Streak/rank card (react-native-android-widget) — vc3 APK mein active |
| Security Hardening | ✅ Done | 1 SQL fix pending (anon revoke) |
| Web SEO / Static Export | ✅ Done | 19/19 routes prerender (`output: "static"`) |
| Web hosting (deploy) | ❌ Not deployed | Static export ready |
| Native build / APK | ✅ Built (vc3) | vc3 APK ready (notifications + widget + naya icon) — download link §7 |
| Device QA (user-led) | 🔄 In progress | 7 bug-fix batches device pe test ho chuke; OTA after each fix |
| Monitoring | ❌ None | No crash visibility in production |
| CI/CD | ❌ None | Manual workflow (tsc → lint → commit → push) |

---

## 3. Features (A → Z)

### 3.1 Auth & Account (`src/app/login.tsx`)
- Single screen, 5 modes: **login / signup / verify / forgot / reset** (animated two-phase mode switches)
- **OTP card** (`src/components/auth/otp-input.tsx`): 6 boxes, paste + `one-time-code` autofill, 60s resend cooldown, auto-submit on 6th digit
- Floating-label fields, lilac focus ring, password eye toggle, legal links
- `AuthGlow` fixed backdrop (no blurs on login — tap-time perf), brand row (formicon + CreateFuture wordmark)
- `readableError` (network/DNS → "No internet connection") + auto-retry once on network-layer failures
- Sessions **encrypted** in `expo-secure-store` (chunked >1800 chars, pointer written last, AsyncStorage migration, web/memory fallback)
- Account sheet (`src/components/account-sheet.tsx`): avatar tap → profile + Level/XP/streak chips + quick links + logout + info links
- `signOut()` clears local timer caches + exact-account queue safety (counters accounts ke beech leak nahi hoti)

### 3.2 Dashboard (`src/app/index.tsx`)
- Today's focus card with working CTAs: Start session → `/timer?courseId`, Roadmap → `/roadmap?courseId`, Courses → `/courses`
- Player stats, focus timer widget, quick links, footer info links, offline banner
- Onboarding gate: fresh install → `/onboarding` → `/login`

### 3.3 Focus Timer (`src/app/timer.tsx`, `src/lib/timer.ts`)
- Focus sessions with optional course link; XP via `record_activity` (server clamps 1440/day, negative = no-op)
- Offline commit handling (`CommitFocusResult`) — honest messaging, no fake XP
- Counters cached (`atlas.timer` / `atlas.sessions` / `atlas.focus.base`) and cleared on signOut

### 3.4 Roadmap (`src/app/roadmap.tsx`, `src/components/roadmap/*`)
- Map view: circular level nodes, boss levels, translucent blurred map card, soft-glow empty state
- **Builder**: segmented level/commitment controls, template grid, AI generation (offline-guarded)
- Detail sheet: objectives + resources; resource URLs scheme-validated (sirf http/s khulti hain)

### 3.5 Courses (`src/app/courses.tsx`, `src/lib/db/courses.ts`)
- Course list with progress; topics add/remove/status; `recomputeCourseProgress`
- Har write `.eq(user_id)` scoped

### 3.6 Notes (`src/app/notes.tsx`, `src/lib/notes.ts`, `src/lib/notes-queue.ts`)
- Rich editor (WebView) + **allowlist sanitizer** (runtime-verified: script/style/iframe/svg blocks drop, entity-encoded `javascript:` reject, unclosed tags escape)
- WebView navigation gate: sirf inline document load hota hai; bahar wale safe http(s) links system browser mein
- **Offline queue**: latest-wins per note, temp `local-…` ids + id-swap, retry on edit / 15s interval / foreground; per-account alag (owner-scoped)
- Title cap 200, "Offline · N to sync" indicator, delete confirm

### 3.7 Quiz (`src/app/quiz.tsx`, `src/lib/quiz-store.ts`)
- AI generation + auto-grading (backend: qwen3.8-27b)
- Session **module-level store** mein (tab switch / navigation ke across survive)
- Done screen: honest sync note jab history save fail ho (XP fallback RPC alag chalta rehta hai)
- `saveQuizSession` returns `{codes, recorded}`

### 3.8 AI Assistant (`src/app/assistant.tsx`, `src/lib/assistant-store.ts`)
- ChatGPT-style layout; thread 24h persist (AsyncStorage, owner-scoped)
- In-flight request navigation ke baad bhi complete hoti hai; offline guard on send

### 3.9 Leaderboard (`src/app/leaderboard.tsx`)
- Weekly ranking; `{ok, entries}` shape — connection failure pe "Couldn't load…" + **Try again**, empty state jhooti nahi

### 3.10 Friends / Squad (`src/app/friends.tsx`, `src/lib/db/squad.ts`)
- Invite create / accept (addressee only) / decline (either side)
- Blurred glass cards; `{ok, members}` honest states

### 3.11 Settings & Profile (`src/app/settings.tsx`, `src/lib/db/profile.ts`)
- Display name (max 60), username (`^[a-z0-9_]{3,24}$`), avatar select/remove
- Avatar **host allowlist** (DiceBear API ya project storage only) — client + DB dono side

### 3.12 Navigation & Shell
- NavigationDrawer (logout removed per user request), AppHeader (76px standard), ScreenShell (BlurTarget + offline banner + footer links)
- Global stack transitions: `slide_from_right` 240ms; login/onboarding fade 300ms

### 3.13 Info Pages (`/about` `/help` `/privacy` `/terms` `/contact`)
- Public (signed-out accessible), glass cards + BlurView backdrops
- Contact form → `contact_messages` (email validation, length clamps, offline guard)

### 3.14 Onboarding (`src/app/onboarding.tsx`)
- 4 swipeable slides, pure-View visuals, native-driver float loops
- One-time first-launch gate **active** (`f4ebe1d`): fresh install → onboarding → login; Skip/Get Started → `await markOnboardingSeen()` → `/login`
- Storage key `atlas.onboarding.seen.v2` (v2 bump: pre-release test devices see it once more; fresh installs start empty)

### 3.15 Offline & Sync Infrastructure (`src/lib/net.ts`, `src/components/offline-banner.tsx`)
- `isOnline()` / `ensureOnline(msg)` (instant "No internet" Alert) / `subscribeNetwork`
- Floating offline pill: ScreenShell + dashboard + assistant mein mounted
- Guards: quiz generate, assistant send, roadmap generate, friend invite, avatar/profile save, contact submit

### 3.16 Security Layer
- Notes sanitizer + WebView gate + avatar allowlist + owner-scoped queue + SecureStore sessions + timer cache clear on signOut
- Ownership predicates: notes update/delete, squad accept/decline, courses/topics/recompute, sessions insert with `user_id`
- DB hardening (`supabase/security-hardening.sql` — user ne run ki): length CHECKs (NOT VALID → sirf naye writes), avatar host CHECK, focus RPCs, RLS audit query

### 3.17 Web (SEO / Static Export)
- `app.json` → `web.output: "static"`; `src/app/+html.tsx` (description/og/twitter/theme-color + dark pre-hydration bg); `<Head>` title in `_layout.tsx`
- `npx expo export --platform web` → **19/19 routes** prerender clean; `dist/` gitignored
- Hosting/deploy abhi nahi hui

### 3.18 Notifications & Home-Screen Widget (`3c87b04` — next build mein active)
- **Session-end local notification** (`src/lib/notifications.ts` + `timer-context.tsx`): session start/resume pe end-time ka DATE-trigger alert schedule hota hai ("Session complete — Your focus session has ended. Open ATLAS to bank your XP."), pause/stop/sign-out pe cancel. App open ho to foreground handler banner SUPPRESS karta hai (in-app completion card hi UI hai) — app background/killed ho to notification fire hoti hai. Channel `session-alerts` (HIGH importance, lilac). Permission pehli session pe mangti hai.
- **Android widget** (`src/lib/widgets/*`): dark lilac-gradient card — "ATLAS" (CreateFuture) + LV, bara 🔥 streak number, rank name + XP. Tap → app open. Data `atlas.widget.data.v1` cache se (dashboard ke har profile fetch pe `syncAtlasWidget` update karta hai; sign-out pe reset — account leak nahi). Task handler `_layout` module scope pe registered (headless redraw).
- **Crash-safety:** dono modules lazy `require` + try/catch ke peeche hain — purani APK / Expo Go / web pe silently skip (isliye ye batch OTA-publish NAHI hui; vc3 build chahiye).

---

## 4. Live Verified Facts (probes, 2026-10-17)

| Check | Result |
|-------|--------|
| Supabase GoTrue health | ✅ `v2.197.0` |
| AI backend health | ✅ `ok`, `ai_configured=true` (roadmap=gemini-3.5-flash, quiz/code=qwen3.8-27b, chat=gpt-oss-20b) |
| XP authority | ✅ `record_activity` server-side clamp (999999 → 1440/day; negative → no-op) |
| RLS (anon) | ✅ notes / learning_sessions / profiles → `[]` (no leakage) |
| Contact form (anon) | ✅ insert 201 (public form works) |
| `learning_sessions.user_id` | ✅ column exists |
| SQL hardening run | ✅ RPCs exist (404 only for missing-fn control) |
| Sanitizer | ✅ runtime node-test pass (XSS cases blocked) |
| `tsc --noEmit` / `expo lint` | ✅ clean |
| Web static export | ✅ 19/19 routes, SEO meta verified |

---

## 5. Security Audit Findings

| Finding | Severity | Impact | Status |
|---------|----------|--------|--------|
| Focus RPCs **anon-callable** (Supabase default privileges direct `anon` grant — `revoke from public` kaafi nahi) | **Low** (body `where id = auth.uid()`, anon uid = null → no-op) | Koi data change nahi hota, magar defense-in-depth | ⏳ File updated; **user ko 2 lines run karni hain**: `revoke all on function increment_global_focus(integer) from anon;` + same for `increment_course_focus(bigint, integer)` |
| npm audit: 33 vulns (11 moderate / 22 high) | Low (tooling only) | Expo tooling chain (@expo/config-plugins etc.) — app runtime pe asar nahi | Deliberately not auto-fixed; next SDK upgrade pe re-check |
| Test users in DB | Housekeeping | `atlas.devcheck.1017@gmail.com`, `atlas.probe.1017@gmail.com` + "Message from RLS Probe" row | ⏳ Dashboard se delete karo |

---

## 6. Backend & Infrastructure

- **Supabase project:** `bzwqiguoihztbvnammqx` — RLS verified, XP server-authoritative, constraints live
- **AI backend:** external service via `EXPO_PUBLIC_AI_API_URL` — **temporary trycloudflare tunnel**; tunnel badla → quiz/assistant/roadmap AI dead (EAS env + `.env` update zaroori)
- **Auth config:** Confirm email DISABLED (signup returns session instantly); OTP screens fallback ke tor pe maujood
- **Env:** `.env` local + EAS "production" environment set (eas.json); `eas build` pe `--environment` flag nahi hota (eas.json se aata hai)
- **Versioning:** `versionCode 3`, `runtimeVersion: { policy: "appVersion" }` — OTA ka scope app version se bandha hua

---

## 7. Build & Release State

- **Production APK vc3 built (2026-10-18):** `7830c669-1619-4f53-81c1-79e6d51c40dd` (commit `3e7aac6`, versionCode **3**, channel `production`, runtime 1.0.0) — **notifications + widget + naya launcher icon**. Download: `https://expo.dev/artifacts/eas/400VNpJfrUrdMgmWae6oByO5IEBRxXzDaZLU5ym7JFE.apk` (verified HTTP 206). Install + device-test pending (user).
- **OTA live:** 3 update groups device pe test ho chuke — `b563d481…` (6-bug batch), `0f7d6a99…` (assistant keyboard flush), `ffe8892b…` (friends/drawer/offline). Publish cmd: `$env:CI=1; eas update --branch production --platform android --environment production --message "…"`
- **vc3 scope:** session-end notification (permission pehli session pe) + home-screen widget ("ATLAS — Streak & Rank") + naya launcher icon — sab is build mein active. Ye batch OTA se NAHI aa saka tha (native modules).
- **Old builds:** vc1/vc2 ke chaar builds EAS se delete (2026-10-18, `eas build:delete <id> --non-interactive`)
- Keystore: remote EAS-managed (`lFBi1Xtp8Y`)
- OTA policy: sirf device-safe JS changes publish karo; native changes (icons/splash/plugins/modules) ke liye `eas build` zaroori

---

## 8. Known Gaps / Risks

1. **AI tunnel** — production SLA nahi, kabhi bhi change ho sakta hai
2. **No monitoring** — production crash/error blindness
3. **Device QA** — real phone pe user-led testing abhi baqi (jank/feel/notch issues sirf phone pe pakre jate hain)
4. **Web not deployed** — SEO shell tayyar hai magar kahin host nahi hui
5. **Multi-device races** — focus counters read-modify-write hain; atomic RPCs file mein ready hain, jab zaroorat ho switch karna
6. **npm vulns** — tooling chain, blocking nahi

---

## 9. Action Items

### User ke liye (immediate)
1. **vc3 APK install karo** (download link §7) → test: notifications (pehli session pe permission prompt + session-end alert), widget (long-press home screen → Widgets → "ATLAS — Streak & Rank"), naya launcher icon. Build ho chuki hai (`7830c669`).
2. Supabase SQL Editor: `revoke all on function increment_global_focus(integer) from anon;` aur `revoke all on function increment_course_focus(bigint, integer) from anon;`
3. Dashboard se: 2 test users + "Message from RLS Probe" row delete

### Next dev batches (recommended order)
1. Sentry integration (`sentry-react-native-sdk`)
2. AI backend stable hosting (Vercel/Railway/Fly.io) + EAS env update
3. Web deploy (EAS Hosting / any static host)
4. Focus counters → atomic RPCs (multi-device)

---

## 10. Tech Stack & Key Files

**Stack:** Expo SDK 57 · RN 0.86 · expo-router (typed routes) · Supabase (Auth + Postgres) · expo-secure-store · expo-network · expo-blur · expo-image · expo-notifications · react-native-android-widget · legacy Animated only (native-driver) · plain StyleSheet (no NativeWind) · Geist / Outfit / CreateFuture fonts

**Key files:**
| File | Role |
|------|------|
| `src/app/_layout.tsx` | Stack transitions, fonts, Head (SEO), TimerProvider |
| `src/app/login.tsx` | Auth 5-mode screen |
| `src/lib/supabase.ts` | Client + `SUPABASE_ORIGIN` + SecureStore session storage |
| `src/lib/auth.ts` | Auth calls, `withRetry`, `readableError`, signOut |
| `src/lib/net.ts` | Online/offline detection + guards |
| `src/lib/notes-queue.ts` | Per-account offline notes queue |
| `src/lib/quiz-store.ts` | Module-level quiz session |
| `src/lib/timer.ts` | Focus timer + local caches |
| `src/lib/dicebear.ts` | Avatar allowlist |
| `src/lib/notifications.ts` | Session-end alert (lazy expo-notifications, crash-safe) |
| `src/lib/widgets/*` | Android streak/rank widget (data cache, UI, task handler, sync) |
| `supabase/security-hardening.sql` | DB hardening (constraints + RPCs + audit) |
| `src/app/+html.tsx` | Web document shell (SEO) |

---

## 11. Recent Commit Timeline

| Commit | What |
|--------|------|
| `3e7aac6` | Naya app icon + production APK vc3 build (`7830c669`) |
| `3c87b04` | Session-end notifications + Android streak/rank widget (vc3, next build) |
| `730204e` | Friends reload fix, drawer brand row, 3s offline pill |
| `29001c8` | Assistant composer docks flush onto keyboard |
| `a443f83` | 6 device-test fixes: assistant thread, avatar policy, courses, notes |
| `4097b09` | Production APK build (vc2) + device-test fix batch |
| `f4ebe1d` | Re-enable onboarding one-time gate for fresh installs |
| `45f97c9` | Revoke anon execute on focus RPCs, note SQL run |
| `1317a2a` | Make hardening SQL idempotent and signup-safe |
| `adf2beb` | Add web SEO shell, static export and DB hardening SQL |
| `f4dd7d5` | Add offline guards and honest sync states across app |
| `856fd49` | Harden notes, sync writes, avatars and session storage |
| `de7cd31` | Phase A: dead code removal, onboarding bypass, honest offline focus handling |
| `5886d99` | Set EAS environment on production build profile (versionCode 2) |
| `874bed1` → `a780788` | Onboarding finalize, design-reference cycle, screenshots |

---

*Report generated from live probes + repo state. Har naye batch ke baad ye file update karni chahiye.*
