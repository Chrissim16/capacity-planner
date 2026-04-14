/**
 * usePortfolioPlan — data layer for the Portfolio Planning page.
 *
 * Board membership (which epic keys are on the board) is kept in localStorage
 * for v1 so the feature works in local-only mode without Supabase.
 * Phase plans and assignments are persisted to Supabase when configured.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import type {
  EpicPhasePlan, EpicPhaseAssignment, PlanningPhase,
  AllocationMode, AllocationSegment, ManualEpic, EpicDependency,
} from '../types';
import {
  getOrderedActualPhaseEntries,
  getPlaceholderInsertIndex,
  upsertPhaseSequencePlans,
} from '../utils/portfolioPhaseOrdering';
import { filterAssignmentsForReplacementUpsert } from '../utils/portfolioAssignmentReplacement';

const BOARD_KEY   = 'pp.boardEpicKeys';
const MANUAL_KEY  = 'pp.manualEpics';

function loadManualEpics(): ManualEpic[] {
  try {
    const raw = localStorage.getItem(MANUAL_KEY);
    return raw ? (JSON.parse(raw) as ManualEpic[]) : [];
  } catch { return []; }
}

function saveManualEpics(epics: ManualEpic[]): void {
  try { localStorage.setItem(MANUAL_KEY, JSON.stringify(epics)); } catch {}
}

export interface UsePortfolioPlanReturn {
  boardEpicKeys:       string[];
  phasePlans:          EpicPhasePlan[];
  phaseAssignments:    EpicPhaseAssignment[];
  manualEpics:         ManualEpic[];
  addEpicToBoard:      (epicKey: string) => void;
  removeEpicFromBoard: (epicKey: string) => void;
  addManualEpic:       (input: { summary: string; description?: string; startDate?: string; endDate?: string }) => string;
  updateManualEpic:    (epicKey: string, changes: { summary?: string; description?: string; startDate?: string; endDate?: string }) => void;
  deleteManualEpic:    (epicKey: string) => void;
  addPhaseInstance:    (epicKey: string, phase: PlanningPhase, afterPhaseInstanceId?: string) => Promise<string>;
  removePhaseInstance: (epicKey: string, phaseInstanceId: string) => Promise<void>;
  reorderPhaseInstances: (
    epicKey: string,
    orderedEntries: Array<{ phase: PlanningPhase; phaseInstanceId: string }>,
  ) => Promise<void>;
  updatePhasePlan:     (
    epicKey: string,
    phase: PlanningPhase,
    changes: { startDate?: string | null; endDate?: string | null; description?: string | null },
    phaseInstanceId?: string,
  ) => Promise<void>;
  setPhaseStartDate:   (epicKey: string, phase: PlanningPhase, startDate: string, phaseInstanceId?: string) => Promise<void>;
  setPhaseEndDate:     (epicKey: string, phase: PlanningPhase, endDate: string, phaseInstanceId?: string) => Promise<void>;
  clearPhase:          (epicKey: string, phase: PlanningPhase, phaseInstanceId?: string) => Promise<void>;
  upsertAssignment:    (
    epicKey: string,
    phase: PlanningPhase,
    phaseInstanceId: string,
    memberId: string,
    days: number,
    track: 'IT' | 'BIZ',
    options?: { allocationMode?: AllocationMode; daysPerWeek?: number; replaceMemberId?: string }
  ) => Promise<void>;
  removeAssignment:    (epicKey: string, phase: PlanningPhase, phaseInstanceId: string, memberId: string) => Promise<void>;
  upsertSegment:       (epicKey: string, phase: PlanningPhase, phaseInstanceId: string, memberId: string, segment: AllocationSegment) => Promise<void>;
  removeSegment:       (epicKey: string, phase: PlanningPhase, phaseInstanceId: string, memberId: string, segmentId: string) => Promise<void>;
  epicDependencies:    EpicDependency[];
  addEpicDependency:   (fromEpicKey: string, toEpicKey: string) => string;
  removeEpicDependency:(id: string) => void;
  loading:             boolean;
}

function loadBoardKeys(): string[] {
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveBoardKeys(keys: string[]): void {
  localStorage.setItem(BOARD_KEY, JSON.stringify(keys));
}

type ManualEpicRow = {
  epic_key: string; summary: string | null; description: string | null;
  start_date: string | null; end_date: string | null;
};

function mapManualRow(r: ManualEpicRow): ManualEpic {
  return {
    epicKey:     r.epic_key,
    summary:     r.summary ?? r.epic_key,
    description: r.description ?? undefined,
    startDate:   r.start_date ?? undefined,
    endDate:     r.end_date ?? undefined,
  };
}

function nextManualCode(existing: ManualEpic[]): string {
  const nums = existing
    .map(e => e.epicKey.match(/^MAN-(\d+)$/)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  const max = nums.length > 0 ? Math.max(...nums) : 999;
  return `MAN-${max + 1}`;
}

type PlanRow = {
  id: string; epic_key: string; phase: string;
  phase_instance_id?: string | null;
  phase_order?: number | null;
  start_date: string | null; end_date: string | null; description?: string | null; updated_at: string;
};

type AssignRow = {
  id: string; epic_key: string; phase: string; member_id: string;
  phase_instance_id?: string | null;
  track: string; days: number; allocation_mode: string;
  days_per_week: number | null; updated_at: string;
};

type SegmentRow = {
  id: string; assignment_id: string;
  start_date: string; end_date: string; days: number;
};

function mapPlanRow(r: PlanRow): EpicPhasePlan {
  const phase = r.phase as PlanningPhase;
  return {
    id:        r.id,
    epicKey:   r.epic_key,
    phase,
    phaseInstanceId: r.phase_instance_id ?? phase,
    phaseOrder: r.phase_order ?? 0,
    startDate: r.start_date,
    endDate:   r.end_date ?? null,
    description: r.description ?? null,
    updatedAt: r.updated_at,
  };
}

function mapAssignRow(r: AssignRow, segments: AllocationSegment[] = []): EpicPhaseAssignment {
  const phase = r.phase as PlanningPhase;
  return {
    id:             r.id,
    epicKey:        r.epic_key,
    phase,
    phaseInstanceId: r.phase_instance_id ?? phase,
    memberId:       r.member_id,
    track:          r.track as 'IT' | 'BIZ',
    days:           r.days,
    allocationMode: (r.allocation_mode ?? 'flat') as AllocationMode,
    daysPerWeek:    r.days_per_week ?? undefined,
    segments:       segments.length > 0 ? segments : undefined,
    updatedAt:      r.updated_at,
  };
}

function defaultPhaseInstanceId(phase: PlanningPhase): string {
  return phase;
}

function buildPhaseInstanceId(phase: PlanningPhase): string {
  return `${phase}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildOrderedEntriesForEpic(
  phasePlans: EpicPhasePlan[],
  phaseAssignments: EpicPhaseAssignment[],
  epicKey: string,
): Array<{ phase: PlanningPhase; phaseInstanceId: string }> {
  return getOrderedActualPhaseEntries(phasePlans, phaseAssignments, epicKey).map((entry) => ({
    phase: entry.phase,
    phaseInstanceId: entry.phaseInstanceId,
  }));
}

function insertPhaseEntry(
  orderedEntries: Array<{ phase: PlanningPhase; phaseInstanceId: string }>,
  phase: PlanningPhase,
  phaseInstanceId: string,
  afterPhaseInstanceId?: string,
): Array<{ phase: PlanningPhase; phaseInstanceId: string }> {
  const next = [...orderedEntries];
  const afterIdx = afterPhaseInstanceId
    ? next.findIndex((entry) => entry.phaseInstanceId === afterPhaseInstanceId)
    : -1;
  const insertIdx = afterIdx >= 0
    ? afterIdx + 1
    : getPlaceholderInsertIndex(
        next.map((entry, index) => ({
          phase: entry.phase,
          phaseInstanceId: entry.phaseInstanceId,
          phaseOrder: index,
          plan: null,
          assignments: [],
        })),
        phase,
      );
  next.splice(insertIdx, 0, { phase, phaseInstanceId });
  return next;
}

export function usePortfolioPlan(): UsePortfolioPlanReturn {
  const [boardEpicKeys, setBoardEpicKeys] = useState<string[]>(loadBoardKeys);
  const [phasePlans, setPhasePlans]       = useState<EpicPhasePlan[]>([]);
  const [phaseAssignments, setPhaseAssignments] = useState<EpicPhaseAssignment[]>([]);
  const [manualEpics, setManualEpics]     = useState<ManualEpic[]>(loadManualEpics);
  const [epicDependencies, setEpicDependencies] = useState<EpicDependency[]>([]);
  const [loading, setLoading]             = useState(false);

  // ── Load from Supabase on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);

    Promise.all([
      supabase.from('portfolio_epics').select('*'),
      supabase.from('epic_phase_plans').select('*'),
      supabase.from('epic_phase_assignments').select('*'),
      // Graceful degradation: returns empty data if migration 040 not yet applied
      supabase.from('epic_phase_allocation_segments').select('*').then(res => ({
        data: res.error ? [] : res.data,
        error: null,
      })),
      // Graceful degradation: returns empty data if migration 052 not yet applied
      supabase.from('epic_dependencies').select('*').then(res => ({
        data: res.error ? [] : res.data,
        error: null,
      })),
    ]).then(([boardRes, plansRes, assignRes, segsRes, depsRes]) => {
      if (boardRes.data && boardRes.data.length > 0) {
        const rows = boardRes.data as Array<{ epic_key: string; is_manual: boolean | null } & ManualEpicRow>;
        const keys = rows.map(r => r.epic_key);
        setBoardEpicKeys(keys);
        saveBoardKeys(keys);
        const manuals = rows.filter(r => r.is_manual).map(mapManualRow);
        setManualEpics(manuals);
        saveManualEpics(manuals);
      }
      if (plansRes.data) {
        setPhasePlans((plansRes.data as PlanRow[]).map(mapPlanRow));
      }
      if (assignRes.data) {
        const segRows = (segsRes.data ?? []) as SegmentRow[];
        setPhaseAssignments(
          (assignRes.data as AssignRow[]).map(r => {
            const segs = segRows
              .filter(s => s.assignment_id === r.id)
              .map(s => ({ id: s.id, startDate: s.start_date, endDate: s.end_date, days: s.days }));
            return mapAssignRow(r, segs);
          })
        );
      }
      if (depsRes.data && depsRes.data.length > 0) {
        setEpicDependencies((depsRes.data as Array<{ id: string; from_epic_key: string; to_epic_key: string }>).map(r => ({
          id: r.id,
          fromEpicKey: r.from_epic_key,
          toEpicKey: r.to_epic_key,
        })));
      }
    }).finally(() => setLoading(false));
  }, []);

  // ── Board membership (localStorage + Supabase) ───────────────────────────
  const addEpicToBoard = useCallback((epicKey: string) => {
    setBoardEpicKeys(prev => {
      if (prev.includes(epicKey)) return prev;
      const next = [...prev, epicKey];
      saveBoardKeys(next);
      return next;
    });
    if (isSupabaseConfigured()) {
      supabase
        .from('portfolio_epics')
        .upsert({ epic_key: epicKey }, { onConflict: 'epic_key' })
        .then(({ error }) => { if (error) console.warn('[Portfolio] addEpicToBoard:', error.message); });
    }
  }, []);

  const removeEpicFromBoard = useCallback((epicKey: string) => {
    setBoardEpicKeys(prev => {
      const next = prev.filter(k => k !== epicKey);
      saveBoardKeys(next);
      return next;
    });
    if (isSupabaseConfigured()) {
      supabase
        .from('portfolio_epics')
        .delete()
        .eq('epic_key', epicKey)
        .then(({ error }) => { if (error) console.warn('[Portfolio] removeEpicFromBoard:', error.message); });
    }
  }, []);

  // ── Manual epic creation ─────────────────────────────────────────────────
  const addManualEpic = useCallback((input: {
    summary: string;
    description?: string;
    startDate?: string;
    endDate?: string;
  }): string => {
    const epicKey = nextManualCode(manualEpics);
    const newEpic: ManualEpic = {
      epicKey,
      summary:     input.summary,
      description: input.description,
      startDate:   input.startDate,
      endDate:     input.endDate,
    };
    setManualEpics(prev => {
      const next = [...prev, newEpic];
      saveManualEpics(next);
      return next;
    });
    setBoardEpicKeys(prev => {
      if (prev.includes(epicKey)) return prev;
      const next = [...prev, epicKey];
      saveBoardKeys(next);
      return next;
    });
    if (isSupabaseConfigured()) {
      supabase
        .from('portfolio_epics')
        .upsert({
          epic_key:    epicKey,
          summary:     input.summary,
          description: input.description ?? null,
          is_manual:   true,
          start_date:  input.startDate ?? null,
          end_date:    input.endDate ?? null,
        }, { onConflict: 'epic_key' })
        .then(({ error }) => { if (error) console.warn('[Portfolio] addManualEpic:', error.message); });
    }
    return epicKey;
  }, [manualEpics]);

  // ── Update manual epic metadata ──────────────────────────────────────────
  const updateManualEpic = useCallback((
    epicKey: string,
    changes: { summary?: string; description?: string; startDate?: string; endDate?: string },
  ) => {
    setManualEpics(prev => {
      const next = prev.map(e => e.epicKey === epicKey ? { ...e, ...changes } : e);
      saveManualEpics(next);
      return next;
    });
    if (isSupabaseConfigured()) {
      supabase
        .from('portfolio_epics')
        .update({
          ...(changes.summary     !== undefined && { summary:     changes.summary }),
          ...(changes.description !== undefined && { description: changes.description ?? null }),
          ...(changes.startDate   !== undefined && { start_date:  changes.startDate ?? null }),
          ...(changes.endDate     !== undefined && { end_date:    changes.endDate ?? null }),
        })
        .eq('epic_key', epicKey)
        .then(({ error }) => { if (error) console.warn('[Portfolio] updateManualEpic:', error.message); });
    }
  }, []);

  // ── Delete manual epic entirely ───────────────────────────────────────────
  const deleteManualEpic = useCallback((epicKey: string) => {
    setManualEpics(prev => {
      const next = prev.filter(e => e.epicKey !== epicKey);
      saveManualEpics(next);
      return next;
    });
    setBoardEpicKeys(prev => {
      const next = prev.filter(k => k !== epicKey);
      saveBoardKeys(next);
      return next;
    });
    if (isSupabaseConfigured()) {
      supabase
        .from('portfolio_epics')
        .delete()
        .eq('epic_key', epicKey)
        .then(({ error }) => { if (error) console.warn('[Portfolio] deleteManualEpic:', error.message); });
    }
  }, []);

  // ── Phase instances + dates ───────────────────────────────────────────────
  const reorderPhaseInstances = useCallback(async (
    epicKey: string,
    orderedEntries: Array<{ phase: PlanningPhase; phaseInstanceId: string }>,
  ) => {
    const now = new Date().toISOString();
    const nextPlans = upsertPhaseSequencePlans(phasePlans, orderedEntries, epicKey, now);
    setPhasePlans(nextPlans);

    if (!isSupabaseConfigured()) return;

    const payload = orderedEntries.map((entry, index) => {
      const existing = phasePlans.find(
        (plan) => plan.epicKey === epicKey && plan.phaseInstanceId === entry.phaseInstanceId,
      );
      return {
        epic_key: epicKey,
        phase: entry.phase,
        phase_instance_id: entry.phaseInstanceId,
        phase_order: index,
        start_date: existing?.startDate ?? null,
        end_date: existing?.endDate ?? null,
        description: existing?.description ?? null,
      };
    });

    const { data, error } = await supabase
      .from('epic_phase_plans')
      .upsert(payload, { onConflict: 'epic_key,phase_instance_id' })
      .select();

    if (!error && data) {
      const returnedRows = (data as PlanRow[]).map(mapPlanRow);
      const returnedIds = new Set(returnedRows.map((row) => row.phaseInstanceId));
      setPhasePlans((prev) => [
        ...prev.filter((plan) => plan.epicKey !== epicKey || !returnedIds.has(plan.phaseInstanceId)),
        ...returnedRows,
      ]);
    }
  }, [phasePlans]);

  const addPhaseInstance = useCallback(async (
    epicKey: string,
    phase: PlanningPhase,
    afterPhaseInstanceId: string = defaultPhaseInstanceId(phase),
  ) => {
    const now = new Date().toISOString();
    const phaseInstanceId = buildPhaseInstanceId(phase);
    const orderedEntries = insertPhaseEntry(
      buildOrderedEntriesForEpic(phasePlans, phaseAssignments, epicKey),
      phase,
      phaseInstanceId,
      afterPhaseInstanceId,
    );

    setPhasePlans(upsertPhaseSequencePlans(phasePlans, orderedEntries, epicKey, now));

    if (!isSupabaseConfigured()) return phaseInstanceId;

    const { data, error } = await supabase
      .from('epic_phase_plans')
      .upsert(orderedEntries.map((entry, index) => ({
        epic_key: epicKey,
        phase: entry.phase,
        phase_instance_id: entry.phaseInstanceId,
        phase_order: index,
        start_date: entry.phaseInstanceId === phaseInstanceId ? null : phasePlans.find(
          (plan) => plan.epicKey === epicKey && plan.phaseInstanceId === entry.phaseInstanceId,
        )?.startDate ?? null,
        end_date: entry.phaseInstanceId === phaseInstanceId ? null : phasePlans.find(
          (plan) => plan.epicKey === epicKey && plan.phaseInstanceId === entry.phaseInstanceId,
        )?.endDate ?? null,
        description: entry.phaseInstanceId === phaseInstanceId ? null : phasePlans.find(
          (plan) => plan.epicKey === epicKey && plan.phaseInstanceId === entry.phaseInstanceId,
        )?.description ?? null,
      })), { onConflict: 'epic_key,phase_instance_id' })
      .select()
      ;

    if (!error && data) {
      const returnedRows = (data as PlanRow[]).map(mapPlanRow);
      const returnedIds = new Set(returnedRows.map((row) => row.phaseInstanceId));
      setPhasePlans((prev) => [
        ...prev.filter((plan) => plan.epicKey !== epicKey || !returnedIds.has(plan.phaseInstanceId)),
        ...returnedRows,
      ]);
    }
    return phaseInstanceId;
  }, [phaseAssignments, phasePlans]);

  const removePhaseInstance = useCallback(async (epicKey: string, phaseInstanceId: string) => {
    const remainingEntries = buildOrderedEntriesForEpic(phasePlans, phaseAssignments, epicKey)
      .filter((entry) => entry.phaseInstanceId !== phaseInstanceId);
    const now = new Date().toISOString();
    setPhasePlans(upsertPhaseSequencePlans(
      phasePlans.filter((plan) => !(plan.epicKey === epicKey && plan.phaseInstanceId === phaseInstanceId)),
      remainingEntries,
      epicKey,
      now,
    ));
    setPhaseAssignments(prev => prev.filter(a => !(a.epicKey === epicKey && a.phaseInstanceId === phaseInstanceId)));

    if (!isSupabaseConfigured()) return;

    await supabase
      .from('epic_phase_assignments')
      .delete()
      .match({ epic_key: epicKey, phase_instance_id: phaseInstanceId });

    await supabase
      .from('epic_phase_plans')
      .delete()
      .match({ epic_key: epicKey, phase_instance_id: phaseInstanceId });
  }, [phaseAssignments, phasePlans]);

  const updatePhasePlan = useCallback(async (
    epicKey: string,
    phase: PlanningPhase,
    changes: { startDate?: string | null; endDate?: string | null; description?: string | null },
    phaseInstanceId: string = defaultPhaseInstanceId(phase),
  ) => {
    const now = new Date().toISOString();
    const existing = phasePlans.find(p => p.epicKey === epicKey && p.phaseInstanceId === phaseInstanceId);
    const orderedEntries = buildOrderedEntriesForEpic(phasePlans, phaseAssignments, epicKey);
    const phaseOrder = existing
      ? existing.phaseOrder
      : (() => {
          const existingIdx = orderedEntries.findIndex((entry) => entry.phaseInstanceId === phaseInstanceId);
          if (existingIdx >= 0) return existingIdx;
          return getPlaceholderInsertIndex(
            getOrderedActualPhaseEntries(phasePlans, phaseAssignments, epicKey),
            phase,
          );
        })();
    const nextPlan: EpicPhasePlan = existing
      ? {
          ...existing,
          ...changes,
          updatedAt: now,
        }
      : {
          id: `local-${epicKey}-${phaseInstanceId}`,
          epicKey,
          phase,
          phaseInstanceId,
          phaseOrder,
          startDate: changes.startDate ?? null,
          endDate: changes.endDate ?? null,
          description: changes.description ?? null,
          updatedAt: now,
        };

    setPhasePlans(prev => {
      const next = prev.filter(p => !(p.epicKey === epicKey && p.phaseInstanceId === phaseInstanceId));
      return [...next, nextPlan];
    });

    if (!isSupabaseConfigured()) return;

    const { data, error } = await supabase
      .from('epic_phase_plans')
      .upsert({
        epic_key: epicKey,
        phase,
        phase_instance_id: phaseInstanceId,
        phase_order: phaseOrder,
        start_date: nextPlan.startDate,
        end_date: nextPlan.endDate,
        description: nextPlan.description,
      }, { onConflict: 'epic_key,phase_instance_id' })
      .select()
      .single();

    if (!error && data) {
      const row = mapPlanRow(data as PlanRow);
      setPhasePlans(prev => {
        const filtered = prev.filter(p => !(p.epicKey === epicKey && p.phaseInstanceId === phaseInstanceId));
        return [...filtered, row];
      });
    }
  }, [phasePlans]);

  const setPhaseStartDate = useCallback(async (
    epicKey: string,
    phase: PlanningPhase,
    startDate: string,
    phaseInstanceId: string = defaultPhaseInstanceId(phase),
  ) => {
    await updatePhasePlan(epicKey, phase, { startDate }, phaseInstanceId);
  }, [updatePhasePlan]);

  const setPhaseEndDate = useCallback(async (
    epicKey: string,
    phase: PlanningPhase,
    endDate: string,
    phaseInstanceId: string = defaultPhaseInstanceId(phase),
  ) => {
    await updatePhasePlan(epicKey, phase, { endDate }, phaseInstanceId);
  }, [updatePhasePlan]);

  const clearPhase = useCallback(async (
    epicKey: string,
    phase: PlanningPhase,
    phaseInstanceId: string = defaultPhaseInstanceId(phase),
  ) => {
    await updatePhasePlan(epicKey, phase, { startDate: null, endDate: null }, phaseInstanceId);
  }, [updatePhasePlan]);

  // ── Assignments ───────────────────────────────────────────────────────────
  const upsertAssignment = useCallback(async (
    epicKey: string,
    phase: PlanningPhase,
    phaseInstanceId: string,
    memberId: string,
    days: number,
    track: 'IT' | 'BIZ',
    options?: { allocationMode?: AllocationMode; daysPerWeek?: number; replaceMemberId?: string },
  ) => {
    const now      = new Date().toISOString();
    const mode     = options?.allocationMode ?? 'flat';
    const dpw      = options?.daysPerWeek;
    const replaceMemberId = options?.replaceMemberId;
    const existing = phaseAssignments.find(
      a => a.epicKey === epicKey && a.phaseInstanceId === phaseInstanceId && a.memberId === memberId
    );

    if (existing) {
      setPhaseAssignments(prev => filterAssignmentsForReplacementUpsert(
        prev,
        epicKey,
        phaseInstanceId,
        memberId,
        replaceMemberId,
      )
        .map(a =>
          a.epicKey === epicKey && a.phaseInstanceId === phaseInstanceId && a.memberId === memberId
            ? { ...a, days, track, allocationMode: mode, daysPerWeek: dpw, updatedAt: now }
            : a
        ));
    } else {
      const tempId = `local-${epicKey}-${phaseInstanceId}-${memberId}`;
      setPhaseAssignments(prev => [
        ...filterAssignmentsForReplacementUpsert(prev, epicKey, phaseInstanceId, memberId, replaceMemberId),
        { id: tempId, epicKey, phase, phaseInstanceId, memberId, track, days, allocationMode: mode, daysPerWeek: dpw, updatedAt: now },
      ]);
    }

    if (!isSupabaseConfigured()) return;

    const { data, error } = await supabase
      .from('epic_phase_assignments')
      .upsert(
        { epic_key: epicKey, phase, phase_instance_id: phaseInstanceId, member_id: memberId, days, track, allocation_mode: mode, days_per_week: dpw ?? null },
        { onConflict: 'epic_key,phase_instance_id,member_id' }
      )
      .select()
      .single();

    if (!error && data) {
      const row = data as AssignRow;
      setPhaseAssignments(prev => {
        const filtered = filterAssignmentsForReplacementUpsert(prev, epicKey, phaseInstanceId, memberId, replaceMemberId);
        return [...filtered, mapAssignRow(row, existing?.segments ?? [])];
      });
    }
  }, [phaseAssignments]);

  const removeAssignment = useCallback(async (epicKey: string, _phase: PlanningPhase, phaseInstanceId: string, memberId: string) => {
    setPhaseAssignments(prev =>
      prev.filter(a => !(a.epicKey === epicKey && a.phaseInstanceId === phaseInstanceId && a.memberId === memberId))
    );

    if (!isSupabaseConfigured()) return;

    await supabase
      .from('epic_phase_assignments')
      .delete()
      .match({ epic_key: epicKey, phase_instance_id: phaseInstanceId, member_id: memberId });
  }, []);

  // ── Allocation segments ───────────────────────────────────────────────────
  const upsertSegment = useCallback(async (
    epicKey: string,
    _phase: PlanningPhase,
    phaseInstanceId: string,
    memberId: string,
    segment: AllocationSegment,
  ) => {
    const now = new Date().toISOString();

    setPhaseAssignments(prev => prev.map(a => {
      if (a.epicKey !== epicKey || a.phaseInstanceId !== phaseInstanceId || a.memberId !== memberId) return a;
      const existing = a.segments ?? [];
      const idx = existing.findIndex(s => s.id === segment.id);
      const newSegs = idx >= 0 ? existing.map((s, i) => (i === idx ? segment : s)) : [...existing, segment];
      const total = newSegs.reduce((sum, s) => sum + s.days, 0);
      return { ...a, segments: newSegs, days: total, updatedAt: now };
    }));

    if (!isSupabaseConfigured()) return;

    const assignment = phaseAssignments.find(
      a => a.epicKey === epicKey && a.phaseInstanceId === phaseInstanceId && a.memberId === memberId
    );
    if (!assignment || assignment.id.startsWith('local-')) return;

    if (segment.id.startsWith('local-')) {
      const { data, error } = await supabase
        .from('epic_phase_allocation_segments')
        .insert({
          assignment_id: assignment.id,
          start_date: segment.startDate,
          end_date: segment.endDate,
          days: segment.days,
        })
        .select()
        .single();

      if (!error && data) {
        const row = data as SegmentRow;
        setPhaseAssignments(prev => prev.map(a => {
          if (a.epicKey !== epicKey || a.phaseInstanceId !== phaseInstanceId || a.memberId !== memberId) return a;
          return { ...a, segments: (a.segments ?? []).map(s => s.id === segment.id ? { ...s, id: row.id } : s) };
        }));
      }
    } else {
      await supabase
        .from('epic_phase_allocation_segments')
        .update({
          start_date: segment.startDate,
          end_date: segment.endDate,
          days: segment.days,
          updated_at: now,
        })
        .eq('id', segment.id);
    }
  }, [phaseAssignments]);

  const removeSegment = useCallback(async (
    epicKey: string,
    _phase: PlanningPhase,
    phaseInstanceId: string,
    memberId: string,
    segmentId: string,
  ) => {
    const now = new Date().toISOString();

    setPhaseAssignments(prev => prev.map(a => {
      if (a.epicKey !== epicKey || a.phaseInstanceId !== phaseInstanceId || a.memberId !== memberId) return a;
      const newSegs = (a.segments ?? []).filter(s => s.id !== segmentId);
      const total = newSegs.reduce((sum, s) => sum + s.days, 0);
      return { ...a, segments: newSegs, days: total, updatedAt: now };
    }));

    if (!isSupabaseConfigured() || segmentId.startsWith('local-')) return;

    await supabase
      .from('epic_phase_allocation_segments')
      .delete()
      .eq('id', segmentId);
  }, []);

  // ── Epic dependencies ─────────────────────────────────────────────────────
  const addEpicDependency = useCallback((fromEpicKey: string, toEpicKey: string): string => {
    const id = crypto.randomUUID();
    setEpicDependencies(prev => {
      if (prev.some(d => d.fromEpicKey === fromEpicKey && d.toEpicKey === toEpicKey)) return prev;
      return [...prev, { id, fromEpicKey, toEpicKey }];
    });
    if (isSupabaseConfigured()) {
      supabase
        .from('epic_dependencies')
        .upsert({ id, from_epic_key: fromEpicKey, to_epic_key: toEpicKey }, { onConflict: 'from_epic_key,to_epic_key' })
        .then(({ error }) => { if (error) console.warn('[Portfolio] addEpicDependency:', error.message); });
    }
    return id;
  }, []);

  const removeEpicDependency = useCallback((id: string) => {
    setEpicDependencies(prev => prev.filter(d => d.id !== id));
    if (isSupabaseConfigured()) {
      supabase
        .from('epic_dependencies')
        .delete()
        .eq('id', id)
        .then(({ error }) => { if (error) console.warn('[Portfolio] removeEpicDependency:', error.message); });
    }
  }, []);

  return {
    boardEpicKeys,
    phasePlans,
    phaseAssignments,
    manualEpics,
    addEpicToBoard,
    removeEpicFromBoard,
    addManualEpic,
    updateManualEpic,
    deleteManualEpic,
    addPhaseInstance,
    removePhaseInstance,
    reorderPhaseInstances,
    updatePhasePlan,
    setPhaseStartDate,
    setPhaseEndDate,
    clearPhase,
    upsertAssignment,
    removeAssignment,
    upsertSegment,
    removeSegment,
    epicDependencies,
    addEpicDependency,
    removeEpicDependency,
    loading,
  };
}
