import { Fragment, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getInternalConversations } from '../../api/messages';
import { Users, MessageSquare, Send, Hash, ArrowLeft } from 'lucide-react';

interface Participant {
  profile_id: string;
  last_read_at: string | null;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
}

interface Conversation {
  id: string;
  conversation_type: 'direct' | 'group';
  title: string | null;
  organization_id: string;
  last_message_at: string;
  conversation_participants: Participant[];
  messages: Message[];
}

function AvatarCircle({
  name,
  avatarUrl,
  sizeClassName,
  fallbackClassName,
}: {
  name: string | null | undefined;
  avatarUrl: string | null | undefined;
  sizeClassName: string;
  fallbackClassName: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = (() => {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  })();

  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? 'avatar'}
        className={`${sizeClassName} rounded-full object-cover border border-black/5 bg-white flex-shrink-0`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          setImgFailed(true);
        }}
      />
    );
  }

  return (
    <div
      className={`${sizeClassName} rounded-full flex items-center justify-center flex-shrink-0 ${fallbackClassName}`}
      aria-label={initials}
      title={name ?? undefined}
    >
      <span className="text-xs font-bold">{initials}</span>
    </div>
  );
}

export function InternalMessagingView({
  embedded = false,
  leftTop,
}: {
  embedded?: boolean;
  leftTop?: ReactNode;
}) {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // ── Load conversations ──────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const data = await getInternalConversations();
        setConversations(data as Conversation[]);
        // Auto-select group chat first
        const group = (data as Conversation[]).find(
          c => c.conversation_type === 'group'
        );
        if (group) setSelectedId(group.id);
        else if (data.length > 0) setSelectedId((data as any)[0].id);
      } catch (err) {
        console.error('Failed to load internal conversations:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // When a conversation is selected on mobile, switch to chat view
  useEffect(() => {
    if (!selectedId) return;
    setMobileView('chat');
  }, [selectedId]);

  // ── Load messages for selected conversation ─────────────
  useEffect(() => {
    if (!selectedId) return;

    async function loadMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id')
        .eq('conversation_id', selectedId)
        .order('created_at', { ascending: true });

      if (error) console.error('Failed to load messages:', error);
      else setMessages(data ?? []);
    }

    loadMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`internal-msg:${selectedId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedId}`,
        },
        payload => {
          const newMessage = payload.new as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId]);

  // ── Auto-scroll ─────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ────────────────────────────────────────
  async function handleSend() {
    if (!input.trim() || !selectedId || !user) return;
    setSending(true);
    const content = input.trim();
    setInput('');
    
    const { data: newMessage, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedId,
        sender_id: user.id,
        content,
      })
      .select()
      .single();

    if (error) {
      console.error('Send failed:', error);
    } else if (newMessage) {
      // Direct update for immediate feedback
      setMessages(prev => {
        if (prev.some(m => m.id === newMessage.id)) return prev;
        return [...prev, newMessage as Message];
      });
    }

    // Update last_message_at for conversation sorting
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', selectedId);
    setSending(false);
  }

  // ── Helpers ─────────────────────────────────────────────
  function getOtherParticipant(conv: Conversation) {
    return conv.conversation_participants.find(
      p => p.profile_id !== user?.id
    );
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const selected = conversations.find(c => c.id === selectedId);
  const groupChats = conversations.filter(c => c.conversation_type === 'group');
  const directChats = conversations.filter(c => c.conversation_type === 'direct');

  // ── Render ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-400">
        Loading team messages...
      </div>
    );
  }

  return (
    <div
      className={[
        'flex flex-1 min-h-0 overflow-hidden',
        embedded
          ? 'rounded-[14px] border border-gray-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
          : 'rounded-xl border border-slate-200 bg-white',
      ].join(' ')}
    >

      {/* ── Sidebar ── */}
      <div
        className={[
          embedded
            ? 'w-full md:w-[320px] lg:w-[360px] flex-shrink-0 border-r border-gray-200 flex flex-col'
            : 'w-full md:w-72 flex-shrink-0 border-r border-slate-100 flex flex-col',
          mobileView === 'chat' ? 'hidden md:flex' : 'flex',
        ].join(' ')}
      >
        {embedded ? (
          <Fragment>
            {leftTop ? <div className="px-4 border-b border-gray-100">{leftTop}</div> : null}
          </Fragment>
        ) : (
          <div className="px-4 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Team Messages</h2>
            <p className="text-xs text-slate-400 mt-0.5">Internal — team only</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">

          {/* Group chats */}
          {groupChats.length > 0 && (
            <div>
              <div className="px-4 pt-4 pb-1 text-[10px] font-extrabold
                              text-slate-400 uppercase tracking-widest">
                Channels
              </div>
              {groupChats.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => { setSelectedId(conv.id); setMobileView('chat'); }}
                  className={`w-full flex items-center gap-3 px-4 py-3
                    hover:bg-slate-50 transition-colors text-left
                    ${selectedId === conv.id
                      ? (embedded ? 'bg-teal-50/60 border-l-[3px] border-l-teal-600' : 'bg-teal-50 border-r-2 border-teal-500')
                      : ''
                    }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-teal-100 flex
                                  items-center justify-center flex-shrink-0">
                    <Hash className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {conv.title ?? 'Team Chat'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {conv.conversation_participants.length} members
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Direct messages */}
          {directChats.length > 0 && (
            <div>
              <div className="px-4 pt-4 pb-1 text-[10px] font-extrabold
                              text-slate-400 uppercase tracking-widest">
                Direct Messages
              </div>
              {directChats.map(conv => {
                const other = getOtherParticipant(conv);
                const name = other?.profiles?.full_name ?? 'Team Member';
                const avatarUrl = other?.profiles?.avatar_url ?? null;
                const lastMsg = conv.messages[conv.messages.length - 1];
                return (
                  <button
                    key={conv.id}
                    onClick={() => { setSelectedId(conv.id); setMobileView('chat'); }}
                    className={`w-full flex items-center gap-3 px-4 py-3
                      hover:bg-slate-50 transition-colors text-left
                      ${selectedId === conv.id
                        ? (embedded ? 'bg-teal-50/60 border-l-[3px] border-l-teal-600' : 'bg-teal-50 border-r-2 border-teal-500')
                        : ''
                      }`}
                  >
                    <AvatarCircle
                      name={name}
                      avatarUrl={avatarUrl}
                      sizeClassName="w-9 h-9"
                      fallbackClassName="bg-slate-200 text-slate-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {name}
                      </div>
                      {lastMsg && (
                        <div className="text-xs text-slate-400 truncate">
                          {lastMsg.content}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {conversations.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No team conversations yet.
            </div>
          )}
        </div>
      </div>

      {/* ── Chat Area ── */}
      {selected ? (
        <div
          className={[
            'flex flex-1 flex-col overflow-hidden min-w-0',
            mobileView === 'list' ? 'hidden md:flex' : 'flex',
          ].join(' ')}
        >

          {/* Header */}
          <div
            className={[
              'flex items-center gap-3 px-4 py-4 flex-shrink-0',
              embedded ? 'border-b border-gray-100 bg-white' : 'border-b border-slate-100',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-50 text-slate-600"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {selected.conversation_type === 'group' ? (
              <>
                <div className="w-9 h-9 rounded-xl bg-teal-100 flex
                                items-center justify-center">
                  <Users className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {selected.title ?? 'Team Chat'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {selected.conversation_participants.length} members
                  </div>
                </div>
              </>
            ) : (
              <>
                <AvatarCircle
                  name={getOtherParticipant(selected)?.profiles?.full_name ?? 'Team Member'}
                  avatarUrl={getOtherParticipant(selected)?.profiles?.avatar_url ?? null}
                  sizeClassName="w-9 h-9"
                  fallbackClassName="bg-slate-200 text-slate-600"
                />
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {getOtherParticipant(selected)?.profiles?.full_name
                      ?? 'Team Member'}
                  </div>
                  <div className="text-xs text-slate-400">Direct message</div>
                </div>
              </>
            )}
          </div>

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-3 md:p-4 space-y-3 ${embedded ? 'bg-slate-50' : 'bg-white'}`}>
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center
                              text-sm text-slate-400">
                No messages yet. Say hello 👋
              </div>
            )}
            {messages.map(msg => {
              const isOwn = msg.sender_id === user?.id;
              // Find sender name from participants
              const senderParticipant = selected.conversation_participants
                .find(p => p.profile_id === msg.sender_id);
              const senderName = isOwn
                ? 'You'
                : senderParticipant?.profiles?.full_name ?? 'Team Member';
              const senderAvatarUrl = isOwn
                ? (profile as any)?.avatar_url ?? null
                : senderParticipant?.profiles?.avatar_url ?? null;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                >
                  {!isOwn && (
                    <div className="mt-1">
                      <AvatarCircle
                        name={senderName}
                        avatarUrl={senderAvatarUrl}
                        sizeClassName="w-7 h-7"
                        fallbackClassName="bg-slate-200 text-slate-600 text-[10px]"
                      />
                    </div>
                  )}
                  <div className={`max-w-[70%] ${isOwn ? 'items-end' : ''} flex flex-col`}>
                    {!isOwn && (
                      <span className="text-[10px] font-semibold text-slate-400
                                       mb-1 ml-1">
                        {senderName}
                      </span>
                    )}
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm
                        ${isOwn
                          ? 'bg-teal-600 text-white rounded-br-md'
                          : 'bg-slate-100 text-slate-900 rounded-bl-md'
                        }`}
                    >
                      {msg.content}
                    </div>
                    <span className={`text-[10px] text-slate-400 mt-1
                      ${isOwn ? 'text-right' : ''}`}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className={`border-t px-3 md:px-4 py-3 flex gap-3 flex-shrink-0 bg-white ${embedded ? 'border-gray-100' : 'border-slate-100'}`}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-all ${
                embedded
                  ? 'border border-gray-200 bg-slate-50/70 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:bg-white'
                  : 'rounded-full border border-slate-200 bg-slate-50 focus:border-teal-400 focus:ring-2 focus:ring-teal-100'
              }`}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className={`w-10 h-10 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white flex items-center justify-center transition-colors flex-shrink-0 ${
                embedded ? 'rounded-xl' : 'rounded-full'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-slate-400">
          <div className="text-center">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Select a conversation</p>
          </div>
        </div>
      )}
    </div>
  );
}

