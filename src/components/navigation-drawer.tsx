import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
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
} from "lucide-react-native";
import { colors, ease, fonts } from "../theme/theme";

const DRAWER_WIDTH = 240;

const BRAND_ICON = require("../../assets/formicon.png");

const HALO_INSETS = [2, 4, 6, 8, 10, 12, 14, 16];

type NavRoute =
  | "/"
  | "/roadmap"
  | "/courses"
  | "/notes"
  | "/quiz"
  | "/timer"
  | "/friends"
  | "/leaderboard"
  | "/assistant"
  | "/settings";

interface NavItem {
  label: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  route?: NavRoute;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, route: "/" },
  { label: "Roadmap", icon: Map, route: "/roadmap" },
  { label: "Courses", icon: GraduationCap, route: "/courses" },
  { label: "Notes", icon: FileText, route: "/notes" },
  { label: "Quiz", icon: ListChecks, route: "/quiz" },
  { label: "Timer", icon: Timer, route: "/timer" },
  { label: "Friends", icon: Users, route: "/friends" },
  { label: "Leaderboard", icon: Trophy, route: "/leaderboard" },
  { label: "Assistant", icon: Sparkles, route: "/assistant" },
  { label: "Settings", icon: Settings, route: "/settings" },
];

interface NavigationDrawerProps {
  open: boolean;
  onClose: () => void;
  activeLabel?: string;
}

export function NavigationDrawer({
  open,
  onClose,
  activeLabel = "Dashboard",
}: NavigationDrawerProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

  const panelBody = (
    <>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close navigation"
          onPress={onClose}
          hitSlop={8}
          style={styles.closeButton}
        >
          <ArrowLeft size={20} color={colors.w60} />
        </Pressable>

        <View style={styles.logo} pointerEvents="none">
          <Image source={BRAND_ICON} style={styles.logoIcon} />
          <Text style={styles.logoText}>ATLAS</Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navList}
        showsVerticalScrollIndicator={false}
      >
        {NAV_ITEMS.map((item) => {
          const active = item.label === activeLabel;
          const Icon = item.icon;
          return (
            <View key={item.label} style={styles.itemWrap}>
              {active
                ? HALO_INSETS.map((inset) => (
                    <View
                      key={inset}
                      pointerEvents="none"
                      style={[
                        styles.halo,
                        {
                          top: -inset,
                          bottom: -inset,
                          left: -inset,
                          right: -inset,
                          borderRadius: 16 + inset,
                        },
                      ]}
                    />
                  ))
                : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={item.label}
                onPress={() => {
                  onClose();
                  if (!item.route || item.label === activeLabel) return;
                  // navigate() reuses the screen if it is already in the
                  // stack and pops back to it — no duplicate instances, no
                  // remount-refetch churn on every tab switch.
                  router.navigate(item.route);
                }}
                style={({ pressed }) => [
                  styles.item,
                  active ? styles.itemActive : styles.itemIdle,
                  pressed && !active ? styles.itemPressed : null,
                ]}
              >
                <Icon size={22} color={active ? colors.white : colors.w50} />
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
            </View>
          );
        })}
      </ScrollView>
    </>
  );

  const panelInsets = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close navigation"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panelWrap,
          {
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
        {Platform.OS === "android" ? (
          <View style={[styles.panel, panelInsets]}>{panelBody}</View>
        ) : (
          <BlurView intensity={60} tint="dark" style={[styles.panel, panelInsets]}>
            {panelBody}
          </BlurView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 50,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  panelWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
  },
  panel: {
    flex: 1,
    backgroundColor: "rgba(17,17,26,0.97)",
    borderRightWidth: 1,
    borderRightColor: colors.w05,
    overflow: "hidden",
  },
  headerRow: {
    height: 64,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.w05,
  },
  logo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoIcon: {
    width: 26,
    height: 26,
  },
  logoText: {
    fontSize: 22,
    fontFamily: fonts.brand,
    letterSpacing: 2,
    color: colors.white,
  },
  headerSpacer: {
    width: 40,
  },
  closeButton: {
    width: 40,
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
  },
  navScroll: {
    flex: 1,
  },
  navList: {
    padding: 16,
    gap: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
  },
  itemWrap: {
    position: "relative",
  },
  halo: {
    position: "absolute",
    backgroundColor: "rgba(207,158,255,0.025)",
  },
  itemIdle: {
    borderColor: "transparent",
  },
  itemActive: {
    borderColor: colors.lilac25,
    backgroundColor: "#241f31",
    shadowColor: colors.lilac50,
    shadowOpacity: 0.7,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  itemPressed: {
    backgroundColor: colors.w04,
  },
  itemText: {
    flexShrink: 1,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.w50,
  },
  itemTextActive: {
    color: colors.white,
  },
});
