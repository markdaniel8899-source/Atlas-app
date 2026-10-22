# FIX-14 — Dashboard first card (rank + streak on one line) and Timer card cleanup

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- No new dependency, no `eas build/update`, no `git push`.
- Brand look same rahe; sirf layout aur wo content jo neeche remove list mein likha hai.
- End par `npx tsc --noEmit` aur `npx expo lint` pass hon.
- Do commits: `fix: keep rank and streak on one line` aur `fix: trim timer card content`.
- **Remove list ke bahar kuch delete mat karna.** Code bayan se alag nikle to wo step ruko aur report mein likho.
- Final report: files changed, kya badla, kaise verify, risks.

## NOTE
Ye batch `FIX-07` ke step 2 ko **override** karta hai. FIX-07 mein PlayerStats ko wrap karne ko kaha tha; Zain chahta hai ke rank aur streak **hamesha ek hi line** mein rahein. Agar FIX-07 pehle ho chuka hai aur wrap/stack add hua hai, use is batch mein wapas single row banao.

## PART A — Dashboard first card (PlayerStats)

### Problem
Rank block aur streak block alag alag lines mein aa gaye hain. Original design mein dono ek hi row mein the.

### Files
- `src/components/dashboard/player-stats.tsx`
- `src/app/index.tsx` (sirf agar parent width/padding masla ho)

### Steps
1. Top row ko ek single row banao: `flexDirection: "row"`, `flexWrap: "nowrap"`, `alignItems: "center"`, `justifyContent: "space-between"`.
2. Gap `40` se kam karo (16-20) aur dono blocks ko `minWidth: 0` + `flexShrink: 1` do taake chhoti screen par shrink hon, wrap na hon.
3. Streak number aur rank ke naam par `numberOfLines={1}` aur `adjustsFontSizeToFit` (ya `minimumFontScale ~0.8`) lagao; `maxFontSizeMultiplier={1.2}` lagao taake bare system font se row na tute.
4. Skeleton (loading) layout ko bhi same single-row structure do (fixed 144 px blocks hata kar flex use karo) taake loading se data par layout na kude.
5. Streak ka number/emoji aur rank badge ka size jitna hai utna rakho; sirf spacing aur shrink behavior badlo.
6. Verify 320 dp, 360 dp aur 412 dp par: ek hi line, kuch clip na ho (agar bilkul fit na ho to text chhota ho, line na badle).

### Acceptance
- Streak aur rank ek hi row mein, 320-412 dp par, font scale 1.0-1.3 par.
- Loading skeleton aur loaded card ki height lagbhag barabar (layout jump nahi).

## PART B — Timer screen card (too much content)

### Problem
Timer screen ke card par zaroorat se zyada content aa gaya hai. Zain ne abhi tak exact list nahi di; **neeche REMOVE LIST Zain bharega**. Agar list khali hai to **kuch delete mat karo**; sirf inventory banao (step 1) aur report mein likho.

### Files
- `src/app/timer.tsx`
- `src/components/dashboard/focus-timer-widget.tsx` (sirf agar remove list mein likha ho)

### REMOVE LIST (Zain yahan likhega, chalane se pehle)
```
1. (example) "Counting up live - pauses and stops are saved." wali line
2. (example) 
3. 
```
(Opencode: sirf wohi cheezein hatao jo is list mein likhi hain, exact text ya description ke mutabiq.)

### Steps
1. Inventory: timer card ke andar jo bhi elements hain (text, chips, helper lines, badges, buttons) unki list banao, file:line ke saath, aur report mein likho.
2. REMOVE LIST ke items hatao. Unke saath jo spacing/margin sirf unke liye thi use bhi hatao taake khali jagah na bache.
3. Core cheezein bilkul na chhuo: clock, start/pause/stop controls, target chips, course picker (jab tak remove list mein na ho).
4. Hataye gaye elements ke unused styles, imports aur variables bhi saaf karo (lint pass ho).

### Acceptance
- Remove list ke items nazar nahi aate; baqi card normal dikhta hai; koi khali gap nahi.
- Timer ka behavior (start/pause/stop, XP, notification) bilkul same.

## USER TEST (Zain karega)
1. Dashboard: pehla card dekho: streak aur rank ek line mein hain? Bare font (Settings > Display > Font size Largest) par bhi?
2. Timer screen: kya jo hatwana tha wo gaya aur card saaf lagta hai? Start/pause/stop theek chalte hain?
3. Dono ke screenshot bhejo agar kuch aur kharab lage.
