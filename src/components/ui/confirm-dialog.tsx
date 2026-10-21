import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AlertTriangle, Trash2 } from "lucide-react-native";
import { MOTION } from "../../theme/motion";
import { colors, fonts } from "../../theme/theme";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(open);
  const opening = useRef(false);
  const closing = useRef(false);

  useEffect(() => {
    if (open) {
      if (!rendered) {
        setRendered(true);
        return;
      }
      if (opening.current) return;
      opening.current = true;
      closing.current = false;
      anim.stopAnimation();
      Animated.timing(anim, {
        toValue: 1,
        duration: MOTION.sheet,
        easing: MOTION.easing,
        useNativeDriver: true,
      }).start();
    } else if (rendered && !closing.current) {
      opening.current = false;
      anim.stopAnimation();
      Animated.timing(anim, {
        toValue: 0,
        duration: MOTION.sheetClose,
        easing: MOTION.easing,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [open, rendered, anim]);

  const close = (after: () => void) => {
    if (closing.current) return;
    closing.current = true;
    opening.current = false;
    anim.stopAnimation();
    Animated.timing(anim, {
      toValue: 0,
      duration: MOTION.sheetClose,
      easing: MOTION.easing,
      useNativeDriver: true,
    }).start(({ finished }) => {
      closing.current = false;
      if (!finished) return;
      setRendered(false);
      after();
    });
  };

  const handleCancel = () => close(onCancel);
  const handleConfirm = () => close(onConfirm);

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
          <Pressable
            accessibilityLabel="Cancel"
            style={[StyleSheet.absoluteFill, styles.backdrop]}
            onPress={handleCancel}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.dialog,
            {
              opacity: anim,
              transform: [
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.body}>
            <View style={styles.iconBox}>
              <AlertTriangle size={20} color="#fca5a5" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={handleCancel}
              style={styles.cancel}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleConfirm}
              style={styles.confirm}
            >
              <Trash2 size={16} color={colors.white} />
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  dialog: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "#0a0a12",
    padding: 24,
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  body: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.25)",
    backgroundColor: "rgba(239,68,68,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.w60,
  },
  actions: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancel: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.w70,
  },
  confirm: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "rgba(239,68,68,0.9)",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  confirmText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
});
