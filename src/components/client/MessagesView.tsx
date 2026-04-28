import { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Search, 
  User,
  ChevronLeft,
  MessageSquare
} from 'lucide-react';
import { messagesApi } from '../../api/messages';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useIsMobile } from "../../hooks/useIsMobile";
import { StatusBadge } from "../shared/StatusBadge";

export function MessagesView() {
  const { user } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const requestId = new URLSearchParams(location.search).get('requestId');
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  useEffect(() => {
    if (!user) return;
    async function loadConversations() {
      try {
        setLoading(true);
        setLoadError(null);
        const data = await messagesApi.getMyConversations();
        setConversations(data);
        if (data.length > 0) {
          if (requestId) {
            const matching = data.find(c => String(c.request_id) === requestId);
            setSelectedConversationId(matching?.id ?? data[0].id);
          } else {
            setSelectedConversationId(data[0].id);
          }
        }
      } catch {
        setLoadError('Failed to load conversations.');
      } finally {
        setLoading(false);
      }
    }
    void loadConversations();
  }, [user, requestId]);

  useEffect(() => {
    if (!isMobile) {
      setMobileView("list");
      return;
    }
    if (selectedConversationId) setMobileView("chat");
  }, [isMobile, selectedConversationId]);

  useEffect(() => {
    if (!user || !selectedConversationId) return;
    let active = true;
    let lastRealtimeAt = Date.now();

    async function loadMessages() {
      try {
        const data = await messagesApi.getMessages(selectedConversationId!);
        if (!active) return;
        setMessages(data);
      } catch {
        // Failed to load messages
      }
    }
    loadMessages();

    // Subscribe to new messages
    const subscription = messagesApi.subscribeToMessages(selectedConversationId!, (newMsg) => {
      lastRealtimeAt = Date.now();
      setMessages(prev => {
        const next = [...prev.filter(m => m.id !== newMsg.id), newMsg];
        next.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        return next;
      });
    });

    // Light fallback polling: only refetch if realtime has been quiet.
    const poll = window.setInterval(() => {
      const quietForMs = Date.now() - lastRealtimeAt;
      if (quietForMs < 20_000) return;
      void loadMessages();
    }, 10_000);

    return () => {
      active = false;
      window.clearInterval(poll);
      void supabase.removeChannel(subscription);
    };
  }, [selectedConversationId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (newMessage.trim() && selectedConversationId) {
      try {
        const content = newMessage;
        setNewMessage('');
        const sent = await messagesApi.send(selectedConversationId, content);
        // Ensure the sender sees their message immediately, even if realtime echo lags.
        setMessages(prev => {
          const next = [...prev.filter(m => m.id !== sent.id), sent];
          next.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
          return next;
        });
      } catch {
        // Failed to send message
      }
    }
  };

  const currentConversation = conversations.find(c => c.id === selectedConversationId);
  const getAssignedStaff = (conv: any) =>
    conv?.request?.assigned_staff ?? conv?.assigned_staff ?? null;
  const staffForCurrent = getAssignedStaff(currentConversation);
  const requestForCurrent = currentConversation?.request ?? null;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm font-semibold text-red-700">Couldn’t load messages</p>
        <p className="text-xs text-red-600 mt-2">{loadError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 h-9 px-3 rounded-lg bg-white border border-gray-200 text-gray-700 text-[12px] font-semibold hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-160px)]">
      <div className="mb-4">
        <h1 className="text-[24px] font-bold tracking-tight text-gray-900 mb-1">Messages</h1>
        <p className="text-gray-500 text-sm">Communicate with service providers and case managers</p>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-200 h-full flex overflow-hidden">
        {/* Conversations List */}
        <div
          className={[
            "flex-shrink-0 border-r border-gray-200 flex flex-col min-w-0 bg-white",
            isMobile ? `w-full ${mobileView === "list" ? "flex" : "hidden"}` : "w-[300px] flex",
          ].join(" ")}
        >
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {conversations.length > 0 ? conversations.map((conversation) => (
              (() => {
                const staff = getAssignedStaff(conversation);
                const displayName =
                  staff?.full_name ||
                  (conversation.request?.assigned_staff_id ? 'Case manager assigned' : null) ||
                  conversation.organization?.name ||
                  'Conversation';
                const avatarUrl = staff?.avatar_url || null;
                const request = conversation?.request ?? null;
                const serviceName = request?.services?.name ?? null;
                const category = request?.services?.category ?? null;
                const borough = request?.borough ?? null;
                const requestLine =
                  serviceName
                    ? [serviceName, borough].filter(Boolean).join(" · ")
                    : (conversation.organization?.name ? conversation.organization.name : "Request");
                return (
              <div
                key={conversation.id}
                onClick={() => {
                  setSelectedConversationId(conversation.id);
                  if (isMobile) setMobileView("chat");
                }}
                className={`p-4 border-b border-gray-50 cursor-pointer transition-colors ${
                  selectedConversationId === conversation.id ? 'bg-teal-50 border-teal-100' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        className="w-full h-full rounded-full object-cover"
                        alt={staff?.full_name ?? 'Case manager'}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : conversation.organization?.logo_url ? (
                      <img
                        src={conversation.organization.logo_url}
                        className="w-full h-full rounded-full object-cover"
                        alt={conversation.organization?.name ?? 'Organization'}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-6 h-6 text-teal-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-900 truncate">
                        {displayName}
                      </p>
                      <span className="text-[10px] text-gray-400">
                        {conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-600 font-semibold truncate">
                            {requestLine}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {category ? `Category: ${category}` : "Request conversation"}
                          </p>
                        </div>
                        {request?.status ? (
                          <div className="flex-shrink-0">
                            <StatusBadge status={request.status} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      {conversation.last_message?.[0]?.content || 'Click to start chatting'}
                    </p>
                  </div>
                </div>
              </div>
                );
              })()
            )) : (
              <div className="p-8 text-center text-gray-400 text-sm">
                No active conversations
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div
          className={[
            "flex-1 flex flex-col bg-gray-50 min-w-0",
            isMobile ? (mobileView === "chat" ? "flex" : "hidden") : "flex",
          ].join(" ")}
        >
          {selectedConversationId ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {isMobile && (
                      <button
                        type="button"
                        onClick={() => setMobileView("list")}
                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 -ml-1"
                        aria-label="Back"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                      </button>
                    )}
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                      {staffForCurrent?.avatar_url ? (
                        <img
                          src={staffForCurrent.avatar_url}
                          className="w-full h-full rounded-full object-cover"
                          alt={staffForCurrent.full_name ?? 'Case manager'}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-5 h-5 text-teal-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {requestForCurrent?.services?.name || "Request"}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                        <p className="text-[11px] text-slate-500 truncate max-w-[420px]">
                          {[
                            staffForCurrent?.full_name ||
                              (currentConversation?.request?.assigned_staff_id ? "Case manager assigned" : null) ||
                              null,
                            requestForCurrent?.borough,
                            requestForCurrent?.services?.category,
                          ]
                            .filter(Boolean)
                            .join(" · ") || (currentConversation?.organization?.name ?? "")}
                        </p>
                        {requestForCurrent?.status ? (
                          <StatusBadge status={requestForCurrent.status} />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => {
                  const isMe = message.sender_id === user?.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-xs lg:max-w-md`}>
                        <div className={`px-4 py-2.5 rounded-2xl ${
                          isMe 
                            ? 'bg-teal-600 text-white rounded-tr-none' 
                            : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none shadow-sm'
                        }`}>
                          <p className="text-sm">{message.content}</p>
                        </div>
                        <p className={`text-[10px] text-gray-400 mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white focus:border-transparent outline-none text-sm transition-all"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSendMessage();
                        }
                      }}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="absolute right-2 top-1.5 p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:bg-gray-400"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center flex-col text-gray-400 space-y-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <MessageSquare className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium">Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}