import { useEffect, useMemo, useState } from 'react';
import { MessagesView } from '../../components/cbo/MessagesView';
import { InternalMessagingView } from '../../components/cbo/InternalMessagingView';
import { messagesApi } from '../../api/messages';

export function StaffMessagesPage() {
  type Tab = 'clients' | 'team';
  const [activeTab, setActiveTab] = useState<Tab>('clients');
  const [clientUnreadCount, setClientUnreadCount] = useState(0);

  // Internal team chat unread count is not currently tracked in the API.
  const teamUnreadCount = 0;

  useEffect(() => {
    let active = true;
    async function loadUnread() {
      try {
        const convs = await messagesApi.getMyOrgConversations();
        if (!active) return;
        const total = (convs ?? []).reduce((sum: number, c: any) => {
          const n = typeof c?.unread_count === 'number' ? c.unread_count : 0;
          return sum + (n > 0 ? n : 0);
        }, 0);
        setClientUnreadCount(total);
      } catch {
        if (active) setClientUnreadCount(0);
      }
    }
    void loadUnread();
    return () => {
      active = false;
    };
  }, []);

  const leftTabs = useMemo(
    () => (
      <div className="flex border-b border-slate-100 flex-shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('clients')}
          className={`flex-1 py-3.5 text-sm font-semibold transition-colors
            relative flex items-center justify-center gap-2
            ${activeTab === 'clients'
              ? 'text-teal-600'
              : 'text-slate-400 hover:text-slate-600'
            }`}
        >
          My Clients
          {clientUnreadCount > 0 && (
            <span className="bg-teal-600 text-white text-[10px] font-bold
                             px-1.5 py-0.5 rounded-full min-w-[18px]
                             text-center leading-none">
              {clientUnreadCount}
            </span>
          )}
          {activeTab === 'clients' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5
                            bg-teal-600 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('team')}
          className={`flex-1 py-3.5 text-sm font-semibold transition-colors
            relative flex items-center justify-center gap-2
            ${activeTab === 'team'
              ? 'text-teal-600'
              : 'text-slate-400 hover:text-slate-600'
            }`}
        >
          Team
          {teamUnreadCount > 0 && (
            <span className="bg-teal-600 text-white text-[10px] font-bold
                             px-1.5 py-0.5 rounded-full min-w-[18px]
                             text-center leading-none">
              {teamUnreadCount}
            </span>
          )}
          {activeTab === 'team' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5
                            bg-teal-600 rounded-full" />
          )}
        </button>
      </div>
    ),
    [activeTab, clientUnreadCount, teamUnreadCount],
  );

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-[20px] font-extrabold text-slate-900 mb-1 leading-tight">Messages</h1>
        <p className="text-[12px] text-slate-500">Communicate with clients and track case progress</p>
      </div>

      {/* Keep BOTH tabs mounted to avoid reload/unmount */}
      <div className={activeTab === 'clients' ? 'flex flex-1 min-h-0' : 'hidden'}>
        <MessagesView
          embedded
          leftTop={leftTabs}
          listSectionLabel="YOUR ASSIGNED CLIENTS"
          viewRequestHref={(requestId) => `/staff/requests/${requestId}`}
        />
      </div>

      <div className={activeTab === 'team' ? 'flex flex-1 min-h-0' : 'hidden'}>
        <InternalMessagingView embedded leftTop={leftTabs} />
      </div>
    </div>
  );
}

