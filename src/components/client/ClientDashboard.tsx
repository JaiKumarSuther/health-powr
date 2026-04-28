import { ClientHeader } from './ClientHeader';
import { ClientSidebar } from './ClientSidebar';
import { ServicesView } from './ServicesView';
import { ApplicationsView } from './ApplicationsView';
import { MessagesView } from './MessagesView';
import { CommunityView } from './CommunityView';
import { ApplicationForm } from './ApplicationForm';
import { ApplicationFormPage } from '../../pages/client/ApplicationFormPage';
import { AccountSettingsView } from '../shared/AccountSettingsView';
import { EmergencyResourcesView } from './EmergencyResourcesView';
import { ContactSupportView } from './ContactSupportView';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';

const MapView = lazy(() =>
  import('./MapView').then((m) => ({ default: m.MapView })),
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
  const isMapView = currentView === 'map';

  const handleViewChange = (view: ClientView) => {
    navigate(`/client/${view}`);
    setSidebarOpen(false);
  };

  const renderView = () => {
    switch (currentView) {
      case 'services':         return <ServicesView />;
      case 'map':              return (
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Loading map...
            </div>
          }
        >
          <MapView />
        </Suspense>
      );
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
            isMapView
              ? "flex-1 overflow-hidden min-w-0 bg-slate-50/50"
              : "flex-1 overflow-y-auto hide-scrollbar p-4 md:p-6 lg:p-8 min-w-0 bg-slate-50/50"
          }
        >
          <div
            className={
              currentView === 'map'
                ? 'w-full h-full min-w-0'
                : 'max-w-[1200px] mx-auto w-full min-w-0'
            }
          >
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}
