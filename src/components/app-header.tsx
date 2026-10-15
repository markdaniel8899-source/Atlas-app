import { Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, Menu } from "lucide-react-native";
import { colors, fonts } from "../theme/theme";

interface AppHeaderProps {
  title: string;
  onMenuPress: () => void;
  avatarUrl?: string | null;
  initials?: string;
  onAccountPress?: () => void;
}

export function AppHeader({
  title,
  onMenuPress,
  avatarUrl,
  initials = "A",
  onAccountPress,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={30}
      tint="dark"
      blurMethod="dimezisBlurView"
      style={[styles.header, { paddingTop: insets.top }]}
    >
      <View style={styles.inner}>
        <View style={styles.left}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open navigation"
            onPress={onMenuPress}
            hitSlop={6}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Menu size={20} color={colors.w60} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account menu"
          onPress={onAccountPress}
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
            <LinearGradient
              colors={[colors.avatarFrom, colors.avatarTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.avatar, styles.avatarFallback]}
            >
              <Text style={styles.initials}>{initials}</Text>
            </LinearGradient>
          )}
          <ChevronDown size={14} color={colors.w40} />
        </Pressable>
      </View>
    </BlurView>
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
  inner: {
    height: 64,
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
    fontSize: 16,
    fontFamily: fonts.medium,
    letterSpacing: -0.32,
    color: colors.white,
    flexShrink: 1,
  },
  account: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
});
