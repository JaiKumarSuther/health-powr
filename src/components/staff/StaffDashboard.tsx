import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { requestsApi } from '../../api/requests';
import { messagesApi } from '../../api/messages';
import { CBOHeader } from '../cbo/CBOHeader';
import { CBOSidebar } from '../cbo/CBOSidebar';

const toLazyComponent = <T extends Record<string, unknown>>(mod: T, exportName: string, source: string) => {
  const component = (mod as any)[exportName] ?? (mod as any).default;
  if (!component) throw new Error(`${source}: missing ${exportName} and default export.`);
  return { default: component };
};

const ClientsView = lazy(() => import('../cbo/ClientsView').then(m => toLazyComponent(m, 'ClientsView', 'ClientsView')));
const HelpSupportView = lazy(() => import('../cbo/HelpSupportView').then(m => toLazyComponent(m, 'HelpSupportView', 'HelpSupportView')));
const AccountSettingsView = lazy(() => import('../shared/AccountSettingsView').then(m => toLazyComponent(m, 'AccountSettingsView', 'AccountSettingsView')));
const StaffMessagesPage = lazy(() => import('../../pages/staff/StaffMessagesPage').then(m => toLazyComponent(m, 'StaffMessagesPage', 'StaffMessagesPage')));
const StaffOverviewView = lazy(() => import('./StaffOverviewView').then(m => toLazyComponent(m, 'StaffOverviewView', 'StaffOverviewView')));

type StaffView = 'overview' | 'assigned' | 'messages' | 'team' | 'help' | 'account';
const ALL_VIEWS: StaffView[] = ['overview', 'assigned', 'messages', 'team', 'help', 'account'];

