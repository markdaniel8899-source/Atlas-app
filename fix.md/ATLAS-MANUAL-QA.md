# ATLAS — Manual QA (Zain apni phone par karega)

## Kaise use karna hai
- Har batch ke OTA ke baad app **2 dafa band-khol** karo, phir us batch ki checklist (har fix file ke "USER TEST") chalao.
- Jab saare batch ho jayein to neeche wali **Final Pass** poori chalao (sab kuch ek saath).
- Masla mile to har ek ka alag note is format mein mujhe bhejo:

```
Screen:
Kya kiya (steps):
Kya hona chahiye tha:
Kya hua:
Kitni dafa hota hai: har dafa / kabhi kabhi
Phone model + Android version:
Screen recording / screenshot: (haan/nahi)
```

Tip: Phone ki screen recording (swipe-down panel > Screen recorder) lag/jerk ke liye sab se kaam ki cheez hai.

## Final Pass (end mein)

### 1. Install aur auth
- [ ] Naya install (ya app data clear) -> onboarding aaye -> signup -> login
- [ ] Signup ke har field par keyboard ke saath form upar aaye, button nazar aaye
- [ ] Logout -> login; Forgot password -> OTP (paste) -> reset -> login
- [ ] Airplane mode mein logout

### 2. Navigation aur motion
- [ ] Drawer se har section (10) par jao: koi slide/jerk/flash nahi
- [ ] Timer chalate hue sections badlo: smooth
- [ ] App kill karke kholo: splash se app tak flash nahi

### 3. Har feature
- [ ] **Timer:** start/pause/stop (stop par confirm), background mein end-time notification, XP
- [ ] **Courses:** course banao (modal ka keyboard), topic add/toggle, delete (confirm)
- [ ] **Roadmap:** generate (lag kam), cancel, level complete (XP ek dafa), course progress sync
- [ ] **Notes:** likho, lamba title tez type, offline likho -> online sync, delete (confirm), share
- [ ] **Quiz:** topic/notes/PDF se; aakhri button par double tap (XP ek dafa); result foran; retry save
- [ ] **Friends:** invite, accept/decline (offline mein error), refresh
- [ ] **Leaderboard:** scroll smooth, apna rank sahi
- [ ] **Assistant:** message, keyboard, tab badal kar wapas, 24h thread
- [ ] **Settings:** name/username/avatar, notifications
- [ ] **Widgets:** dono add karo, tap se app khule, logout par reset

### 4. Do accounts (privacy)
- [ ] A ka data (timer, quiz, assistant) B login par nazar na aaye
- [ ] A dobara login: apna data wapas

### 5. Network
- [ ] Airplane mode: offline pill sirf ek dafa, queue baad mein sync
- [ ] Slow network (weak WiFi) par quiz generate: error/timeout saaf
- [ ] AI backend band ho (test URL galat) -> AI buttons band + message

### 6. Chhoti screen / bara font
- [ ] Font size "Largest": Dashboard, Leaderboard, Friends, Onboarding, Login kate nahi
- [ ] Reduce animations on: decorative animations ruk jaayen

### 7. Performance feel
- [ ] Roadmap generate ke dauran dusre tabs: lag kam
- [ ] Quiz result: foran, scroll smooth
- [ ] Leaderboard 50+ rows scroll

### 8. Native build ke baad (Batch 12)
- [ ] Naya APK purane ke upar install: login/data barqarar
- [ ] Widget picker mein preview, notifications, offline notes sync

## Bug priority guide
- **Bohot zaroori (mujhe foran batao):** crash, data ghayab, ghalat account ka data, XP double
- **Zaroori:** kisi feature ka kaam na karna, keyboard/layout toota
- **Chhota:** spacing, copy, halka lag
