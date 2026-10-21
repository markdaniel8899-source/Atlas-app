import AsyncStorage from "@react-native-async-storage/async-storage";
import { resolveSession } from "../auth";
import { notifyProfileChanged, notifyRoadmapsChanged } from "../events";
import { supabase } from "../supabase";
import type {
  GraphEdge,
  GraphNode,
  GraphPhase,
  NodeStatus,
  RoadmapGraph,
} from "../roadmap-graph";
import { deriveEdges, orderedNodes, withDerivedStatuses } from "../roadmap-graph";
import type { CourseStatus } from "./types";
import {
  findCourseByTitle,
  findOrCreateCourseByTitle,
  syncTopicStatuses,
} from "./courses";

const ROADMAP_COLUMNS = "id, goal, title, summary, model, phases, course_id";
/** Same columns plus the linked course title (roadmaps.course_id → courses). */
const ROADMAP_SELECT = `${ROADMAP_COLUMNS}, courses(title)`;
const NODE_COLUMNS =
  "id, roadmap_id, title, description, phase_number, position, " +
  "position_x, position_y, status, estimated_hours, prerequisites, " +
  "resources, completed_at";

interface RoadmapRow {
  id: string;
  goal: string;
  title: string;
  summary: string;
  model: string | null;
  phases: unknown;
  course_id: number | null;
  /** Embedded courses(title): to-one object, but tolerated as a one-item array. */
  courses: unknown;
}

/** Reads the embedded course title from a to-one (or one-item array) relation. */
function readCourseTitle(value: unknown): string | null {
  if (Array.isArray(value)) {
    const first: unknown = value[0];
    if (first && typeof first === "object") {
      const title = (first as { title?: unknown }).title;
      return typeof title === "string" ? title : null;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const title = (value as { title?: unknown }).title;
    return typeof title === "string" ? title : null;
  }
  return null;
}

interface NodeRow {
  id: string;
  title: string;
  description: string;
  phase_number: number;
  position: number;
  position_x: number | null;
  position_y: number | null;
  status: NodeStatus;
  estimated_hours: number;
  prerequisites: string[] | null;
  resources: unknown;
  completed_at: string | null;
}

interface ConnectionRow {
  from_node_id: string | null;
  to_node_id: string | null;
}

function asString(value: unknown, limit: number): string {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown, limit: number, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, max)
    .map((item) => item.slice(0, limit));
}

function readResources(value: unknown): GraphNode["resources"] {
  if (!Array.isArray(value)) return [];
  const out: GraphNode["resources"] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const url = asString(record.url, 600).trim();
    // Resources are opened with Linking - only web links are ever allowed.
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({
      type: asString(record.type, 24) || "article",
      title: asString(record.title, 300),
      url,
    });
    if (out.length >= 12) break;
  }
  return out;
}

function readPhases(raw: unknown, nodes: GraphNode[]): GraphPhase[] {
  const phases: GraphPhase[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const number =
        asNumber(record.number, phases.length + 1) || phases.length + 1;
      phases.push({
        number,
        title: asString(record.title, 160) || `Phase ${number}`,
        objective: asString(record.objective, 600),
        durationWeeks: asNumber(record.duration_weeks),
        hours: asNumber(record.hours),
        milestones: asStringArray(record.milestones, 300, 8),
      });
    }
  }

  const seen = new Set(phases.map((phase) => phase.number));
  const nodePhases = Array.from(
    new Set(nodes.map((node) => node.phaseNumber)),
  ).sort((a, b) => a - b);
  for (const number of nodePhases) {
    if (seen.has(number)) continue;
    phases.push({
      number,
      title: `Phase ${number}`,
      objective: "",
      durationWeeks: 0,
      hours: 0,
      milestones: [],
    });
    seen.add(number);
  }

  return phases.sort((a, b) => a.number - b.number);
}

