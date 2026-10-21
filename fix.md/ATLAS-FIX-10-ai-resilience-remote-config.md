# FIX-10 — AI resilience: remote URL config, health check, cancel, consent

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- No new dependency, no `eas build/update`, no `git push`.
- **SQL sirf likho, run mat karo.** Re-runnable aur additive ho.
- End par `npx tsc --noEmit` aur `npx expo lint` pass hon.
- Do commits: `docs(sql): app_config table` aur `feat: remote AI base URL, health check, cancel and consent`.
- Final report: files changed, kya badla, kaise verify, risks.

## CONTEXT (audit: SEC-01, SEC-02, AI-01, AI-02, AI-03)
`src/lib/ai.ts` reads `EXPO_PUBLIC_AI_API_URL` once at module load; the value is baked into the JS bundle at build time (currently a trycloudflare tunnel). The backend now has a stable HTTPS URL (`https://api.atlas.kz.ci`), but changing the URL should never require a new build. All AI features depend on one URL with 90-180 s timeouts, no health check, no cancel for the multi-phase roadmap loop, and no consent before notes/PDF excerpts are sent to the AI provider.

## GOAL
The app learns the AI URL at runtime from Supabase (with a safe fallback), tells the user quickly when AI is down, lets them cancel long generations, and asks consent once before sending study content.

## SCOPE
- `supabase/migrations/010_app_config.sql` (NEW)
- `src/lib/api-config.ts` (NEW)
- `src/lib/ai.ts`
- `src/hooks/use-ai-status.ts` (NEW)
- `src/app/roadmap.tsx`, `src/app/quiz.tsx`, `src/components/quiz/quiz-setup.tsx`, `src/app/assistant.tsx` (disable-state + cancel + consent hook-up only)
- `src/components/ai-consent-modal.tsx` (NEW)
- `src/app/_layout.tsx` (call `refreshAiBaseUrl()` once, non-blocking)

## STEPS
1. SQL `010_app_config.sql`: `create table if not exists public.app_config (key text primary key, value text not null, updated_at timestamptz not null default now());` enable RLS; policy allowing `select` for `anon, authenticated` (using true); no insert/update/delete for them (`revoke`). Add a commented example `insert into app_config(key,value) values ('ai_api_url','https://api.atlas.kz.ci') on conflict (key) do update set value = excluded.value;` for Zain to run manually.
2. `api-config.ts`:
   - `getAiBaseUrl()` (sync): in-memory value, else cached AsyncStorage value (`atlas.cfg.ai_url`) loaded at startup, else `process.env.EXPO_PUBLIC_AI_API_URL`.
   - `refreshAiBaseUrl()`: fetch `app_config` row `ai_api_url` with a 4 s timeout; **accept only** a value that starts with `https://`, has no credentials/spaces, and parses with `new URL`. Save to memory + AsyncStorage. Any failure => keep the current value silently.
3. `ai.ts`: replace the module-level base URL constant with `getAiBaseUrl()` called **per request**. Behavior of requests stays the same.
4. Health: `useAiStatus()` pings `GET {base}/health` (4 s timeout) on app start, on foreground, and when a generation fails; exposes `online | offline | unknown`. When `offline`, quiz/roadmap/assistant generate buttons are disabled with a short message ("AI is unavailable right now. Try again in a minute."). `unknown` must not block.
5. Cancel: add an `AbortSignal` parameter through `ai.ts` functions; the roadmap phase loop gets a **Cancel** button. On cancel: stop further phases, keep what was saved, mark the roadmap clearly as partial (use whatever field already exists; otherwise show a "Partial roadmap - continue or delete" banner using local state only), and never start the next phase.
6. Timeouts: keep the existing long timeouts for the model call itself, but fail fast (<=5 s) when the server cannot be reached at all (connect error) so the user is not stuck for minutes.
7. Consent: first time any feature sends notes/PDF excerpts or uploads a PDF, show a one-time modal ("Your notes/PDF excerpts are sent to our AI provider to generate this. Continue?" Accept / Not now). Store `atlas.ai.consent.v1` in AsyncStorage. "Not now" returns to the form without sending. Plain topic-only requests need no consent.
8. Dedup: if the same quiz topic+settings+context hash was generated in this session, offer the cached one instead of calling the AI again (memory only).

## DO NOT
- Remove the env fallback.
- Change request/response contracts with the backend.
- Log tokens or the base URL with credentials.

## ACCEPTANCE
- With the `app_config` row present, changing it in Supabase changes where the app sends requests after the next app start; no rebuild.
- With a dead URL, buttons are disabled within ~5 s with a clear message; app does not hang for minutes.
- Roadmap generation can be cancelled; no extra phases run after cancel.
- Consent shows once; "Not now" sends nothing.

## USER TEST (Zain karega)
1. SQL review ke baad `010_app_config.sql` chalao aur row insert karo (`https://api.atlas.kz.ci`).
2. OTA ke baad app mein quiz/roadmap/assistant chalao: kaam kare.
3. Test ke liye row mein galat URL daalo (jaise `https://example.invalid`), app band-khol: AI buttons band + message. Phir sahi URL wapas.
4. Roadmap generate karte hue Cancel dabao: naye phases na chalein.
5. Naye install/clear data par pehle PDF/notes wala quiz: consent dialog ek hi dafa aaye.
6. Sab pass hone par bata do: phir tunnel band karenge.
