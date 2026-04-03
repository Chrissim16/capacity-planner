import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { CapacityRequest, JiraWorkItem, Sprint } from '../../types';
import { CapacityRequestCard, type CapacityJiraItemMeta } from './CapacityRequestCard';

interface CapacityBacklogProps {
  jiraItems: JiraWorkItem[];
  requests: CapacityRequest[];
  sprints: Sprint[];
  onAddRequest: (req: Omit<CapacityRequest, 'id' | 'createdAt'>) => void;
  onRemoveRequest: (id: string) => void;
  jiraItemMetaById?: Map<string, CapacityJiraItemMeta>;
}

export function CapacityBacklog({
  jiraItems,
  requests,
  sprints,
  onAddRequest,
  onRemoveRequest,
  jiraItemMetaById,
}: CapacityBacklogProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [days, setDays] = useState('1');
  const [sprintId, setSprintId] = useState('');
  const [skills, setSkills] = useState('');

  const filteredJira = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return jiraItems;
    return jiraItems.filter((item) =>
      item.summary.toLowerCase().includes(query) ||
      item.jiraKey.toLowerCase().includes(query) ||
      item.typeName.toLowerCase().includes(query),
    );
  }, [jiraItems, search]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((request) =>
      request.name.toLowerCase().includes(query) ||
      request.requiredSkills?.some((skill) => skill.toLowerCase().includes(query)),
    );
  }, [requests, search]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAddRequest({
      name: name.trim(),
      estimatedDays: Number(days),
      sprintId: sprintId || undefined,
      requiredSkills: skills
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean),
    });
    setName('');
    setDays('1');
    setSprintId('');
    setSkills('');
    setAdding(false);
  };

  if (collapsed) {
    return (
      <div className="flex h-full w-[52px] flex-col items-center border-r border-[#DEDFE3] bg-white py-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-lg border border-[#DEDFE3] bg-white p-2 text-[#64748B] hover:bg-[#F8FAFC]"
          aria-label="Expand backlog"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex h-full w-[280px] flex-col border-r border-[#DEDFE3] bg-white">
      <div className="flex items-center justify-between border-b border-[#DEDFE3] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1E293B]">Backlog</h2>
          <p className="text-xs text-[#94A3B8]">Imported Jira delivery items plus scenario-only what-if work</p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#334155]"
          aria-label="Collapse backlog"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="border-b border-[#DEDFE3] px-4 py-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search backlog…"
          className="w-full rounded-lg border border-[#DEDFE3] px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-[#0089DD]"
        />
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div className="rounded-xl border border-[#E0E7FF] bg-[#F8FAFF] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4F46E5]">Planning input</p>
          <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
            Prioritize imported Jira items for delivery planning. Use what-if requests only for scenario work that is not yet represented in Jira breakdown.
          </p>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
              Imported Jira Items
            </h3>
            <span className="text-xs text-[#94A3B8]">{filteredJira.length}</span>
          </div>
          <p className="text-xs leading-relaxed text-[#94A3B8]">
            Features, stories, tasks, and bugs from Jira that are still unscheduled in the current delivery scenario.
          </p>
          <div className="space-y-2">
            {filteredJira.map((item) => (
              <CapacityRequestCard
                key={item.id}
                entry={{ kind: 'jira', item }}
                jiraMeta={jiraItemMetaById?.get(item.id)}
              />
            ))}
            {filteredJira.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#DEDFE3] px-3 py-4 text-xs text-[#94A3B8]">
                No unscheduled Jira items match this filter.
              </p>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                Scenario What-if Requests
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#94A3B8]">
                Optional scenario-only delivery work. These requests are not imported from Jira and do not count as breakdown coverage.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAdding((value) => !value)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#0089DD] hover:bg-[#EFF6FF]"
            >
              <Plus size={12} />
              Add what-if
            </button>
          </div>

          {adding ? (
            <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border border-[#DEDFE3] bg-[#F8FAFC] p-3">
              <p className="text-xs leading-relaxed text-[#64748B]">
                Capture delivery work you want to compare inside this scenario before it exists in Jira.
              </p>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="What-if request name"
                className="w-full rounded-lg border border-[#DEDFE3] px-3 py-2 text-sm outline-none focus:border-[#0089DD]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  placeholder="Days"
                  className="rounded-lg border border-[#DEDFE3] px-3 py-2 text-sm outline-none focus:border-[#0089DD]"
                />
                <select
                  value={sprintId}
                  onChange={(event) => setSprintId(event.target.value)}
                  className="rounded-lg border border-[#DEDFE3] px-3 py-2 text-sm outline-none focus:border-[#0089DD]"
                >
                  <option value="">Any sprint</option>
                  {sprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={skills}
                onChange={(event) => setSkills(event.target.value)}
                placeholder="Skills (comma separated)"
                className="w-full rounded-lg border border-[#DEDFE3] px-3 py-2 text-sm outline-none focus:border-[#0089DD]"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="rounded-lg px-3 py-2 text-xs text-[#64748B] hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#0089DD] px-3 py-2 text-xs font-medium text-white hover:bg-[#0077C2]"
                >
                  Save request
                </button>
              </div>
            </form>
          ) : null}

          <div className="space-y-2">
            {filteredRequests.map((request) => (
              <CapacityRequestCard
                key={request.id}
                entry={{ kind: 'request', item: request }}
                onRemoveRequest={onRemoveRequest}
              />
            ))}
            {filteredRequests.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#DEDFE3] px-3 py-4 text-xs text-[#94A3B8]">
                No scenario what-if requests yet.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </aside>
  );
}
