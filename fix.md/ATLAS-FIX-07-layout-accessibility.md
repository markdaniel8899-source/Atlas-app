# FIX-07 — Small screens, font scaling, touch targets, motion preferences

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- No new dependency, no `eas build/update`, no `git push`.
- Brand look (colors, fonts, spacing rhythm) same rahe; sirf layout/size ki galtiyan theek karo.
- End par `npx tsc --noEmit` aur `npx expo lint` pass hon.
- Sirf ek commit: `fix: responsive layouts, font scaling, touch targets`
- Code bayan se alag nikle to wo step ruko aur report mein likho.
- Final report: files changed, kya badla, kaise verify, risks, phone test.

## CONTEXT (audit: UX-02, 03, 04, 07, 08, ACC-01, 02, 03)
- `PlayerStats` top row is `flexWrap: "nowrap"` with `columnGap: 40` -> overflows at 320-360 dp or large fonts. `TodayFocus` header actions do not wrap.
- Many labels are 9-11 px with no `maxFontSizeMultiplier`; fixed-height badges/podium/onboarding clip at large system fonts.
- Icon buttons under 44 dp (notes toolbar ~32, topic rows, header buttons rely on hitSlop, some 32 px close buttons).
- Module-scope `Dimensions.get` in `account-sheet.tsx` (sheet offset) does not react to size changes.
- Onboarding slide text area is not scrollable; clamps to 190-330 px.
- Decorative animations ignore reduce-motion.

## GOAL
At 320x568, 360x800 and with Android font size "Largest": nothing clipped, overlapping, or off-screen; every control has a 44x44 dp touch area; decorative motion respects reduce-motion.

## SCOPE
- `src/components/dashboard/player-stats.tsx`, `src/components/dashboard/today-focus.tsx`
- `src/app/onboarding.tsx`, `src/app/leaderboard.tsx` (podium sizing only)
- `src/components/account-sheet.tsx`, `src/components/app-header.tsx`
- `src/app/notes.tsx` (toolbar/targets), `src/app/courses.tsx` (topic rows)
- `src/components/ui/*` (shared button/input if they need min target / font cap)
- `src/theme/theme.ts` (add tokens only; do not remove)
- `src/hooks/use-reduced-motion.ts` (NEW)
- Files with 9-11 px text (grep `fontSize: (9|10|11)`)

## STEPS
1. **Type floor:** raise body/secondary labels from 9-10 to 11-12 px (keep uppercase tracked labels at 11 minimum). Add `maxFontSizeMultiplier={1.3}` to chrome (badges, chips, podium, header, tab-like labels) and to any text inside a fixed-height container. Prose paragraphs keep scaling normally.
2. **PlayerStats:** allow wrapping (`flexWrap: "wrap"` + `rowGap`) or stack into a 2-row layout below ~380 dp using `useWindowDimensions()`. Skeletons must follow the same layout.
3. **TodayFocus:** put header actions on their own wrapping row on narrow widths; title may use `flexShrink: 1` but not collapse to zero.
4. **Touch targets:** every `Pressable` that is icon-only or small gets `minWidth/minHeight: 44` (or total hitSlop reaching 44) without changing the visible icon size. Cover: notes toolbar, topic status/delete rows, app header buttons, 32 px close buttons, friends action buttons, drawer rows.
5. **Window size:** replace module-scope `Dimensions.get("window")` in `account-sheet.tsx` with `useWindowDimensions()` (compute hidden offset inside the component).
6. **Onboarding:** make the slide text block scrollable or let the visual shrink further when height is tight; verify at 320x568 and font scale 1.5 that title, subtitle, dots and CTA are all visible.
7. **Podium and fixed-height badges:** use `minHeight` instead of `height` where text can grow; cap font growth with the multiplier.
8. **Contrast:** write a small script (can be a one-off in `/tmp`, not committed) that computes WCAG contrast for the muted text tokens (`w30`, `w35`, `w40`, etc.) against the actual backgrounds. For any pair < 4.5:1 at body sizes, raise the token minimally and report old/new values. Keep the same visual hierarchy.
9. **Reduce motion:** create `useReducedMotion()` (wraps `AccessibilityInfo.isReduceMotionEnabled` + change listener). Gate decorative loops (onboarding floats, leaderboard shine, splash zoom, confetti) behind it. Functional transitions stay.
10. **A11y state:** add `accessibilityRole`/`accessibilityState` (`selected`, `checked`, `disabled`) and labels for icon-only controls on topic rows, quiz options, roadmap node taps, note toolbar.

## DO NOT
- Redesign cards or change brand colors beyond the minimal contrast fix.
- Touch navigation or data logic.

## ACCEPTANCE
- Report includes a table of every component changed and its before/after behavior at 320 dp.
- No horizontal overflow at 320 dp or font scale 1.3; no clipped labels.
- No icon-only control under 44x44 dp (list any you intentionally left).
- Reduce-motion on => decorative loops stopped.

## USER TEST (Zain karega)
1. Settings > Display > Font size: "Largest" karo, phir Dashboard, Leaderboard, Friends, Onboarding (naya install ya app data clear) dekho: text kata/overlap to nahi?
2. Agar chhota phone/emulator hai to wahan Dashboard dekho (streak/rank dab to nahi rahe).
3. Notes toolbar aur courses ke topic icons ko ungli se tap karo: ek hi tap mein lagte hain?
4. Settings > Accessibility > "Remove animations" on karo: onboarding/leaderboard ki shine ruk gayi?
