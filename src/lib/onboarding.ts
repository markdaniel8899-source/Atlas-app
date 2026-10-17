import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "atlas.onboarding.seen.v1";

/**
 * TEMP (2026-10-17): onboarding stays out of the launch flow while the
 * on-device display issue is debugged. Flip to false to re-enable the
 * one-time first-launch gate (hasSeenOnboarding).
 */
export const SKIP_ONBOARDING_FOR_NOW = true;

export async function hasSeenOnboarding(): Promise<boolean> {
  if (SKIP_ONBOARDING_FOR_NOW) return true;
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, "1");
  } catch {
    // Non-fatal: worst case onboarding shows again next launch.
  }
}
