# FIX-11 — Client security hardening

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- No new dependency, no `eas build/update`, no `git push`.
- Look/copy mat badlo.
- End par `npx tsc --noEmit` aur `npx expo lint` pass hon.
- Sirf ek commit: `fix: sanitize on read, tighten WebView, scrub logs`
- Code bayan se alag nikle to wo step ruko aur report mein likho.
- Final report: files changed, kya badla, kaise verify, risks, phone test.

## CONTEXT (audit: SEC-06, SEC-08, SEC-04, DB-05, section 6 of 04-security-review)
- Notes are sanitized on save with a custom regex allowlist (`src/lib/notes.ts`). Shared notes are copied by a server RPC, so the stored content of a received note was not necessarily sanitized by this client. The read/render path must not trust stored HTML.
- `RichNoteEditor` uses `originWhitelist={["*"]}`.
- Contact form is anonymous with only length checks.
- Possible token/PII logging in release builds is unchecked.

## GOAL
Stored content is never trusted at render time, the WebView surface is minimal, nothing sensitive reaches logs, and the public contact form is a little harder to spam.

## SCOPE
- `src/lib/notes.ts`, `src/lib/db/notes.ts`
- `src/components/notes/rich-note-editor.tsx`
- Any place that renders note HTML/snippets: widget builders in `src/lib/widgets/*`, list previews, share modal
- `src/app/contact.tsx`
- `src/lib/assistant-store.ts`, `src/components/quiz/rich-text.tsx` / markdown components (read-only verification unless a real hole exists)
- Whole `src/` for `console.log/warn/error` review

## STEPS
1. **Sanitize on read:** every place that injects note `content` into the WebView, or turns it into a preview/widget snippet, passes it through `sanitizeHtml()` (or a strip-to-text helper) first, regardless of where the note came from. Make sure the function is idempotent (sanitizing twice yields the same output) and add that to the report.
2. **WebView:** change `originWhitelist` to the minimum that still loads the inline document (start with `["about:blank"]`; if the editor fails to load because of this, revert **only that line** and say so). Keep `onShouldStartLoadWithRequest` gate; keep `javaScriptEnabled` only if the editor needs it; set `allowFileAccess={false}`, `allowUniversalAccessFromFileURLs={false}`, `mixedContentMode="never"`, `setSupportMultipleWindows={false}` where supported.
3. **Markdown/AI output:** verify the quiz/assistant renderers never interpret raw HTML or `javascript:` links from AI/user text; links must go through the existing http(s)-only validator. Fix only if you find a real gap.
4. **Deep links:** where `atlas://` params (e.g. `compose=1`, ids) are consumed, validate type/length and ignore unexpected values.
5. **Log scrub:** grep every `console.*` call; remove or guard with `__DEV__` any that could print a token, session, email, note content or AI payload. List what you changed.
6. **Contact form:** add a hidden honeypot field (ignored if empty; if filled, pretend success but do not insert) and a minimum interval of 30 s between submissions per device (AsyncStorage timestamp). State clearly in the report that this does NOT stop a determined bot (real protection needs captcha or an Edge Function later).
7. **Share errors:** map `share_note` failures to friendly messages (no raw DB text). If Batch 09 already did, just verify.

## DO NOT
- Replace the sanitizer with a library (no new dependencies).
- Change the editor's features or look.

## ACCEPTANCE
- A note whose stored HTML contains `<script>`, `onerror=`, `javascript:` links, `<svg onload>` renders as inert text/safe HTML in the editor, list and widget.
- Editor still loads and edits normally; links open in the system browser only for http(s).
- `grep` shows no log line that can contain tokens/emails/note bodies in release.

## USER TEST (Zain karega)
1. Notes mein normal note banao, formatting (bold, list, link) check karo: editor theek chale.
2. Link par tap: browser mein khule. Note band-khol: content wahi.
3. Dost se note share karwao ya khud do accounts mein share karo: dono taraf theek dikhe.
4. Contact form: ek message bhejo; turant doosra bhejo -> "thodi der baad" jaisa message.
5. Agar editor khali/white aaye to mujhe batao (WebView whitelist wali line revert hogi).
