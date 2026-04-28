import { useEffect, useState } from 'react';
import {
  Building2, Edit, MapPin, Save, X, UserPlus, Trash2,
  CheckCircle, AlertCircle, Users, ShieldCheck, Info,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { staffApi } from '../../api/staff';

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island'] as const;

function Badge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    owner: 'bg-teal-50 text-teal-700 border-teal-200',
    admin: 'bg-blue-50 text-blue-700 border-blue-200',
    member: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${colors[role] ?? colors.member}`}>
      {role}
    </span>
  );
}

function Alert({ type, message }: { type: 'success' | 'error' | 'info'; message: string }) {
  const styles = {
    success: 'bg-teal-600 border-teal-700 text-white',
    error: 'bg-red-50 border-red-200 text-red-700',
    info: 'bg-teal-50 border-teal-200 text-teal-800',
  };
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertCircle : Info;
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${styles[type]}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function SettingsView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [orgMessage, setOrgMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({ name: '', description: '', borough: '' });
  const [initialForm, setInitialForm] = useState({ name: '', description: '', borough: '' });
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [myMembershipRole, setMyMembershipRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamMessage, setTeamMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [createStaff, setCreateStaff] = useState({
    username: '', personalEmail: '', fullName: '', role: 'member' as 'admin' | 'member',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<null | { email: string; tempPassword: string; personalEmail?: string; delivery?: 'email' | 'manual' }>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const canEdit = myMembershipRole === 'owner' || myMembershipRole === 'admin';

  useEffect(() => {
    async function loadOrg() {
      try {
        setLoading(true);
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        setMyProfileId(auth.user.id);

        const { data: membership } = await supabase
          .from('organization_members')
          .select('organization_id, role')
          .eq('profile_id', auth.user.id)
          .order('joined_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!membership?.organization_id) return;
        setOrgId(membership.organization_id);
        setMyMembershipRole((membership.role as any) ?? null);

        const { data: org } = await supabase
          .from('organizations')
          .select('name, description, borough')
          .eq('id', membership.organization_id)
          .single();

        if (org) {
          const next = { name: org.name || '', description: org.description || '', borough: org.borough || '' };
          setForm(next);
          setInitialForm(next);
        }
      } finally {
        setLoading(false);
      }
    }
    void loadOrg();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    void loadTeam();
  }, [orgId]);

  async function loadTeam() {
    try {
      setTeamLoading(true);
      const { data, error } = await supabase
        .from('organization_members')
        .select('profile_id, role, joined_at, username, profile:profiles!profile_id(id, full_name, email)')
        .eq('organization_id', orgId!)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      setTeamMembers(data ?? []);
    } catch (err: any) {
      setTeamMessage({ type: 'error', text: err?.message || 'Failed to load team.' });
    } finally {
      setTeamLoading(false);
    }
  }

  async function save() {
    if (!orgId) return;
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setOrgMessage({ type: 'error', text: 'Organization name is required.' });
      return;
    }
    if (form.borough && !BOROUGHS.includes(form.borough as any)) {
      setOrgMessage({ type: 'error', text: 'Please select a valid borough.' });
      return;
    }
    try {
      setSaving(true);
      setOrgMessage(null);
      const { error } = await supabase
        .from('organizations')
        .update({ name: trimmedName, description: form.description || null, borough: form.borough })
        .eq('id', orgId);
      if (error) throw error;
      setOrgMessage({ type: 'success', text: 'Organization settings saved.' });
      setInitialForm({ ...form, name: trimmedName });
      setIsEditing(false);
    } catch (err: any) {
      setOrgMessage({ type: 'error', text: err?.message || 'Failed to save changes.' });
    } finally {
      setSaving(false);
    }
  }

  function validateStaffForm() {
    const errors: Record<string, string> = {};
    const email = createStaff.personalEmail.trim();
    const username = createStaff.username.trim().toLowerCase();

    if (!email) errors.personalEmail = 'Personal email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.personalEmail = 'Enter a valid email address.';

    if (!username) errors.username = 'Username is required.';
    else if (username.length < 3) errors.username = 'Username must be at least 3 characters.';
    else if (username.length > 24) errors.username = 'Username must be 24 characters or less.';
    else if (!/^[a-z0-9._-]+$/.test(username)) errors.username = 'Only lowercase letters, numbers, dot, underscore, dash.';

    return errors;
  }

  async function createStaffAccount() {
    if (!orgId || !canEdit) return;
    if (!form.name.trim()) {
      setTeamMessage({ type: 'error', text: 'Save your organization name before adding staff.' });
      return;
    }
    const errors = validateStaffForm();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setTeamMessage(null);
      setCreatedCreds(null);
      setCreatingStaff(true);
      const res = await staffApi.createStaffAccount({
        organizationId: orgId,
        organizationName: form.name,
        username: createStaff.username.trim().toLowerCase(),
        personalEmail: createStaff.personalEmail.trim().toLowerCase(),
        fullName: createStaff.fullName.trim() || undefined,
        membershipRole: createStaff.role,
      });
      setCreatedCreds({ email: res.email, tempPassword: res.tempPassword, personalEmail: res.personalEmail, delivery: res.delivery });
      setTeamMessage({
        type: 'success',
        text: res.message || 'Staff account created. Share credentials securely with the staff member.',
      });
      setCreateStaff({ username: '', personalEmail: '', fullName: '', role: 'member' });
      setFieldErrors({});
      await loadTeam();
    } catch (err: any) {
      const msg = err?.message || 'Failed to create staff account.';
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('not found')) {
        setTeamMessage({
          type: 'error',
          text: 'Staff creation is unavailable — the server function is not yet deployed. Please contact your system administrator.',
        });
      } else {
        setTeamMessage({ type: 'error', text: msg });
      }
    } finally {
      setCreatingStaff(false);
    }
  }

  async function removeTeamMember(profileId: string) {
    if (!orgId || profileId === myProfileId) return;
    try {
      setRemovingId(profileId);
      setTeamMessage(null);
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', orgId)
        .eq('profile_id', profileId);
      if (error) throw error;
      setTeamMembers((prev) => prev.filter((m) => m.profile_id !== profileId));
      setTeamMessage({ type: 'success', text: 'Team member removed.' });
    } catch (err: any) {
      setTeamMessage({ type: 'error', text: err?.message || 'Failed to remove member.' });
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-gray-200 border-t-teal-600" />
      </div>
    );
  }

  const loginEmailPreview = createStaff.personalEmail.trim()
    ? createStaff.personalEmail.trim().toLowerCase()
    : null;

  return (
    <div className="max-w-3xl space-y-6">

      {/* ── Organization Details Card ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-gray-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Organization Details</h2>
              {!canEdit && <p className="text-xs text-gray-400 mt-0.5">Editable by owner / admin only</p>}
            </div>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setOrgMessage(null);
                if (isEditing) { setForm(initialForm); setIsEditing(false); }
                else setIsEditing(true);
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {isEditing ? <><X className="w-4 h-4" />Cancel</> : <><Edit className="w-4 h-4" />Edit</>}
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          {!isEditing ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Organization Name</p>
                <p className="text-lg font-bold text-gray-900">{form.name || <span className="text-gray-400 font-normal">Not set</span>}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Borough</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{form.borough || <span className="text-gray-400 font-normal">Not set</span>}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-gray-700 line-clamp-2">{form.description || <span className="text-gray-400">Not set</span>}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Organization Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Alpha Hive Community Services"
                  className="w-full h-11 border border-gray-200 rounded-xl px-3 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Borough</label>
                <select
                  value={form.borough}
                  onChange={(e) => setForm((p) => ({ ...p, borough: e.target.value }))}
                  className="w-full h-11 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-50 outline-none transition-all"
                >
                  <option value="">Select borough</option>
                  {BOROUGHS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of your organization's mission..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 outline-none transition-all resize-none"
                />
              </div>
              {orgMessage && <Alert type={orgMessage.type} message={orgMessage.text} />}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <button
                  onClick={() => void save()}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => { setForm(initialForm); setIsEditing(false); setOrgMessage(null); }}
                  className="h-10 px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors text-center"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {!isEditing && orgMessage && <Alert type={orgMessage.type} message={orgMessage.text} />}
        </div>
      </div>

      {/* ── Team Management Card ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-gray-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Team Management</h2>
              <p className="text-xs text-gray-400 mt-0.5">Manage staff logins for your organization</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
            <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Your role: <span className="text-gray-800">{myMembershipRole ?? 'member'}</span>
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {canEdit ? (
            <>
              <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3">
                <p className="text-xs font-semibold text-teal-800 mb-0.5">How staff accounts work</p>
                <p className="text-[11px] sm:text-xs text-teal-700 leading-relaxed">
                  Creating a staff account generates a login email and a temporary password.
                  Share these credentials securely with the staff member.
                </p>
              </div>

              {/* Add Staff Form */}
              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-teal-600" /> Add Staff Member
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                      Personal Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={createStaff.personalEmail}
                      onChange={(e) => {
                        setCreateStaff((p) => ({ ...p, personalEmail: e.target.value }));
                        if (fieldErrors.personalEmail) setFieldErrors((p) => ({ ...p, personalEmail: '' }));
                      }}
                      placeholder="staff@gmail.com"
                      className={`w-full h-10 border rounded-lg px-3 text-sm outline-none transition-all focus:ring-2 focus:ring-teal-50 ${
                        fieldErrors.personalEmail ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-teal-500'
                      }`}
                    />
                    {fieldErrors.personalEmail && <p className="text-xs text-red-500 mt-1">{fieldErrors.personalEmail}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                      Username <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={createStaff.username}
                      onChange={(e) => {
                        setCreateStaff((p) => ({ ...p, username: e.target.value }));
                        if (fieldErrors.username) setFieldErrors((p) => ({ ...p, username: '' }));
                      }}
                      placeholder="e.g. jaikumar"
                      className={`w-full h-10 border rounded-lg px-3 text-sm outline-none transition-all focus:ring-2 focus:ring-teal-50 ${
                        fieldErrors.username ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-teal-500'
                      }`}
                    />
                    {fieldErrors.username
                      ? <p className="text-xs text-red-500 mt-1">{fieldErrors.username}</p>
                      : loginEmailPreview && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          Login: <span className="font-mono text-gray-600">{loginEmailPreview}</span>
                        </p>
                      )
                    }
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Full Name</label>
                    <input
                      value={createStaff.fullName}
                      onChange={(e) => setCreateStaff((p) => ({ ...p, fullName: e.target.value }))}
                      placeholder="Full Name (optional)"
                      className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Role</label>
                    <select
                      value={createStaff.role}
                      onChange={(e) => setCreateStaff((p) => ({ ...p, role: e.target.value as any }))}
                      className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm bg-white outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-50"
                    >
                      <option value="member">Member — handles cases</option>
                      <option value="admin">Admin — manages team</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    disabled={creatingStaff}
                    onClick={() => void createStaffAccount()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    {creatingStaff ? 'Creating…' : 'Create Staff Account'}
                  </button>
                </div>
              </div>

              {teamMessage && <Alert type={teamMessage.type} message={teamMessage.text} />}

              {createdCreds && (
                <div className="rounded-xl border border-teal-700 bg-teal-600 p-4 space-y-3 shadow-lg">
                  <div className="flex items-center gap-2 text-white">
                    <CheckCircle className="w-4 h-4" />
                    <p className="text-sm font-semibold">Staff account created successfully</p>
                  </div>
                  <p className="text-[11px] text-white/90 leading-relaxed">
                    Share these credentials securely. They can sign in immediately and should change their password after first login.
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="rounded-lg border border-teal-700/30 bg-white p-3">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Staff Login Email</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-mono font-bold text-gray-900 select-all break-all">{createdCreds.email}</p>
                        <button
                          type="button"
                          className="h-8 px-2 rounded-lg border border-gray-200 text-[11px] text-gray-700 hover:bg-gray-50 flex-shrink-0"
                          onClick={() => void navigator.clipboard.writeText(createdCreds.email)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-[10px] text-amber-700 uppercase font-semibold mb-1">Temporary Password</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-mono font-bold text-amber-900 select-all tracking-wider break-all">{createdCreds.tempPassword}</p>
                        <button
                          type="button"
                          className="h-8 px-2 rounded-lg border border-amber-300 text-[11px] text-amber-900 hover:bg-amber-100 flex-shrink-0"
                          onClick={() => void navigator.clipboard.writeText(createdCreds.tempPassword)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-teal-100">
                    Recovery Email: {createdCreds.personalEmail}
                  </p>
                </div>
              )}
            </>
          ) : (
            <Alert type="info" message="Only the organization owner or admin can manage team members." />
          )}

          {/* Team List */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Current Team ({teamMembers.length})</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              {teamLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-teal-600" />
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No team members yet.</div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase">Name</th>
                          <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase">Email</th>
                          <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase">Role</th>
                          <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase">Joined</th>
                          {canEdit && <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase text-right">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {teamMembers.map((m) => {
                          const isMe = m.profile_id === myProfileId;
                          return (
                            <tr key={m.profile_id} className={isMe ? 'bg-teal-50/40' : 'hover:bg-gray-50/50'}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                    {(m.profile?.full_name || 'S').charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                                    {m.profile?.full_name || 'Staff'}
                                    {isMe && <span className="ml-1.5 text-xs text-teal-600 font-semibold">(you)</span>}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[150px]">{m.profile?.email || '—'}</td>
                              <td className="px-4 py-3"><Badge role={m.role} /></td>
                              <td className="px-4 py-3 text-sm text-gray-400">
                                {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                              </td>
                              {canEdit && (
                                <td className="px-4 py-3 text-right">
                                  {!isMe ? (
                                    <button
                                      type="button"
                                      disabled={removingId === m.profile_id}
                                      onClick={() => void removeTeamMember(m.profile_id)}
                                      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-red-100 text-red-500 text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      {removingId === m.profile_id ? '…' : 'Remove'}
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-300">—</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {teamMembers.map((m) => {
                      const isMe = m.profile_id === myProfileId;
                      return (
                        <div key={m.profile_id} className={`p-4 ${isMe ? 'bg-teal-50/20' : ''}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                {(m.profile?.full_name || 'S').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">
                                  {m.profile?.full_name || 'Staff'}
                                  {isMe && <span className="ml-1.5 text-[10px] text-teal-600 font-bold uppercase">(you)</span>}
                                </p>
                                <p className="text-[11px] text-gray-500">{m.profile?.email || 'No email'}</p>
                              </div>
                            </div>
                            <Badge role={m.role} />
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-gray-400">Joined: {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}</p>
                            {canEdit && !isMe && (
                              <button
                                type="button"
                                disabled={removingId === m.profile_id}
                                onClick={() => void removeTeamMember(m.profile_id)}
                                className="flex items-center gap-1 text-[11px] font-bold text-red-500 uppercase tracking-tight"
                              >
                                <Trash2 className="w-3 h-3" />
                                {removingId === m.profile_id ? 'Removing…' : 'Remove Member'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}