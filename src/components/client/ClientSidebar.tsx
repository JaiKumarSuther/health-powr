import {
  Search, FileText, MessageSquare, Users, X, Map, AlertTriangle, Phone, UserCog
} from 'lucide-react';
import { ClientView } from './ClientDashboard';

interface ClientSidebarProps {
  currentView: ClientView;
  onViewChange: (view: ClientView) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface NavGroup {
  label: string;
  items: { id: string; icon: React.ElementType; label: string; badge?: number | null }[];
}

export function ClientSidebar({ currentView, onViewChange, isOpen, onClose }: ClientSidebarProps) {
  const navGroups: NavGroup[] = [
    {
      label: 'Main',
      items: [
        { id: 'services', icon: Search, label: 'Find Services', badge: null },
        { id: 'map', icon: Map, label: 'Map View', badge: null },
        { id: 'applications', icon: FileText, label: 'My Applications', badge: null },
        { id: 'messages', icon: MessageSquare, label: 'Messages', badge: null },
      ]
    },
    {
      label: 'My Account',
      items: [
        { id: 'community', icon: Users, label: 'Community', badge: null },
        { id: 'profile', icon: UserCog, label: 'Profile & Settings', badge: null },
      ]
    }
  ];

  const handleNav = (id: ClientView) => {
    onViewChange(id);
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[5000] lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-[5001] lg:z-[300]
        w-[280px] md:w-[240px]
        bg-white border-r border-gray-200
        transform transition-transform duration-300 ease-in-out
        flex flex-col flex-shrink-0
        overflow-hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <img src="/healthPowr-logo.png" alt="HealthPowr" className="h-8 w-auto" />
            <span className="text-[16px] font-extrabold tracking-tight text-slate-900">
              <span className="text-teal-600">Health</span>
              <span className="text-emerald-500">Powr</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close sidebar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-hidden py-2 flex flex-col">
          {navGroups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-1' : ''}>
              <div className="px-4 pt-3 pb-1">
                <span className="text-[10px] font-semibold text-gray-400 tracking-[0.08em] uppercase">
                  {group.label}
                </span>
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                const isMessage = item.id === 'messages';

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id as ClientView)}
                    className={`
                      flex items-center justify-between py-[10px] pr-[12px] text-[14px] font-medium transition-all group w-full min-h-[44px]
                      ${isActive
                        ? 'bg-teal-50 text-teal-600 border-l-[3px] border-teal-600 rounded-r-lg mr-2 pl-[9px]'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 mx-2 px-[12px] rounded-lg border-l-[3px] border-transparent'}
                    `}
                  >
                    <div className="flex items-center gap-[10px]">
                      <Icon className={`w-[18px] h-[18px] transition-colors flex-shrink-0 ${isActive ? 'text-teal-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge != null && item.badge > 0 && (
                      <span className={`
                        text-[11px] font-semibold px-[7px] py-[2px] rounded-full flex-shrink-0
                        ${isMessage ? 'bg-red-50 text-red-500' : 'bg-teal-50 text-teal-600'}
                      `}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer — Emergency + Support */}
        <div className="border-t border-gray-200 py-3 flex flex-col gap-[2px] flex-shrink-0">
          <button
            onClick={() => handleNav('emergency' as ClientView)}
            className="flex items-center gap-[10px] py-[10px] px-[12px] mx-2 rounded-lg text-[13px] font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors group min-h-[44px]"
          >
            <AlertTriangle className="w-[18px] h-[18px] text-red-500 flex-shrink-0" />
            <span>Emergency Resources</span>
          </button>
          <button
            onClick={() => handleNav('support' as ClientView)}
            className="flex items-center gap-[10px] py-[10px] px-[12px] mx-2 rounded-lg text-[13px] font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors min-h-[44px]"
          >
            <Phone className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
            <span>Contact Support</span>
          </button>
        </div>
      </aside>
    </>
  );
}
