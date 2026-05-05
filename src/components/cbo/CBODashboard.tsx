import { CBOHeader } from './CBOHeader';
import { CBOSidebar } from './CBOSidebar';
import { useAuth } from '../../contexts/AuthContext';
import CBOOverview from './CBOOverview';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { requestsApi } from '../../api/requests';
import { orgsApi } from '../../api/organizations';
import { messagesApi } from '../../api/messages';
import { supabase } from '../../lib/supabase';
import { useEffect, useRef, useState, lazy, Suspense } from 'react';

// const CBOOverview = lazy(() => import('./CBOOverview'));
const ClientsView = lazy(() => import('./ClientsView').then(m => ({ default: m.ClientsView })));
const ServicesView = lazy(() => import('./ServicesView').then(m => ({ default: m.ServicesView })));
const CreateServicePage = lazy(() => import('./CreateServicePage').then(m => ({ default: m.CreateServicePage })));
const ServiceDetailPage = lazy(() => import('./ServiceDetailPage').then(m => ({ default: m.ServiceDetailPage })));
const MessagesView = lazy(() => import('./MessagesView').then(m => ({ default: m.MessagesView })));
const InternalMessagingView = lazy(() => import('./InternalMessagingView').then(m => ({ default: m.InternalMessagingView })));
const ReportsView = lazy(() => import('./ReportsView').then(m => ({ default: m.ReportsView })));
const SettingsView = lazy(() => import('./SettingsView').then(m => ({ default: m.SettingsView })));
const HelpSupportView = lazy(() => import('./HelpSupportView').then(m => ({ default: m.HelpSupportView })));
const AccountSettingsView = lazy(() => import('../shared/AccountSettingsView').then(m => ({ default: m.AccountSettingsView })));
import StaffOverviewView from '../staff/StaffOverviewView';

// const StaffOverviewView = lazy(() => import('../staff/StaffOverviewView').then(m => ({ default: m.StaffOverviewView })));

