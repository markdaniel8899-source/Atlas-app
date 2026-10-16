import type { Roadmap, RoadmapPhase } from "./ai";

export type NodeStatus = "locked" | "active" | "completed";
export type LevelType = "regular" | "boss";

export interface GraphPhase {
  number: number;
  title: string;
  objective: string;
  durationWeeks: number;
  hours: number;
  milestones: string[];
}

export interface GraphNode {
  /** Database row id, or null until the roadmap is persisted. */
  id: string | null;
  /** Stable identifier: the AI slug before save, the row id after. */
  key: string;
  title: string;
  description: string;
  phaseNumber: number;
  position: number;
  status: NodeStatus;
  estimatedHours: number;
  /** Keys of nodes that must be completed first. */
  prerequisites: string[];
  resources: { type: string; title: string; url: string }[];
  completedAt: string | null;
  /** 1-based position on the single sequential trail. */
  levelNumber: number;
  type: LevelType;
  /** Focused study days estimated for this level. */
  estimatedDays: number;
  /** Boss levels require a passed quiz (80%) to proceed. */
  quizRequired: boolean;
  /** Short action bullets; derived when the backend does not send them. */
  objectives: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface RoadmapGraph {
  id: string | null;
  goal: string;
  title: string;
  summary: string;
  model: string | null;
  /** Linked course (roadmaps.course_id); null for standalone roadmaps. */
  courseId: number | null;
  /** Title of the linked course, hydrated from the courses relation. */
  courseTitle: string | null;
  phases: GraphPhase[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Clean, prompt-free card title: always "Roadmap for <course/topic>".
 * Never exposes the raw generation goal/prompt.
 */

/** Goals are imperative sentences - a real name never starts like one. */
const PROMPT_START =
  /^(?:generate|create|make|build|design|write|draft|give|plan|prepare|develop|teach|show|help\s+me|i\s+want|want\s+to|learn\s+me)\b/i;

function looksLikePrompt(raw: string): boolean {
  if (!raw) return false;
  if (raw.length > 70) return true;
  return PROMPT_START.test(raw);
}

function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 90);
}

export function roadmapDisplayTitle(
  graph: Pick<RoadmapGraph, "title" | "courseTitle">,
): string {
  const course = cleanName(graph.courseTitle ?? "");
  const title = cleanName(graph.title ?? "");

  // Prefer whichever name reads like a real name; a course row created from
  // the raw goal (older saves) must never surface the user's prompt.
  const candidates = [course, title].filter(
    (value) => value && !looksLikePrompt(value),
  );
  const raw = candidates[0] || title || course;

  if (!raw) return "Roadmap";

  const base = raw.replace(/\s+roadmap$/i, "").trim();
  if (!base) return "Roadmap";
  return /^roadmap\b/i.test(base) ? base : `Roadmap for ${base}`;
}

export interface LayoutBox {
  x: number;
  y: number;
}

export interface MapLayout {
  boxes: Map<string, LayoutBox>;
  width: number;
  height: number;
}

export interface LevelPoint {
  /** Circle center. */
  cx: number;
  cy: number;
  /** Circle diameter (larger for boss levels). */
  size: number;
}

export interface LevelLayout {
  points: Map<string, LevelPoint>;
  width: number;
  height: number;
}

export const NODE_W = 176;
export const NODE_H = 96;
export const PHASE_COL_WIDTH = 300;
export const PHASE_ROW_HEIGHT = 150;
export const NODE_ZIGZAG = 76;
export const MAP_PAD_X = 48;
export const MAP_PAD_Y = 76;

/**
 * Candy-Crush trail geometry: one level per row, placed on a sine wave so
 * the path meanders left-to-right like the world map in the game.
 */
export const TRAIL_WIDTH = 640;
export const TRAIL_ROW_H = 168;
export const TRAIL_PAD_X = 90;
export const TRAIL_PAD_Y = 64;
/** Candy-style node diameters: boss levels are visibly larger. */
export const LEVEL_D = 104;
export const LEVEL_BOSS_D = 140;

/** XP rewards for finishing a level. */
export const XP_PER_LEVEL = 50;
export const XP_PER_BOSS = 200;

/** A boss is inserted when this many regular levels run in a row without one. */
const BOSS_FILL_GAP = 7;

const BOSS_TITLE_RE = /boss|devil/i;

export function xpFor(node: Pick<GraphNode, "type">): number {
  return node.type === "boss" ? XP_PER_BOSS : XP_PER_LEVEL;
}

export function isBossNode(node: Pick<GraphNode, "type" | "title">): boolean {
  return node.type === "boss" || BOSS_TITLE_RE.test(node.title);
}

const COL_W = PHASE_COL_WIDTH;
const ROW_H = PHASE_ROW_HEIGHT;
const ZIGZAG = NODE_ZIGZAG;
const PAD_X = MAP_PAD_X;
const PAD_Y = MAP_PAD_Y;

/** Single sequential trail order: phase number, then position. */
export function orderedNodes(nodes: GraphNode[]): GraphNode[] {
  return [...nodes].sort(
    (a, b) =>
      a.phaseNumber - b.phaseNumber ||
      a.position - b.position ||
      a.title.localeCompare(b.title),
  );
}

/**
 * Strictly sequential progression (Candy Crush rules): a level unlocks only
 * when every level before it on the trail is completed. Completed levels stay
 * completed even if an earlier one is unchecked.
 */
export function deriveStatuses(nodes: GraphNode[]): Map<string, NodeStatus> {
  const status = new Map<string, NodeStatus>();
  let open = true;

  for (const node of orderedNodes(nodes)) {
    if (node.status === "completed") {
      status.set(node.key, "completed");
      continue;
    }
    status.set(node.key, open ? "active" : "locked");
    open = false;
  }

  for (const node of nodes) {
    if (!status.has(node.key)) status.set(node.key, node.status);
  }

  return status;
}

/** Level metadata + statuses, recomputed for any graph (fresh or from DB). */
export function withDerivedStatuses(graph: RoadmapGraph): RoadmapGraph {
  const ordered = orderedNodes(graph.nodes);

  const leveled = ordered.map((node, index) => {
    const boss = isBossNode(node);
    return {
      ...node,
      type: boss ? ("boss" as LevelType) : ("regular" as LevelType),
      levelNumber: index + 1,
      estimatedDays:
        node.estimatedDays > 0
          ? node.estimatedDays
          : Math.max(1, Math.round(node.estimatedHours / 8)),
      quizRequired: boss ? true : node.quizRequired,
      objectives: node.objectives.slice(0, 4),
    };
  });

  const status = deriveStatuses(leveled);

  return {
    ...graph,
    nodes: leveled.map((node) => ({
      ...node,
      status: status.get(node.key) ?? node.status,
    })),
  };
}

function bossLevel(prev: GraphNode, label: string, serial: number): GraphNode {
  return {
    id: null,
    key: `boss-${serial}-${prev.key}`.slice(0, 80),
    title: `BOSS BATTLE: ${label || prev.title}`,
    description: "Complete this quiz to unlock the next phase.",
    phaseNumber: prev.phaseNumber,
    position: prev.position + 1,
    status: "locked",
    estimatedHours: 2,
    prerequisites: prev.key ? [prev.key] : [],
    resources: [],
    completedAt: null,
    levelNumber: 0,
    type: "boss",
    estimatedDays: 1,
    quizRequired: true,
    objectives: [
      "Review every concept from the levels before this gate",
      "Pass the boss quiz with a score of at least 80%",
      "Write down the questions you missed and why",
    ],
  };
}

/**
 * Guarantee a boss level appears at least every BOSS_FILL_GAP regular levels.
 * Boss levels the AI already generated are kept as-is; this only fills gaps.
 */
export function insertBossLevels(
  nodes: GraphNode[],
  labelFor: (node: GraphNode) => string,
): GraphNode[] {
  const out: GraphNode[] = [];
  let run = 0;
  let serial = 0;

  for (const node of nodes) {
    if (isBossNode(node)) {
      out.push({ ...node, type: "boss", quizRequired: true });
      run = 0;
      continue;
    }
    if (run >= BOSS_FILL_GAP) {
      out.push(bossLevel(node, labelFor(node), serial));
      serial += 1;
      run = 0;
    }
    out.push(node);
    run += 1;
  }

  return out;
}

function sequentialChain(nodes: GraphNode[]): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const edges: GraphEdge[] = [];
  const chained = nodes.map((node, index) => {
    const previous = index > 0 ? nodes[index - 1] : null;
    if (previous) edges.push({ source: previous.key, target: node.key });
    return { ...node, prerequisites: previous ? [previous.key] : [] };
  });
  return { nodes: chained, edges };
}

