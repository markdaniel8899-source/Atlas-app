# ATLAS BACKEND — Read-only security & reliability audit (Atlas-Backend repo)

## RULES (read first)
- **READ-ONLY.** Koi source file modify/delete/rename nahi. Sirf ek nayi file `BACKEND-AUDIT.md` repo root mein likho.
- Koi `pip install`, koi server restart, koi `git` command jo state badle (sirf `git log/status/diff` allowed). `.env`, `.env.save` ki **values** report mein mat likho; sirf ye likho ke kaun si keys maujood hain aur kahan use hoti hain.
- Jo verify nahi kar sakte: "UNVERIFIED" likho.

## CONTEXT
FastAPI app (`app.main:app`, uvicorn, port 8000) on a 1 CPU / 1 GB Oracle VM, behind Caddy HTTPS at `https://api.atlas.kz.ci`. Consumers: the ATLAS mobile app (Expo) and the Vercel web frontend. The app sends `Authorization: Bearer <Supabase access token>`. It serves roadmap (Gemini), quiz/code (Qwen via OpenAI-compatible API), chat (gpt-oss-20b), PDF quiz generation, and an AutoBlog scheduler (daily 09:00 UTC). Startup logs currently print the first characters of API keys.

## AUDIT SCOPE (every item needs evidence: file:line + snippet)
1. **Endpoint inventory:** table of every route: method, path, auth required (yes/no/how), request size limits, who can call.
2. **Auth:** is the Supabase JWT actually verified (signature with the project JWT secret/JWKS, `exp`, `aud`, issuer) or only decoded? Are there routes with no auth that spend AI credits or write data? What identity does the code use for per-user limits?
3. **Abuse controls:** rate limiting, per-user/daily quotas, max prompt length, max PDF size/type, max concurrent generations, timeouts on upstream AI calls, retry storms, cost caps.
4. **CORS:** allowed origins; does it allow `*` with credentials; Vercel domain handled?
5. **Secrets & logs:** where keys are loaded; what is logged (keys, tokens, prompts, user text, PDF contents); `.gitignore` coverage for `.env`, `.env.save`, `cloudflared.deb`; whether any secret was ever committed (`git log -p` search for key-like strings, report only the commit and file, never the value).
6. **PDF handling:** temp files location, deletion guarantee, filename/path traversal, content-type checks, memory use on a 1 GB machine.
7. **Error handling:** do errors leak stack traces, upstream responses, or key fragments to clients?
8. **Resource limits:** worker count, blocking calls inside async handlers, memory/CPU hot spots, behavior under 5-10 concurrent users on 1 vCPU / 1 GB.
9. **AutoBlog:** what it writes and where, auth for any trigger endpoint, failure behavior, idempotency, and what happens when its logic changes.
10. **Dependencies:** deprecated packages (the log shows `google.generativeai` deprecation), known-risky versions, unpinned requirements.
11. **Health endpoint:** what it exposes (model names are fine; no secrets).
12. **Deployment hygiene:** systemd unit sanity (runs as `ubuntu`, restart policy), listening address (`0.0.0.0:8000` publicly reachable bypassing Caddy?), suggestion for binding to `127.0.0.1` once the app no longer uses the tunnel.

## OUTPUT: `BACKEND-AUDIT.md`
Sections: Summary (top 5 risks), Endpoint table, Findings (each: ID, severity Critical/High/Medium/Low, evidence, impact, recommended fix as SPEC ONLY with an effort estimate), Unverified items, and a proposed fix order. Finding format:

```
### [BE-01] Title
- Severity:
- Evidence: path:line — snippet (no secrets)
- Impact:
- Recommended fix (SPEC ONLY):
- Effort: S/M/L
```

## FINAL CHECK
Run `git status` and confirm only `BACKEND-AUDIT.md` is new. Write "Files modified besides BACKEND-AUDIT.md: none" at the end.