/** Latest roadmap for the user; pass `courseId` to scope it to one course. */
export async function fetchLatestRoadmap(
  courseId?: number | null,
): Promise<RoadmapGraph | null> {
  const user = await resolveSession();
  if (!user) return null;

  let query = supabase
    .from("roadmaps")
    .select(ROADMAP_SELECT)
    .eq("user_id", user.id);
  if (courseId != null) {
    query = query.eq("course_id", courseId);
  }
  const { data: roadmapData, error: roadmapError } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (roadmapError || !roadmapData) return null;
  const roadmap = roadmapData as RoadmapRow;

  const { data: nodeData, error: nodeError } = await supabase
    .from("roadmap_nodes")
    .select(NODE_COLUMNS)
    .eq("roadmap_id", roadmap.id)
    .order("phase_number", { ascending: true })
    .order("position", { ascending: true });

  if (nodeError) return null;
  const nodeRows = Array.isArray(nodeData)
    ? (nodeData as unknown as NodeRow[])
    : [];

  const nodes: GraphNode[] = nodeRows.map((row) => {
    const boss = /boss|devil/i.test(row.title);
    return {
      id: row.id,
      key: row.id,
      title: row.title,
      description: row.description ?? "",
      phaseNumber: row.phase_number,
      position: row.position,
      status: row.status,
      estimatedHours: row.estimated_hours,
      prerequisites: (row.prerequisites ?? []).map(String),
      resources: readResources(row.resources),
      completedAt: row.completed_at,
      levelNumber: 0,
      type: boss ? "boss" : "regular",
      estimatedDays: 0,
      quizRequired: boss,
      objectives: [],
    };
  });

  const idToKey = new Map(nodes.map((node) => [node.id, node.key]));

  const phases = readPhases(roadmap.phases, nodes);

  let edges: GraphEdge[] = [];
  const { data: connectionData } = await supabase
    .from("roadmap_connections")
    .select("from_node_id, to_node_id")
    .eq("roadmap_id", roadmap.id);

  if (Array.isArray(connectionData)) {
    edges = (connectionData as unknown as ConnectionRow[])
      .map((row) => ({
        source: row.from_node_id ? (idToKey.get(row.from_node_id) ?? "") : "",
        target: row.to_node_id ? (idToKey.get(row.to_node_id) ?? "") : "",
      }))
      .filter(
        (edge) =>
          edge.source !== "" && edge.target !== "" && edge.source !== edge.target,
      );
  }

  const graph: RoadmapGraph = {
    id: roadmap.id,
    goal: roadmap.goal,
    title: roadmap.title,
    summary: roadmap.summary,
    model: roadmap.model,
    courseId: roadmap.course_id,
    courseTitle: readCourseTitle(roadmap.courses),
    phases,
    nodes,
    edges,
  };

  if (graph.edges.length === 0) {
    graph.edges = deriveEdges(graph);
  }

  return withDerivedStatuses(graph);
}

/**
 * Node ids must be client-generated so prerequisites can be written in one
 * insert. Hermes may not expose crypto.randomUUID, so fall back gracefully.
 */
