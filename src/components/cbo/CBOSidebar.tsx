import { 
  Users, Settings, MessageSquare, Home, HelpCircle, X, UserCog, BarChart2, LayoutDashboard
} from 'lucide-react';
import { CBOView } from './CBODashboard';

interface CBOSidebarProps {
  currentView: CBOView;
  onViewChange: (view: CBOView) => void;
  isOpen: boolean;
  onClose: () => void;
  membershipRole?: 'owner' | 'admin' | 'member' | null;
  unreadMessagesCount?: number | null;
}

export function CBOSidebar({
  currentView,
  onViewChange,
  isOpen,
  onClose,
  membershipRole,
  unreadMessagesCount,
}: CBOSidebarProps) {
  const isStaffMember = membershipRole === 'member';
  const isOwner = membershipRole === 'owner';
  const messagesBadge =
    typeof unreadMessagesCount === 'number' && unreadMessagesCount > 0 ? String(unreadMessagesCount) : null;
  const menuItems = isStaffMember
    ? [
        { id: 'overview', icon: LayoutDashboard, label: 'Dashboard', badge: null },
        { id: 'assigned', icon: Users, label: 'My Assigned Requests', badge: null },
        { id: 'messages', icon: MessageSquare, label: 'Messages', badge: messagesBadge },
      ]
    : [
        { id: 'overview', icon: Home, label: 'Overview', badge: null },
        { id: 'clients', icon: Users, label: 'Clients', badge: null },
        { id: 'services', icon: Settings, label: 'Services', badge: null },
        { id: 'reports', icon: BarChart2, label: 'Reports', badge: null },
        ...(isOwner ? [] : [{ id: 'messages', icon: MessageSquare, label: 'Messages', badge: messagesBadge }]),
        { id: 'team', icon: Users, label: 'Team', badge: null },
      ];

  const footerItems = isStaffMember
    ? [
        { id: 'account' as CBOView, icon: UserCog, label: 'Account Settings' },
        { id: 'help' as CBOView, icon: HelpCircle, label: 'Help & Support' },
      ]
    : [
        { id: 'account' as CBOView, icon: UserCog, label: 'Account Settings' },
        { id: 'settings' as CBOView, icon: Settings, label: 'Org Settings' },
        { id: 'help' as CBOView, icon: HelpCircle, label: 'Help & Support' },
      ];

  const handleNav = (id: CBOView) => {
    onViewChange(id);
    onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-[299] lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-[300]
        w-[280px] md:w-[240px]
        bg-white border-r border-gray-200
        transform transition-transform duration-300 ease-in-out 
        flex flex-col flex-shrink-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Mobile drawer header */}
        <div className="flex items-center justify-between lg:hidden p-4 border-b border-gray-100">
          <img src="/healthPowr-logo.png" alt="HealthPowr" className="h-8 w-auto" />
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="pt-5 pb-2 px-4">
          <h2 className="text-[11px] font-semibold text-gray-400 tracking-[0.08em] uppercase">
            {isStaffMember ? 'Staff Portal' : 'CBO Dashboard'}
          </h2>
        </div>
        
        <nav className="flex-1 overflow-y-auto pt-2 pb-4 flex flex-col gap-[2px]">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const isUrgent = item.id === 'messages';
            
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id as CBOView)}
                className={`
                  flex items-center justify-between py-[10px] pr-[12px] text-[14px] font-medium transition-all group min-h-[44px]
                  ${isActive 
                    ? 'bg-teal-50 text-teal-600 border-l-[3px] border-teal-600 rounded-r-lg mr-2 pl-[9px]' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 mx-2 px-[12px] rounded-lg border-l-[3px] border-transparent'}
                `}
              >
                <div className="flex items-center gap-[10px]">
                  <Icon className={`w-[18px] h-[18px] transition-colors flex-shrink-0 ${isActive ? 'text-teal-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`
                    text-[11px] font-semibold px-[7px] py-[2px] rounded-full flex-shrink-0
                    ${isUrgent ? 'bg-red-50 text-red-500' : 'bg-teal-50 text-teal-600'}
                  `}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 py-3 flex flex-col gap-[2px]">
          {footerItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`
                  flex items-center gap-[10px] py-[10px] px-[12px] mx-2 rounded-lg text-[13px] font-medium transition-all group min-h-[44px]
                  ${isActive 
                    ? 'bg-teal-50 text-teal-600' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
                `}
              >
                <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-teal-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}
