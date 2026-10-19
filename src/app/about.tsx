import { StyleSheet, Text, View } from "react-native";
import { Quote } from "lucide-react-native";
import { ScreenHeading, ScreenShell } from "../components/screen-shell";
import { InfoParagraph, InfoSection } from "../components/info-blocks";
import { colors, fonts } from "../theme/theme";

const PERKS = [
  {
    title: "AI Roadmaps",
    body: "Give ATLAS one goal and it builds a roadmap of levels and topics. Every topic is a small step you can finish in one sitting.",
  },
  {
    title: "Courses and Notes",
    body: "Notes live inside the courses and topics they belong to, so your study material never floats away from its subject.",
  },
  {
    title: "Smart Quizzes",
    body: "Pick a topic or upload a syllabus PDF, choose 5, 10 or 15 questions and a difficulty, and ATLAS writes the quiz for you.",
  },
  {
    title: "Focus Timer",
    body: "Start a session, stay on one task and let the timer log every hour you put in. Sessions earn XP on your roadmap.",
  },
  {
    title: "Progress Tracking",
    body: "XP, streaks, quiz results and timer hours all feed one profile, so you always know what you covered and what is next.",
  },
  {
    title: "Friends and Leaderboard",
    body: "Add friends, compare streaks and keep each other accountable. Learning is easier when someone is climbing with you.",
  },
];

const REASONS = [
  "One place instead of ten. Your plan, notes, quizzes and timer live on the same surface, so you start learning instead of organising tools.",
  "Built for recall, not cramming. Quizzes reach you while the material is still fresh, and visible progress keeps you coming back.",
  "Free while in beta. No credit card and no trial countdown. Open ATLAS, set a goal and start the climb today.",
];

const STORY = [
  "ATLAS started with a simple frustration. Learning had become a browser problem. The plan lived in one app, notes in another, flashcards somewhere else and videos in a fourth. Every session began with ten minutes of switching between apps and ended with no clear idea of what actually got done.",
  "So we built one surface. Give ATLAS a goal and it turns that goal into a roadmap of levels and topics. Notes stay attached to the courses they belong to. Quizzes test you while the material is still fresh, and a focus timer turns every session into hours, XP and streaks you can see.",
  "ATLAS is built by HM. Zain, an IT student in Lahore, as the tool he wanted for himself: simple, fast and honest about progress. It is free while in beta, and it stays built for one thing - helping you climb.",
];

export default function AboutScreen() {
  return (
    <ScreenShell title="About" publicPage>
      <ScreenHeading
        eyebrow="Learning OS"
        title="About ATLAS"
        subtitle="One surface for focus, memory, momentum and the people climbing beside you."
      />

      <InfoSection title="All the perks">
        <InfoParagraph>
          Everything you need to plan, practice and progress, kept on one
          surface so nothing gets lost between apps.
        </InfoParagraph>
        <View style={styles.perkList}>
          {PERKS.map((perk) => (
            <View key={perk.title} style={styles.perkCard}>
              <Text style={styles.perkTitle}>{perk.title}</Text>
              <Text style={styles.perkBody}>{perk.body}</Text>
            </View>
          ))}
        </View>
      </InfoSection>

      <InfoSection title="Our story">
        {STORY.map((paragraph) => (
          <InfoParagraph key={paragraph.slice(0, 32)}>
            {paragraph}
          </InfoParagraph>
        ))}
      </InfoSection>

      <InfoSection title="Why choose ATLAS">
        <View style={styles.reasonList}>
          {REASONS.map((reason) => (
            <View key={reason.slice(0, 32)} style={styles.reasonCard}>
              <Quote size={20} color="rgba(255,255,255,0.25)" />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      </InfoSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  perkList: {
    marginTop: 14,
    gap: 10,
  },
  perkCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w02,
    padding: 14,
  },
  perkTitle: {
    fontSize: 14.5,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  perkBody: {
    marginTop: 5,
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.w50,
  },
  reasonList: {
    marginTop: 14,
    gap: 10,
  },
  reasonCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w02,
    padding: 16,
  },
  reasonText: {
    marginTop: 10,
    fontSize: 13.5,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.w60,
  },
});
