import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MOTION } from "../theme/motion";
import { colors, fonts } from "../theme/theme";

const CONSENT_KEY = "atlas.ai.consent.v1";

interface AiConsentModalProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function AiConsentModal({ open, onAccept, onDecline }: AiConsentModalProps) {
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

  const handleAccept = async () => {
    try {
      await AsyncStorage.setItem(CONSENT_KEY, "1");
    } catch {
      // ignore
    }
    close(onAccept);
  };

  const handleDecline = () => close(onDecline);

  if (!rendered) return null;

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDecline}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
          <Pressable
            accessibilityLabel="Cancel"
            style={[StyleSheet.absoluteFill, styles.backdrop]}
            onPress={handleDecline}
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
              <Text style={styles.icon}>🤖</Text>
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title}>AI Provider Consent</Text>
              <Text style={styles.message}>
                Your notes or PDF excerpts will be sent to our AI provider to
                generate this content. The data is not stored by the provider
                after the request completes.
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={handleDecline}
              style={styles.decline}
            >
              <Text style={styles.declineText}>Not now</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleAccept}
              style={styles.accept}
            >
              <Text style={styles.acceptText}>Continue</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export async function hasAiConsent(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(CONSENT_KEY);
    return value === "1";
  } catch {
    return false;
  }
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
    borderColor: "rgba(207,158,255,0.25)",
    backgroundColor: "rgba(207,158,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 20,
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
  decline: {
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
  declineText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.w70,
  },
  accept: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.lilac,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  acceptText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
});