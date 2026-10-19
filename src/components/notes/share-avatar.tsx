import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { pngAvatarUrl } from "../../lib/dicebear";
import { colors, fonts } from "../../theme/theme";

interface ShareAvatarProps {
  name: string;
  avatarUrl?: string | null;
  initials?: string;
  gradient?: readonly [string, string];
  size?: number;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function ShareAvatar({
  name,
  avatarUrl,
  initials,
  gradient,
  size = 40,
}: ShareAvatarProps) {
  const uri = pngAvatarUrl(avatarUrl ?? null);
  const label = initials?.trim() || initialsOf(name);
  const radius = size / 2;

  return (
    <View
      style={[
        styles.shell,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: radius }}
        />
      ) : (
        <LinearGradient
          colors={gradient ?? [colors.avatarFrom, colors.avatarTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        >
          <View style={styles.initialsWrap}>
            <Text style={[styles.initials, { fontSize: size * 0.34 }]}>
              {label}
            </Text>
          </View>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: "hidden",
    backgroundColor: colors.w04,
  },
  initialsWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: fonts.semibold,
    color: colors.white,
  },
});
