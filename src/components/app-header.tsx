import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  BellRing,
  ChevronDown,
  ArrowLeft,
  Menu,
} from "lucide-react-native";
import { AccountSheet } from "./account-sheet";
import { NotificationsSheet } from "./notifications-sheet";
import { PressScale } from "./ui/press-scale";
import { pngAvatarUrl } from "../lib/dicebear";
import { useUnreadCount } from "../lib/notification-center";
import { colors, fonts } from "../theme/theme";

const APP_ICON = require("../../assets/icon.png");

/** Fixed inner height of the header bar (below the status bar). */
export const HEADER_HEIGHT = 76;

interface AppHeaderProps {
  title: string;
  onMenuPress: () => void;
  /** When provided, the leading button becomes a back arrow. */
  onBackPress?: () => void;
  avatarUrl?: string | null;
  onAccountPress?: () => void;
  /** Public info pages hide the bell (no signed-in inbox to show). */
  showNotifications?: boolean;
}

export function AppHeader({
  title,
  onMenuPress,
  onBackPress,
  avatarUrl,
  onAccountPress,
  showNotifications = true,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unread = useUnreadCount();
  const handleAccountPress = onAccountPress ?? (() => setAccountOpen(true));
  const resolvedAvatar = pngAvatarUrl(avatarUrl ?? null);

  const inner = (
    <View style={styles.inner}>
      <View style={styles.left}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={onBackPress ? "Go back" : "Open navigation"}
          onPress={onBackPress ?? onMenuPress}
          hitSlop={6}
          scaleTo={0.92}
          style={styles.iconButton}
        >
          {onBackPress ? (
            <ArrowLeft size={22} color={colors.w60} />
          ) : (
            <Menu size={22} color={colors.w60} />
          )}
        </PressScale>
        <Text
          style={styles.title}
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
        >
          {title}
        </Text>
      </View>

      <View style={styles.right}>
        {showNotifications ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={
              unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
            }
            onPress={() => setNotificationsOpen(true)}
            hitSlop={6}
            scaleTo={0.92}
            style={styles.bellButton}
          >
            {unread > 0 ? (
              <BellRing size={21} color={colors.lilac} />
            ) : (
              <Bell size={21} color={colors.w60} />
            )}
            {unread > 0 ? (
              <View style={styles.bellBadge}>
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1}
                  style={styles.bellBadgeText}
                >
                  {unread > 9 ? "9+" : unread}
                </Text>
              </View>
            ) : null}
          </PressScale>
        ) : null}

        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Account menu"
          onPress={handleAccountPress}
          hitSlop={6}
          scaleTo={0.94}
          style={styles.account}
        >
          {resolvedAvatar ? (
            <Image
              source={{ uri: resolvedAvatar }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={resolvedAvatar}
              transition={0}
              accessibilityLabel="Your profile picture"
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
        </PressScale>
      </View>
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
      {showNotifications ? (
        <NotificationsSheet
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
        />
      ) : null}
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
    minWidth: 44,
    minHeight: 44,
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
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
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  bellButton: {
    width: 40,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: 6,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lilac,
    shadowColor: colors.lilac,
    shadowOpacity: 0.75,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  bellBadgeText: {
    fontSize: 9,
    fontFamily: fonts.semibold,
    color: "#0a0a12",
  },
  account: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
  },
});
