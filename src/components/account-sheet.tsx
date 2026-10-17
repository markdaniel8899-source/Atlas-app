import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronRight,
  FileText,
  Flame,
  Info,
  LifeBuoy,
  LogOut,
  Mail,
  Shield,
  Star,
  X,
  Zap,
} from "lucide-react-native";
import { resolveSession, signOut } from "../lib/auth";
import { fetchProfile } from "../lib/db/profile";
import { pngAvatarUrl } from "../lib/dicebear";
import { PROFILE_CHANGED_EVENT, listen } from "../lib/events";
import type { Profile } from "../lib/db/types";
import { colors, ease, fonts } from "../theme/theme";

const APP_ICON = require("../../assets/icon.png");

type InfoRoute = "/about" | "/help" | "/privacy" | "/terms" | "/contact";

interface NavItem {
  label: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  route: InfoRoute;
}

const NAV_ITEMS: NavItem[] = [
  { label: "About Us", icon: Info, route: "/about" },
  { label: "Help & Support", icon: LifeBuoy, route: "/help" },
  { label: "Privacy Policy", icon: Shield, route: "/privacy" },
  { label: "Terms & Conditions", icon: FileText, route: "/terms" },
  { label: "Contact Us", icon: Mail, route: "/contact" },
];

interface AccountSheetProps {
  open: boolean;
  onClose: () => void;
  /** Avatar shown in the header, used until the profile loads. */
  avatarUrl?: string | null;
}

export function AccountSheet({ open, onClose, avatarUrl }: AccountSheetProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const anim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(open);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) {
      setRendered(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 320,
        easing: ease,
        useNativeDriver: true,
      }).start();
    } else if (rendered) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 240,
        easing: ease,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [open, rendered, anim]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = () => {
      void (async () => {
        const user = await resolveSession();
        if (!active || !user) return;
        setName(user.name);
        const next = await fetchProfile(user.id);
        if (active) setProfile(next);
      })();
    };
    load();
    const unsubscribe = listen(PROFILE_CHANGED_EVENT, load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [open]);

  const handleClose = () => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 240,
      easing: ease,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setRendered(false);
        onClose();
      }
    });
  };

  const go = (route: InfoRoute) => {
    handleClose();
    router.push(route);
  };

  const handleLogOut = async () => {
    handleClose();
    await signOut();
    router.replace("/login");
  };

  const displayName =
    profile?.display_name?.trim() || name.trim() || "Explorer";
  const username = profile?.username?.trim() ?? "";
  const avatarSource =
    pngAvatarUrl(avatarUrl ?? null) ??
    pngAvatarUrl(profile?.avatar_url ?? null) ??
    APP_ICON;
  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;
  const streak = profile?.streak ?? 0;

  if (!rendered) return null;

  const body = (
    <>
      <View style={styles.handleWrap}>
        <View style={styles.handle} />
      </View>

      <View style={styles.userRow}>
        <Image source={avatarSource} style={styles.avatar} contentFit="cover" />
        <View style={styles.userText}>
          <Text numberOfLines={1} style={styles.userName}>
            {displayName}
          </Text>
          {username ? (
            <Text numberOfLines={1} style={styles.userHandle}>
              @{username}
            </Text>
          ) : null}
          <View style={styles.chipRow}>
            <View style={styles.statChip}>
              <Star size={11} color={colors.lilac} />
              <Text style={styles.statChipText}>Level {level}</Text>
            </View>
            <View style={styles.statChip}>
              <Zap size={11} color={colors.star} />
              <Text style={styles.statChipText}>{xp} XP</Text>
            </View>
            <View style={styles.statChip}>
              <Flame size={11} color="#fda4af" />
              <Text style={styles.statChipText}>{streak}d streak</Text>
            </View>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close account menu"
          onPress={handleClose}
          hitSlop={8}
          style={styles.closeButton}
        >
          <X size={18} color={colors.w45} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => go(item.route)}
              style={({ pressed }) => [
                styles.navItem,
                pressed && styles.navItemPressed,
              ]}
            >
              <View style={styles.navIcon}>
                <Icon size={16} color={colors.w60} />
              </View>
              <Text numberOfLines={1} style={styles.navLabel}>
                {item.label}
              </Text>
              <ChevronRight size={14} color={colors.w30} />
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.logoutWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          onPress={() => void handleLogOut()}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutPressed,
          ]}
        >
          <LogOut size={16} color="#fecdd3" />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close account menu"
            onPress={handleClose}
            style={[StyleSheet.absoluteFill, styles.backdrop]}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              paddingBottom: insets.bottom + 16,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [480, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {Platform.OS === "android" ? (
            body
          ) : (
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill}>
              {body}
            </BlurView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  panel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: "rgba(17,17,26,0.98)",
    overflow: "hidden",
    maxHeight: "86%",
  },
  handleWrap: {
    paddingTop: 10,
    alignItems: "center",
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.w15,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.w06,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
  },
  userText: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    letterSpacing: -0.5,
    color: colors.white,
  },
  userHandle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  chipRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statChipText: {
    fontSize: 10.5,
    fontFamily: fonts.medium,
    color: colors.w60,
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  scroll: {
    flexGrow: 0,
  },
  list: {
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.w07,
    backgroundColor: colors.w03,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  navItemPressed: {
    backgroundColor: colors.w06,
    borderColor: colors.lilac25,
  },
  navIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: colors.w75,
  },
  logoutWrap: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.35)",
    backgroundColor: "rgba(244,63,94,0.10)",
    paddingVertical: 13,
  },
  logoutPressed: {
    backgroundColor: "rgba(244,63,94,0.18)",
  },
  logoutText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: "#fecdd3",
  },
});