function renumberPositions(nodes: GraphNode[]): GraphNode[] {
  const counts = new Map<number, number>();
  return nodes.map((node) => {
    const next = (counts.get(node.phaseNumber) ?? 0) + 1;
    counts.set(node.phaseNumber, next);
    return { ...node, position: next };
  });
}

export function graphFromRoadmap(
  roadmap: Roadmap,
  goal: string,
  model: string | null,
): RoadmapGraph {
  const known = new Set<string>();
  const phases: GraphPhase[] = [];
  const nodes: GraphNode[] = [];

  for (const phase of roadmap.phases) {
    phases.push({
      number: phase.number,
      title: phase.title,
      objective: phase.objective,
      durationWeeks: phase.duration_weeks,
      hours: phase.hours,
      milestones: phase.milestones,
    });

    phase.nodes.forEach((node, index) => {
      if (known.has(node.key)) return;
      known.add(node.key);
      nodes.push({
        id: null,
        key: node.key,
        title: node.title,
        description: node.description,
        phaseNumber: phase.number,
        position: index + 1,
        status: "locked",
        estimatedHours: node.estimated_hours,
        prerequisites: node.prerequisites.filter((key) => key !== node.key),
        resources: node.resources,
        completedAt: null,
        levelNumber: 0,
        type:
          node.type === "boss" || BOSS_TITLE_RE.test(node.title)
            ? "boss"
            : "regular",
        estimatedDays: node.estimated_days ?? 0,
        quizRequired: Boolean(node.quiz_required),
        objectives: (node.objectives ?? []).slice(0, 4),
      });
    });
  }

  const phaseTitle = (node: GraphNode): string =>
    phases.find((phase) => phase.number === node.phaseNumber)?.title ?? "";

  const ordered = orderedNodes(nodes);
  const withBosses = insertBossLevels(ordered, phaseTitle);
  const sequential = sequentialChain(withBosses);
  const finalNodes = renumberPositions(sequential.nodes);

  return withDerivedStatuses({
    id: null,
    goal,
    title: roadmap.title,
    summary: roadmap.summary,
    model,
    courseId: null,
    courseTitle: null,
    phases,
    nodes: finalNodes,
    edges: sequential.edges,
  });
}

