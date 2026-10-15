export type CourseStatus = 'not_started' | 'in_progress' | 'paused' | 'completed';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  streak: number;
  xp: number;
  level: number;
  avatar_url: string | null;
  last_active_date: string | null;
  weekly_xp?: number | null;
  total_xp?: number | null;
  day_streak?: number | null;
  total_focus_seconds?: number | null;
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

export interface CourseRef {
  id: number;
  title: string;
  accent: string;
}

export interface CourseTopic {
  id: number;
  title: string;
  summary: string;
  position: number;
  status: CourseStatus;
  progress_percentage: number;
  completed_at: string | null;
}

export interface Course {
  id: number;
  title: string;
  description: string;
  accent: string;
  status: CourseStatus;
  progress_percentage: number;
  position: number;
  total_focus_seconds: number;
  topics: CourseTopic[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  courseId: number | null;
  topicId: number | null;
  courseTitle: string | null;
}

export interface RoadmapPhase {
  number: number;
  title: string;
  objective: string;
  durationWeeks: number;
  hours: number;
  milestones: string[];
}

export interface RoadmapSummary {
  id: string;
  goal: string;
  title: string;
  summary: string;
  model: string | null;
  courseId: number | null;
  courseTitle: string | null;
  phases: RoadmapPhase[];
  phaseCount: number;
  completed: number;
  total: number;
  percent: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  id: string;
  displayName: string;
  username: string;
  initials: string;
  avatarUrl: string | null;
  weeklyXp: number;
  totalXp: number;
  streak: number;
  level: number;
  isYou: boolean;
}

export type SquadStatus = 'studying' | 'online' | 'offline';
export type Relationship = 'friend' | 'outgoing' | 'incoming';

export interface SquadMember {
  friendshipId: number;
  id: string;
  displayName: string;
  username: string;
  initials: string;
  status: SquadStatus;
  statusLabel: string;
  streak: number;
  level: number;
  xp: number;
  avatarUrl: string | null;
  relationship: Relationship;
}

export interface InviteResult {
  ok: boolean;
  message: string;
}
