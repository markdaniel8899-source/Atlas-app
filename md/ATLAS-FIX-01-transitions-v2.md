# FIX-01 v2 — Smooth section transitions (research-backed, replaces FIX-01 v1)

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- No new dependency, no `eas build/update`, no `git push`.
- Look/colors/copy mat badlo.
- End par `npx tsc --noEmit` aur `npx expo lint` pass hon.
- Do commits: `fix: remove full-width tab slide and per-scene backdrop` aur `feat: switchable tab transition (none | fade-through)`.
- Code bayan se alag nikle to wo step ruko aur report mein likho.
- Final report: files changed, kya badla, kaise verify, risks, BlurView inventory (step 8).

## WHY THIS BATCH EXISTS (history, do not repeat it)
The user already lost 3 days on transitions. Previous attempts (`1ac7591`, `578bfe8`, `e17c105`, `a722230`) cycled between: root Stack, a crossfade, `animation: "none"`, and finally a custom full-viewport-width slide plus an opaque `SceneBackdrop` image per scene. The last one is the worst. See `audit/02-transitions-and-keyboard-rca.md` Part 1.

## RESEARCH FINDINGS (use these, do not guess)
1. React Navigation bottom-tabs: the default tab animation is `none`. The built-in presets are `fade` (cross-fade, 150 ms) and `shift` (slight left/right shift, 150 ms). The project's custom interpolator (full viewport width, 250 ms) was much heavier than the built-ins.
2. The scene interpolator receives `current.progress` with three values: `-1` (scene to the left), `0` (focused), `1` (scene to the right). The incoming scene animates from +-1 to 0, the outgoing from 0 to +-1.
3. A plain cross-fade of two TRANSPARENT scenes over one shared background shows both screens' content overlapped (ghosting) mid-transition. That is almost certainly why the opaque `SceneBackdrop` per scene was added, and that backdrop (a 355 KB full-screen image per scene, all scenes attached because `detachInactiveScreens={false}`) is what made it heavy.
4. expo-blur on Android is documented as experimental; the docs warn it may reduce performance and cause rendering glitches during `react-native-screens` transitions. The project already uses `dimezisBlurViewSdk31Plus`, which is the recommended variant, but blur under animating scenes is still a risk.

## DESIGN DECISION
- Default: **instant swap** (`animation: "none"`). The drawer is the only navigation UI and it is already animating closed over the swap, so the user sees one smooth motion and zero scene movement.
- Optional soft mode: **fade-through** (outgoing fades out in the first half, incoming fades in in the second half, never overlapping, opacity only). Implemented but OFF by default, switchable by changing one constant (so no more multi-day rewrites).

## SCOPE
- `src/app/_layout.tsx`
- `src/theme/motion.ts`
- `src/lib/tab-transition.ts` (NEW)
- `src/components/scene-backdrop.tsx` (delete)
- `src/components/screen-shell.tsx`, `src/app/index.tsx`, `src/app/assistant.tsx`
- `assets/mesh-bg.png` (delete ONLY if step 6 confirms it is unreferenced)

## STEPS (commit 1)
1. Read fully first: `_layout.tsx`, `theme/motion.ts`, `screen-shell.tsx`, `scene-backdrop.tsx`, `global-drawer.tsx`, `navigation-drawer.tsx`. Line numbers in the audit may have shifted.
2. In `_layout.tsx` remove `VIEWPORT_WIDTH`, `slideSceneStyle`, the `Dimensions` import if unused, and the `animation`, `sceneStyleInterpolator`, `transitionSpec` entries from `screenOptions`.
3. Set `animation: "none"` and make sure the scene style is transparent: `sceneStyle: { backgroundColor: "transparent" }` so the single root `MeshBackground` shows through.
4. Delete `scene-backdrop.tsx` and every `<SceneBackdrop />` + import. `grep -rn "SceneBackdrop\|scene-backdrop\|VIEWPORT_WIDTH\|slideSceneStyle" src` must return nothing.
5. Check every scene root (ScreenShell, dashboard, assistant) for an opaque full-screen background that would hide the root mesh; make it transparent if found.
6. `grep -rn "mesh-bg" src app.json`: if `assets/mesh-bg.png` is no longer referenced anywhere, delete it; otherwise keep and say so.
7. Do NOT touch drawer durations, `detachInactiveScreens`, preload waves, or navigation structure.

## STEPS (commit 2) — switchable soft mode
8. In `src/theme/motion.ts` add:
   ```ts
   export const TAB_TRANSITION: "none" | "fade-through" = "none";
   export const TAB_FADE_MS = 160;
   ```
9. Create `src/lib/tab-transition.ts` exporting `tabTransitionOptions()`:
   - `"none"` -> `{ animation: "none" }`.
   - `"fade-through"` -> `{ animation: "fade", sceneStyleInterpolator, transitionSpec }` where
     `sceneStyleInterpolator = ({ current }) => ({ sceneStyle: { opacity: current.progress.interpolate({ inputRange: [-1, -0.5, 0, 0.5, 1], outputRange: [0, 0, 1, 0, 0], extrapolate: "clamp" }) } })`
     and `transitionSpec = { animation: "timing", config: { duration: TAB_FADE_MS, easing: Easing.inOut(Easing.quad) } }`.
   - Match the exact option/return shapes the vendored bottom-tabs in this repo expects (look at how the old `slideSceneStyle` returned `{ sceneStyle: ... }` and mirror that; do not invent new API). Opacity only, no transforms, no layout work.
10. In `_layout.tsx` spread `...tabTransitionOptions()` into `screenOptions`. Keep `headerShown: false` and the existing `lazy` logic.
11. Leave the constant at `"none"`.
12. **BlurView inventory (report only, change nothing):** for every screen list each `BlurView`/`BlurTarget` (file, approximate count, whether it covers a large area). This tells us if opacity animation could ever be expensive.

## ACCEPTANCE
- With `"none"`: drawer tap -> section is already in place when the drawer finishes closing; the old screen never visibly moves; no flash/bleed; continuous mesh background.
- With `"fade-through"` (if someone flips the constant): no ghosting (two screens never visible together), no horizontal movement.
- grep checks pass; tsc + lint clean; no new dependency.

## USER TEST (Zain karega)
1. OTA ke baad app 2 dafa khol-band karo (default "none").
2. Drawer se Dashboard, Roadmap, Notes, Quiz, Friends, Leaderboard, Assistant, Settings: purani screen slide na ho, koi flash na ho, background ek hi rahe. Timer chalate hue bhi karo.
3. Agar "foran badalna" abrupt lage aur tum thoda naram effect chahte ho, to opencode ko ye ek line do aur dusri OTA karo:
   `In src/theme/motion.ts set TAB_TRANSITION to "fade-through". Change nothing else. Run tsc and lint, then commit "chore: enable fade-through tab transition".`
4. Naram wala jerk ya halka lage to wapas `"none"` kar do (ek line, ek OTA).
5. Phone ki screen recording lo; mujhe bhejo agar abhi bhi masla ho.
