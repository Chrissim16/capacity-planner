/**
 * usePortfolioPlan — data layer for the Portfolio Planning page.
 *
 * Board membership (which epic keys are on the board) is kept in localStorage
 * for v1 so the feature works in local-only mode without Supabase.
 * Phase plans and assignments are persisted to Supabase when configured.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import type { EpicPhasePlan, EpicPhaseAssignment, PlanningPhase } from '../types';

const BOARD_KEY = 'pp.boardEpicKeys';

export interface UsePortfolioPlanReturn {
  boardEpicKeys:       string[];
  phasePlans:          EpicPhasePlan[];
  phaseAssignments:    EpicPhaseAssignment[];
  addEpicToBoard:      (epicKey: string) => void;
  removeEpicFromBoard: (epicKey: string) => void;
  setPhaseStartDate:   (epicKey: string, phase: PlanningPhase, startDate: string) => Promise<void>;
  clearPhase:          (epicKey: string, phase: PlanningPhase) => Promise<void>;
  upsertAssignment:    (epicKey: string, phase: PlanningPhase, memberId: string, days: number, track: 'IT' | 'BIZ') => Promise<void>;
  removeAssignment:    (epicKey: string, phase: PlanningPhase, memberId: string) => Promise<void>;
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

export function usePortfolioPlan(): UsePortfolioPlanReturn {
  const [boardEpicKeys, setBoardEpicKeys] = useState<string[]>(loadBoardKeys);
  const [phasePlans, setPhasePlans]       = useState<EpicPhasePlan[]>([]);
  const [phaseAssignments, setPhaseAssignments] = useState<EpicPhaseAssignment[]>([]);
  const [loading, setLoading]             = useState(false);

  // ── Load from Supabase on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);

    Promise.all([
      supabase.from('portfolio_epics').select('epic_key'),
      supabase.from('epic_phase_plans').select('*'),
      supabase.from('epic_phase_assignments').select('*'),
    ]).then(([boardRes, plansRes, assignRes]) => {
      if (boardRes.data && boardRes.data.length > 0) {
        const keys = (boardRes.data as Array<{ epic_key: string }>).map(r => r.epic_key);
        setBoardEpicKeys(keys);
        saveBoardKeys(keys);
      }
      if (plansRes.data) {
        setPhasePlans(
          (plansRes.data as Array<{
            id: string; epic_key: string; phase: string;
            start_date: string | null; updated_at: string;
          }>).map(r => ({
            id:        r.id,
            epicKey:   r.epic_key,
            phase:     r.phase as PlanningPhase,
            startDate: r.start_date,
            updatedAt: r.updated_at,
          }))
        );
      }
      if (assignRes.data) {
        setPhaseAssignments(
          (assignRes.data as Array<{
            id: string; epic_key: string; phase: string;
            member_id: string; track: string; days: number; updated_at: string;
          }>).map(r => ({
            id:        r.id,
            epicKey:   r.epic_key,
            phase:     r.phase as PlanningPhase,
            memberId:  r.member_id,
            track:     r.track as 'IT' | 'BIZ',
            days:      r.days,
            updatedAt: r.updated_at,
          }))
        );
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

  // ── Phase start date ──────────────────────────────────────────────────────
  const setPhaseStartDate = useCallback(async (
    epicKey: string,
    phase: PlanningPhase,
    startDate: string,
  ) => {
    const now = new Date().toISOString();
    const existing = phasePlans.find(p => p.epicKey === epicKey && p.phase === phase);

    // Optimistic update
    if (existing) {
      setPhasePlans(prev => prev.map(p =>
        p.epicKey === epicKey && p.phase === phase
          ? { ...p, startDate, updatedAt: now }
          : p
      ));
    } else {
      const tempId = `local-${epicKey}-${phase}`;
      setPhasePlans(prev => [...prev, { id: tempId, epicKey, phase, startDate, updatedAt: now }]);
    }

    if (!isSupabaseConfigured()) return;

    const { data, error } = await supabase
      .from('epic_phase_plans')
      .upsert({ epic_key: epicKey, phase, start_date: startDate }, { onConflict: 'epic_key,phase' })
      .select()
      .single();

    if (!error && data) {
      const row = data as { id: string; epic_key: string; phase: string; start_date: string | null; updated_at: string };
      setPhasePlans(prev => {
        const without = prev.filter(p => !(p.epicKey === epicKey && p.phase === phase) || p.id === row.id);
        const alreadyHas = without.some(p => p.id === row.id);
        return alreadyHas
          ? without.map(p => p.id === row.id ? { ...p, startDate: row.start_date, updatedAt: row.updated_at } : p)
          : [...without.filter(p => !(p.epicKey === epicKey && p.phase === phase)),
             { id: row.id, epicKey: row.epic_key, phase: row.phase as PlanningPhase, startDate: row.start_date, updatedAt: row.updated_at }];
      });
    }
  }, [phasePlans]);

  // ── Clear phase (remove start date) ──────────────────────────────────────
  const clearPhase = useCallback(async (epicKey: string, phase: PlanningPhase) => {
    const now = new Date().toISOString();
    setPhasePlans(prev => prev.map(p =>
      p.epicKey === epicKey && p.phase === phase ? { ...p, startDate: null, updatedAt: now } : p
    ));

    if (!isSupabaseConfigured()) return;

    await supabase
      .from('epic_phase_plans')
      .upsert({ epic_key: epicKey, phase, start_date: null }, { onConflict: 'epic_key,phase' });
  }, []);

  // ── Assignments ───────────────────────────────────────────────────────────
  const upsertAssignment = useCallback(async (
    epicKey: string,
    phase: PlanningPhase,
    memberId: string,
    days: number,
    track: 'IT' | 'BIZ',
  ) => {
    const now      = new Date().toISOString();
    const existing = phaseAssignments.find(a => a.epicKey === epicKey && a.phase === phase && a.memberId === memberId);

    if (existing) {
      setPhaseAssignments(prev => prev.map(a =>
        a.epicKey === epicKey && a.phase === phase && a.memberId === memberId
          ? { ...a, days, track, updatedAt: now }
          : a
      ));
    } else {
      const tempId = `local-${epicKey}-${phase}-${memberId}`;
      setPhaseAssignments(prev => [
        ...prev,
        { id: tempId, epicKey, phase, memberId, track, days, updatedAt: now },
      ]);
    }

    if (!isSupabaseConfigured()) return;

    const { data, error } = await supabase
      .from('epic_phase_assignments')
      .upsert(
        { epic_key: epicKey, phase, member_id: memberId, days, track },
        { onConflict: 'epic_key,phase,member_id' }
      )
      .select()
      .single();

    if (!error && data) {
      const row = data as { id: string; epic_key: string; phase: string; member_id: string; track: string; days: number; updated_at: string };
      setPhaseAssignments(prev => {
        const filtered = prev.filter(a => !(a.epicKey === epicKey && a.phase === phase && a.memberId === memberId));
        return [
          ...filtered,
          { id: row.id, epicKey: row.epic_key, phase: row.phase as PlanningPhase, memberId: row.member_id, track: row.track as 'IT' | 'BIZ', days: row.days, updatedAt: row.updated_at },
        ];
      });
    }
  }, [phaseAssignments]);

  const removeAssignment = useCallback(async (epicKey: string, phase: PlanningPhase, memberId: string) => {
    setPhaseAssignments(prev =>
      prev.filter(a => !(a.epicKey === epicKey && a.phase === phase && a.memberId === memberId))
    );

    if (!isSupabaseConfigured()) return;

    await supabase
      .from('epic_phase_assignments')
      .delete()
      .match({ epic_key: epicKey, phase, member_id: memberId });
  }, []);

  return {
    boardEpicKeys,
    phasePlans,
    phaseAssignments,
    addEpicToBoard,
    removeEpicFromBoard,
    setPhaseStartDate,
    clearPhase,
    upsertAssignment,
    removeAssignment,
    loading,
  };
}
