import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Trash2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { SkeletonList } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { supabase } from '../../services/supabase';
import { useCurrentUser, type AppRole } from '../../hooks/useCurrentUser';

interface UserRow {
 id: string;
 email: string;
 role: string;
 created_at: string;
 last_sign_in_at: string | null;
}

const ALL_ROLES: AppRole[] = ['system_admin', 'project_manager', 'read_only'];

const ROLE_LABELS: Record<string, string> = {
 system_admin: 'System Administrator',
 project_manager: 'Project Manager',
 read_only: 'Read Only',
};

function formatDate(iso: string | null): string {
 if (!iso) return '—';
 return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function UsersSection() {
 const { user, can } = useCurrentUser();
 const { showToast } = useToast();
 const isAdmin = can('manage_users');

 const [users, setUsers] = useState<UserRow[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 // Invite form state
 const [inviteEmail, setInviteEmail] = useState('');
 const [inviteRole, setInviteRole] = useState<AppRole>('project_manager');
 const [isInviting, setIsInviting] = useState(false);

 // Role update state: maps userId → true while saving
 const [savingRole, setSavingRole] = useState<Record<string, boolean>>({});

 // Remove confirm state
 const [pendingRemove, setPendingRemove] = useState<UserRow | null>(null);
 const [isRemoving, setIsRemoving] = useState(false);

 const fetchUsers = useCallback(async () => {
 setLoading(true);
 setError(null);
 const { data, error: rpcError } = await supabase.rpc('get_users_with_roles');
 if (rpcError) {
 setError('Failed to load users. Please try again.');
 } else {
 setUsers((data as UserRow[]) ?? []);
 }
 setLoading(false);
 }, []);

 useEffect(() => {
 void fetchUsers();
 }, [fetchUsers]);

 const handleRoleChange = async (userId: string, newRole: AppRole) => {
 setSavingRole((prev) => ({ ...prev, [userId]: true }));
 const { error: upsertError } = await supabase
 .from('user_roles')
 .upsert({ user_id: userId, role: newRole }, { onConflict: 'user_id' });

 setSavingRole((prev) => ({ ...prev, [userId]: false }));

 if (upsertError) {
 showToast('Failed to update role. Please try again.', 'error');
 } else {
 setUsers((prev) =>
 prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
 );
 showToast('Role updated.', 'success');
 }
 };

 const handleInvite = async () => {
 const trimmedEmail = inviteEmail.trim().toLowerCase();
 if (!trimmedEmail) {
 showToast('Please enter an email address.', 'warning');
 return;
 }
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
 showToast('Please enter a valid email address.', 'warning');
 return;
 }

 setIsInviting(true);
 try {
 const { data: sessionData } = await supabase.auth.getSession();
 const jwt = sessionData.session?.access_token;

 const res = await fetch('/api/admin', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${jwt ?? ''}`,
 },
 body: JSON.stringify({ action: 'invite', email: trimmedEmail, role: inviteRole }),
 });

 const body = await res.json() as { error?: string };
 if (!res.ok) {
 showToast(body.error ?? 'Failed to send invitation.', 'error');
 } else {
 showToast(`Invitation sent to ${trimmedEmail}.`, 'success');
 setInviteEmail('');
 setInviteRole('project_manager');
 void fetchUsers();
 }
 } catch {
 showToast('An unexpected error occurred. Please try again.', 'error');
 } finally {
 setIsInviting(false);
 }
 };

 const handleRemoveConfirm = async () => {
 if (!pendingRemove) return;
 setIsRemoving(true);
 try {
 const { data: sessionData } = await supabase.auth.getSession();
 const jwt = sessionData.session?.access_token;

 const res = await fetch('/api/admin', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${jwt ?? ''}`,
 },
 body: JSON.stringify({ action: 'remove', userId: pendingRemove.id }),
 });

 const body = await res.json() as { error?: string };
 if (!res.ok) {
 showToast(body.error ?? 'Failed to remove user.', 'error');
 } else {
 showToast(`${pendingRemove.email} has been removed.`, 'success');
 setUsers((prev) => prev.filter((u) => u.id !== pendingRemove.id));
 }
 } catch {
 showToast('An unexpected error occurred. Please try again.', 'error');
 } finally {
 setIsRemoving(false);
 setPendingRemove(null);
 }
 };

 return (
 <>
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>Users</CardTitle>
 <p className="mt-1 text-sm text-[#6C7A89] ">
 {isAdmin
 ? 'Manage who has access and what they can do.'
 : 'View who has access to this workspace.'}
 </p>
 </div>
 <button
 onClick={() => void fetchUsers()}
 aria-label="Refresh user list"
 className="p-2 rounded-lg text-[#6C7A89] hover:text-[#6C7A89] hover:bg-[#EEEEF1] transition-colors"
 >
 <RefreshCw size={16} />
 </button>
 </div>
 </CardHeader>

 <CardContent className="space-y-4">
 {/* Invite row — admin only */}
 {isAdmin && (
 <div className="flex flex-col sm:flex-row gap-2 pb-4 border-b border-[#CFCFD5] ">
 <div className="flex-1">
 <Input
 type="email"
 placeholder="colleague@company.com"
 value={inviteEmail}
 onChange={(e) => setInviteEmail(e.target.value)}
 onKeyDown={(e) => { if (e.key === 'Enter') void handleInvite(); }}
 autoComplete="off"
 />
 </div>
 <select
 value={inviteRole}
 onChange={(e) => setInviteRole(e.target.value as AppRole)}
 className="h-10 px-3 rounded-lg border-2 border-[#CFCFD5] bg-white text-sm text-[#003565] focus:outline-none focus:ring-2 focus:ring-[#0089DD]"
 >
 {ALL_ROLES.map((r) => (
 <option key={r} value={r}>{ROLE_LABELS[r]}</option>
 ))}
 </select>
 <Button
 onClick={() => void handleInvite()}
 isLoading={isInviting}
 disabled={isInviting}
 size="md"
 >
 <UserPlus size={16} />
 Send invite
 </Button>
 </div>
 )}

 {/* User list */}
 {loading && <SkeletonList rows={4} />}

 {!loading && error && (
 <div className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
 <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
 <button
 onClick={() => void fetchUsers()}
 className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline ml-4"
 >
 Retry
 </button>
 </div>
 )}

 {!loading && !error && users.length === 0 && (
 <p className="text-center py-8 text-[#6C7A89]">No users found.</p>
 )}

 {!loading && !error && users.length > 0 && (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[#CFCFD5] ">
 <th className="text-left py-2 px-3 font-medium text-[#6C7A89] ">Email</th>
 <th className="text-left py-2 px-3 font-medium text-[#6C7A89] ">Role</th>
 <th className="text-left py-2 px-3 font-medium text-[#6C7A89] ">Joined</th>
 {isAdmin && (
 <th className="py-2 px-3 font-medium text-[#6C7A89] w-16" />
 )}
 </tr>
 </thead>
 <tbody>
 {users.map((u) => {
 const isCurrentUser = u.id === user?.id;
 const isSavingThisRow = !!savingRole[u.id];
 return (
 <tr
 key={u.id}
 className="border-b border-[#DEDFE3] dark:border-slate-800 hover:bg-[#EEEEF1] /40 transition-colors"
 >
 <td className="py-3 px-3 text-[#003565] ">
 {u.email}
 {isCurrentUser && (
 <span className="ml-2 text-xs text-[#6C7A89]">(you)</span>
 )}
 </td>
 <td className="py-3 px-3">
 {isAdmin && !isCurrentUser ? (
 <select
 value={u.role}
 disabled={isSavingThisRow}
 onChange={(e) => void handleRoleChange(u.id, e.target.value as AppRole)}
 className="h-8 px-2 rounded-md border border-[#CFCFD5] bg-white text-sm text-[#003565] focus:outline-none focus:ring-2 focus:ring-[#0089DD] disabled:opacity-50"
 >
 {ALL_ROLES.map((r) => (
 <option key={r} value={r}>{ROLE_LABELS[r]}</option>
 ))}
 </select>
 ) : (
 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#EEEEF1] text-[#6C7A89] ">
 {ROLE_LABELS[u.role] ?? u.role}
 </span>
 )}
 </td>
 <td className="py-3 px-3 text-[#6C7A89] ">
 {formatDate(u.created_at)}
 </td>
 {isAdmin && (
 <td className="py-3 px-3 text-right">
 {!isCurrentUser && (
 <button
 onClick={() => setPendingRemove(u)}
 aria-label={`Remove ${u.email}`}
 className="p-1.5 text-[#6C7A89] hover:text-red-500 transition-colors rounded focus:outline-none focus:ring-2 focus:ring-red-500"
 >
 <Trash2 size={15} />
 </button>
 )}
 </td>
 )}
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </CardContent>
 </Card>

 <ConfirmModal
 isOpen={!!pendingRemove}
 onClose={() => !isRemoving && setPendingRemove(null)}
 onConfirm={() => void handleRemoveConfirm()}
 title="Remove user"
 message={`Remove ${pendingRemove?.email ?? 'this user'}? They will immediately lose access to the workspace.`}
 confirmLabel={isRemoving ? 'Removing…' : 'Remove'}
 cancelLabel="Cancel"
 variant="danger"
 />
 </>
 );
}
