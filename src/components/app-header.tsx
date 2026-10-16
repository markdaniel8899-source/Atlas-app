import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, Menu } from "lucide-react-native";
import { AccountSheet } from "./account-sheet";
import { colors, fonts } from "../theme/theme";

const APP_ICON = require("../../assets/icon.png");

/** Fixed inner height of the header bar (below the status bar). */
export const HEADER_HEIGHT = 76;

interface AppHeaderProps {
  title: string;
  onMenuPress: () => void;
  avatarUrl?: string | null;
  onAccountPress?: () => void;
}

export function AppHeader({
  title,
  onMenuPress,
  avatarUrl,
  onAccountPress,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const [accountOpen, setAccountOpen] = useState(false);
  const handleAccountPress = onAccountPress ?? (() => setAccountOpen(true));

  const inner = (
    <View style={styles.inner}>
      <View style={styles.left}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open navigation"
          onPress={onMenuPress}
          hitSlop={6}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Menu size={22} color={colors.w60} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Account menu"
        onPress={handleAccountPress}
        hitSlop={6}
        style={({ pressed }) => [styles.account, pressed && styles.pressed]}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <Image
            source={APP_ICON}
            style={styles.avatar}
            contentFit="cover"
            accessibilityLabel="ATLAS profile"
          />
        )}
        <ChevronDown size={16} color={colors.w40} />
      </Pressable>
    </View>
  );

  const bar =
    Platform.OS === "android" ? (
      <View
        style={[styles.header, styles.headerAndroid, { paddingTop: insets.top }]}
      >
        {inner}
      </View>
    ) : (
      <BlurView
        intensity={20}
        tint="dark"
        style={[styles.header, { paddingTop: insets.top }]}
      >
        {inner}
      </BlurView>
    );

  return (
    <>
      {bar}
      {onAccountPress ? null : (
        <AccountSheet
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          avatarUrl={avatarUrl}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    backgroundColor: colors.w03,
    borderBottomWidth: 1,
    borderBottomColor: colors.w05,
    overflow: "hidden",
  },
  headerAndroid: {
    backgroundColor: "rgba(9,9,17,0.88)",
  },
  inner: {
    height: HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    marginLeft: 12,
    fontSize: 17,
    fontFamily: fonts.medium,
    letterSpacing: -0.34,
    color: colors.white,
    flexShrink: 1,
  },
  account: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
  },
});
