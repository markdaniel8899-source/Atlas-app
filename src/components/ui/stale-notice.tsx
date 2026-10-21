import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../theme/theme";

interface StaleNoticeProps {
  visible: boolean;
  onRetry: () => void;
  retrying?: boolean;
}

export function StaleNotice({ visible, onRetry, retrying }: StaleNoticeProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Showing saved data - couldn&apos;t refresh</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry refresh"
        onPress={onRetry}
        disabled={retrying}
        style={({ pressed }) => [
          styles.retry,
          retrying && styles.retryDisabled,
          pressed && styles.retryPressed,
        ]}
      >
        <Text style={styles.retryText}>{retrying ? "Retrying..." : "Retry"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  retry: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  retryPressed: {
    opacity: 0.8,
  },
  retryDisabled: {
    opacity: 0.6,
  },
  retryText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.lilac,
  },
});