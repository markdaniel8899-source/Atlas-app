import type { ComponentType } from "react";
import {
  Bug,
  Code2,
  Compass,
  Feather,
  Flame,
  Gauge,
  GraduationCap,
  Hash,
  ListChecks,
  PenLine,
  Shuffle,
  Target,
  Terminal,
  Zap,
} from "lucide-react-native";
import type { KindChoice } from "../../lib/quiz";

export type QuizIcon = ComponentType<{ size?: number; color?: string }>;

/** One glyph per question type: used by the setup dropdown, the running
 *  badge and the results review row. */
export const KIND_ICON: Record<KindChoice, QuizIcon> = {
  mixed: Shuffle,
  mcq: ListChecks,
  code: Code2,
  debug: Bug,
  output: Terminal,
};

export const DIFFICULTY_ICON: Record<string, QuizIcon> = {
  easy: Feather,
  medium: Flame,
  hard: Zap,
};

/** Field-level glyphs (rendered in the SelectMenu label row). */
export const FIELD_ICON = {
  course: GraduationCap,
  topic: Target,
  kind: ListChecks,
  difficulty: Gauge,
  count: Hash,
} as const;

export const COURSE_ICON = GraduationCap;
export const GENERAL_COURSE_ICON = Compass;
export const TOPIC_ICON = Hash;
export const CUSTOM_TOPIC_ICON = PenLine;