/**
 * Convert one generated phase chunk into GraphNodes for the live graph.
 * `taken` holds every key already used by earlier chunks, so keys stay
 * unique across chunks and prerequisites are remapped onto the final keys.
 */
export function graphNodesFromPhase(
  phase: RoadmapPhase,
  taken: Set<string>,
): GraphNode[] {
  const keyMap = new Map<string, string>();
  const out: GraphNode[] = [];

  phase.nodes.forEach((node, index) => {
    const base = (node.key || `p${phase.number}-${index + 1}`)
      .trim()
      .slice(0, 70);
    let key = base;
    let suffix = 1;
    while (taken.has(key)) {
      suffix += 1;
      key = `${base}-${suffix}`.slice(0, 80);
    }
    taken.add(key);
    if (!keyMap.has(node.key)) keyMap.set(node.key, key);

    out.push({
      id: null,
      key,
      title: node.title,
      description: node.description ?? "",
      phaseNumber: phase.number,
      position: index + 1,
      status: "locked",
      estimatedHours: node.estimated_hours ?? 0,
      prerequisites: [],
      resources: node.resources ?? [],
      completedAt: null,
      levelNumber: 0,
      type:
        node.type === "boss" || BOSS_TITLE_RE.test(node.title)
          ? "boss"
          : "regular",
      estimatedDays: node.estimated_days ?? 0,
      quizRequired: Boolean(node.type === "boss" || node.quiz_required),
      objectives: (node.objectives ?? []).slice(0, 4),
    });
  });

  phase.nodes.forEach((node, index) => {
    out[index].prerequisites = (node.prerequisites ?? [])
      .map((raw) => keyMap.get(raw))
      .filter(
        (mapped): mapped is string =>
          mapped !== undefined && mapped !== out[index].key,
      );
  });

  return out;
}

/** XP earned vs. XP available across every level on the trail. */
export function xpProgressOf(graph: RoadmapGraph): {
  earned: number;
  total: number;
} {
  let earned = 0;
  let total = 0;
  for (const node of graph.nodes) {
    const xp = xpFor(node);
    total += xp;
    if (node.status === "completed") earned += xp;
  }
  return { earned, total };
}

/** Phase containing the first unfinished level (last phase when all done). */
export function currentPhaseNumber(graph: RoadmapGraph): number {
  const next = orderedNodes(graph.nodes).find(
    (node) => node.status !== "completed",
  );
  if (next) return next.phaseNumber;
  const last = orderedNodes(graph.nodes)[graph.nodes.length - 1];
  return last?.phaseNumber ?? graph.phases[0]?.number ?? 1;
}

