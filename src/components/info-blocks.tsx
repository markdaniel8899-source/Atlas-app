import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { useBlurTargetRef } from "./blur-target";
import { colors, fonts } from "../theme/theme";

export function InfoSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const blurTarget = useBlurTargetRef();

  return (
    <View style={styles.section}>
      <BlurView
        intensity={18}
        tint="dark"
        blurMethod="dimezisBlurViewSdk31Plus"
        blurTarget={blurTarget ?? undefined}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.sectionHead}>
        <View style={styles.sectionAccent} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export function InfoSubheading({ children }: { children: ReactNode }) {
  return <Text style={styles.subheading}>{children}</Text>;
}

export function InfoParagraph({ children }: { children: ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

export function InfoBullets({ items }: { items: string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.w06,
    backgroundColor: "rgba(255,255,255,0.025)",
    paddingHorizontal: 18,
    paddingVertical: 18,
    overflow: "hidden",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionAccent: {
    width: 3,
    height: 16,
    borderRadius: 999,
    backgroundColor: colors.lilac50,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.semibold,
    letterSpacing: -0.3,
    color: colors.white,
  },
  subheading: {
    marginTop: 16,
    fontSize: 13.5,
    fontFamily: fonts.semibold,
    letterSpacing: 0.1,
    color: colors.w75,
  },
  paragraph: {
    marginTop: 10,
    fontSize: 14.5,
    lineHeight: 23,
    fontFamily: fonts.regular,
    color: colors.w60,
  },
  list: {
    marginTop: 12,
    gap: 10,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 10,
  },
  bulletDot: {
    marginTop: 10,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.lilac50,
  },
  bulletText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14.5,
    lineHeight: 23,
    fontFamily: fonts.regular,
    color: colors.w60,
  },
});
