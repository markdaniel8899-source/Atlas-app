# FIX-02 — Keyboard hides fields/buttons (login first, then every form)

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- No new dependency, no `eas build/update`, no `git push`.
- Look/colors/copy mat badlo.
- End par `npx tsc --noEmit` aur `npx expo lint` pass hon.
- Sirf ek commit: `fix: keep focused inputs and submit buttons above the keyboard`
- Code bayan se alag nikle to wo step ruko aur report mein likho.
- Final report: files changed, kya badla, kaise verify, risks, phone test.

## CONTEXT
RN 0.86 enforces edge-to-edge on Android, so `softwareKeyboardLayoutMode: "resize"` does not shrink the window; the IME overlays it. `login.tsx` uses `KeyboardAvoidingView behavior={undefined}` on Android and a plain `ScrollView` with no bottom padding or scroll-into-view, so the last field and the submit button end up behind the keyboard. `ScreenShell` already solves this with a keyboard-height listener (`src/components/screen-shell.tsx`, around lines 83-99 and 121-132). See `audit/02-transitions-and-keyboard-rca.md` Part 2.

## GOAL
Every focused text field and the primary action are visible above the keyboard on Android and iOS, in all 5 auth modes first, then every other form that lacks handling.

## SCOPE
- `src/app/login.tsx`
- `src/hooks/use-keyboard-height.ts` (NEW)
- `src/app/settings.tsx`
- `src/components/courses/course-editor-modal.tsx`
- `src/components/quiz/quiz-setup.tsx`, `src/components/roadmap/roadmap-builder.tsx` (only if they lack handling)
- `src/components/screen-shell.tsx` (only to reuse the new hook; behavior must stay identical)

## STEPS
1. Create `src/hooks/use-keyboard-height.ts`: returns current keyboard height using `Keyboard.addListener("keyboardDidShow" | "keyboardDidHide")` (use `keyboardWillShow/Hide` on iOS), removes listeners on unmount. Copy the exact logic ScreenShell uses so behavior matches.
2. Inventory first (put it in the report): list every screen/modal with `TextInput`/`ThemedInput` and say whether it already handles the keyboard (ScreenShell `scrollOnKeyboard`) or not. Fix only the ones that do not.
3. `login.tsx`:
   - Use the hook. Add `paddingBottom: insets.bottom + 32 + keyboardHeight` (same formula as ScreenShell) to the ScrollView `contentContainerStyle`.
   - Keep `keyboardShouldPersistTaps="handled"`, add `keyboardDismissMode="on-drag"`.
   - Create a ScrollView ref. On focus of the lower fields (password, confirm password, OTP area), after ~200 ms call `scrollRef.current?.scrollToEnd({ animated: true })`.
   - Chain the keyboard action key: email -> password -> confirm; last field `returnKeyType="done"` and `onSubmitEditing` triggers the same submit handler as the button (respect existing validation and disabled state).
   - Remove the iOS-only reliance: keep `KeyboardAvoidingView behavior="padding"` for iOS, leave Android `undefined`, since the manual padding now covers Android.
   - Verify all 5 modes: login, signup, verify (OTP auto-submit on 6th digit must still work), forgot, reset.
4. `settings.tsx`: apply the same padding + scroll-into-view for the username/display-name fields (or reuse ScreenShell's `scrollOnKeyboard` if the screen uses ScreenShell).
5. Modals with inputs (`course-editor-modal`, any quick-start/share modal with a text input): Android modals are also edge-to-edge; add keyboard-height bottom padding to the modal's scroll content so the focused field and save button are reachable.
6. Do not change `app.json` (`softwareKeyboardLayoutMode` stays).

## DO NOT
- Install `react-native-keyboard-controller` (native, out of scope).
- Redesign the login layout.

## ACCEPTANCE
- On a 360x800 Android screen, focusing the last field in signup keeps that field and the submit button visible (or one short scroll away) with the keyboard open.
- No layout jump when the keyboard opens; brand/title stay stable.
- Hardware back closes the keyboard first.
- OTP 6th digit still auto-submits.

## USER TEST (Zain karega)
1. Signup: har field par tap karo, aakhri field bharte waqt form upar aana chahiye aur "Create account" button nazar aaye.
2. Login, Forgot password, OTP (code paste karo), Reset password: sab mein check.
3. Settings: username aur display name edit karo.
4. Courses: naya course banao (modal), aakhri field aur Save button dekho.
5. Chhoti screen / bara font (Settings > Display > Font size Largest) ke saath ek dafa dobara signup.
