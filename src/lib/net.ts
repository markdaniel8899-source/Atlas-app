import * as Network from "expo-network";
import { Alert } from "react-native";

/** True when the device reports an active internet connection. */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return (
      state.isConnected === true && state.isInternetReachable !== false
    );
  } catch {
    // The check itself failing is not proof of being offline - let the
    // request decide for itself.
    return true;
  }
}

/**
 * Guard for internet-only actions: returns true when online, otherwise shows
 * an immediate "You are offline" warning and returns false.
 */
export async function ensureOnline(
  message = "Connect to the internet and try again.",
): Promise<boolean> {
  if (await isOnline()) return true;
  Alert.alert("You are offline", message);
  return false;
}

/** Subscribe to connectivity changes (fires once immediately). */
export function subscribeNetwork(
  listener: (online: boolean) => void,
): () => void {
  const apply = (state: Network.NetworkState) => {
    listener(
      state.isConnected === true && state.isInternetReachable !== false,
    );
  };
  const subscription = Network.addNetworkStateListener(apply);
  void Network.getNetworkStateAsync()
    .then(apply)
    .catch(() => undefined);
  return () => subscription.remove();
}
