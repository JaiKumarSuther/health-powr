import { useMemo, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { 
  Send, Search, ArrowLeft, ChevronRight
} from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { messagesApi } from '../../api/messages';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getAvatarColor, getInitials } from '../../lib/utils';
import { StatusBadge } from '../shared/StatusBadge';

export function MessagesView({
  viewRequestHref,
  embedded = false,
  leftTop,
  listSectionLabel,
}: {
  viewRequestHref?: (requestId: string) => string;
  embedded?: boolean;
  leftTop?: ReactNode;
  listSectionLabel?: string;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const requestId = new URLSearchParams(location.search).get('requestId');
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentRequestMeta, setCurrentRequestMeta] = useState<null | {
    requestId: string;
    category: string | null;
    borough: string | null;
    status: string | null;
    metadata?: Record<string, unknown> | null;
    created_at?: string | null;
  }>(null);

  useEffect(() => {
    if (!user) return;
    async function loadConversations() {
      try {
        setLoading(true);
        setLoadError(null);
        const data = await messagesApi.getMyOrgConversations();
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

    // Load request meta for the header ("Category · Borough · Status")
    const conv = conversations.find((c) => c.id === selectedConversationId);
    const reqId = conv?.request_id ? String(conv.request_id) : null;
    if (reqId) {
      supabase
        .from('service_requests')
        .select('id, category, borough, status, metadata, created_at')
        .eq('id', reqId)
        .maybeSingle()
        .then(({ data }) => {
          if (!active) return;
          if (!data?.id) return;
          setCurrentRequestMeta({
            requestId: data.id,
            category: data.category ?? null,
            borough: data.borough ?? null,
            status: data.status ?? null,
            metadata: (data as any).metadata ?? null,
            created_at: (data as any).created_at ?? null,
          });
        });
    } else {
      setCurrentRequestMeta(null);
    }

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
  }, [selectedConversationId, user, conversations]);

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
  const filteredConversations = conversations.filter(conv =>
    conv.member?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const convLastMessage = (conv: any) => {
    const list = Array.isArray(conv?.messages) ? conv.messages : [];
    return list.slice().sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at))[0] ?? null;
  };

  const isOverdue48h = (conv: any) => {
    const t = conv?.last_message_at || conv?.updated_at || conv?.created_at;
    if (!t) return false;
    const last = convLastMessage(conv);
    if (!last?.created_at) return false;
    const isLastFromMember = last.sender_id ? last.sender_id !== user?.id : true;
    if (!isLastFromMember) return false;
    const hoursSince = (Date.now() - new Date(last.created_at).getTime()) / 36e5;
    return hoursSince > 48;
  };

  const chatRows = useMemo(() => {
    const rows: Array<{ type: 'sep' | 'msg'; key: string; label?: string; msg?: any }> = [];
    let lastDayKey: string | null = null;
    for (const m of messages) {
      const d = new Date(m.created_at);
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (dayKey !== lastDayKey) {
        const today = new Date();
        const isToday =
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate();
        rows.push({ type: 'sep', key: `sep:${dayKey}`, label: isToday ? 'Today' : d.toLocaleDateString() });
        lastDayKey = dayKey;
      }
      rows.push({ type: 'msg', key: String(m.id), msg: m });
    }
    return rows;
  }, [messages]);

  if (loading) {
    const skeletonPanel = (
      <div className="bg-white rounded-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-200 flex-1 flex min-h-0 overflow-hidden">
        {/* Left */}
        <div className="w-full md:w-[320px] lg:w-[360px] border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="border-b border-gray-100">
            {leftTop ? <div className="px-4">{leftTop}</div> : null}
            <div className="p-4">
              <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
            </div>
            {listSectionLabel ? (
              <div className="px-4 pb-3 -mt-2">
                <div className="h-3 w-40 rounded bg-slate-100 animate-pulse" />
              </div>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 border-b border-gray-50">
                <div className="flex items-start gap-3">
                  <div className="w-[34px] h-[34px] rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="h-3 w-32 rounded bg-slate-100 animate-pulse" />
                      <div className="h-3 w-12 rounded bg-slate-100 animate-pulse" />
                    </div>
                    <div className="mt-2 h-3 w-44 rounded bg-slate-100 animate-pulse" />
                    <div className="mt-2 h-3 w-56 rounded bg-slate-100 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="hidden md:flex flex-1 flex-col bg-slate-50">
          <div className="p-4 border-b border-gray-100 bg-white">
            <div className="h-5 w-44 rounded bg-slate-100 animate-pulse" />
            <div className="mt-2 h-3 w-72 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="flex-1 p-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-10 w-[70%] rounded-2xl bg-slate-100 animate-pulse" />
                <div className="h-10 w-[55%] rounded-2xl bg-slate-100 animate-pulse ml-auto" />
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-100 bg-white">
            <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        </div>
      </div>
    );

    if (embedded) return skeletonPanel;
    return (
      <div className="w-full flex-1 flex flex-col min-h-0">
        <div className="mb-4 flex-shrink-0">
          <h1 className="text-[20px] font-extrabold text-slate-900 mb-1 leading-tight">Messages</h1>
          <p className="text-[12px] text-slate-500">Communicate with clients and track case progress</p>
        </div>
        {skeletonPanel}
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

  const panel = (
    <div className="bg-white rounded-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-200 flex-1 flex min-h-0 overflow-hidden">
        {/* Conversations List */}
        <div className={`${selectedConversationId ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[360px] border-r border-gray-200 flex-col flex-shrink-0`}>
          <div className="border-b border-gray-100">
            {leftTop ? <div className="px-4">{leftTop}</div> : null}
            <div className="p-4">
              <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 h-10 bg-slate-50/70 border border-gray-200 rounded-xl focus:border-teal-600 outline-none text-[13px] placeholder-slate-400 transition-all"
              />
              </div>
            </div>
            {listSectionLabel ? (
              <div className="px-4 pb-3 -mt-2">
                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                  {listSectionLabel}
                </div>
              </div>
            ) : null}
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length > 0 ? filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => setSelectedConversationId(conversation.id)}
                className={`p-4 border-b border-gray-50 cursor-pointer transition-colors ${
                  selectedConversationId === conversation.id ? 'bg-teal-50/60 border-l-[3px] border-l-teal-600' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {(() => {
                    const name = conversation.member?.full_name || "Member";
                    const initials = getInitials(name);
                    const color = getAvatarColor(name);
                    return (
                      <div
                        className="w-[34px] h-[34px] rounded-full flex items-center justify-center flex-shrink-0 border border-black/5 text-white text-[11px] font-bold"
                        style={{ backgroundColor: color }}
                        aria-label={initials}
                      >
                        {initials}
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-[12px] font-bold text-slate-900 truncate">
                        {conversation.member?.full_name || 'Member'}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isOverdue48h(conversation) ? (
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100">
                            48h+
                          </span>
                        ) : null}
                        <span className="text-[9px] text-slate-400">
                          {(() => {
                            const t =
                              conversation.last_message_at ||
                              conversation.updated_at ||
                              conversation.created_at;
                            return t
                              ? formatDistanceToNowStrict(new Date(t), { addSuffix: true })
                              : "";
                          })()}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">
                      {(conversation.service_request?.services?.category ?? '—')}
                      {' · '}
                      {(conversation.service_request?.borough ?? '—')}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate max-w-[220px]">
                      {(() => {
                        const last = convLastMessage(conversation);
                        return last?.content || 'Start chatting...';
                      })()}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      {conversation.assigned_staff_id ? (
                        <span className="text-[10px] text-teal-700 font-semibold">
                          {conversation.assigned_staff_id === user?.id ? 'Your conversation' : 'Private'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Open</span>
                      )}
                      {typeof conversation.unread_count === "number" && conversation.unread_count > 0 ? (
                        <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-teal-600 text-white text-[10px] font-bold">
                          {conversation.unread_count}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-gray-400 text-sm">No active conversations</div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        {selectedConversationId ? (
          <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
            {/* Chat Header */}
            <div className="p-3 sm:p-4 border-b border-gray-100 bg-white flex-shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setSelectedConversationId(null)} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-50">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  {(() => {
                    const name = currentConversation?.member?.full_name || "Member";
                    const initials = getInitials(name);
                    const color = getAvatarColor(name);
                    return (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center border border-black/5 text-white text-[11px] font-bold"
                        style={{ backgroundColor: color }}
                        aria-label={initials}
                      >
                        {initials}
                      </div>
                    );
                  })()}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-slate-900 truncate">
                      {currentConversation?.service_request?.services?.name ?? 'Request'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {currentConversation?.member?.full_name ?? 'Member'}
                      {' · '}
                      {currentConversation?.service_request?.services?.category ?? currentRequestMeta?.category ?? '—'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{currentRequestMeta?.borough ?? "—"}</span>
                      <span className="text-slate-300">·</span>
                      {currentRequestMeta?.status ? (
                        <StatusBadge status={currentRequestMeta.status} />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const reqId =
                        currentRequestMeta?.requestId ||
                        (currentConversation?.request_id ? String(currentConversation.request_id) : null);
                      if (!reqId) return;
                      const href = viewRequestHref ? viewRequestHref(reqId) : `/cbo/clients/${reqId}`;
                      navigate(href);
                    }}
                    className="sm:hidden h-9 w-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 hover:bg-teal-100 inline-flex items-center justify-center"
                    aria-label="View request"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const reqId =
                        currentRequestMeta?.requestId ||
                        (currentConversation?.request_id ? String(currentConversation.request_id) : null);
                      if (!reqId) return;
                      const href = viewRequestHref ? viewRequestHref(reqId) : `/cbo/clients/${reqId}`;
                      navigate(href);
                    }}
                    className="hidden sm:inline-flex h-9 px-3 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 hover:bg-teal-100 text-[12px] font-semibold items-center gap-1"
                  >
                    View Request <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-slate-50 space-y-2">
              {chatRows.map((row) => {
                if (row.type === 'sep') {
                  return (
                    <div key={row.key} className="py-2 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                        {row.label}
                      </span>
                    </div>
                  );
                }
                const message = row.msg!;
                const isMe = message.sender_id === user?.id;
                const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={row.key} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[78%] md:max-w-[65%]">
                      <div
                        className={[
                          "px-3 py-2 text-[13px] leading-relaxed shadow-sm",
                          isMe
                            ? "bg-teal-600 text-white rounded-[14px] rounded-br-[3px]"
                            : "bg-white text-slate-900 border border-gray-200 rounded-[14px] rounded-bl-[3px]",
                        ].join(" ")}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                      <p className={`text-[10px] text-slate-400 mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                        {isMe ? `You · ${time}` : `${currentConversation?.member?.full_name ?? 'Client'} · ${time}`}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-3 sm:p-4 border-t border-gray-100 bg-white flex-shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 h-10 px-3 bg-slate-50/70 border border-gray-200 rounded-xl focus:border-teal-600 outline-none text-[13px] placeholder-slate-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="w-10 h-10 inline-flex items-center justify-center bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center text-center p-8 bg-gray-50">
            <div>
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100 shadow-sm">
                <Send className="w-8 h-8 text-teal-600/30" />
              </div>
              <h3 className="text-[16px] font-bold text-slate-900 mb-1">Select a conversation</h3>
              <p className="text-[13px] text-slate-400 max-w-xs">Choose a client from the list to start communicating</p>
            </div>
          </div>
        )}
      </div>
  );

  if (embedded) return panel;

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-[20px] font-extrabold text-slate-900 mb-1 leading-tight">Messages</h1>
        <p className="text-[12px] text-slate-500">Communicate with clients and track case progress</p>
      </div>
      {panel}
    </div>
  );
}