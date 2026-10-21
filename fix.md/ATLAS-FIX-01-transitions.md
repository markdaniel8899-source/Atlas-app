# FIX-01 — Section transitions (hard/jerky switching)

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- No new dependency, no `eas build/update`, no `git push`.
- Look/colors/copy mat badlo.
- End par `npx tsc --noEmit` aur `npx expo lint` pass hon.
- Sirf ek commit: `fix: remove full-width tab slide and per-scene backdrop`
- Code bayan se alag nikle to wo step ruko aur report mein likho.
- Final report: files changed, kya badla, kaise verify, risks, phone test.

## CONTEXT
All sections are siblings in one root `Tabs` navigator (`src/app/_layout.tsx`). The previous "smoothing" commit `a722230` added a full-viewport-width custom slide (`slideSceneStyle`, module-scope `VIEWPORT_WIDTH`) and an opaque full-screen `SceneBackdrop` image per scene. With `detachInactiveScreens={false}` every scene stays attached, so two full-screen layers translate while the drawer is still closing (drawer close 200 ms vs slide 250 ms). That is the "hard navigation" users report. See `audit/02-transitions-and-keyboard-rca.md` Part 1.

## GOAL
Section change is instant and invisible behind the drawer. The drawer open/close is the only visible motion. No flashes, no bleed-through, no black/white background.

## SCOPE (only these files)
- `src/app/_layout.tsx`
- `src/components/scene-backdrop.tsx` (delete)
- `src/components/screen-shell.tsx`
- `src/app/index.tsx`
- `src/app/assistant.tsx`
- `assets/mesh-bg.png` (delete ONLY if step 6 confirms it is unreferenced)

## STEPS
1. Line numbers in the audit may have shifted. Read `_layout.tsx` fully first.
2. In `_layout.tsx` remove: `VIEWPORT_WIDTH`, `slideSceneStyle`, the `Dimensions` import if now unused, and from `screenOptions` remove `animation`, `sceneStyleInterpolator`, `transitionSpec`.
3. Set `animation: "none"` explicitly in `screenOptions` (keeps behavior deterministic) and keep `headerShown: false`.
4. Make sure each scene is transparent: `sceneStyle: { backgroundColor: "transparent" }` must be present so the single root `MeshBackground` shows through.
5. Delete `src/components/scene-backdrop.tsx` and remove every `<SceneBackdrop />` and its import (screen-shell, index, assistant). Run `grep -rn "SceneBackdrop\|scene-backdrop\|VIEWPORT_WIDTH\|slideSceneStyle" src` — must return nothing.
6. `grep -rn "mesh-bg" src app.json` — if nothing references `assets/mesh-bg.png` any more, delete it. If something does, keep it and say so.
7. Check each scene root (ScreenShell, dashboard, assistant, onboarding/login if inside Tabs) does not paint an opaque full-screen background that would hide the root mesh. If one does, make it transparent.

## DO NOT
- Change drawer durations, `theme/motion.ts`, `detachInactiveScreens`, preload waves, or navigation structure.
- Add any fade/slide replacement (optional polish is a separate decision).

## ACCEPTANCE
- Drawer tap -> new section is already in place when the drawer finishes closing; the old screen never visibly slides.
- No flash of white/black; the mesh background is continuous across sections.
- grep checks in steps 5-6 pass; tsc + lint clean.

## USER TEST (Zain phone par karega)
1. OTA ke baad app 2 dafa khol-band karo.
2. Drawer se Dashboard -> Roadmap -> Notes -> Quiz -> Friends -> Leaderboard -> Assistant -> Settings, har ek par jao.
3. Dekho: purani screen side mein slide to nahi hoti? Background mein flash/kala-safed patch to nahi? Drawer band hote hi naya section tayyar hai?
4. Phone ki screen recording lo (swipe-down panel se) aur mujhe bhejo agar abhi bhi jerk lage.
5. Timer chalate hue bhi 3-4 section badlo.
