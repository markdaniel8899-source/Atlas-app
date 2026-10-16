import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Check, RefreshCw, Sparkles, X } from "lucide-react-native";
import {
  DEFAULT_DICEBEAR_STYLE,
  DICEBEAR_STYLES,
  generateAvatarCandidates,
  baseSeedFor,
} from "../../lib/dicebear";
import type { DiceBearStyle } from "../../lib/dicebear";
import { colors, fonts } from "../../theme/theme";

interface AvatarPickerModalProps {
  open: boolean;
  currentUrl: string | null;
  userId: string;
  onClose: () => void;
  /** Persist the chosen avatar; resolve to false when the save failed. */
  onSelect: (url: string) => Promise<boolean>;
}

export function AvatarPickerModal({
  open,
  currentUrl,
  userId,
  onClose,
  onSelect,
}: AvatarPickerModalProps) {
  const [style, setStyle] = useState<DiceBearStyle>(DEFAULT_DICEBEAR_STYLE);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regenerate = (nextStyle: DiceBearStyle) => {
    setCandidates(generateAvatarCandidates(baseSeedFor(userId), nextStyle));
    setSelected(null);
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    regenerate(style);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, style, userId]);

  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    const ok = await onSelect(selected);
    setSaving(false);
    if (!ok) {
      setError("Couldn't save that avatar. Try another one.");
      return;
    }
    onClose();
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close avatar picker"
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.centerWrap}
          pointerEvents="box-none"
        >
          <View
            accessibilityViewIsModal
            accessibilityLabel="Pick an avatar"
            style={styles.panel}
          >
            <View style={styles.header}>
              <View style={styles.headerText}>
                <View style={styles.eyebrowRow}>
                  <Sparkles size={14} color={colors.star} />
                  <Text style={styles.eyebrow}>Edit avatar</Text>
                </View>
                <Text style={styles.title}>Pick your look</Text>
                <Text style={styles.subtitle}>
                  Unique, generated avatars - no upload needed.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close avatar picker"
                onPress={onClose}
                hitSlop={6}
                style={styles.closeButton}
              >
                <X size={16} color={colors.w40} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.styleRow}>
                {DICEBEAR_STYLES.map((entry) => {
                  const active = style === entry.id;
                  return (
                    <Pressable
                      key={entry.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setStyle(entry.id)}
                      style={[styles.styleChip, active && styles.styleChipActive]}
                    >
                      <Text
                        style={[
                          styles.styleChipText,
                          active && styles.styleChipTextActive,
                        ]}
                      >
                        {entry.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.grid}>
                {candidates.map((url) => {
                  const active = selected === url;
                  const isCurrent = currentUrl === url;
                  return (
                    <Pressable
                      key={url}
                      accessibilityRole="button"
                      accessibilityLabel="Choose this avatar"
                      accessibilityState={{ selected: active }}
                      onPress={() => setSelected(url)}
                      style={[styles.cell, active && styles.cellActive]}
                    >
                      <Image source={{ uri: url }} style={styles.cellImage} />
                      {isCurrent ? (
                        <View style={styles.currentTag}>
                          <Text style={styles.currentTagText}>Current</Text>
                        </View>
                      ) : null}
                      {active ? (
                        <View style={styles.checkBadge}>
                          <Check size={12} color="#0a0a14" strokeWidth={3} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                onPress={() => regenerate(style)}
                style={styles.shuffle}
              >
                <RefreshCw size={14} color={colors.w60} />
                <Text style={styles.shuffleText}>Shuffle</Text>
              </Pressable>

              <View style={styles.footerRight}>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void save()}
                  disabled={!selected || saving}
                  style={[styles.useButton, (!selected || saving) && styles.disabled]}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.primaryText} />
                  ) : (
                    <>
                      <Check size={14} color={colors.primaryText} />
                      <Text style={styles.useText}>Use this avatar</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  panel: {
    width: "100%",
    maxWidth: 576,
    maxHeight: "86%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(10,10,20,0.97)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.95,
    shadowRadius: 45,
    shadowOffset: { width: 0, height: 32 },
    elevation: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    padding: 24,
    paddingBottom: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: fonts.medium,
    letterSpacing: 1.7,
    textTransform: "uppercase",
    color: colors.w45,
  },
  title: {
    marginTop: 8,
    fontSize: 20,
    fontFamily: fonts.semibold,
    letterSpacing: -0.6,
    color: colors.white,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  closeButton: {
    borderRadius: 8,
    padding: 8,
  },
  bodyScroll: {
    flexShrink: 1,
  },
  body: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  styleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  styleChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  styleChipActive: {
    borderColor: "rgba(207,158,255,0.5)",
    backgroundColor: colors.lilac10,
  },
  styleChipText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.w50,
  },
  styleChipTextActive: {
    color: colors.white,
  },
  grid: {
    marginTop: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  cell: {
    width: "21.5%",
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.w10,
    overflow: "hidden",
  },
  cellActive: {
    borderColor: colors.lilac,
    shadowColor: colors.lilac,
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  cellImage: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.w04,
  },
  currentTag: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 2,
    alignItems: "center",
  },
  currentTagText: {
    fontSize: 9,
    fontFamily: fonts.medium,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.w80,
  },
  checkBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: colors.lilac,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.w06,
    padding: 20,
    paddingHorizontal: 24,
  },
  shuffle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  shuffleText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.w60,
  },
  footerRight: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  error: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "rgba(253,164,175,0.85)",
  },
  useButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 11,
    minWidth: 44,
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.4,
  },
  useText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.primaryText,
  },
});