function newNodeId(): string {
  const bytes = new Uint8Array(16);
  const cryptoApi = globalThis.crypto as
    | { randomUUID?: () => string; getRandomValues?: (array: Uint8Array) => void }
    | undefined;

  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < 16; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

export interface SaveRoadmapSkeletonInput {
  goal: string;
  title: string;
  summary: string;
  model: string | null;
  /** Course this roadmap belongs to (roadmaps.course_id). */
  courseId?: number | null;
  courseTitle?: string | null;
  /** Outline phases, saved before any level exists. */
  phases: GraphPhase[];
}

/**
 * Resolve the course link: an explicit pick wins. Otherwise reuse a course
 * matching the goal (older saves stored the raw goal as the course title) or
 * the roadmap's short AI title, and only create a new one when neither
 * exists - the new course is named after the AI roadmap title so the raw
 * prompt never becomes a course name.
 */
async function linkCourse(
  explicitId: number | null,
  explicitTitle: string | null,
  goal: string,
  roadmapTitle: string,
): Promise<{ id: number | null; title: string | null }> {
  if (explicitId != null) return { id: explicitId, title: explicitTitle };

  const cleanTitle = roadmapTitle.replace(/\s+/g, " ").trim().slice(0, 160);
  const existing =
    (await findCourseByTitle(goal)) ??
    (cleanTitle ? await findCourseByTitle(cleanTitle) : null);
  if (existing) return existing;

  const linked = await findOrCreateCourseByTitle(cleanTitle || goal);
  return linked
    ? { id: linked.id, title: linked.title }
    : { id: null, title: explicitTitle ?? null };
}

/**
 * Step 1 of chunked generation: create the roadmap row (phase titles) and
 * link its course immediately, before any level exists. Phase chunks are
 * appended later with `appendRoadmapPhase`, so a half-finished generation
 * never loses what it already produced.
 */
export async function saveRoadmapSkeleton(
  input: SaveRoadmapSkeletonInput,
): Promise<RoadmapGraph | null> {
  const user = await resolveSession();
  if (!user) return null;

  const link = await linkCourse(
    input.courseId ?? null,
    input.courseTitle ?? null,
    input.goal,
    input.title,
  );

  const { data, error } = await supabase
    .from("roadmaps")
    .insert({
      user_id: user.id,
      goal: input.goal.slice(0, 400),
      title: input.title.slice(0, 200),
      summary: input.summary.slice(0, 1000),
      model: input.model,
      course_id: link.id,
      phases: input.phases.map((phase) => ({
        number: phase.number,
        title: phase.title,
        objective: phase.objective,
        duration_weeks: phase.durationWeeks,
        hours: phase.hours,
        milestones: phase.milestones,
      })),
    })
    .select(ROADMAP_SELECT)
    .maybeSingle();

  if (error || !data) return null;
  const roadmap = data as RoadmapRow;

  notifyRoadmapsChanged();

  return withDerivedStatuses({
    id: roadmap.id,
    goal: roadmap.goal,
    title: roadmap.title,
    summary: roadmap.summary,
    model: roadmap.model,
    courseId: roadmap.course_id,
    courseTitle: readCourseTitle(roadmap.courses),
    phases: input.phases,
    nodes: [],
    edges: [],
  });
}

/**
 * Step 2+ of chunked generation: insert one phase's nodes (and their chain
 * edges) into an already-created roadmap. `idMap` tracks graph key → row id
 * across chunks; it is only updated after a successful insert, so a failed
 * chunk never poisons later prerequisite writes.
 *
 * Returns the nodes with their row ids filled in, or null on failure.
 */
export async function appendRoadmapPhase(
  roadmapId: string,
  idMap: Map<string, string>,
  chunk: GraphNode[],
  previousLastKey: string | null,
  options?: { notify?: boolean },
): Promise<GraphNode[] | null> {
  const user = await resolveSession();
  if (!user || chunk.length === 0) return null;

  const ids = chunk.map(() => newNodeId());
  const chunkIds = new Map(chunk.map((node, index) => [node.key, ids[index]]));
  const resolveId = (key: string): string | undefined =>
    idMap.get(key) ?? chunkIds.get(key);

  const { error: nodeError } = await supabase.from("roadmap_nodes").insert(
    chunk.map((node, index) => ({
      id: ids[index],
      roadmap_id: roadmapId,
      title: node.title.slice(0, 200),
      description: node.description.slice(0, 800),
      phase_number: node.phaseNumber,
      position: node.position,
      position_x: null,
      position_y: null,
      status: node.status,
      estimated_hours: node.estimatedHours,
      prerequisites: (node.prerequisites ?? [])
        .map((key) => resolveId(key))
        .filter((value): value is string => value !== undefined),
      resources: node.resources,
      completed_at: node.completedAt,
    })),
  );
  if (nodeError) return null;

  // Only new edges: cross-chunk bridge, within-chunk chain, prerequisites.
  const rows: {
    roadmap_id: string;
    from_node_id: string;
    to_node_id: string;
  }[] = [];
  const seen = new Set<string>();
  const push = (from: string | undefined, to: string | undefined) => {
    if (!from || !to || from === to) return;
    const tag = `${from}->${to}`;
    if (seen.has(tag)) return;
    seen.add(tag);
    rows.push({ roadmap_id: roadmapId, from_node_id: from, to_node_id: to });
  };

  push(previousLastKey ? idMap.get(previousLastKey) : undefined, ids[0]);
  for (let index = 1; index < ids.length; index += 1) {
    push(ids[index - 1], ids[index]);
  }
  chunk.forEach((node, index) => {
    for (const key of node.prerequisites ?? []) {
      push(resolveId(key), ids[index]);
    }
  });

  if (rows.length > 0) {
    // Cosmetic edges: never fail the chunk if the insert is rejected.
    const { error: connectionError } = await supabase
      .from("roadmap_connections")
      .insert(rows);
    if (connectionError) {
      console.warn("roadmap connections not saved:", connectionError.message);
    }
  }

  for (const [key, id] of chunkIds) idMap.set(key, id);
  if (options?.notify !== false) notifyRoadmapsChanged();

  return chunk.map((node, index) => ({ ...node, id: ids[index] }));
}

export interface NodeStatusUpdateResult {
  ok: boolean;
  /** Nodes that actually changed from not-completed to completed. */
  completedIds: string[];
  /** Number of rows the database actually changed. */
  applied: number;
}

export async function updateNodeStatuses(
  updates: { id: string; status: NodeStatus; completedAt: string | null }[],
): Promise<NodeStatusUpdateResult> {
  if (updates.length === 0) {
    return { ok: true, completedIds: [], applied: 0 };
  }

  const user = await resolveSession();
  if (!user) {
    return { ok: false, completedIds: [], applied: 0 };
  }

  // roadmap_nodes has no user_id column, so ownership is proven through the
  // parent roadmap before any write.
  const ids = Array.from(new Set(updates.map((update) => update.id)));
  const { data: nodeRows, error: nodeError } = await supabase
    .from("roadmap_nodes")
    .select("id, roadmap_id")
    .in("id", ids);
  if (nodeError || !Array.isArray(nodeRows) || nodeRows.length !== ids.length) {
    return { ok: false, completedIds: [], applied: 0 };
  }

  const rows = nodeRows as unknown as { id: string; roadmap_id: string }[];
  const roadmapIds = Array.from(new Set(rows.map((row) => row.roadmap_id)));
  const { data: ownedRows, error: ownedError } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("user_id", user.id)
    .in("id", roadmapIds);
  if (
    ownedError ||
    !Array.isArray(ownedRows) ||
    ownedRows.length !== roadmapIds.length
  ) {
    return { ok: false, completedIds: [], applied: 0 };
  }

  const results = await Promise.all(
    updates.map(async (update) => {
      let query = supabase
        .from("roadmap_nodes")
        .update({ status: update.status, completed_at: update.completedAt })
        .eq("id", update.id);
      if (update.status === "completed") {
        query = query.neq("status", "completed");
      }
      const { data, error } = await query.select("id");
      const affected = !error && Array.isArray(data) && data.length > 0;
      return {
        id: update.id,
        error,
        affected,
        completed: affected && update.status === "completed",
      };
    }),
  );

  const ok = results.every((result) => !result.error);
  if (ok) notifyRoadmapsChanged();
  return {
    ok,
    completedIds: results
      .filter((result) => result.completed)
      .map((result) => result.id),
    applied: results.filter((result) => result.affected).length,
  };
}

const AWARDED_LEVELS_PREFIX = "atlas.roadmap.awarded-levels.";

async function readAwardedLevels(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(`${AWARDED_LEVELS_PREFIX}${userId}`);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((value): value is string => typeof value === "string"),
    );
  } catch {
    return new Set();
  }
}

