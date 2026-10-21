# FIX-13 — Automated tests, RLS isolation script, CI

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- Dev-only dependencies add karna allowed hai is batch mein (`jest`, `jest-expo`, `@types/jest`); koi runtime dependency nahi. `eas build/update`, `git push` mana.
- App ka production code mat badlo. Sirf tests, scripts, config aur docs. Agar test ko code mein ek chhoti export chahiye (`export` keyword) to wo allowed hai, logic nahi.
- Do commits: `test: unit tests for pure logic` aur `chore: RLS isolation script and CI`.
- Final report: kitne tests, kya cover hua, kya cover nahi hua, kaise chalayein.

## CONTEXT (audit: TEST-01, TEST-02, TEST-03, REL-05)
There are no automated tests. The riskiest pure logic (offline notes queue, quiz store, sanitizer, timer math, widget model, day helper) has none, and tenant isolation is unverified.

## GOAL
`npm test` and `npm run typecheck` exist and pass; a runnable two-user isolation script exists; a basic CI workflow runs typecheck + lint + tests.

## SCOPE
- `package.json` (scripts + dev dependencies), `jest.config.js`
- `__tests__/` or `src/**/__tests__/` (NEW)
- `scripts/rls-isolation-test.mjs` (NEW), `docs/RLS-TEST.md` (NEW)
- `.github/workflows/ci.yml` (NEW)
- `docs/MANUAL-QA.md` (NEW, copy of the checklist below)

## STEPS
1. Add scripts: `"typecheck": "tsc --noEmit"`, `"test": "jest"`. Set up `jest-expo` with the repo's TS config. Mock AsyncStorage and native modules minimally.
2. Unit tests (aim for the behaviors, not coverage numbers):
   - `notes.ts` sanitizer corpus: `<script>`, `<style>`, `<iframe>`, `<svg onload>`, `onerror=`, `javascript:` and entity-encoded variants (`&#106;avascript:`), unclosed tags, nested encodings, data URLs, valid bold/list/link markup stays. Also idempotency (`sanitize(sanitize(x)) === sanitize(x)`).
   - `notes-queue.ts`: latest-wins per note, temp `local-` id swap, retry on network error, drop on permanent (constraint/RLS) error, owner scoping (account A's queue never flushes for B).
   - `quiz-store.ts`: single finish under double call, reset on sign-out, save failure state.
   - `timer.ts`: elapsed/commit math, owner-scoped keys, sign-out clearing.
   - `session-reset.ts`: all registered handlers run once.
   - `day.ts`: local day key at UTC+5 / 23:30 edge, DST-free sanity.
   - `widget-model` formatting.
3. `scripts/rls-isolation-test.mjs` (Node ESM, uses `@supabase/supabase-js` already installed): reads `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TEST_USER_A_EMAIL/PASSWORD`, `TEST_USER_B_EMAIL/PASSWORD` from env. As A create a note, a course, a session. As B try to SELECT/UPDATE/DELETE those rows by id and via list queries; assert zero rows/denied. Also assert: anon cannot read `notes`, `profiles` private columns, `learning_sessions`; anon CAN insert `contact_messages` but cannot select; `share_note` fails for non-friends; B cannot call `increment_*` for A's course. Print a PASS/FAIL table; non-zero exit on any FAIL; clean up rows it created. **Never run it against production data without test accounts**; the doc must say so.
4. `docs/RLS-TEST.md`: how to create two throwaway accounts and run the script.
5. `.github/workflows/ci.yml`: on push/PR run `npm ci`, `npm run typecheck`, `npx expo lint`, `npm test`. (No secrets; RLS script is NOT part of CI.)
6. `docs/MANUAL-QA.md`: copy the manual checklist from the file `ATLAS-MANUAL-QA.md` if it is present in the repo root; otherwise write the checklist from the audit's `05-release-readiness.md` section 7.

## DO NOT
- Change app behavior to make tests pass; if a test exposes a bug, keep the test, mark it `test.failing` or `it.skip` with a comment, and list it in the report.
- Add runtime dependencies.

## ACCEPTANCE
- `npm run typecheck`, `npx expo lint`, `npm test` all pass locally.
- The report lists which previously-found bugs each test guards.

## USER TEST (Zain karega)
1. `npm test` chalao: green.
2. RLS script ke liye 2 test accounts banao, env set karo, `node scripts/rls-isolation-test.mjs` chalao, poora output mujhe bhejo.
3. GitHub par push karoge to Actions tab mein CI chalni chahiye.
