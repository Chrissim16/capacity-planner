import { useState } from 'react';
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, Archive, ArchiveRestore } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { useCurrentState } from '../../stores/appStore';
import {
  addBusinessContact,
  updateBusinessContact,
  deleteBusinessContact,
  addBusinessTimeOff,
  removeBusinessTimeOff,
} from '../../stores/actions';
import type { BusinessContact } from '../../types';

const blankContact = (): Omit<BusinessContact, 'id'> => ({
  name: '',
  title: '',
  department: '',
  email: '',
  countryId: '',
  workingDaysPerWeek: 5,
  workingHoursPerDay: 8,
  notes: '',
  archived: false,
  projectIds: [],
});

export function BusinessContactsSection() {
  const state = useCurrentState();
  const { businessContacts, businessTimeOff, countries } = state;

  const [showArchived, setShowArchived] = useState(false);
  const [editContact, setEditContact] = useState<BusinessContact | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(blankContact());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<BusinessContact | null>(null);
  const [expandedTimeOff, setExpandedTimeOff] = useState<string | null>(null);
  // Time-off add form
  const [toContactId, setToContactId] = useState('');
  const [toStart, setToStart] = useState('');
  const [toEnd, setToEnd] = useState('');
  const [toType, setToType] = useState<'holiday' | 'other'>('holiday');
  const [toNotes, setToNotes] = useState('');

  const countryOptions = [
    { value: '', label: 'Select country…' },
    ...countries.map(c => ({ value: c.id, label: `${c.flag ?? ''} ${c.name}`.trim() })),
  ];

  const typeOptions = [
    { value: 'holiday', label: 'Holiday / annual leave' },
    { value: 'other',   label: 'Other' },
  ];

  const visibleContacts = businessContacts.filter(c => showArchived || !c.archived);

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!form.name?.trim()) errs.name = 'Name is required';
    if (!form.countryId) errs.countryId = 'Country is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const openAdd = () => {
    setForm(blankContact());
    setFormErrors({});
    setIsAddOpen(true);
    setEditContact(null);
  };

  const openEdit = (c: BusinessContact) => {
    setForm({ ...c });
    setFormErrors({});
    setEditContact(c);
    setIsAddOpen(true);
  };

  const handleSave = () => {
    if (!validateForm()) return;
    if (editContact) {
      updateBusinessContact(editContact.id, form);
    } else {
      addBusinessContact(form);
    }
    setIsAddOpen(false);
  };

  const handleAddTimeOff = () => {
    if (!toContactId || !toStart || !toEnd) return;
    addBusinessTimeOff({ contactId: toContactId, startDate: toStart, endDate: toEnd, type: toType, notes: toNotes.trim() || undefined });
    setToStart('');
    setToEnd('');
    setToNotes('');
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Business Contacts</CardTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowArchived(v => !v)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                {showArchived ? 'Hide archived' : 'Show archived'}
              </button>
              <Button size="sm" onClick={openAdd}>
                <Plus size={14} />
                Add Contact
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleContacts.length === 0 && (
            <p className="text-center py-8 text-slate-400 text-sm">
              No business contacts yet. Add Finance Controllers, UAT leads, or process owners.
            </p>
          )}

          {visibleContacts.map(contact => {
            const contactTimeOff = businessTimeOff.filter(t => t.contactId === contact.id);
            const isToExpanded = expandedTimeOff === contact.id;
            const country = countries.find(c => c.id === contact.countryId);

            return (
              <div key={contact.id} className={`rounded-lg border ${contact.archived ? 'border-slate-200 dark:border-slate-700 opacity-60' : 'border-slate-200 dark:border-slate-700'} overflow-hidden`}>
                {/* Contact header row */}
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-white text-sm">{contact.name}</span>
                      {contact.archived && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 uppercase font-bold tracking-wide">Archived</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wide">BIZ</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {contact.title && <span>{contact.title}</span>}
                      {contact.title && contact.department && <span>·</span>}
                      {contact.department && <span>{contact.department}</span>}
                      {country && <span>· {country.flag} {country.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setExpandedTimeOff(isToExpanded ? null : contact.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      title="Time off"
                    >
                      {isToExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    <button
                      onClick={() => openEdit(contact)}
                      className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => updateBusinessContact(contact.id, { archived: !contact.archived })}
                      className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                      title={contact.archived ? 'Restore' : 'Archive'}
                    >
                      {contact.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(contact)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Time off panel */}
                {isToExpanded && (
                  <div className="px-4 py-3 space-y-3 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Time off</p>

                    {contactTimeOff.length === 0 && (
                      <p className="text-xs text-slate-400">No time off recorded.</p>
                    )}

                    {contactTimeOff.map(t => (
                      <div key={t.id} className="flex items-center gap-3 text-xs">
                        <span className="text-slate-700 dark:text-slate-300">{t.startDate} – {t.endDate}</span>
                        <span className="text-slate-400">{t.type}</span>
                        {t.notes && <span className="text-slate-400 truncate">{t.notes}</span>}
                        <button
                          onClick={() => removeBusinessTimeOff(t.id)}
                          className="ml-auto shrink-0 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}

                    {/* Add time off inline */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Input
                        type="date"
                        label="Start"
                        value={toContactId === contact.id ? toStart : ''}
                        onChange={e => { setToContactId(contact.id); setToStart(e.target.value); }}
                      />
                      <Input
                        type="date"
                        label="End"
                        value={toContactId === contact.id ? toEnd : ''}
                        min={toContactId === contact.id ? toStart : undefined}
                        onChange={e => { setToContactId(contact.id); setToEnd(e.target.value); }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        label="Type"
                        value={toContactId === contact.id ? toType : 'holiday'}
                        onChange={e => { setToContactId(contact.id); setToType(e.target.value as 'holiday' | 'other'); }}
                        options={typeOptions}
                      />
                      <Input
                        label="Notes (optional)"
                        value={toContactId === contact.id ? toNotes : ''}
                        onChange={e => { setToContactId(contact.id); setToNotes(e.target.value); }}
                        placeholder="e.g. Summer leave"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => { setToContactId(contact.id); handleAddTimeOff(); }}
                      disabled={!(toContactId === contact.id ? toStart && toEnd : false)}
                    >
                      <Plus size={13} /> Add time off
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Add / Edit modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title={editContact ? 'Edit Business Contact' : 'New Business Contact'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editContact ? 'Save Changes' : 'Add Contact'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Name"
              required
              value={form.name ?? ''}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              error={formErrors.name}
            />
            <Input
              label="Job title (optional)"
              value={form.title ?? ''}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Department (optional)"
              value={form.department ?? ''}
              onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
            />
            <Input
              label="Email (optional)"
              type="email"
              value={form.email ?? ''}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <Select
            label="Country"
            value={form.countryId ?? ''}
            onChange={e => setForm(f => ({ ...f, countryId: e.target.value }))}
            options={countryOptions}
            error={formErrors.countryId}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Working days / week"
              type="number"
              min="1"
              max="7"
              value={String(form.workingDaysPerWeek ?? 5)}
              onChange={e => setForm(f => ({ ...f, workingDaysPerWeek: parseInt(e.target.value) || 5 }))}
            />
            <Input
              label="Working hours / day"
              type="number"
              min="1"
              max="24"
              value={String(form.workingHoursPerDay ?? 8)}
              onChange={e => setForm(f => ({ ...f, workingHoursPerDay: parseInt(e.target.value) || 8 }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Any context about this contact's availability…"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Business Contact"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteBusinessContact(deleteConfirm!.id); setDeleteConfirm(null); }}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
          Their time off and all phase commitments will also be removed.
        </p>
      </Modal>
    </>
  );
}
