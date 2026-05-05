import { ClientHeader } from './ClientHeader';
import { ClientSidebar } from './ClientSidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';

const toLazyComponent = <T extends Record<string, unknown>>(mod: T, exportName: string, source: string) => {
  const component = (mod as any)[exportName] ?? (mod as any).default;
  if (!component) throw new Error(`${source}: missing ${exportName} and default export.`);
  return { default: component };
};

const ServicesView = lazy(() => import('./ServicesView').then(m => toLazyComponent(m, 'ServicesView', 'ServicesView')));
const ApplicationsView = lazy(() => import('./ApplicationsView').then(m => toLazyComponent(m, 'ApplicationsView', 'ApplicationsView')));
const MessagesView = lazy(() => import('./MessagesView').then(m => toLazyComponent(m, 'MessagesView', 'MessagesView')));
const CommunityView = lazy(() => import('./CommunityView').then(m => toLazyComponent(m, 'CommunityView', 'CommunityView')));
const ApplicationForm = lazy(() => import('./ApplicationForm').then(m => toLazyComponent(m, 'ApplicationForm', 'ApplicationForm')));
const ApplicationFormPage = lazy(() => import('../../pages/client/ApplicationFormPage').then(m => toLazyComponent(m, 'ApplicationFormPage', 'ApplicationFormPage')));
const AccountSettingsView = lazy(() => import('../shared/AccountSettingsView').then(m => toLazyComponent(m, 'AccountSettingsView', 'AccountSettingsView')));
const EmergencyResourcesView = lazy(() => import('./EmergencyResourcesView').then(m => toLazyComponent(m, 'EmergencyResourcesView', 'EmergencyResourcesView')));
const ContactSupportView = lazy(() => import('./ContactSupportView').then(m => toLazyComponent(m, 'ContactSupportView', 'ContactSupportView')));

const MapView = lazy(() =>
  import('./MapView').then((m) => toLazyComponent(m, 'MapView', 'MapView')),
);

export type ClientView =
  | 'services'
  | 'map'
  | 'applications'
  | 'apply'
  | 'messages'
  | 'profile'
  | 'community'
  | 'emergency'
  | 'support'
  | 'application-form';

const ALL_CLIENT_VIEWS: ClientView[] = [
  'services', 'map', 'applications', 'apply', 'messages', 'profile', 'community', 'emergency', 'support', 'application-form',
];

function viewFromPath(pathname: string): ClientView | null {
  const seg = pathname.replace(/^\/client\/?/, '').split('/')[0] as ClientView;
  return ALL_CLIENT_VIEWS.includes(seg) ? seg : null;
}

export function ClientDashboard() {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const clientSegments = pathname.replace(/^\/client\/?/, '').split('/').filter(Boolean);
  const applicationIdFromPath =
    clientSegments[0] === 'applications' && clientSegments[1] ? clientSegments[1] : undefined;
  const applyServiceIdFromPath =
    clientSegments[0] === 'apply' && clientSegments[1] ? clientSegments[1] : undefined;

  // Redirect bare /client to /client/services
  useEffect(() => {
    if (!viewFromPath(pathname)) {
      navigate('/client/services', { replace: true });
    }
  }, [pathname, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="hp-page flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-[3px] border-gray-200 border-t-teal-600" />
      </div>
    );
  }

  if (!user) return null;

  const currentView: ClientView = viewFromPath(pathname) ?? 'services';
  const isFullScreenView = currentView === 'map' || currentView === 'messages';

  const handleViewChange = (view: ClientView) => {
    navigate(`/client/${view}`);
    setSidebarOpen(false);
  };

  const renderView = () => {
    switch (currentView) {
      case 'services':         return <ServicesView />;
      case 'map':              return <MapView />;
      case 'applications':     return <ApplicationsView requestId={applicationIdFromPath} />;
      case 'apply':            return <ApplicationFormPage serviceId={applyServiceIdFromPath} />;
      case 'messages':         return <MessagesView />;
      case 'profile':          return <AccountSettingsView />;
      case 'community':        return <CommunityView />;
      case 'emergency':        return <EmergencyResourcesView />;
      case 'support':          return <ContactSupportView />;
      case 'application-form': return (
        <ApplicationForm
          serviceName="Emergency Housing Assistance"
          organization="Community Housing Alliance"
          onSubmit={() => navigate('/client/applications')}
          onSave={() => {}}
          onCancel={() => navigate('/client/services')}
        />
      );
      default: return <ServicesView />;
    }
  };

  return (
    <div className="h-screen flex font-sans overflow-hidden">
      <ClientSidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <ClientHeader
          user={user}
          onLogout={handleLogout}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <main
          className={
            isFullScreenView
              ? "flex-1 overflow-hidden min-w-0 bg-slate-50/50"
              : "flex-1 overflow-y-auto hide-scrollbar p-4 md:p-6 lg:p-8 min-w-0 bg-slate-50/50"
          }
        >
          <div
            className={
              isFullScreenView
                ? 'w-full h-full min-w-0'
                : 'max-w-[1200px] mx-auto w-full min-w-0'
            }
          >
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
