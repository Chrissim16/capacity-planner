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
  'bg-[#E8F8F8] text-[#0BB8B5]',
  'bg-[#DCFCE7] text-[#166534]',
  'bg-[#FFF7ED] text-[#92400E]',
  'bg-[#F5F3F0] text-[#6B7280]',
  'bg-[#FFF5F5] text-[#991B1B]',
  'bg-[#EDE9FE] text-[#5B21B6]',
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
            startQuarter: phase.startQuarter ?? '',
            endQuarter: phase.endQuarter ?? '',
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
        <div className="flex items-center gap-3 pb-3 border-b border-[#F0EFED]">
          <div className="w-10 h-10 rounded-full bg-[#E8F8F8] border border-[#0ED3CF]/30 flex items-center justify-center text-[#0BB8B5] font-semibold text-sm">
            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="font-semibold text-[#1A1A1A]">{member.name}</h2>
            <p className="text-xs text-[#9CA3AF]">{member.role}</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Calendar size={14} className="text-[#9CA3AF]" />
            <span className="text-xs text-[#9CA3AF]">Availability Calendar</span>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-[#F5F3F0] text-[#6B7280] transition-colors duration-150"
          >
            <ChevronLeft size={16} />
          </button>
          <h3 className="font-semibold text-[#1A1A1A]">
            {MONTHS[viewMonth]} {viewYear}
          </h3>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-[#F5F3F0] text-[#6B7280] transition-colors duration-150"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 text-center text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-[#E5E5E3] rounded-lg overflow-hidden">
          {days.map((d, idx) => {
            const isCurrentMonth = d.getMonth() === viewMonth;
            const dateStr = isoDate(d);
            const isToday = dateStr === isoDate(today);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const isHoliday = memberHolidays.has(dateStr);
            const timeOff = getTimeOff(dateStr);
            const activeProjects = isCurrentMonth && !isWeekend ? getProjectsForDate(d) : [];

            let bg = 'bg-white';
            let dateColor = isCurrentMonth ? 'text-[#6B7280]' : 'text-[#D1D5DB]';

            if (isWeekend)  bg = 'bg-[#FAF9F7]';
            if (isHoliday)  bg = 'bg-[#FFF7ED]';
            if (timeOff)    bg = 'bg-[#FFF5F5]';
            if (isToday)    dateColor = 'text-[#0ED3CF] font-bold';

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
                      <span className="text-[9px] leading-tight px-1 rounded bg-[#FED7AA] text-[#92400E] truncate">
                        Holiday
                      </span>
                    )}
                    {timeOff && (
                      <span className="text-[9px] leading-tight px-1 rounded bg-[#FECACA] text-[#991B1B] truncate">
                        Time off
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
                      <span className="text-[9px] text-[#9CA3AF]">+{activeProjects.length - 2} more</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-[#F0EFED] text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#FED7AA] border border-[#F97316]/20" />
            <span className="text-[#6B7280]">Public holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#FECACA] border border-[#EF4444]/20" />
            <span className="text-[#6B7280]">Time off</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#FAF9F7] border border-[#E5E5E3]" />
            <span className="text-[#6B7280]">Weekend</span>
          </div>
          {legendProjects.map(p => (
            <div key={p.projectId} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${PROJECT_COLORS[p.colorIdx].split(' ')[0]}`} />
              <span className="text-[#6B7280] truncate max-w-[120px]">{p.projectName}</span>
            </div>
          ))}
          {legendProjects.length === 0 && (
            <span className="text-[#9CA3AF] italic">No project assignments recorded</span>
          )}
        </div>
      </div>
    </Modal>
  );
}
