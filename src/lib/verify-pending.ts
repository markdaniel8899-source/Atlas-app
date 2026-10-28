import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The Supabase project currently has "Confirm email" disabled, so a new
 * account can sign in with its password before the OTP step is completed.
 * This device-local marker keeps the app's signup flow honest: a fresh
 * account must finish the 6-digit verification before the login form accepts
 * it again. Clearing happens once the code is verified (or the email is
 * recovered), so a verification done on the website is not remembered here.
 */
const KEY = "atlas.auth.pending-verification.v1";

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export async function markPendingVerification(email: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, normalize(email));
  } catch {
    // Storage is best-effort; the flow still works when it is unavailable.
  }
}

export async function isPendingVerification(email: string): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    return stored !== null && stored === normalize(email);
  } catch {
    return false;
  }
}

export async function clearPendingVerification(email?: string): Promise<void> {
  try {
    if (email) {
      const stored = await AsyncStorage.getItem(KEY);
      if (stored !== null && stored !== normalize(email)) return;
    }
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up.
  }
}
