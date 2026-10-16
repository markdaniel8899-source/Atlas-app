import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme/theme";

export function InfoSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
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
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    letterSpacing: -0.3,
    color: colors.white,
  },
  subheading: {
    marginTop: 14,
    fontSize: 13.5,
    fontFamily: fonts.semibold,
    color: colors.w75,
  },
  paragraph: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.regular,
    color: colors.w60,
  },
  list: {
    marginTop: 12,
    gap: 8,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 10,
  },
  bulletDot: {
    marginTop: 9,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.lilac50,
  },
  bulletText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.regular,
    color: colors.w60,
  },
});