export function progressOf(graph: RoadmapGraph): {
  completed: number;
  total: number;
  percent: number;
} {
  const total = graph.nodes.length;
  const completed = graph.nodes.filter(
    (node) => node.status === "completed",
  ).length;
  return { completed, total, percent: total ? (completed / total) * 100 : 0 };
}

export function phaseProgress(
  graph: RoadmapGraph,
  phaseNumber: number,
): { completed: number; total: number } {
  const nodes = graph.nodes.filter((node) => node.phaseNumber === phaseNumber);
  return {
    completed: nodes.filter((node) => node.status === "completed").length,
    total: nodes.length,
  };
}

export function nodesOfPhase(
  graph: RoadmapGraph,
  phaseNumber: number,
): GraphNode[] {
  return graph.nodes
    .filter((node) => node.phaseNumber === phaseNumber)
    .sort((a, b) => a.position - b.position);
}

/** 3-4 concrete learning objectives for the level detail card. */
export function objectivesFor(
  node: GraphNode,
  phase?: GraphPhase,
): string[] {
  if (node.objectives.length > 0) return node.objectives.slice(0, 4);

  if (node.type === "boss") {
    const topic = node.title.split(":").slice(1).join(":").trim() || node.title;
    return [
      `Review everything learned so far for ${topic}`,
      "Pass the boss quiz with a score of at least 80%",
      "Note down every question you missed and why",
    ];
  }

  const out: string[] = [`Understand the core ideas behind ${node.title}`];
  if (phase?.objective) out.push(phase.objective);
  out.push("Practice with a small hands-on example");
  out.push("Explain the concept aloud from your notes without peeking");
  return out.slice(0, 4);
}

/**
 * Meandering trail layout: one level per row, pushed along a sine wave (plus
 * a small deterministic wobble) so the path snakes organically like the
 * Candy Crush world map.
 */
export function layoutLevels(graph: RoadmapGraph): LevelLayout {
  const ordered = orderedNodes(graph.nodes);
  const points = new Map<string, LevelPoint>();
  const centerX = TRAIL_WIDTH / 2;
  const amplitude = TRAIL_WIDTH / 2 - TRAIL_PAD_X;

  ordered.forEach((node, index) => {
    const wobble = Math.cos(index * 2.3) * 14;
    const cx = centerX + Math.sin(index * 1.15) * (amplitude * 0.92) + wobble;
    const cy = TRAIL_PAD_Y + index * TRAIL_ROW_H;
    const size = node.type === "boss" ? LEVEL_BOSS_D : LEVEL_D;
    points.set(node.key, { cx, cy, size });
  });

  const height =
    TRAIL_PAD_Y + Math.max(0, ordered.length - 1) * TRAIL_ROW_H + 190;

  return { points, width: TRAIL_WIDTH, height };
}

function crSegment(
  p0: LevelPoint,
  p1: LevelPoint,
  p2: LevelPoint,
  p3: LevelPoint,
): string {
  const c1x = p1.cx + (p2.cx - p0.cx) / 6;
  const c1y = p1.cy + (p2.cy - p0.cy) / 6;
  const c2x = p2.cx - (p3.cx - p1.cx) / 6;
  const c2y = p2.cy - (p3.cy - p1.cy) / 6;
  return ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.cx} ${p2.cy}`;
}

function neighbors(points: LevelPoint[], index: number) {
  const last = points.length - 1;
  return {
    p0: points[Math.max(0, index - 1)],
    p1: points[index],
    p2: points[index + 1],
    p3: points[Math.min(last, index + 2)],
  };
}

/** One continuous Catmull-Rom ribbon through every level on the trail. */
export function trailPath(points: LevelPoint[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0].cx} ${points[0].cy}`;

  let d = `M ${points[0].cx} ${points[0].cy}`;
  for (let index = 0; index < n - 1; index += 1) {
    const { p0, p1, p2, p3 } = neighbors(points, index);
    d += crSegment(p0, p1, p2, p3);
  }
  return d;
}

/** A single segment of the trail, for status-colored overlays. */
export function trailSegmentPath(points: LevelPoint[], index: number): string {
  if (index < 0 || index >= points.length - 1) return "";
  const { p0, p1, p2, p3 } = neighbors(points, index);
  return `M ${p1.cx} ${p1.cy}${crSegment(p0, p1, p2, p3)}`;
}

