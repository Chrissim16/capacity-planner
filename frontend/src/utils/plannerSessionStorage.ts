/**
 * Planner entry + UI session (localStorage only, single key).
 * When absent or invalid, /planner defaults to the home screen; populated when a scenario is open.
 * @see scenario-planner-redesign.md §4
 */
const PLANNER_SESSION_KEY = 'capacity-planner-planner-session';

/** Indices match `generateQuarters(8)` — 0 = current quarter. */
const MAX_QUARTER_INDEX = 7;

export type PlannerSessionMode = 'board' | 'timeline';

export interface PlannerSession {
  activeScenarioId: string;
  lastActiveMode: PlannerSessionMode;
  lastActiveQuarter: number;
  backlogDrawerOpen: boolean;
}

function clampQuarterIndex(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_QUARTER_INDEX, Math.floor(n)));
}

function normalizeMode(v: unknown): PlannerSessionMode {
  return v === 'timeline' ? 'timeline' : 'board';
}

/** Parse JSON without clearing storage (for merges). */
function parseSessionObject(raw: string): Partial<PlannerSession> | null {
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (!p || typeof p !== 'object') return null;
    const id = p.activeScenarioId;
    const out: Partial<PlannerSession> = {};
    if (typeof id === 'string' && id.length > 0) out.activeScenarioId = id;
    out.lastActiveMode = normalizeMode(p.lastActiveMode);
    out.lastActiveQuarter = clampQuarterIndex(Number(p.lastActiveQuarter));
    out.backlogDrawerOpen = Boolean(p.backlogDrawerOpen);
    return out;
  } catch {
    return null;
  }
}

/**
 * Full session for an open scenario. Returns null if the key is missing, JSON is invalid,
 * or activeScenarioId is absent (legacy empty objects).
 */
export function readPlannerSession(): PlannerSession | null {
  try {
    const raw = localStorage.getItem(PLANNER_SESSION_KEY);
    if (!raw) return null;
    const partial = parseSessionObject(raw);
    if (!partial || !partial.activeScenarioId) {
      clearPlannerSession();
      return null;
    }
    return {
      activeScenarioId: partial.activeScenarioId,
      lastActiveMode: partial.lastActiveMode ?? 'board',
      lastActiveQuarter: partial.lastActiveQuarter ?? 0,
      backlogDrawerOpen: partial.backlogDrawerOpen ?? false,
    };
  } catch {
    clearPlannerSession();
    return null;
  }
}

export function hasPlannerSession(): boolean {
  return readPlannerSession() !== null;
}

/**
 * Set active scenario; preserves existing UI fields from storage when present (legacy `{ activeScenarioId }` gets defaults for UI).
 */
export function writePlannerSession(activeScenarioId: string): void {
  try {
    const raw = localStorage.getItem(PLANNER_SESSION_KEY);
    const prev = raw ? parseSessionObject(raw) : null;
    const payload: PlannerSession = {
      activeScenarioId,
      lastActiveMode: prev?.lastActiveMode ?? 'board',
      lastActiveQuarter: prev?.lastActiveQuarter ?? 0,
      backlogDrawerOpen: prev?.backlogDrawerOpen ?? false,
    };
    localStorage.setItem(PLANNER_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Persist full snapshot (debounced caller). Only call when a scenario is open. */
export function persistPlannerSession(snapshot: PlannerSession): void {
  try {
    localStorage.setItem(
      PLANNER_SESSION_KEY,
      JSON.stringify({
        ...snapshot,
        lastActiveQuarter: clampQuarterIndex(snapshot.lastActiveQuarter),
        lastActiveMode: normalizeMode(snapshot.lastActiveMode),
      }),
    );
  } catch {
    /* ignore */
  }
}

export function clearPlannerSession(): void {
  try {
    localStorage.removeItem(PLANNER_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