async function invokeSetupOrganization(input: { orgName: string; borough: string }, accessToken: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase configuration.');
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/setup-organization`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg = body?.error || body?.message || `Request failed (${res.status}).`;
    throw new Error(String(msg));
  }
  return body;
}

export type CBOView =
  | 'overview'
  | 'clients'
  | 'assigned'
  | 'services'
  | 'reports'
  | 'messages'
  | 'team'
  | 'settings'
  | 'help'
  | 'account';

const ALL_VIEWS: CBOView[] = ['overview', 'clients', 'assigned', 'services', 'reports', 'messages', 'team', 'settings', 'help', 'account'];
const STAFF_VIEWS: CBOView[] = ['overview', 'assigned', 'messages', 'team', 'help', 'account'];

function viewFromPath(pathname: string): CBOView | null {
  const seg = pathname.replace(/^\/cbo\/?/, '').split('/')[0] as CBOView;
  return ALL_VIEWS.includes(seg) ? seg : null;
}

export function CBODashboard() {
  const { user, profile, signOut, isLoading, isResolvingRole, retryAuth } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [membershipRole, setMembershipRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [membershipLoaded, setMembershipLoaded] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [loadError, setLoadError] = useState(false);
  const bootstrapAttempted = useRef(false);
  const isRestrictedRole = membershipRole === 'member' || membershipRole === null;

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isResolvingRole || !membershipLoaded) setLoadError(true);
    }, 15000);
    return () => clearTimeout(timeout);
  }, [isResolvingRole, membershipLoaded]);

  // Derive current view from URL — falls back to null until membership loads
  const urlView = viewFromPath(pathname);

  // Internal role guard — redirect admin/member users away from CBO portal
  useEffect(() => {
    if (!isLoading && profile && profile.role !== 'organization') {
      console.warn('[CBODashboard] Wrong role detected:', profile.role, '— redirecting')
      if (profile.role === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/client', { replace: true })
      }
    }
  }, [profile, isLoading, navigate])

  useEffect(() => {
    if (!user) return;
    const currentUser = user;
    let active = true;

    async function loadRole() {
      setMembershipLoaded(false);
      try {
        const ctx = await requestsApi.getMyOrgMembership();
        if (!active) return;

        if (ctx.orgId) {
          const role = (ctx.role as 'owner' | 'admin' | 'member' | null) ?? null;
          setOrgId(ctx.orgId);
          setMembershipRole(role);
          setMembershipLoaded(true);

          // Sidebar badge: unread client messages for this user (staff → assigned only)
          try {
            const convs = await messagesApi.getMyOrgConversations();
            if (active) {
              const totalUnread = (convs ?? []).reduce((sum: number, c: any) => {
                const n = typeof c?.unread_count === 'number' ? c.unread_count : 0;
                return sum + (n > 0 ? n : 0);
              }, 0);
              setUnreadMessagesCount(totalUnread);
            }
          } catch {
            if (active) setUnreadMessagesCount(0);
          }

          // Redirect to default view when landing on bare /cbo
          const view = viewFromPath(pathname);
          if (!view) {
            navigate(role === 'member' ? '/cbo/assigned' : '/cbo/overview', { replace: true });
          } else if (role === 'member' && !STAFF_VIEWS.includes(view)) {
            navigate('/cbo/assigned', { replace: true });
          }
          return;
        }

        // No org found — attempt to bootstrap from user metadata
        if (!bootstrapAttempted.current && currentUser.organization?.trim()) {
          bootstrapAttempted.current = true;
          try {
            await orgsApi.setup();
            await new Promise(r => setTimeout(r, 3000));
            const retryCtx = await requestsApi.getMyOrgMembership();
            if (!active) return;
            if (retryCtx.orgId) {
              const role = (retryCtx.role as 'owner' | 'admin' | 'member' | null) ?? null;
              setOrgId(retryCtx.orgId);
              setMembershipRole(role);
              setMembershipLoaded(true);
              if (!viewFromPath(pathname)) {
                navigate(role === 'member' ? '/cbo/assigned' : '/cbo/overview', { replace: true });
              }
              return;
            }
          } catch {
            // Fall through to show error state
          }
        }

        if (!active) return;
        setOrgId(null);
        setMembershipRole(null);
        setMembershipLoaded(true);
        if (!currentUser.organization?.trim()) {
          setBootstrapError(null);
        } else {
          setBootstrapError(
            'Your account was created but we could not link it to an organization. Please sign out and sign in again, or contact support.',
          );
        }
      } catch {
        if (!active) return;
        setMembershipRole(null);
        setMembershipLoaded(true);
      }
    }

    void loadRole();
    return () => { active = false; };
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  if (loadError && !membershipLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-6 text-center">
          <p className="text-lg font-bold text-gray-900">Workspace is taking too long to load</p>
          <p className="text-sm text-gray-600 mt-2">
            We are having trouble connecting to your organization. This can happen on cold starts.
          </p>
          <div className="mt-5 flex gap-3 justify-center">
            <button
              type="button"
              onClick={async () => {
                setLoadError(false);
                await retryAuth();
              }}
              className="h-10 px-6 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-10 px-6 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || isResolvingRole) {
    return (
      <div className="hp-page flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-[3px] border-gray-200 border-t-teal-600" />
      </div>
    );
  }

  if (!membershipLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-9 w-9 border-[3px] border-gray-200 border-t-teal-600 mx-auto" />
          <p className="text-sm text-gray-500">Setting up your workspace…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (!orgId) {
    const isOrgOwner = !!user.organization?.trim();
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-6 text-center">
          {isOrgOwner ? (
            <>
              <p className="text-lg font-bold text-gray-900">Organization setup incomplete</p>
              <p className="text-sm text-gray-600 mt-2">
                {bootstrapError ??
                  'We could not finish setting up your organization. Please sign out and sign back in to retry.'}
              </p>
              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { data: sess } = await supabase.auth.getSession();
                      const token = sess.session?.access_token;
                      if (!token) throw new Error('Missing session token.');
                      await invokeSetupOrganization(
                        {
                          orgName: user?.organization || 'My Organization',
                          borough: profile?.borough || 'Manhattan',
                        },
                        token,
                      );
                      await new Promise(r => setTimeout(r, 2500))
                      window.location.reload()
                    } catch (e) {
                      console.error('Retry failed:', e);
                      await signOut();
                    }
                  }}
                  className="h-10 px-4 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
                >
                  Sign out &amp; retry
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-gray-900">No organization access found</p>
              <p className="text-sm text-gray-600 mt-2">
                This account is not linked to any organization. If you are staff, sign in from the
                staff portal with your credentials.
              </p>
              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/staff-login', { replace: true })}
                  className="h-10 px-4 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
                >
                  Go to staff login
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="h-10 px-4 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Determine effective view from URL, gated by role
  const effectiveView: CBOView = (() => {
    const v = urlView;
    if (!v) return isRestrictedRole ? 'assigned' : 'overview';
    if (isRestrictedRole && !STAFF_VIEWS.includes(v)) return 'assigned';
    // Owner cannot access client messaging; redirect to Team.
    if (membershipRole === 'owner' && v === 'messages') return 'team';
    return v;
  })();

  const handleViewChange = (nextView: CBOView) => {
    const allowed = isRestrictedRole
      ? (STAFF_VIEWS.includes(nextView) ? nextView : 'assigned')
      : nextView;
    navigate(`/cbo/${allowed}`);
    setSidebarOpen(false);
  };

  const renderView = () => {
    // Use real nested routes so sub-pages don't require pathname hacks.
    return (
      <Routes>
        <Route
          path="overview"
          element={membershipRole === 'member' ? <StaffOverviewView /> : <CBOOverview />}
        />
        <Route path="clients" element={<ClientsView />} />
        <Route path="clients/:requestId" element={<ClientsView />} />
        <Route path="assigned" element={<ClientsView staffMode />} />
        <Route path="assigned/:requestId" element={<ClientsView staffMode />} />
        <Route path="services" element={<ServicesView />} />
        <Route path="services/:serviceId" element={<ServiceDetailPage />} />
        <Route path="services/new" element={<CreateServicePage />} />
        <Route path="reports" element={<ReportsView />} />
        <Route
          path="messages"
          element={membershipRole === 'owner' ? <Navigate to="/cbo/team" replace /> : <MessagesView />}
        />
        <Route
          path="team"
          element={membershipRole === 'member' ? <Navigate to="/staff/messages" replace /> : <InternalMessagingView />}
        />
        <Route path="settings" element={<SettingsView />} />
        <Route path="help" element={<HelpSupportView />} />
        <Route path="account" element={<AccountSettingsView hideBorough />} />

        {/* Keep unknown nested routes stable (no full reload). */}
        <Route path="*" element={<Navigate to={`/cbo/${effectiveView}`} replace />} />
      </Routes>
    );
  };

  return (
    <div className="h-screen flex font-sans overflow-hidden">
      <CBOSidebar
        currentView={effectiveView}
        onViewChange={handleViewChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        membershipRole={membershipRole}
        unreadMessagesCount={unreadMessagesCount}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <CBOHeader
          user={user}
          onLogout={handleLogout}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          membershipRole={membershipRole}
          onAccountSettings={() => handleViewChange('account')}
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className={`flex-1 flex flex-col w-full min-w-0 ${
            effectiveView === 'messages' || effectiveView === 'team'
              ? 'h-full'
              : 'max-w-[1200px] mx-auto p-4 md:p-6 lg:p-8 overflow-y-auto hide-scrollbar'
          }`}>
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
              </div>
            }>
              {renderView()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
