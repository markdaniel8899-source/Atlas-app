import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "atlas.onboarding.seen.v1";

/**
 * TEMP (design review): when true, onboarding is shown once per app launch
 * regardless of auth state or the seen flag. Flip to false to finalize the
 * one-time first-launch flow.
 */
export const FORCE_ONBOARDING_FOR_TESTING = true;

export async function hasSeenOnboarding(): Promise<boolean> {
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
