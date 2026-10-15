export type CourseStatus =
  | "not_started"
  | "in_progress"
  | "paused"
  | "completed";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  streak: number;
  xp: number;
  level: number;
  avatar_url: string | null;
  last_active_date: string | null;
  /** XP earned since the last weekly reset (Monday, UTC). */
  weekly_xp?: number | null;
  /** Lifetime XP alias (generated column mirroring `xp`). */
  total_xp?: number | null;
  /** Streak alias (generated column mirroring `streak`). */
  day_streak?: number | null;
}

export interface HeatmapDay {
  day: string;
  total_seconds: number;
  session_count: number;
}

export interface FocusTopic {
  id: number;
  title: string;
  position: number;
  status: CourseStatus;
}

export interface FocusCourse {
  id: number;
  title: string;
  accent: string;
  progress_percentage: number;
  status: CourseStatus;
  topics: FocusTopic[];
}

export interface CourseTopic extends FocusTopic {
  summary: string;
  progress_percentage: number;
  completed_at: string | null;
}

export interface Course extends FocusCourse {
  description: string;
  position: number;
  topics: CourseTopic[];
  /** Lifetime focused seconds for this course (courses.total_focus_seconds). */
  total_focus_seconds: number;
}
