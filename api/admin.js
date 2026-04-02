const { createClient } = require('@supabase/supabase-js');

const ALLOWED_ORIGIN = process.env.FRONTEND_URL || 'https://capacity-planner-mw.vercel.app';

function normalizeInviteError(message) {
  const lower = message.toLowerCase();

  if (lower.includes('already registered')) {
    return 'A user with this email already exists.';
  }

  if (lower.includes('not authorized')) {
    return 'Supabase blocked the invite email for this address. Configure custom SMTP or add the recipient as an authorized team address in Supabase.';
  }

  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Invite emails are temporarily rate-limited. Please wait a bit and try again.';
  }

  if (lower.includes('smtp') || lower.includes('email') || lower.includes('mailer')) {
    return 'Supabase could not send the invite email. Check the project email and SMTP settings.';
  }

  return 'Failed to send invitation. Please try again.';
}

/**
 * Admin API route — invite and remove users.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY to be set in Vercel environment variables.
 * The service role key is NEVER exposed to the browser.
 *
 * All requests must include a valid Supabase JWT in the Authorization header.
 * The caller must have role = 'system_admin' in the user_roles table.
 *
 * Supported actions (POST body JSON):
 *   { action: 'invite', email: string, role: string }
 *   { action: 'remove', userId: string }
 */
module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Vary', 'Origin');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate env config
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[Admin] Missing Supabase configuration');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Verify caller JWT
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const callerJwt = authorization.slice(7);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify the token is valid and belongs to a real user
  const { data: { user: callerUser }, error: authError } = await adminClient.auth.getUser(callerJwt);
  if (authError || !callerUser) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Confirm the caller is a system_admin
  const { data: roleRow, error: roleError } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (roleError) {
    console.error('[Admin] Role lookup error:', roleError.message);
    return res.status(500).json({ error: 'Failed to verify permissions' });
  }
  if (!roleRow || roleRow.role !== 'system_admin') {
    return res.status(403).json({ error: 'Forbidden: system_admin role required' });
  }

  // Parse and validate body
  const { action, email, role, userId } = req.body || {};

  try {
    if (action === 'invite') {
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'email is required' });
      }
      const validRoles = ['system_admin', 'project_manager', 'read_only'];
      const assignedRole = validRoles.includes(role) ? role : 'project_manager';

      // Send the invitation email
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);
      if (inviteError) {
        const msg = normalizeInviteError(inviteError.message);
        console.error('[Admin] Invite user error:', inviteError.message);
        return res.status(400).json({ error: msg });
      }

      // Pre-assign the chosen role so the user lands with the right permissions on first login
      if (inviteData?.user?.id) {
        const { error: upsertError } = await adminClient
          .from('user_roles')
          .upsert({ user_id: inviteData.user.id, role: assignedRole }, { onConflict: 'user_id' });
        if (upsertError) {
          console.error('[Admin] Failed to pre-assign role:', upsertError.message);
          // Non-fatal: the user can still be assigned a role manually
        }
      }

      return res.status(200).json({ success: true });

    } else if (action === 'remove') {
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'userId is required' });
      }
      // Prevent self-removal
      if (userId === callerUser.id) {
        return res.status(400).json({ error: 'You cannot remove your own account.' });
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.error('[Admin] Delete user error:', deleteError.message);
        return res.status(500).json({ error: 'Failed to remove user. Please try again.' });
      }
      // user_roles row is removed automatically via ON DELETE CASCADE

      return res.status(200).json({ success: true });

    } else {
      return res.status(400).json({ error: `Unknown action: ${String(action)}` });
    }
  } catch (err) {
    console.error('[Admin] Unexpected error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};
