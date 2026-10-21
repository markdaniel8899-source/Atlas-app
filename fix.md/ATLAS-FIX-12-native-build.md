# FIX-12 — Native-build batch (new APK required)

## RULES (read first)
- Sirf isi batch ka kaam. Scope ke bahar kuch nahi chhuna; kuch nazar aaye to `NOTES.md` mein likho.
- Is batch mein (sirf isi mein) `npx expo install` se dependency add/remove allowed hai jahan neeche likha ho. `eas build/update` aur `git push` phir bhi mana.
- End par `npx tsc --noEmit` aur `npx expo lint` pass hon.
- Sirf ek commit: `chore: native config, dependency cleanup, optional crash reporting`
- Code bayan se alag nikle to wo step ruko aur report mein likho.
- Final report: files changed, kya badla, kaise verify, risks, **exact build command**.

## CONTEXT (audit: ARC-05, REL-04, section 8 of 04-security-review)
These items change native configuration or native modules, so they cannot go out via OTA. Zain will run `eas build --platform android --profile production` himself after this batch. This is APK only (no Play Store/iOS work).

## GOAL
One clean APK build that disables Android auto-backup of private local data, drops unused native modules, bumps the version code, and (optionally) reports crashes.

## SCOPE
- `app.json`, `eas.json`, `package.json`, `package-lock.json`
- `babel.config.js` (only if it references a removed package)
- `src/lib/monitoring.ts` (NEW, only for the Sentry step)
- `src/app/_layout.tsx` (only to call `initMonitoring()`)
- `assets/mobile icon.png` (delete)

## STEPS
1. **Backup:** set `android.allowBackup: false` in `app.json` (notes queue and cached data live in AsyncStorage and must not be restored from cloud backup onto another install).
2. **Version:** bump `android.versionCode` by 1 (currently 5 => 6). Keep `version` and `runtimeVersion` policy unchanged unless a native change requires otherwise; explain if you change anything.
3. **Unused deps:** run `npm ls react-native-reanimated react-native-worklets` and grep `src/`, `babel.config.js`, `app.json` plugins. If nothing depends on them (no importer, no babel plugin, no peer requirement from another installed package), remove both with `npx expo uninstall`. If anything depends on them, **keep them** and say exactly why.
4. **Unused asset:** delete `assets/mobile icon.png` after confirming nothing references it.
5. **Optional crash reporting (Sentry):** implement ONLY as a guarded integration:
   - Add `@sentry/react-native` via `npx expo install @sentry/react-native` and its Expo plugin entry.
   - `src/lib/monitoring.ts`: `initMonitoring()` initializes Sentry **only if** `process.env.EXPO_PUBLIC_SENTRY_DSN` is set; otherwise does nothing. `beforeSend` scrubs: request bodies, emails, tokens, note/quiz/chat text. Disable breadcrumbs for network payloads. `sendDefaultPii: false`.
   - In `eas.json` production env set `SENTRY_DISABLE_AUTO_UPLOAD=true` so the build does not need an auth token.
   - If this causes any config or dependency conflict, **skip Sentry entirely**, keep the rest of the batch, and report the reason. The app must build and run without a DSN.
6. Run `npx expo config --type prebuild` (or `npx expo-doctor` if available) and report warnings.

## DO NOT
- Touch iOS config, `aab` build type, Play Store metadata, or account deletion (intentionally out of scope).
- Change versions of Expo/RN/React.

## ACCEPTANCE
- `app.json` shows `allowBackup: false` and the bumped `versionCode`.
- `package.json` no longer lists removed packages (or the report explains why they stayed).
- `tsc` and lint pass; `expo config` resolves without errors.

## USER TEST (Zain karega — build ke baad)
1. `eas build --platform android --profile production` chalao; naya APK install karo (purane ke upar).
2. Login ho jaye aur data wahi ho (backup off karne se purana data nahi jata).
3. Widgets add karo (picker mein preview image aani chahiye), notification test: session shuru karo, app band, end time par notification.
4. Notes offline likho -> online: sync.
5. Agar Sentry DSN banaya (sentry.io free) to EAS env mein `EXPO_PUBLIC_SENTRY_DSN` set karo aur build se pehle mujhe batao.
