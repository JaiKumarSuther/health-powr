import { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Search, MessageSquare, ChevronLeft, User } from 'lucide-react';
import { messagesApi } from '../../api/messages';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { MessageBubble } from '../shared/MessageBubble';
import type { ConversationListItem, Message } from '../../lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeLabel(dateStr: string): string {
  const h = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h)}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1d' : `${d}d`;
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
}


// ─── Main Component ───────────────────────────────────────────────────────────

export function MessagesView() {
  const { user } = useAuth();
  const location = useLocation();
  const requestId = new URLSearchParams(location.search).get('requestId');
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Mobile state ──
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // ── Conversations state ──
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');

  // Use container width (not window) so this view is responsive even inside a narrow column.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setIsMobile(el.clientWidth <= 768);
    update();
    const obs = new ResizeObserver(() => update());
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Load conversations ──
  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        setLoading(true);
        const data = (await messagesApi.getMyConversations()) as ConversationListItem[];

        // Filter out team channels / non-request based for client
        const filtered = data.filter(c => c.request_id !== null);
        setConversations(filtered);

        if (filtered.length > 0) {
          const match = requestId ? filtered.find(c => String(c.request_id) === requestId) : null;
          setSelectedConvId(match?.id ?? filtered[0].id);
          if (isMobile && (match || requestId)) setMobileView('chat');
        }
      } catch (err) {
        console.error('[MessagesView] Failed to load conversations:', err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [user, requestId]);

  // ── Load messages for selected conversation ──
  useEffect(() => {
    if (!selectedConvId) return;
    const convId = selectedConvId;
    async function load() {
      try {
        const data = (await messagesApi.getMessages(convId, { limit: 50 })) as Message[];
        setMessages(data);
      } catch (err) {
        console.error('[MessagesView] Failed to load messages:', err);
      }
    }
    void load();

    const sub = messagesApi.subscribeToMessages(convId, (msg: Message) => {
      setMessages(prev => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        const last = prev[prev.length - 1];
        if (!last) return [msg];
        if (+new Date(msg.created_at) >= +new Date(last.created_at)) return [...prev, msg];
        const next = [...prev, msg];
        next.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        return next;
      });
    });
    return () => {
      void supabase.removeChannel(sub);
    };
  }, [selectedConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ──
  async function sendMessage() {
    if (!newMessage.trim() || !selectedConvId) return;
    const content = newMessage.trim();
    // SEC-AUDIT: Do NOT clear before send. If it fails, user loses their input.
    // setNewMessage(''); 
    try {
      const sent = (await messagesApi.send(selectedConvId, content)) as Message;
      setNewMessage(''); // Clear only on success
      setMessages(prev => {
        const next = [...prev.filter(m => m.id !== sent.id), sent];
        next.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        return next;
      });
    } catch (err) {
      console.error('[MessagesView] Failed to send message:', err);
      // Optional: show toast or keep message in input
    }
  }

  // ── Derived ──
  const filteredConvs = useMemo(() =>
    conversations.filter(c => {
      const staffName = c.request?.assigned_staff?.full_name || c.assigned_staff?.full_name;
      const orgName = c.organization?.name;
      const haystack = `${staffName} ${orgName}`.toLowerCase();
      return haystack.includes(searchTerm.toLowerCase());
    }),
    [conversations, searchTerm]);

  const selectedConv = conversations.find(c => c.id === selectedConvId);

  if (loading) {
    return (
      <div className="flex h-full w-full justify-center items-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0d9b8a]" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-white">
      {/* ── Sidebar ── */}
      <aside
        className={[
          "flex-shrink-0 border-r border-[#e8f0ee] flex flex-col",
          isMobile ? (mobileView === "list" ? "w-full flex" : "hidden") : "w-[300px] xl:w-[340px] flex"
        ].join(" ")}
      >
        <div className="p-4 border-b border-[#e8f0ee]">
          <h1 className="text-xl font-bold text-[#0f1f2e] mb-1">Messages</h1>
          <p className="text-[12px] text-[#7a9e99]">Chat with providers and staff</p>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-[#e8f0ee]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#7a9e99]" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-2 text-[12px] bg-[#f6faf8] border border-[#e8f0ee] rounded-lg outline-none focus:border-[#0d9b8a] focus:bg-white transition-all placeholder-[#7a9e99] text-[#0f1f2e]"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.map(conv => {
            const staff = conv.request?.assigned_staff || conv.assigned_staff;
            const org = conv.organization;
            const name = staff?.full_name || org?.name || 'Support';
            const subtext = conv.request?.services?.name || org?.name || 'Service request';
            const preview = conv.last_message?.[0]?.content || 'Start a conversation';
            const isActive = conv.id === selectedConvId;
            const avatarUrl = staff?.avatar_url || org?.logo_url;

            return (
              <div
                key={conv.id}
                onClick={() => {
                  setSelectedConvId(conv.id);
                  if (isMobile) setMobileView('chat');
                }}
                className={`flex items-start gap-3 px-4 py-4 cursor-pointer border-b border-[#f3f4f6] border-l-2 transition-colors ${isActive ? 'bg-[#f0faf8] border-l-[#0d9b8a]' : 'border-l-transparent hover:bg-[#f6faf8]'
                  }`}
              >
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-teal-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[14px] font-semibold text-[#0f1f2e] truncate">{name}</div>
                    <div className="text-[10px] text-[#7a9e99] flex-shrink-0">
                      {conv.last_message_at ? timeLabel(conv.last_message_at) : ''}
                    </div>
                  </div>
                  <div className="text-[11px] text-[#0d9b8a] font-medium truncate mt-0.5">{subtext}</div>
                  <div className="text-[12px] text-[#7a9e99] truncate mt-1">{preview}</div>
                </div>
              </div>
            );
          })}
          {filteredConvs.length === 0 && (
            <div className="py-20 text-center text-[13px] text-[#7a9e99]">No conversations found.</div>
          )}
        </div>
      </aside>

      {/* ── Chat area ── */}
      <main
        className={[
          "flex-1 flex flex-col min-w-0 bg-[#f6faf8]",
          isMobile ? (mobileView === "chat" ? "flex" : "hidden") : "flex"
        ].join(" ")}
      >
        {selectedConvId && selectedConv ? (
          <>
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#e8f0ee] flex-shrink-0">
              <div className="flex items-center gap-3">
                {isMobile && (
                  <button
                    onClick={() => setMobileView('list')}
                    className="p-1 -ml-1 text-[#7a9e99] hover:bg-[#f6faf8] rounded-lg border-none bg-transparent cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {selectedConv.request?.assigned_staff?.avatar_url || selectedConv.organization?.logo_url ? (
                    <img
                      src={selectedConv.request?.assigned_staff?.avatar_url || selectedConv.organization?.logo_url || undefined}
                      className="w-full h-full object-cover"
                      alt="Avatar"
                    />
                  ) : (
                    <User className="w-5 h-5 text-teal-600" />
                  )}
                </div>
                <div>
                  <div className="text-[15px] font-bold text-[#0f1f2e]">
                    {selectedConv.request?.assigned_staff?.full_name || selectedConv.organization?.name || 'Support'}
                  </div>
                  <div className="text-[11px] text-[#7a9e99] mt-0.5">
                    {selectedConv.request?.services?.name || 'General Support'}
                  </div>
                </div>
              </div>
            </header>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
              {messages.map(msg => {
                const isMe = msg.sender_id === user?.id;
                const senderName = isMe ? 'You' : (msg.sender?.full_name || selectedConv.organization?.name || 'Support');
                return (
                  <MessageBubble
                    key={msg.id}
                    content={msg.content}
                    isOwn={isMe}
                    senderName={senderName}
                    timestamp={new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    avatarFallback={initials(senderName)}
                    avatarUrl={isMe ? undefined : (msg.sender?.avatar_url || selectedConv.organization?.logo_url || undefined)}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <footer className="px-4 py-4 bg-white border-t border-[#e8f0ee] flex items-center gap-3 flex-shrink-0">
              <input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void sendMessage(); }}
                placeholder="Type your message..."
                className="flex-1 px-4 py-3 border border-[#e8f0ee] rounded-xl text-[14px] outline-none focus:border-[#0d9b8a] bg-[#f6faf8] focus:bg-white transition-all text-[#0f1f2e] placeholder-[#7a9e99]"
              />
              <button
                onClick={() => void sendMessage()}
                disabled={!newMessage.trim()}
                className="w-11 h-11 rounded-xl bg-[#0d9b8a] flex items-center justify-center hover:bg-[#0b8a7a] transition-colors disabled:opacity-40 flex-shrink-0 border-none cursor-pointer"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-[#f0faf8] rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-[#0d9b8a]" />
            </div>
            <h2 className="text-lg font-bold text-[#0f1f2e]">Your Messages</h2>
            <p className="text-sm text-[#7a9e99] max-w-xs mt-1">
              Select a conversation to communicate with service providers and case managers.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}