/**
 * Phases become columns. Even phases snake downward, odd phases snake upward,
 * so the connector between two phases is a short horizontal hop instead of a
 * long diagonal, so the path reads as one continuous candy trail.
 */
export function layoutGraph(graph: RoadmapGraph): MapLayout {
  const numbers = Array.from(
    new Set(graph.nodes.map((node) => node.phaseNumber)),
  ).sort((a, b) => a - b);

  const boxes = new Map<string, LayoutBox>();
  let maxX = 0;
  let maxY = 0;

  numbers.forEach((phaseNumber, phaseIndex) => {
    const nodes = nodesOfPhase(graph, phaseNumber);
    const downward = phaseIndex % 2 === 0;

    nodes.forEach((node, index) => {
      const row = downward ? index : nodes.length - 1 - index;
      const x = PAD_X + phaseIndex * COL_W + (row % 2 === 1 ? ZIGZAG : 0);
      const y = PAD_Y + row * ROW_H;
      boxes.set(node.key, { x, y });
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
  });

  return {
    boxes,
    width: maxX + NODE_W + PAD_X,
    height: maxY + NODE_H + 48,
  };
}

/** Keys of the sequential trail edges, as distinct from dependency edges. */
export function flowEdgeKeys(graph: RoadmapGraph): Set<string> {
  const keys = new Set<string>();
  const numbers = Array.from(
    new Set(graph.nodes.map((node) => node.phaseNumber)),
  ).sort((a, b) => a - b);

  for (const number of numbers) {
    const nodes = nodesOfPhase(graph, number);
    for (let index = 1; index < nodes.length; index += 1) {
      keys.add(`${nodes[index - 1].key}->${nodes[index].key}`);
    }
  }

  for (let index = 1; index < numbers.length; index += 1) {
    const previous = nodesOfPhase(graph, numbers[index - 1]);
    const current = nodesOfPhase(graph, numbers[index]);
    if (previous.length > 0 && current.length > 0) {
      keys.add(`${previous[previous.length - 1].key}->${current[0].key}`);
    }
  }

  return keys;
}

/** Rebuild the edge list when the connections table is missing rows. */
export function deriveEdges(graph: RoadmapGraph): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const push = (source: string, target: string) => {
    if (source === target) return;
    const key = `${source}->${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target });
  };

  const ordered = orderedNodes(graph.nodes);
  for (let index = 1; index < ordered.length; index += 1) {
    push(ordered[index - 1].key, ordered[index].key);
  }

  for (const node of ordered) {
    for (const prereq of node.prerequisites) push(prereq, node.key);
  }

  return edges;
}

/** Bezier between two node borders. Falls back to a straight line when aligned. */
export function edgePath(from: LayoutBox, to: LayoutBox): string {
  const ax = from.x + NODE_W / 2;
  const ay = from.y + NODE_H / 2;
  const bx = to.x + NODE_W / 2;
  const by = to.y + NODE_H / 2;
  const dx = bx - ax;
  const dy = by - ay;

  let sx: number;
  let sy: number;
  let tx: number;
  let ty: number;
  let c1x: number;
  let c1y: number;
  let c2x: number;
  let c2y: number;

  if (Math.abs(dy) >= Math.abs(dx)) {
    const dir = dy >= 0 ? 1 : -1;
    sx = ax;
    sy = ay + dir * (NODE_H / 2);
    tx = bx;
    ty = by - dir * (NODE_H / 2);
    const bulge =
      Math.abs(dx) < 1 ? 0 : Math.max(34, Math.abs(dx) * 0.5) * Math.sign(dx);
    const drop = Math.max(34, Math.abs(dy) * 0.25) * dir;
    c1x = sx + bulge;
    c1y = sy + drop;
    c2x = tx - bulge;
    c2y = ty - drop;
  } else {
    const dir = dx >= 0 ? 1 : -1;
    sx = ax + dir * (NODE_W / 2);
    sy = ay;
    tx = bx - dir * (NODE_W / 2);
    ty = by;
    const bulge =
      Math.abs(dy) < 1 ? 0 : Math.max(34, Math.abs(dy) * 0.5) * Math.sign(dy);
    const reach = Math.max(34, Math.abs(dx) * 0.25) * dir;
    c1x = sx + reach;
    c1y = sy + bulge;
    c2x = tx - reach;
    c2y = ty - bulge;
  }

  return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
}
