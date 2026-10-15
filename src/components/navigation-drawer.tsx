import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Map,
  Settings,
  Sparkles,
  Timer,
  Trophy,
  Users,
  X,
} from "lucide-react-native";
import { colors, ease, fonts } from "../theme/theme";

const DRAWER_WIDTH = 240;

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Roadmap", icon: Map },
  { label: "Courses", icon: GraduationCap },
  { label: "Notes", icon: FileText },
  { label: "Quiz", icon: ListChecks },
  { label: "Timer", icon: Timer },
  { label: "Friends", icon: Users },
  { label: "Leaderboard", icon: Trophy },
  { label: "Assistant", icon: Sparkles },
  { label: "Settings", icon: Settings },
] as const;

interface NavigationDrawerProps {
  open: boolean;
  onClose: () => void;
  activeLabel?: string;
  blurTarget?: RefObject<View | null>;
}

export function NavigationDrawer({
  open,
  onClose,
  activeLabel = "Dashboard",
  blurTarget,
}: NavigationDrawerProps) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    if (open) {
      setRendered(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 350,
        easing: ease,
        useNativeDriver: true,
      }).start();
    } else if (rendered) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 250,
        easing: ease,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [open, rendered, anim]);

  if (!rendered) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close navigation"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
      </Animated.View>

      <BlurView
        intensity={70}
        tint="dark"
        blurMethod="dimezisBlurViewSdk31Plus"
        blurTarget={blurTarget}
        style={[
          styles.panel,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            transform: [
              {
                translateX: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-DRAWER_WIDTH, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.logo}>
            <View style={styles.logoDiamond} />
            <Text style={styles.logoText}>ATLAS</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close navigation"
          onPress={onClose}
          hitSlop={8}
          style={[styles.closeButton, { top: insets.top + 16 }]}
        >
          <X size={16} color={colors.w50} />
        </Pressable>

        <ScrollView
          style={styles.navScroll}
          contentContainerStyle={styles.navList}
          showsVerticalScrollIndicator={false}
        >
          {NAV_ITEMS.map((item) => {
            const active = item.label === activeLabel;
            const Icon = item.icon;
            return (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={item.label}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.item,
                  active ? styles.itemActive : styles.itemIdle,
                  pressed && !active && styles.itemPressed,
                ]}
              >
                <Icon size={16} color={active ? colors.white : colors.w50} />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.itemText,
                    active ? styles.itemTextActive : null,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: "rgba(6,6,14,0.94)",
    borderRightWidth: 1,
    borderRightColor: colors.w05,
    overflow: "hidden",
  },
  headerRow: {
    height: 64,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.w05,
  },
  logo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoDiamond: {
    width: 12,
    height: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(157,180,255,0.8)",
    backgroundColor: "rgba(157,180,255,0.2)",
    transform: [{ rotate: "45deg" }],
  },
  logoText: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    letterSpacing: -0.48,
    color: colors.white,
  },
  closeButton: {
    position: "absolute",
    right: 16,
    zIndex: 2,
    padding: 8,
    borderRadius: 8,
  },
  navScroll: {
    flex: 1,
  },
  navList: {
    padding: 12,
    gap: 6,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemIdle: {
    borderColor: "transparent",
  },
  itemActive: {
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    shadowColor: colors.lilac50,
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  itemPressed: {
    backgroundColor: colors.w04,
  },
  itemText: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w50,
  },
  itemTextActive: {
    color: colors.white,
  },
});
