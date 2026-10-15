import { generateRoadmapOutline } from '@/lib/ai';
import { supabase } from '@/lib/supabase';

import { createCourse, findCourseByTitle } from './courses';
import { notifyRoadmapsChanged } from './events';
import type { RoadmapPhase, RoadmapSummary } from './types';

interface RoadmapRow {
  id: string;
  goal: string;
  title: string;
  summary: string;
  model: string | null;
  phases: unknown;
  course_id: number | null;
  created_at: string;
  courses: unknown;
  roadmap_nodes: { status: string }[] | null;
}

const ROADMAP_SELECT =
  'id, goal, title, summary, model, phases, course_id, created_at, ' +
  'courses(title), roadmap_nodes(status)';

function readCourseTitle(value: unknown): string | null {
  if (Array.isArray(value)) {
    const first: unknown = value[0];
    if (first && typeof first === 'object') {
      const title = (first as { title?: unknown }).title;
      return typeof title === 'string' ? title : null;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const title = (value as { title?: unknown }).title;
    return typeof title === 'string' ? title : null;
  }
  return null;
}

function normalisePhases(raw: unknown): RoadmapPhase[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const record = (item ?? {}) as Record<string, unknown>;
    const milestones = Array.isArray(record.milestones)
      ? record.milestones
          .filter((m): m is string => typeof m === 'string')
          .slice(0, 8)
      : [];
    return {
      number:
        typeof record.number === 'number' && record.number > 0
          ? record.number
          : index + 1,
      title:
        typeof record.title === 'string' && record.title.trim()
          ? record.title
          : `Phase ${index + 1}`,
      objective: typeof record.objective === 'string' ? record.objective : '',
      durationWeeks:
        typeof record.duration_weeks === 'number' ? record.duration_weeks : 0,
      hours: typeof record.hours === 'number' ? record.hours : 0,
      milestones,
    };
  });
}

function toSummary(row: RoadmapRow): RoadmapSummary {
  const phases = normalisePhases(row.phases);
  const nodes = row.roadmap_nodes ?? [];
  const total = nodes.length;
  const completed = nodes.filter((node) => node.status === 'completed').length;
  return {
    id: row.id,
    goal: row.goal,
    title: row.title,
    summary: row.summary,
    model: row.model,
    courseId: row.course_id,
    courseTitle: readCourseTitle(row.courses),
    phases,
    phaseCount: phases.length > 0 ? phases.length : total,
    completed,
    total,
    percent: total > 0 ? (completed / total) * 100 : 0,
    createdAt: row.created_at,
  };
}

export async function fetchRoadmaps(
  userId: string | null,
): Promise<RoadmapSummary[]> {
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from('roadmaps')
    .select(ROADMAP_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !Array.isArray(data)) return [];
  return (data as unknown as RoadmapRow[]).map(toSummary);
}

export async function deleteRoadmap(
  userId: string | null,
  roadmapId: string,
): Promise<boolean> {
  if (!supabase || !userId) return false;

  const { error } = await supabase
    .from('roadmaps')
    .delete()
    .eq('id', roadmapId)
    .eq('user_id', userId);
  if (error) return false;

  notifyRoadmapsChanged();
  return true;
}

export interface CreateRoadmapInput {
  goal: string;
  hoursPerWeek: number;
  level: string;
  courseId?: number | null;
}

export async function createRoadmap(
  userId: string | null,
  input: CreateRoadmapInput,
): Promise<RoadmapSummary | null> {
  if (!supabase || !userId) return null;

  const goal = input.goal.trim();
  if (!goal) return null;

  const outline = await generateRoadmapOutline(
    goal,
    input.hoursPerWeek,
    input.level,
  );
  const title = (outline.title || goal).replace(/\s+/g, ' ').trim();
  const summary = (outline.summary || '').slice(0, 1000);

  let courseId = input.courseId ?? null;
  let courseTitle: string | null = null;

  if (courseId == null) {
    const existing =
      (await findCourseByTitle(userId, title)) ??
      (await findCourseByTitle(userId, goal));
    if (existing) {
      courseId = existing.id;
      courseTitle = existing.title;
    } else {
      const created = await createCourse(userId, title, summary);
      if (created) {
        courseId = created.id;
        courseTitle = created.title;
      }
    }
  }

  const phaseRows = outline.phases.map((phase) => ({
    number: phase.number,
    title: phase.title.slice(0, 160),
    objective: (phase.objective ?? '').slice(0, 600),
    duration_weeks: phase.duration_weeks ?? 0,
    hours: phase.hours ?? 0,
    milestones: (phase.milestones ?? []).slice(0, 8),
  }));

  const { data, error } = await supabase
    .from('roadmaps')
    .insert({
      user_id: userId,
      goal: goal.slice(0, 400),
      title: title.slice(0, 200),
      summary,
      model: outline.model ?? null,
      course_id: courseId,
      phases: phaseRows,
    })
    .select(ROADMAP_SELECT)
    .maybeSingle();

  if (error || !data) return null;

  notifyRoadmapsChanged();
  const summaryRow = toSummary(data as unknown as RoadmapRow);
  if (courseTitle && !summaryRow.courseTitle) {
    summaryRow.courseTitle = courseTitle;
  }
  return summaryRow;
}
