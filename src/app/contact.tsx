import { useState } from "react";
import type { ComponentType } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowUpRight,
  Mail,
  MapPin,
  Phone,
} from "lucide-react-native";
import { ScreenHeading, ScreenShell } from "../components/screen-shell";
import { ensureOnline } from "../lib/net";
import { supabase } from "../lib/supabase";
import { colors, fonts } from "../theme/theme";

const EMAIL = "hafizmzain786@gmail.com";
const PHONE_DISPLAY = "+92-3074477250";
const MAPS_HREF =
  "https://www.google.com/maps/search/?api=1&query=Lahore%2C+Pakistan";

interface Detail {
  title: string;
  value: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  href: string;
}

const DETAILS: Detail[] = [
  {
    title: "Email us",
    value: EMAIL,
    icon: Mail,
    href: `mailto:${EMAIL}`,
  },
  {
    title: "Call us",
    value: PHONE_DISPLAY,
    icon: Phone,
    href: "tel:+923074477250",
  },
  {
    title: "Our location",
    value: "Lahore, Pakistan",
    icon: MapPin,
    href: MAPS_HREF,
  },
];

type Status = "idle" | "sending" | "sent" | "error" | "invalid";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ContactScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const onEdit =
    (setValue: (value: string) => void) => (value: string) => {
      setValue(value);
      if (status !== "idle") setStatus("idle");
    };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();
    if (!trimmedName || !trimmedEmail || !trimmedMessage) return;

    if (!EMAIL_RE.test(trimmedEmail)) {
      setStatus("invalid");
      return;
    }

    if (!(await ensureOnline("Messages can't be sent while offline."))) {
      setStatus("error");
      return;
    }

    setStatus("sending");

    const { error } = await supabase.from("contact_messages").insert({
      name: trimmedName.slice(0, 80),
      email: trimmedEmail.slice(0, 120),
      subject: `Message from ${trimmedName.slice(0, 80)}`,
      message: trimmedMessage.slice(0, 4000),
    });

    if (error) {
      setStatus("error");
      return;
    }

    setName("");
    setEmail("");
    setMessage("");
    setStatus("sent");
  };

  return (
    <ScreenShell title="Contact" activeLabel="Contact" publicPage>
      <ScreenHeading
        eyebrow="Say hello"
        title="Get in touch"
        subtitle="Have a question about ATLAS, found a bug or want to share feedback? Send a message and we will reply to your inbox."
      />

      <View style={styles.details}>
        {DETAILS.map((detail) => {
          const Icon = detail.icon;
          return (
            <Pressable
              key={detail.title}
              accessibilityRole="link"
              accessibilityLabel={`${detail.title}: ${detail.value}`}
              onPress={() => void Linking.openURL(detail.href)}
              style={({ pressed }) => [
                styles.detailCard,
                pressed && styles.detailCardPressed,
              ]}
            >
              <View style={styles.detailIcon}>
                <Icon size={18} color={colors.lilac} />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailTitle}>{detail.title}</Text>
                <Text numberOfLines={1} style={styles.detailValue}>
                  {detail.value}
                </Text>
              </View>
              <ArrowUpRight size={16} color={colors.w50} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Send us a message</Text>
        <TextInput
          value={name}
          onChangeText={onEdit(setName)}
          maxLength={80}
          placeholder="Name"
          placeholderTextColor={colors.w35}
          style={styles.field}
        />
        <TextInput
          value={email}
          onChangeText={onEdit(setEmail)}
          maxLength={120}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={colors.w35}
          style={styles.field}
        />
        <TextInput
          value={message}
          onChangeText={onEdit(setMessage)}
          maxLength={4000}
          multiline
          placeholder="Message"
          placeholderTextColor={colors.w35}
          style={[styles.field, styles.messageField]}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Submit message"
          disabled={status === "sending"}
          onPress={() => void handleSubmit()}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitPressed,
            status === "sending" && styles.submitDisabled,
          ]}
        >
          <Text style={styles.submitText}>
            {status === "sending" ? "Sending…" : "Submit"}
          </Text>
        </Pressable>

        <Text style={styles.statusText}>
          {status === "invalid" ? (
            <Text style={styles.statusError}>
              Enter a valid email address so we can reply.
            </Text>
          ) : status === "error" ? (
            <Text style={styles.statusError}>
              Could not send your message. Please try again, or email us
              directly.
            </Text>
          ) : status === "sent" ? (
            <Text style={styles.statusSent}>
              Message sent — we’ll reply to your inbox.
            </Text>
          ) : (
            "Your message goes straight to our team."
          )}
        </Text>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  details: {
    gap: 10,
  },
  detailCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    padding: 14,
  },
  detailCardPressed: {
    borderColor: colors.lilac25,
    backgroundColor: colors.w05,
  },
  detailIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    alignItems: "center",
    justifyContent: "center",
  },
  detailText: {
    flex: 1,
    minWidth: 0,
  },
  detailTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  detailValue: {
    marginTop: 3,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.w50,
  },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w02,
    padding: 18,
    gap: 10,
  },
  formTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    letterSpacing: -0.3,
    color: colors.white,
  },
  field: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  messageField: {
    minHeight: 132,
    textAlignVertical: "top",
  },
  submitButton: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingVertical: 14,
  },
  submitPressed: {
    opacity: 0.88,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    letterSpacing: 0.2,
    color: colors.primaryText,
  },
  statusText: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    textAlign: "center",
    color: colors.w45,
  },
  statusError: {
    color: "#fda4af",
  },
  statusSent: {
    color: colors.lilac,
  },
});
