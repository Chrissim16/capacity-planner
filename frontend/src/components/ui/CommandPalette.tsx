import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, FolderKanban, Users, ExternalLink, ArrowRight } from 'lucide-react';
import { useCurrentState } from '../../stores/appStore';
import type { ViewType } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewType, payload?: CommandPayload) => void;
}

export interface CommandPayload {
  highlightId?: string;
}

interface SearchResult {
  id: string;
  type: 'project' | 'member' | 'jira';
  label: string;
  sublabel?: string;
  view: ViewType;
  payload?: CommandPayload;
}

export function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const state = useCurrentState();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const results = useMemo((): SearchResult[] => {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const out: SearchResult[] = [];

    // Projects
    state.projects
      .filter(p => !p.archived && p.name.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach(p => out.push({
        id: `project-${p.id}`,
        type: 'project',
        label: p.name,
        sublabel: `${p.status} · ${p.phases.length} feature${p.phases.length !== 1 ? 's' : ''}`,
        view: 'projects',
        payload: { highlightId: p.id },
      }));

    // Team members
    state.teamMembers
      .filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.role ?? '').toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q)
      )
      .slice(0, 5)
      .forEach(m => out.push({
        id: `member-${m.id}`,
        type: 'member',
        label: m.name,
        sublabel: m.role,
        view: 'team',
        payload: { highlightId: m.id },
      }));

    // Jira work items
    const jiraItems = state.jiraWorkItems ?? [];
    jiraItems
      .filter(w =>
        w.summary.toLowerCase().includes(q) ||
        w.jiraKey.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .forEach(w => out.push({
        id: `jira-${w.id}`,
        type: 'jira',
        label: w.summary,
        sublabel: `${w.jiraKey} · ${w.typeName}`,
        view: 'projects',
        payload: { highlightId: w.id },
      }));

    return out;
  }, [query, state.projects, state.teamMembers, state.jiraWorkItems]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, results.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && results[activeIndex]) {
        select(results[activeIndex]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, results, activeIndex]);

  // Reset active index when results change
  useEffect(() => { setActiveIndex(0); }, [results]);

  const select = (result: SearchResult) => {
    onNavigate(result.view, result.payload);
    onClose();
  };

  const typeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'project': return <FolderKanban size={14} className="text-blue-500 shrink-0" />;
      case 'member':  return <Users size={14} className="text-slate-500 shrink-0" />;
      case 'jira':    return <ExternalLink size={14} className="text-slate-500 shrink-0" />;
    }
  };

  const typeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'project': return 'Epic';
      case 'member':  return 'Member';
      case 'jira':    return 'Jira';
    }
  };

  // Group results by type for headers
  const grouped = useMemo(() => {
    const groups: { type: SearchResult['type']; label: string; items: SearchResult[] }[] = [];
    const seen = new Set<SearchResult['type']>();
    results.forEach(r => {
      if (!seen.has(r.type)) {
        seen.add(r.type);
        groups.push({ type: r.type, label: typeLabel(r.type), items: [] });
      }
      groups.find(g => g.type === r.type)!.items.push(r);
    });
    return groups;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  if (!isOpen) return null;

  // Global flat index for keyboard nav
  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search epics, team members, Jira items…"
            className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none"
          />
          <kbd className="hidden sm:inline text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {query.trim() === '' && (
            <div className="py-8 text-center text-sm text-slate-400">
              Type to search across epics, members, and Jira items
            </div>
          )}

          {query.trim() !== '' && results.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-400">
              No results for <strong className="text-slate-600 dark:text-slate-300">"{query}"</strong>
            </div>
          )}

          {grouped.map(group => (
            <div key={group.type}>
              <div className="px-4 pt-3 pb-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {group.label}s
                </span>
              </div>
              {group.items.map(result => {
                const idx = flatIndex++;
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={result.id}
                    onClick={() => select(result)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {typeIcon(result.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {result.label}
                      </p>
                      {result.sublabel && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {result.sublabel}
                        </p>
                      )}
                    </div>
                    {isActive && (
                      <ArrowRight size={14} className="text-blue-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 text-xs text-slate-400">
            <span><kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">↑↓</kbd> navigate</span>
            <span><kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">↵</kbd> select</span>
            <span><kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Esc</kbd> close</span>
          </div>
        )}
      </div>
    </div>
  );
}
