import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { ComponentType } from "react";
import { Check, ChevronDown } from "lucide-react-native";
import { MOTION } from "../../theme/motion";
import { colors, fonts } from "../../theme/theme";
import { useModalEntrance } from "./modal-transition";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
  icon?: ComponentType<{ size?: number; color?: string }>;
}

interface SelectMenuProps<T extends string> {
  label: string;
  labelIcon?: ComponentType<{ size?: number; color?: string }>;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  /** Locks the control (e.g. while a focus session is running). */
  disabled?: boolean;
}

export function SelectMenu<T extends string>({
  label,
  labelIcon: LabelIcon,
  value,
  options,
  onChange,
  disabled = false,
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const anim = useRef(new Animated.Value(0)).current;
  const chevron = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const pendingPick = useRef<T | null>(null);
  const startOpen = useModalEntrance(anim, open, rendered, MOTION.sheet);

  useEffect(() => {
    if (!open) return;
    closing.current = false;
    if (!rendered) setRendered(true);
  }, [open, rendered]);

  useEffect(() => {
    Animated.timing(chevron, {
      toValue: open ? 1 : 0,
      duration: MOTION.menu,
      easing: MOTION.easing,
      useNativeDriver: true,
    }).start();
  }, [open, chevron]);

  const selected =
    options.find((option) => option.value === value) ?? options[0];
  const SelectedIcon = selected?.icon;

  const close = useCallback((after?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    anim.stopAnimation();
    Animated.timing(anim, {
      toValue: 0,
      duration: MOTION.sheetClose,
      easing: MOTION.easingExit,
      useNativeDriver: true,
    }).start(({ finished }) => {
      closing.current = false;
      if (!finished) return;
      setRendered(false);
      const next = pendingPick.current;
      pendingPick.current = null;
      if (next !== null) onChange(next);
      after?.();
    });
  }, [anim, onChange]);

  const dismiss = useCallback(() => {
    pendingPick.current = null;
    setOpen(false);
    close();
  }, [close]);

  const pick = (next: T) => {
    pendingPick.current = next;
    setOpen(false);
    close();
  };

  return (
    <View>
      <View style={styles.labelRow}>
        {LabelIcon ? <LabelIcon size={12} color={colors.w40} /> : null}
        <Text maxFontSizeMultiplier={1.3} style={styles.label}>
          {label}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? ""}`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.trigger, open && styles.triggerOpen, disabled && styles.disabled]}
      >
        <View style={[styles.iconBox, open && styles.iconBoxOpen]}>
          {SelectedIcon ? (
            <SelectedIcon
              size={16}
              color={open ? colors.lilac : colors.star}
            />
          ) : null}
        </View>
        <View style={styles.triggerText}>
          <Text numberOfLines={1} style={styles.triggerLabel}>
            {selected?.label}
          </Text>
          {selected?.hint ? (
            <Text numberOfLines={1} style={styles.triggerHint}>
              {selected.hint}
            </Text>
          ) : null}
        </View>
        <Animated.View
          style={{
            transform: [
              {
                rotate: chevron.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "180deg"],
                }),
              },
            ],
          }}
        >
          <ChevronDown size={16} color={open ? colors.lilac : colors.w35} />
        </Animated.View>
      </Pressable>

      <Modal
        visible={rendered}
        onShow={startOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={dismiss}
      >
        <View style={styles.modalRoot}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
            <Pressable
              accessibilityLabel="Close options"
              style={[StyleSheet.absoluteFill, styles.backdrop]}
              onPress={dismiss}
            />
          </Animated.View>

          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                opacity: anim,
                transform: [
                  {
                    scale: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text maxFontSizeMultiplier={1.3} style={styles.sheetLabel}>
              {label}
            </Text>
            <ScrollView
              style={[
                styles.sheetScroll,
                { maxHeight: Math.min(420, windowHeight * 0.55) },
              ]}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {options.map((option) => {
                const Icon = option.icon;
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => pick(option.value)}
                    style={[styles.option, active && styles.optionActive]}
                  >
                    <View style={[styles.iconBox, active && styles.iconBoxOpen]}>
                      {Icon ? (
                        <Icon
                          size={16}
                          color={active ? colors.lilac : "rgba(255,255,255,0.45)"}
                        />
                      ) : null}
                    </View>
                    <View style={styles.optionText}>
                      <Text
                        numberOfLines={1}
                        style={[styles.optionLabel, active && styles.optionLabelActive]}
                      >
                        {option.label}
                      </Text>
                      {option.hint ? (
                        <Text numberOfLines={1} style={styles.triggerHint}>
                          {option.hint}
                        </Text>
                      ) : null}
                    </View>
                    {active ? <Check size={16} color={colors.lilac} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.w40,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  triggerOpen: {
    borderColor: "rgba(207,158,255,0.5)",
    backgroundColor: "rgba(207,158,255,0.08)",
  },
  disabled: {
    opacity: 0.5,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxOpen: {
    borderColor: "rgba(207,158,255,0.4)",
    backgroundColor: "rgba(207,158,255,0.15)",
  },
  triggerText: {
    flex: 1,
    minWidth: 0,
  },
  triggerLabel: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  triggerHint: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(10,10,18,0.97)",
    padding: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  sheetLabel: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 6,
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.w40,
  },
  sheetScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  sheetScrollContent: {
    paddingBottom: 2,
  },
  option: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionActive: {
    backgroundColor: "rgba(207,158,255,0.12)",
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w75,
  },
  optionLabelActive: {
    fontFamily: fonts.medium,
    color: colors.white,
  },
});
