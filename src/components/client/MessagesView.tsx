import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Search,
  User,
  ChevronLeft,
  MessageSquare,
  X,
} from 'lucide-react';
import { messagesApi } from '../../api/messages';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { StatusBadge } from '../shared/StatusBadge';
import type { ConversationListItem, Message } from '../../lib/types';

export function MessagesView() {
  const { user } = useAuth();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  const requestId = new URLSearchParams(location.search).get('requestId');
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [conversationSearch, setConversationSearch] = useState('');
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);

  /* ── Responsive observer ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setIsMobile(el.clientWidth < 768);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── Load conversations ── */
  useEffect(() => {
    if (!user) return;
    async function loadConversations() {
      try {
        setLoading(true);
        setLoadError(null);
        const data = (await messagesApi.getMyConversations()) as ConversationListItem[];
        setConversations(data);
        if (data.length > 0) {
          const matching = requestId
            ? data.find((c) => String(c.request_id) === requestId)
            : null;
          setSelectedConversationId(matching?.id ?? data[0].id);
        }
      } catch {
        setLoadError('Failed to load conversations.');
      } finally {
        setLoading(false);
      }
    }
    void loadConversations();
  }, [user, requestId]);

  /* ── Mobile view sync ── */
  useEffect(() => {
    if (!isMobile) {
      setMobileView('list');
      return;
    }
    if (selectedConversationId) setMobileView('chat');
  }, [isMobile, selectedConversationId]);

  /* ── Messages subscription ── */
  useEffect(() => {
    if (!user || !selectedConversationId) return;
    const convId = selectedConversationId;
    let active = true;
    let lastRealtimeAt = Date.now();

    async function loadMessages() {
      try {
        const data = (await messagesApi.getMessages(convId, { limit: 50 })) as Message[];
        if (!active) return;
        setMessages(data);
        setHasOlder((data?.length ?? 0) === 50);
      } catch {
        // silent
      }
    }
    void loadMessages();

    const subscription = messagesApi.subscribeToMessages(convId, (newMsg) => {
      lastRealtimeAt = Date.now();
      setMessages((prev) => {
        const cast = newMsg as unknown as Message;
        if (prev.some((m) => m.id === cast.id)) return prev;
        const last = prev[prev.length - 1];
        if (!last) return [cast];
        if (+new Date(cast.created_at) >= +new Date(last.created_at)) return [...prev, cast];
        return [...prev, cast].sort(
          (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
        );
      });
    });

    const poll = window.setInterval(() => {
      if (Date.now() - lastRealtimeAt < 20_000) return;
      void loadMessages();
    }, 10_000);

    return () => {
      active = false;
      window.clearInterval(poll);
      void supabase.removeChannel(subscription);
    };
  }, [selectedConversationId, user]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Helpers ── */
  const loadOlder = async () => {
    if (!selectedConversationId || isLoadingOlder || !hasOlder) return;
    const first = messages[0];
    if (!first?.created_at) return;
    setIsLoadingOlder(true);
    try {
      const older = (await messagesApi.getMessages(selectedConversationId, {
        limit: 50,
        beforeCreatedAt: first.created_at,
      })) as Message[];
      setMessages((prev) => [...older, ...prev]);
      setHasOlder((older?.length ?? 0) === 50);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversationId) return;
    const content = newMessage;
    setNewMessage('');
    try {
      const sent = await messagesApi.send(selectedConversationId, content);
      setMessages((prev) => {
        const cast = sent as unknown as Message;
        return [...prev.filter((m) => m.id !== cast.id), cast].sort(
          (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
        );
      });
    } catch {
      // silent
    }
    inputRef.current?.focus();
  };

  const getAssignedStaff = (conv: ConversationListItem | undefined) =>
    conv?.request?.assigned_staff ?? conv?.assigned_staff ?? null;

  const currentConversation = conversations.find((c) => c.id === selectedConversationId);
  const staffForCurrent = getAssignedStaff(currentConversation);
  const requestForCurrent = currentConversation?.request ?? null;

  const filteredConversations = conversationSearch
    ? conversations.filter((c) => {
      const staff = getAssignedStaff(c);
      const hay = [staff?.full_name, c.organization?.name, c.last_message?.[0]?.content]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(conversationSearch.toLowerCase());
    })
    : conversations;

  /* ── Loading / Error states ── */
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-20 text-center px-4">
        <p className="text-sm font-semibold text-red-700">Couldn't load messages</p>
        <p className="text-xs text-red-500 mt-1">{loadError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 h-9 px-4 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
      </div>
    );
  }

  /* ── Main render ── */
  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col"
      style={{ height: 'calc(100dvh - 130px)', minHeight: 0 }}
    >
      {/* Page header — hidden on mobile when chat is open */}
      {(!isMobile || mobileView === 'list') && (
        <div className="mb-3 flex-shrink-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 leading-tight">Messages</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Communicate with service providers and case managers
          </p>
        </div>
      )}

      <div
        className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex overflow-hidden"
        style={{ minHeight: 0 }}
      >
        {/* ── Sidebar ── */}
        <aside
          className={[
            'flex-shrink-0 border-r border-gray-100 flex flex-col bg-white',
            // On mobile: slide in/out as an overlay; on desktop: static column
            isMobile
              ? [
                'absolute inset-0 z-20 rounded-2xl transition-transform duration-200',
                mobileView === 'list' ? 'translate-x-0' : '-translate-x-full pointer-events-none',
              ].join(' ')
              : 'relative w-72 xl:w-80',
          ].join(' ')}
        >
          {/* Search */}
          <div className="p-3 border-b border-gray-100 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search conversations…"
                value={conversationSearch}
                onChange={(e) => setConversationSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm transition-all"
              />
              {conversationSearch && (
                <button
                  type="button"
                  onClick={() => setConversationSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                {conversationSearch ? 'No results found' : 'No active conversations'}
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const staff = getAssignedStaff(conversation);
                const displayName =
                  staff?.full_name ||
                  (conversation.request?.assigned_staff_id ? 'Case manager assigned' : null) ||
                  conversation.organization?.name ||
                  'Conversation';
                const avatarUrl =
                  staff?.avatar_url || conversation.organization?.logo_url || null;
                const request = conversation?.request ?? null;
                const serviceName = request?.services?.name ?? null;
                const category = request?.services?.category ?? null;
                const borough = request?.borough ?? null;
                const requestLine = serviceName
                  ? [serviceName, borough].filter(Boolean).join(' · ')
                  : conversation.organization?.name || 'Request';
                const isSelected = selectedConversationId === conversation.id;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      setSelectedConversationId(conversation.id);
                      if (isMobile) setMobileView('chat');
                    }}
                    className={[
                      'w-full text-left p-3.5 border-b border-gray-50 transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500',
                      isSelected ? 'bg-teal-50' : 'hover:bg-gray-50 active:bg-gray-100',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            className="w-full h-full object-cover"
                            alt={displayName}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User className="w-5 h-5 text-teal-600" />
                        )}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-semibold text-gray-900 text-sm truncate">
                            {displayName}
                          </p>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {conversation.last_message_at
                              ? new Date(conversation.last_message_at).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })
                              : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[11px] text-slate-600 font-medium truncate flex-1">
                            {requestLine}
                          </p>
                          {request?.status && (
                            <div className="flex-shrink-0">
                              <StatusBadge status={request.status} />
                            </div>
                          )}
                        </div>
                        {category && (
                          <p className="text-[10px] text-slate-400 truncate">{category}</p>
                        )}
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {conversation.last_message?.[0]?.content || 'Click to start chatting'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Chat panel ── */}
        <div
          className={[
            'flex-1 flex flex-col bg-gray-50 min-w-0',
            isMobile && mobileView === 'list' ? 'hidden' : 'flex',
          ].join(' ')}
        >
          {selectedConversationId ? (
            <>
              {/* Header */}
              <header className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-3">
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    aria-label="Back to conversations"
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 hover:bg-gray-200 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                )}

                <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {staffForCurrent?.avatar_url ? (
                    <img
                      src={staffForCurrent.avatar_url}
                      className="w-full h-full object-cover"
                      alt={staffForCurrent.full_name ?? 'Case manager'}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : currentConversation?.organization?.logo_url ? (
                    <img
                      src={currentConversation.organization.logo_url}
                      className="w-full h-full object-cover"
                      alt={currentConversation.organization.name ?? 'Org'}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-4 h-4 text-teal-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {requestForCurrent?.services?.name ||
                      currentConversation?.organization?.name ||
                      'Request'}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <p className="text-[11px] text-slate-500 truncate">
                      {[
                        staffForCurrent?.full_name ||
                        (currentConversation?.request?.assigned_staff_id
                          ? 'Case manager assigned'
                          : null),
                        requestForCurrent?.borough,
                        requestForCurrent?.services?.category,
                      ]
                        .filter(Boolean)
                        .join(' · ') ||
                        currentConversation?.organization?.name ||
                        ''}
                    </p>
                    {requestForCurrent?.status && (
                      <StatusBadge status={requestForCurrent.status} />
                    )}
                  </div>
                </div>
              </header>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3">
                {hasOlder && (
                  <div className="flex justify-center pt-1 pb-2">
                    <button
                      type="button"
                      onClick={() => void loadOlder()}
                      disabled={isLoadingOlder}
                      className="h-8 px-4 rounded-full bg-white border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {isLoadingOlder ? 'Loading…' : 'Load older messages'}
                    </button>
                  </div>
                )}

                {messages.map((message) => {
                  const isMe = message.sender_id === user?.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-[80%] sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl">
                        <div
                          className={[
                            'px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words',
                            isMe
                              ? 'bg-teal-600 text-white rounded-tr-sm'
                              : 'bg-white text-gray-900 border border-gray-200 rounded-tl-sm shadow-sm',
                          ].join(' ')}
                        >
                          {message.content}
                        </div>
                        <p
                          className={`text-[10px] text-gray-400 mt-1 ${isMe ? 'text-right' : 'text-left'
                            }`}
                        >
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="flex-shrink-0 p-3 sm:p-4 bg-white border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message…"
                      className="w-full pl-4 pr-12 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white focus:border-transparent outline-none text-sm transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleSendMessage()}
                      disabled={!newMessage.trim()}
                      aria-label="Send message"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center flex-col gap-3 text-center px-4">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">No conversation selected</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Choose a conversation from the list to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}