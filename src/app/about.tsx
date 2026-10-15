import { router } from 'expo-router';
import { Quote } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { GlassCard } from '@/components/ui/glass-card';
import {
  PublicCta,
  PublicSection,
  PublicSubheading,
  PublicText,
  PublicPage,
} from '@/components/site/PublicPage';

const PERKS = [
  {
    title: 'AI Roadmaps',
    body: 'Give ATLAS one goal and it builds a roadmap of levels and topics. Every topic is a small step you can finish in one sitting.',
  },
  {
    title: 'Courses and Notes',
    body: 'Notes live inside the courses and topics they belong to, so your study material never floats away from its subject.',
  },
  {
    title: 'Smart Quizzes',
    body: 'Pick a topic or upload a syllabus PDF, choose 5, 10 or 15 questions and a difficulty, and ATLAS writes the quiz for you.',
  },
  {
    title: 'Focus Timer',
    body: 'Start a session, stay on one task and let the timer log every hour you put in. Sessions earn XP on your roadmap.',
  },
  {
    title: 'Progress Tracking',
    body: 'XP, streaks, quiz results and timer hours all feed one profile, so you always know what you covered and what is next.',
  },
  {
    title: 'Squads and Friends',
    body: 'Invite friends, compare streaks and keep each other accountable. Learning is easier when someone is climbing with you.',
  },
];

const REASONS = [
  'One tab instead of ten. Your plan, notes, quizzes and timer live on the same surface, so you start learning instead of organising tools.',
  'Built for recall, not cramming. Quizzes reach you while the material is still fresh, and visible progress keeps you coming back.',
  'Free while in beta. No credit card and no trial countdown. Open ATLAS, set a goal and start the climb today.',
];

export default function AboutScreen() {
  return (
    <PublicPage eyebrow="Learning OS" title="About ATLAS" wide>
      <PublicCta label="Start free" onPress={() => router.replace('/login')} />

      <PublicSection title="About Atlas">
        <PublicText>
          Everything you need to plan, practice and progress, kept on one surface
          so nothing gets lost between apps.
        </PublicText>
      </PublicSection>

      <GlassCard className="gap-6 rounded-3xl border-lilac/20 p-6 shadow-atlas-glow">
        {PERKS.map((perk) => (
          <View key={perk.title} className="gap-2">
            <Text
              allowFontScaling={false}
              className="font-outfit-bold text-lg font-bold text-white">
              {perk.title}
            </Text>
            <Text
              allowFontScaling={false}
              className="font-outfit text-base leading-relaxed text-white/50">
              {perk.body}
            </Text>
          </View>
        ))}
      </GlassCard>

      <PublicSection title="Our Story">
        <PublicText>
          ATLAS started with a simple frustration. Learning had become a browser
          problem. The plan lived in one app, notes in another, flashcards
          somewhere else and videos in a fourth. Every session began with ten
          minutes of switching tabs and ended with no clear idea of what actually
          got done.
        </PublicText>
        <PublicText>
          So we built one surface. Give ATLAS a goal and it turns that goal into
          a roadmap of levels and topics. Notes stay attached to the courses they
          belong to. Quizzes test you while the material is still fresh, and a
          focus timer turns every session into hours, XP and streaks you can see.
        </PublicText>
        <PublicText>
          ATLAS is built by HM. Zain, an IT student in Lahore, as the tool he
          wanted for himself: simple, fast and honest about progress. It is free
          while in beta, and it stays built for one thing, helping you climb.
        </PublicText>
      </PublicSection>

      <PublicSection title="Happy Learners">
        <PublicSubheading>Why Choose ATLAS</PublicSubheading>
        {REASONS.map((reason) => (
          <GlassCard
            key={reason}
            className="gap-4 rounded-2xl border-lilac/15 p-7 shadow-star-glow">
            <Quote size={28} color="rgba(255,255,255,0.25)" />
            <Text
              allowFontScaling={false}
              className="font-outfit text-base leading-relaxed text-white/60">
              {reason}
            </Text>
          </GlassCard>
        ))}
      </PublicSection>

      <PublicCta
        label="Open ATLAS and start climbing"
        onPress={() => router.replace('/login')}
      />
    </PublicPage>
  );
}
