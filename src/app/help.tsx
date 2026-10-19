import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { MessageCircle, LifeBuoy } from "lucide-react-native";
import { ScreenHeading, ScreenShell } from "../components/screen-shell";
import { InfoParagraph, InfoSection } from "../components/info-blocks";
import { colors, fonts } from "../theme/theme";

const FAQ = [
  {
    question: "How do I get started?",
    answer:
      "Create your first course from the Courses page, or open the Assistant and describe what you want to learn. ATLAS turns that goal into a roadmap with levels you can finish one at a time. The Dashboard always shows your single focus for the day.",
  },
  {
    question: "How do roadmaps work?",
    answer:
      "A roadmap is a trail of levels that unlock one after another. Complete a level to earn XP and open the next one. Boss levels appear along the way - take the boss quiz in the Quiz tab, then mark the battle won when you pass.",
  },
  {
    question: "How do quizzes work?",
    answer:
      "Pick a topic or upload a syllabus PDF, choose 5, 10 or 15 questions and a difficulty, and ATLAS writes the quiz for you. You get instant grading with explanations. Boss battles are quizzes too - take one and prove the phase before moving on.",
  },
  {
    question: "How does the focus timer earn XP?",
    answer:
      "Start a session from the Timer page and pick the course you are working on. Every focused minute is logged, hours add up on your course, and finishing sessions feeds XP and streaks into your profile.",
  },
  {
    question: "Do notes work offline?",
    answer:
      "Yes. Notes save locally first and sync automatically when your connection is back. The notes editor shows an “Offline · N to sync” badge while anything is still waiting to upload.",
  },
  {
    question: "How do XP, levels and streaks work?",
    answer:
      "XP is earned by finishing roadmap levels, quizzes and focus sessions. Enough XP levels up your profile. Your streak grows each day you are active and is shown next to your profile in the top bar.",
  },
  {
    question: "How do I delete my account or data?",
    answer:
      "Email hafizmzain786@gmail.com from the address connected to your account. We remove your data after confirming the request comes from the account owner. You can also delete individual courses, roadmaps and notes inside the app at any time.",
  },
];

export default function HelpScreen() {
  const router = useRouter();

  return (
    <ScreenShell title="Help & Support" publicPage>
      <ScreenHeading
        eyebrow="Support"
        title="Help & Support"
        subtitle="Quick answers to the most common questions about ATLAS."
      />

      {FAQ.map((entry) => (
        <InfoSection key={entry.question} title={entry.question}>
          <InfoParagraph>{entry.answer}</InfoParagraph>
        </InfoSection>
      ))}

      <View style={styles.contactCard}>
        <View style={styles.contactIcon}>
          <LifeBuoy size={20} color={colors.lilac} />
        </View>
        <Text style={styles.contactTitle}>Still stuck?</Text>
        <Text style={styles.contactBody}>
          Send us a message and we will reply to your inbox - bugs, feedback or
          anything that feels confusing.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Contact support"
          onPress={() => router.push("/contact" as Href)}
          style={({ pressed }) => [
            styles.contactButton,
            pressed && styles.contactPressed,
          ]}
        >
          <MessageCircle size={16} color={colors.primaryText} />
          <Text style={styles.contactButtonText}>Contact support</Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  contactCard: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    padding: 22,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: "rgba(207,158,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  contactTitle: {
    marginTop: 14,
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  contactBody: {
    marginTop: 6,
    maxWidth: 320,
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: fonts.regular,
    textAlign: "center",
    color: colors.w60,
  },
  contactButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  contactPressed: {
    opacity: 0.88,
  },
  contactButtonText: {
    fontSize: 13.5,
    fontFamily: fonts.semibold,
    color: colors.primaryText,
  },
});
