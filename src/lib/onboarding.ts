import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * v2 (2026-10-17): key bumped when onboarding was re-enabled for launch.
 * Pre-release test devices that had stored the v1 flag will see the
 * onboarding once more; a real first install starts empty (key absent).
 */
const KEY = "atlas.onboarding.seen.v2";

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
