import {
  LayoutDashboard,
  Building2,
  FileText,
  BarChart3,
  Megaphone,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { RequestsListView } from './RequestsListView';
import { OrganizationsListView } from './OrganizationsListView';
import { UsersListView } from './UsersListView';
import { RequestDetailModal } from './RequestDetailModal';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { OrgDetailsPage } from './OrgDetailsPage';

const toLazyComponent = <T extends Record<string, unknown>>(mod: T, exportName: string, source: string) => {
  const component = (mod as any)[exportName] ?? (mod as any).default;
  if (!component) throw new Error(`${source}: missing ${exportName} and default export.`);
  return { default: component };
};

const AdminOverviewView = lazy(() =>
  import('./AdminOverviewView').then((m) => toLazyComponent(m, 'AdminOverviewView', 'AdminOverviewView')),
);
const ReportsView = lazy(() =>
  import('./ReportsView').then((m) => toLazyComponent(m, 'ReportsView', 'ReportsView')),
);
const AdminAnnouncementsView = lazy(() =>
  import('./AdminAnnouncementsView').then((m) => toLazyComponent(m, 'AdminAnnouncementsView', 'AdminAnnouncementsView')),
);
const AdminSettingsView = lazy(() =>
  import('./AdminSettingsView').then((m) => toLazyComponent(m, 'AdminSettingsView', 'AdminSettingsView')),
);

type AdminTab =
  | 'dashboard'
  | 'requests'
  | 'orgs'
  | 'announcements'
  | 'reports'
  | 'users'
  | 'settings';
const ALL_TABS: AdminTab[] = [
  'dashboard',
  'requests',
  'orgs',
  'announcements',
  'reports',
  'users',
  'settings',
];

function tabFromPath(pathname: string): AdminTab | null {
  const seg = pathname.replace(/^\/admin\/?/, '').split('/')[0] as AdminTab;
  return ALL_TABS.includes(seg) ? seg : null;
}

export function AdminDashboard() {
  const { user, profile, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Internal role guard — redirect non-admin users away from admin portal
  useEffect(() => {
    if (!isLoading && profile && profile.role !== 'admin') {
      console.warn('[AdminDashboard] Non-admin detected:', profile.role, '— redirecting')
      if (profile.role === 'organization') {
        navigate('/cbo', { replace: true })
      } else {
        navigate('/client', { replace: true })
      }
    }
  }, [profile, isLoading, navigate])

  const activeTab: AdminTab = tabFromPath(pathname) ?? 'requests';
  const orgDetailsId = pathname.match(/^\/admin\/orgs\/([^/]+)/)?.[1] ?? null;

  // Redirect bare /admin to /admin/requests
  useEffect(() => {
    if (!tabFromPath(pathname)) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [pathname, navigate]);

  const menuItems = [
    { id: 'dashboard' as AdminTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'requests' as AdminTab, label: 'All Requests', icon: FileText },
    { id: 'orgs' as AdminTab, label: 'Organizations', icon: Building2 },
    { id: 'announcements' as AdminTab, label: 'Announcements', icon: Megaphone },
    { id: 'users' as AdminTab, label: 'Users', icon: Users },
    { id: 'reports' as AdminTab, label: 'Reports', icon: BarChart3 },
    { id: 'settings' as AdminTab, label: 'Settings', icon: Settings },
  ];

  // Keep sidebar responsive: closed on small screens, pinned open on lg+.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(min-width: 1024px)');
    const update = () => setSidebarOpen(mql.matches);
    update();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }
    // Safari fallback
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);

  const handleNav = (tab: AdminTab) => {
    navigate(`/admin/${tab}`);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#111827] text-white transition-transform duration-300 transform
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-64'}
        lg:static lg:translate-x-0
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2.5">
                <img
                  src="/healthPowr-logo.png"
                  alt="HealthPowr"
                  className="h-9 w-9 rounded-lg object-contain bg-white/5"
                  draggable={false}
                />
                <span className="font-extrabold text-[16px] tracking-tight text-white">
                  <span className="text-teal-400">Health</span>
                  <span className="text-emerald-300">Powr</span>
                  <span className="text-gray-300"> </span>
                  <span className="text-teal-300">Admin</span>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-700/60 transition-colors"
              aria-label="Close admin sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all uppercase tracking-tight font-bold text-[13px]
                    ${activeTab === item.id
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'}
                  `}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-800">
            <button
              onClick={() => void signOut()}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-all uppercase tracking-tight font-bold text-[13px]"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6 text-gray-400" />
            </button>
            <div className="hidden md:flex items-center bg-gray-100 rounded-lg px-3 py-1.5 gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Admin Authorization Verified</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-px h-6 bg-gray-200"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[12px] font-bold text-gray-900 uppercase">Administrator</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-tight">{user?.email}</p>
              </div>
              <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center font-bold text-teal-700">A</div>
            </div>
          </div>
        </header>

        {/* Dynamic View */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          {activeTab === 'dashboard' && (
            <Suspense
              fallback={
                <div className="p-8 text-center text-gray-400">
                  Loading dashboard...
                </div>
              }
            >
              <AdminOverviewView />
            </Suspense>
          )}
          {activeTab === 'requests' && (
            <RequestsListView onViewRequest={setSelectedRequestId} />
          )}
          {activeTab === 'orgs' && (
            orgDetailsId ? (
              <OrgDetailsPage
                orgId={orgDetailsId}
                onBack={() => navigate('/admin/orgs')}
              />
            ) : (
              <OrganizationsListView onViewDetails={(id) => navigate(`/admin/orgs/${id}`)} />
            )
          )}
          {activeTab === 'users' && <UsersListView />}
          {activeTab === 'announcements' && (
            <Suspense
              fallback={
                <div className="p-8 text-center text-gray-400">
                  Loading announcements...
                </div>
              }
            >
              <AdminAnnouncementsView />
            </Suspense>
          )}
          {activeTab === 'reports' && (
            <Suspense
              fallback={
                <div className="p-8 text-center text-gray-400">
                  Loading reports...
                </div>
              }
            >
              <ReportsView />
            </Suspense>
          )}
          {activeTab === 'settings' && (
            <Suspense
              fallback={
                <div className="p-8 text-center text-gray-400">
                  Loading settings...
                </div>
              }
            >
              <AdminSettingsView />
            </Suspense>
          )}
        </div>
      </main>

      {/* Request detail modal */}
      {selectedRequestId && (
        <RequestDetailModal
          requestId={selectedRequestId}
          onClose={() => setSelectedRequestId(null)}
        />
      )}
    </div>
  );
}
