# ATLAS — Fix Process (README)

Ye files opencode ko ek ek karke deni hain. Source: `audit/` folder ki reports (01-findings, 02-RCA, 06-fix-plan).
Scope: sirf APK + OTA. Play Store / iOS / AAB / account-deletion abhi **skip** hain.

## Order (is order mein hi karo)

| # | File | Kya fix hota hai | Ship |
|---|------|------------------|------|
| 01 | ATLAS-FIX-01-transitions.md | Hard/jerky section switch | OTA |
| 02 | ATLAS-FIX-02-keyboard.md | Keyboard ke peeche field/button | OTA |
| 03 | ATLAS-FIX-03-account-isolation.md | Logout ke baad purane account ka data | OTA |
| 04 | ATLAS-FIX-04-error-handling.md | Jhoote success, quiz double-save, ignored errors | OTA |
| 05 | ATLAS-FIX-05-lag-generation-results.md | Roadmap generate / quiz result par lag | OTA |
| 06 | ATLAS-FIX-06-list-performance.md | Leaderboard/notes/friends/timer performance | OTA |
| 07 | ATLAS-FIX-07-layout-accessibility.md | Chhoti screens, fonts, touch targets | OTA |
| 08 | ATLAS-FIX-08-ux-safety-copy.md | Confirm dialogs, refresh, copy, date bugs | OTA |
| 09 | ATLAS-FIX-09-database-sql.md | Atomic focus/XP, delete cascade, share limit | SQL pehle, phir OTA |
| 10 | ATLAS-FIX-10-ai-resilience-remote-config.md | AI URL remote config, health, cancel, consent | SQL + OTA |
| 11 | ATLAS-FIX-11-client-security.md | Sanitize-on-read, WebView, log scrub | OTA |
| 12 | ATLAS-FIX-12-native-build.md | allowBackup, unused deps, Sentry, versionCode | **Naya APK build** |
| 13 | ATLAS-FIX-13-tests-and-qa.md | Unit tests, RLS isolation script, CI | OTA/none |
| — | ATLAS-BACKEND-AUDIT-PROMPT.md | Backend repo ka read-only audit | alag repo |
| — | ATLAS-MANUAL-QA.md | Tumhari apni phone testing checklist | — |

Batch 01 aur 02 pehle: ye tumhare 2 din wale masle hain.

## Har batch ka process

1. Opencode mein **ek hi batch file** paste karo. Do batch ek saath kabhi nahi.
2. Opencode khatam kare to uska final report mujhe bhejo (files changed + risks).
3. Tum `git diff HEAD~1 --stat` dekho ke sirf wohi files badli hain jo SCOPE mein thi.
4. OTA publish (PowerShell, project folder mein):
   ```
   $env:CI=1; eas update --branch production --platform android --environment production --message "batch 01 transitions"
   ```
   Cold bundler cache par ~8 min lag sakte hain.
5. Phone par app **2 dafa band-khol karo** (pehli dafa update download hota hai, doosri dafa chalta hai).
6. File ke andar "USER TEST" section follow karo. Masla mile to `ATLAS-MANUAL-QA.md` ke format mein mujhe batao.
7. Test pass ho jaye tab agla batch.

Native change wala sirf Batch 12 hai. Baqi sab OTA se aa jate hain (runtime 1.0.0 same rehta hai).

## Tumhare apne kaam (opencode nahi karega)

- **Batch 09 se pehle:** Supabase SQL Editor mein `supabase/rls-audit.sql` chalao aur natija mujhe bhejo (RLS policies ka sach pata chalega).
- **SQL files** opencode likhega, lekin **tum chalane se pehle mujhe dikhao**. Seedha mat chalana.
- **Batch 10 se pehle:** SQL chala kar `app_config` table mein `ai_api_url = https://api.atlas.kz.ci` ki row daalo.
- **Tunnel band karna:** Batch 10 ki OTA phone par test pass hone ke baad hi (backend ka tunnel us ke baad band hoga).
- **Batch 12:** `eas build --platform android --profile production` tum chalate ho. Sentry optional hai (free account chahiye).

## Shared RULES block (har batch file ke shuru mein bhi hai)

```
RULES
- Sirf isi batch ka kaam karo. Scope ke bahar ki files mat chhuo.
- Koi cheez nazar aaye jo scope mein nahi: NOTES.md mein likho, fix mat karo.
- Koi nayi dependency, eas build/update, git push nahi (Batch 12 mein jo likha ho wohi alag).
- UI ka look, colors, copy mat badlo jab tak step na kahe.
- Khatam karne se pehle: npx tsc --noEmit aur npx expo lint dono pass hon.
- Sirf EK git commit, message file mein diya hai.
- Agar code file ke bayan se alag nikle: wo step ruko, report mein wajah likho, bada rewrite mat karo.
- Final report: (1) files changed (2) har file mein kya badla, 1-2 line (3) kaise verify kiya (4) jo verify nahi hua / risk (5) phone test suggestion.
```