function StaffShellSkeleton() {
  return (
    <div className="flex-1 flex flex-col max-w-[1200px] mx-auto w-full p-4 md:p-6 lg:p-8 overflow-y-auto hide-scrollbar">
      <div className="rounded-[18px] border border-slate-200 bg-white px-6 py-6">
        <div className="h-4 w-28 rounded bg-slate-100 animate-pulse" />
        <div className="mt-3 h-7 w-72 rounded bg-slate-100 animate-pulse" />
        <div className="mt-2 h-4 w-[520px] max-w-full rounded bg-slate-100 animate-pulse" />
        <div className="mt-5 flex gap-2">
          <div className="h-11 w-36 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-11 w-32 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
            <div className="mt-2 h-8 w-14 rounded bg-slate-100 animate-pulse" />
            <div className="mt-3 h-3 w-28 rounded bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="h-4 w-44 rounded bg-slate-100 animate-pulse" />
            <div className="mt-2 h-3 w-60 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="divide-y divide-slate-100">
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
                <div className="flex-1 min-w-0">
                  <div className="h-3 w-40 rounded bg-slate-100 animate-pulse" />
                  <div className="mt-2 h-3 w-56 rounded bg-slate-100 animate-pulse" />
                </div>
                <div className="h-6 w-20 rounded-full bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="h-4 w-36 rounded bg-slate-100 animate-pulse" />
            <div className="mt-2 h-3 w-48 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="p-4 space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="h-3 w-44 rounded bg-slate-100 animate-pulse" />
                <div className="mt-2 h-3 w-56 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
            <div className="h-10 w-full rounded-xl bg-slate-100 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
              <div className="mt-2 h-3 w-56 rounded bg-slate-100 animate-pulse" />
            </div>
            <div className="p-5">
              <div className="h-[140px] rounded-xl bg-slate-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function viewFromPath(pathname: string): StaffView | null {
  const seg = pathname.replace(/^\/staff\/?/, '').split('/')[0] as StaffView;
  return ALL_VIEWS.includes(seg) ? seg : null;
}

export function StaffDashboard() {
  const { user, profile, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [membershipRole, setMembershipRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [membershipLoaded, setMembershipLoaded] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const bootstrapAttempted = useRef(false);

  const urlView = viewFromPath(pathname);
  const effectiveView: StaffView = (urlView === 'team' ? 'messages' : urlView) ?? 'overview';

  useEffect(() => {
    if (!isLoading && profile && profile.role !== 'organization') {
      if (profile.role === 'admin') navigate('/admin', { replace: true });
      else navigate('/client', { replace: true });
    }
  }, [profile, isLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    async function loadMembership() {
      try {
        const ctx = await requestsApi.getMyOrgMembership();
        if (!active) return;
        const role = (ctx.role as 'owner' | 'admin' | 'member' | null) ?? null;
        setMembershipRole(role);
        setMembershipLoaded(true);

        // Staff portal is only for staff (member/admin). Owners are redirected to CBO portal.
        if (role === 'owner') {
          navigate('/cbo', { replace: true });
          return;
        }

        try {
          const convs = await messagesApi.getMyOrgConversations();
          if (!active) return;
          const totalUnread = (convs ?? []).reduce((sum: number, c: any) => {
            const n = typeof c?.unread_count === 'number' ? c.unread_count : 0;
            return sum + (n > 0 ? n : 0);
          }, 0);
          setUnreadMessagesCount(totalUnread);
        } catch {
          setUnreadMessagesCount(0);
        }
      } catch (e: any) {
        setBootstrapError(e?.message || 'Unable to load staff portal.');
        setMembershipLoaded(true);
      }
    }

    void loadMembership();
    return () => {
      active = false;
    };
  }, [user, navigate]);

  // Route normalization/redirect should NOT trigger a full portal reload.
  useEffect(() => {
    const v = viewFromPath(pathname);
    if (!v) navigate('/staff/overview', { replace: true });
  }, [pathname, navigate]);

  // One-time bootstrap for legacy orgs, matching CBO behavior.
  useEffect(() => {
    if (!user) return;
    if (bootstrapAttempted.current) return;
    bootstrapAttempted.current = true;
    // Staff portal does not run org bootstrap; only owner/admin setup should do that in /cbo.
  }, [user]);

  async function handleLogout() {
    await signOut();
    navigate('/', { replace: true });
  }

  function handleViewChange(view: StaffView) {
    navigate(`/staff/${view}`);
  }

  if (bootstrapError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm font-semibold text-red-700">Couldn’t load staff portal</p>
          <p className="text-xs text-red-600 mt-2">{bootstrapError}</p>
          <button
            type="button"
            className="mt-4 h-9 px-3 rounded-lg bg-white border border-gray-200 text-gray-700 text-[12px] font-semibold hover:bg-gray-50"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !membershipLoaded || !user) {
    return (
      <div className="h-screen flex font-sans overflow-hidden">
        <div className="hidden lg:block w-[240px] border-r border-gray-200 bg-white" />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="h-[72px] border-b border-gray-200 bg-white flex items-center px-6">
            <div className="h-8 w-56 rounded bg-slate-100 animate-pulse" />
          </div>
          <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            <StaffShellSkeleton />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex font-sans overflow-hidden">
      <CBOSidebar
        currentView={effectiveView as any}
        onViewChange={handleViewChange as any}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        membershipRole={membershipRole}
        unreadMessagesCount={unreadMessagesCount}
        hideTeamForStaff
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
            effectiveView === 'messages'
              ? 'h-full'
              : 'max-w-[1200px] mx-auto p-4 md:p-6 lg:p-8 overflow-y-auto hide-scrollbar'
          }`}>
            <Suspense fallback={<StaffShellSkeleton />}>
              <Routes>
                <Route path="overview" element={<StaffOverviewView />} />
                <Route path="assigned" element={<ClientsView staffMode />} />
                <Route path="assigned/:requestId" element={<ClientsView staffMode />} />
                {/* Staff request detail (used by Messages "View request") */}
                <Route path="requests/:requestId" element={<ClientsView staffMode />} />
                <Route path="requests" element={<Navigate to="/staff/assigned" replace />} />

                <Route path="messages" element={<StaffMessagesPage />} />
                <Route path="team" element={<Navigate to="/staff/messages" replace />} />
                <Route path="help" element={<HelpSupportView />} />
                <Route path="account" element={<AccountSettingsView hideBorough />} />

                <Route path="*" element={<Navigate to={`/staff/${effectiveView}`} replace />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

