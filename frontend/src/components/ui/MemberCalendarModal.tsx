import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Modal } from './Modal';
import { useCurrentState } from '../../stores/appStore';
import type { TeamMember } from '../../types';

interface MemberCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: TeamMember | null;
}

// Returns all days in a calendar month including leading/trailing days for the grid
function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];

  // Leading days from previous month (week starts Monday)
  const startDow = (firstDay.getDay() + 6) % 7; // 0=Mon, 6=Sun
  for (let i = startDow - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }

  // Days of this month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  // Trailing days to fill the grid
  const remainder = days.length % 7;
  if (remainder > 0) {
    for (let d = 1; d <= 7 - remainder; d++) {
      days.push(new Date(year, month + 1, d));
    }
  }

  return days;
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const PROJECT_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
];

export function MemberCalendarModal({ isOpen, onClose, member }: MemberCalendarModalProps) {
  const state = useCurrentState();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Time-off entries for this member
  const memberTimeOff = useMemo(() => {
    if (!member) return [];
    return state.timeOff.filter(t => t.memberId === member.id);
  }, [state.timeOff, member]);

  // Public holidays for member's country
  const memberHolidays = useMemo(() => {
    if (!member) return new Set<string>();
    const country = state.countries.find((c: { id: string }) => c.id === member.countryId);
    if (!country) return new Set<string>();
    const holidays = state.publicHolidays.filter(h => h.countryId === country.id);
    return new Set(holidays.map(h => h.date));
  }, [member, state.countries, state.publicHolidays]);

  // Active projects/phases for member (by quarter)
  const memberProjects = useMemo(() => {
    if (!member) return [];
    const result: { projectId: string; projectName: string; colorIdx: number; startQuarter: string; endQuarter: string }[] = [];
    let colorIdx = 0;
    state.projects.forEach(project => {
      project.phases.forEach(phase => {
        const hasAssignment = phase.assignments.some(a => a.memberId === member.id);
        if (hasAssignment) {
          result.push({
            projectId: project.id,
            projectName: project.name,
            colorIdx: colorIdx % PROJECT_COLORS.length,
            startQuarter: phase.startQuarter,
            endQuarter: phase.endQuarter,
          });
          colorIdx++;
        }
      });
    });
    return result;
  }, [member, state.projects]);

  // For a given date, check if it's in a time-off range
  const getTimeOff = (dateStr: string) =>
    memberTimeOff.find(t => dateStr >= t.startDate && dateStr <= t.endDate);

  // For a given date, check which projects are active (by quarter)
  const getProjectsForDate = (d: Date) => {
    const year = d.getFullYear();
    const month = d.getMonth();
    const quarter = `Q${Math.ceil((month + 1) / 3)} ${year}`;
    return memberProjects.filter(p => {
      // Check if this quarter falls within the phase range
      if (p.startQuarter > quarter || p.endQuarter < quarter) return false;
      return true;
    });
  };

  const days = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  if (!member) return null;

  // Build a compact legend from active project assignments
  const legendProjects = Array.from(
    new Map(memberProjects.map(p => [p.projectId, p])).values()
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <div className="space-y-4">
        {/* Member header */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">{member.name}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{member.role}</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Calendar size={14} className="text-slate-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Availability Calendar</span>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <ChevronLeft size={16} />
          </button>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {MONTHS[viewMonth]} {viewYear}
          </h3>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden">
          {days.map((d, idx) => {
            const isCurrentMonth = d.getMonth() === viewMonth;
            const dateStr = isoDate(d);
            const isToday = dateStr === isoDate(today);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const isHoliday = memberHolidays.has(dateStr);
            const timeOff = getTimeOff(dateStr);
            const activeProjects = isCurrentMonth && !isWeekend ? getProjectsForDate(d) : [];

            let bg = 'bg-white dark:bg-slate-900';
            let dateColor = isCurrentMonth ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600';

            if (isWeekend)  bg = 'bg-slate-50 dark:bg-slate-800/40';
            if (isHoliday)  bg = 'bg-amber-50 dark:bg-amber-900/20';
            if (timeOff)    bg = 'bg-red-50 dark:bg-red-900/20';
            if (isToday)    dateColor = 'text-blue-600 dark:text-blue-400 font-bold';

            return (
              <div
                key={idx}
                className={`min-h-[72px] p-1.5 ${bg} flex flex-col`}
              >
                <span className={`text-xs leading-none mb-1 ${dateColor}`}>
                  {d.getDate()}
                </span>

                {isCurrentMonth && (
                  <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                    {isHoliday && (
                      <span className="text-[9px] leading-tight px-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-800/50 dark:text-amber-300 truncate">
                        🏖️ Holiday
                      </span>
                    )}
                    {timeOff && (
                      <span className="text-[9px] leading-tight px-1 rounded bg-red-100 text-red-700 dark:bg-red-800/40 dark:text-red-300 truncate">
                        🏠 Off
                      </span>
                    )}
                    {!isWeekend && !timeOff && activeProjects.slice(0, 2).map(p => (
                      <span
                        key={p.projectId}
                        className={`text-[9px] leading-tight px-1 rounded truncate ${PROJECT_COLORS[p.colorIdx]}`}
                        title={p.projectName}
                      >
                        {p.projectName}
                      </span>
                    ))}
                    {activeProjects.length > 2 && (
                      <span className="text-[9px] text-slate-400">+{activeProjects.length - 2} more</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700" />
            <span className="text-slate-600 dark:text-slate-400">Public holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700" />
            <span className="text-slate-600 dark:text-slate-400">Time off</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700" />
            <span className="text-slate-600 dark:text-slate-400">Weekend</span>
          </div>
          {legendProjects.map(p => (
            <div key={p.projectId} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${PROJECT_COLORS[p.colorIdx].split(' ')[0]}`} />
              <span className="text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{p.projectName}</span>
            </div>
          ))}
          {legendProjects.length === 0 && (
            <span className="text-slate-400 dark:text-slate-500 italic">No project assignments recorded</span>
          )}
        </div>
      </div>
    </Modal>
  );
}
