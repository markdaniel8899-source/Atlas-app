import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WifiOff } from "lucide-react-native";
import { HEADER_HEIGHT } from "./app-header";
import { subscribeNetwork } from "../lib/net";
import { fonts } from "../theme/theme";

/**
 * Floating "no internet" pill shown under the header while the device is
 * offline. Ambient awareness on top of the per-action ensureOnline guards.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => subscribeNetwork((online) => setOffline(!online)), []);

  if (!offline) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.banner, { top: insets.top + HEADER_HEIGHT + 6 }]}
    >
      <WifiOff size={13} color="#fda4af" />
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(253,164,175,0.35)",
    backgroundColor: "rgba(45,18,28,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 30,
  },
  text: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "#fda4af",
  },
});