/**
 * XP for finishing a level (50 regular / 200 boss), stored via activity RPC.
 * Each node is credited at most once per account, even if the level is
 * unchecked and completed again later.
 */
export async function awardLevelXp(
  nodeId: string,
  xp: number,
): Promise<boolean> {
  if (!nodeId || xp <= 0) return false;
  const user = await resolveSession();
  if (!user) return false;

  const awarded = await readAwardedLevels(user.id);
  if (awarded.has(nodeId)) return true;

  const { error } = await supabase.rpc("record_activity", { p_xp: xp });
  if (error) return false;

  notifyProfileChanged();
  awarded.add(nodeId);
  try {
    await AsyncStorage.setItem(
      `${AWARDED_LEVELS_PREFIX}${user.id}`,
      JSON.stringify(Array.from(awarded).slice(-1000)),
    );
  } catch {
    // XP is already awarded; the local ledger is best effort.
  }
  return true;
}

/**
 * Permanently remove a roadmap. Nodes and connection edges cascade at the
 * database level. Used to clear a roadmap whose course link was lost (rows
 * saved before course linking was fixed) or an unwanted standalone roadmap.
 */
export async function deleteRoadmap(roadmapId: string): Promise<boolean> {
  const user = await resolveSession();
  if (!user) return false;

  const { error } = await supabase
    .from("roadmaps")
    .delete()
    .eq("id", roadmapId)
    .eq("user_id", user.id);
  if (error) return false;

  notifyRoadmapsChanged();
  return true;
}

function normaliseTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Mirror roadmap level completion onto the linked course's `course_topics`.
 * Levels map to topics by normalised title first, then by trail position.
 * Completing a level marks the topic completed; unchecking it reverts the
 * topic to not_started (manually paused/in-progress topics are left alone).
 */
export async function syncRoadmapProgressToCourse(
  courseId: number,
  nodes: GraphNode[],
): Promise<boolean> {
  const user = await resolveSession();
  if (!user || nodes.length === 0) return false;

  const { data, error } = await supabase
    .from("course_topics")
    .select("id, title, status")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .order("position", { ascending: true });

  if (error || !Array.isArray(data) || data.length === 0) return false;

  const ordered = orderedNodes(nodes);
  const byTitle = new Map<string, GraphNode>();
  for (const node of ordered) {
    const key = normaliseTitle(node.title.replace(/^boss battle:\s*/i, ""));
    if (key && !byTitle.has(key)) byTitle.set(key, node);
  }

  const updates: { id: number; status: CourseStatus }[] = [];
  const topics = data as { id: number; title: string; status: CourseStatus }[];

  topics.forEach((topic, index) => {
    const node =
      byTitle.get(normaliseTitle(topic.title)) ?? ordered[index] ?? null;
    if (!node) return;

    if (node.status === "completed") {
      if (topic.status !== "completed") {
        updates.push({ id: topic.id, status: "completed" });
      }
    } else if (topic.status === "completed") {
      updates.push({ id: topic.id, status: "not_started" });
    }
  });

  const synced = await syncTopicStatuses(courseId, updates);
  if (synced) notifyRoadmapsChanged();
  return synced;
}

export interface RoadmapCourseProgress {
  roadmapId: string;
  courseId: number;
  title: string;
  completed: number;
  total: number;
  percent: number;
}

interface RoadmapProgressRow {
  id: string;
  course_id: number | null;
  title: string;
  goal: string;
  roadmap_nodes: { status: NodeStatus }[] | null;
}

/**
 * Latest roadmap progress for every linked course: drives the course card
 * progress ring (e.g. 3/10 levels → 30%).
 */
export async function fetchRoadmapProgressByCourse(): Promise<
  Map<number, RoadmapCourseProgress>
> {
  const out = new Map<number, RoadmapCourseProgress>();
  const user = await resolveSession();
  if (!user) return out;

  const { data, error } = await supabase
    .from("roadmaps")
    .select("id, course_id, title, goal, roadmap_nodes(status)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !Array.isArray(data)) return out;

  for (const row of data as unknown as RoadmapProgressRow[]) {
    if (row.course_id === null || row.course_id === undefined) continue;
    if (out.has(row.course_id)) continue; // newest roadmap wins per course

    const nodes = row.roadmap_nodes ?? [];
    const total = nodes.length;
    const completed = nodes.filter(
      (node) => node.status === "completed",
    ).length;

    out.set(row.course_id, {
      roadmapId: row.id,
      courseId: row.course_id,
      title: row.title,
      completed,
      total,
      percent: total > 0 ? (completed / total) * 100 : 0,
    });
  }

  return out;
}
