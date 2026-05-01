import { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Search } from 'lucide-react';
import { messagesApi } from '../../api/messages';
import { requestsApi } from '../../api/requests';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { MessageBubble } from '../shared/MessageBubble';

// ─── Types ────────────────────────────────────────────────────────────────────

type TopTab = 'clients' | 'team';
type TeamChannel = 'all_staff' | string;

interface MyConversation {
  id: string;
  request_id: string;
  created_at: string;
  member: { id: string; full_name: string; avatar_url?: string } | null;
  category?: string;
  borough?: string;
  status?: string;
  last_message?: { content: string; created_at: string }[];
}

interface TeamMember {
  profile_id: string;
  full_name: string;
  role: string;
  isActive?: boolean;
}

interface TeamMessage {
  id: string;
  channel: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
  is_announcement?: boolean;
  is_pinned?: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { full_name: string; avatar_url?: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeLabel(dateStr: string): string {
  const h = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h)}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1d' : `${d}d`;
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#0d9b8a', '#7c3aed', '#d97706', '#be185d', '#0891b2', '#15803d'];
function avatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function Avatar({ name, size = 36, color }: { name: string; size?: number; color?: string }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.32, background: color ?? avatarColor(name) }}
    >
      {initials(name)}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StaffMessagesView() {
  const { user } = useAuth();
  const location = useLocation();
  const requestId = new URLSearchParams(location.search).get('requestId');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [topTab, setTopTab]                   = useState<TopTab>('clients');
  const [conversations, setConversations]     = useState<MyConversation[]>([]);
  const [selectedConvId, setSelectedConvId]   = useState<string | null>(null);
  const [messages, setMessages]               = useState<Message[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [searchTerm, setSearchTerm]           = useState('');
  const [newMessage, setNewMessage]           = useState('');

  const [orgId, setOrgId]     = useState<string | null>(null);
  const [userId, setUserId]   = useState<string | null>(null);
  const [teamMembers, setTeamMembers]         = useState<TeamMember[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<TeamChannel>('all_staff');
  const [teamMessages, setTeamMessages]       = useState<TeamMessage[]>([]);

  // ── Load staff's own conversations ──
  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        setLoading(true);
        const ctx = await requestsApi.getMyOrgMembership();
        setOrgId(ctx.orgId);
        setUserId(ctx.userId ?? null);

        // getMyOrgConversations already filters to staff's own assigned requests
        const convs = await messagesApi.getMyOrgConversations();

        // Enrich with category/borough/status from service_requests
        const enriched: MyConversation[] = await Promise.all(
          convs.map(async (conv: any) => {
            if (!conv.request_id) return conv;
            const { data: req } = await supabase
              .from('service_requests')
              .select('category, borough, status')
              .eq('id', conv.request_id)
              .maybeSingle();
            return { ...conv, category: req?.category, borough: req?.borough, status: req?.status };
          })
        );
        setConversations(enriched);

        if (enriched.length > 0) {
          const match = requestId ? enriched.find(c => c.request_id === requestId) : null;
          setSelectedConvId(match?.id ?? enriched[0].id);
        }

        // Team members for DM list (excluding self)
        const members = await requestsApi.getOrgTeamMembers();
        setTeamMembers(
          members
            .filter((m: any) => m.profile_id !== ctx.userId)
            .map((m: any) => ({
              profile_id: m.profile_id,
              full_name:  m.full_name ?? 'Staff member',
              role:       m.role === 'owner' ? 'Admin' : 'Caseworker',
              isActive:   true,
            }))
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [user, requestId]);

  // ── Load client conversation messages ──
  useEffect(() => {
    if (!selectedConvId || topTab !== 'clients') return;
    async function load() {
      const data = await messagesApi.getMessages(selectedConvId!);
      setMessages(data);
    }
    void load();

    const poll = window.setInterval(() => void load(), 2500);
    const sub  = messagesApi.subscribeToMessages(selectedConvId, (msg: any) => {
      setMessages(prev => {
        const next = [...prev.filter(m => m.id !== msg.id), msg as Message];
        next.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        return next;
      });
    });
    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(sub);
    };
  }, [selectedConvId, topTab]);

  // ── Load team messages ──
  // TODO: Jai — requires `team_messages` table (see CBOMessagesView.tsx TODO)
  useEffect(() => {
    if (!orgId || topTab !== 'team') return;
    async function load() {
      const { data } = await supabase
        .from('team_messages')
        .select(`*, sender:profiles!sender_id(full_name)`)
        .eq('org_id', orgId)
        .eq('channel', selectedChannel)
        .order('created_at', { ascending: true });
      if (data) {
        setTeamMessages(data.map((m: any) => ({
          id:              m.id,
          channel:         m.channel,
          sender_id:       m.sender_id,
          sender_name:     m.sender?.full_name ?? 'Unknown',
          content:         m.content,
          created_at:      m.created_at,
          is_announcement: m.is_announcement ?? false,
          is_pinned:       m.is_pinned ?? false,
        })));
      }
    }
    void load();
  }, [orgId, topTab, selectedChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, teamMessages]);

  // ── Send client message ──
  async function sendClientMessage() {
    if (!newMessage.trim() || !selectedConvId) return;
    const content = newMessage;
    setNewMessage('');
    const sent = await messagesApi.send(selectedConvId, content);
    setMessages(prev => {
      const next = [...prev.filter(m => m.id !== sent.id), sent as unknown as Message];
      next.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      return next;
    });
  }

  // ── Send team message ──
  async function sendTeamMessage() {
    if (!newMessage.trim() || !orgId || !userId) return;
    const content = newMessage;
    setNewMessage('');
    await supabase.from('team_messages').insert({
      org_id:          orgId,
      channel:         selectedChannel,
      sender_id:       userId,
      content,
      is_announcement: false,
      is_pinned:       false,
    });
  }

  function handleSend() {
    if (topTab === 'clients') void sendClientMessage();
    else void sendTeamMessage();
  }

  const filteredConvs = useMemo(() =>
    conversations.filter(c =>
      c.member?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  [conversations, searchTerm]);

  const selectedConv       = conversations.find(c => c.id === selectedConvId);
  const dmPartner          = teamMembers.find(m => m.profile_id === selectedChannel);
  const channelMessages    = teamMessages.filter(m => m.channel === selectedChannel);
  const pinnedMessage      = teamMessages.find(m => m.is_pinned && m.channel === 'all_staff');

  if (loading) return <div className="py-20 text-center text-[#7a9e99]">Loading messages...</div>;

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">

      {/* ── Sidebar ── */}
      <div className="w-[280px] flex-shrink-0 border-r border-[#e8f0ee] flex flex-col">

        {/* Tabs */}
        <div className="flex border-b border-[#e8f0ee]">
          {([
            { id: 'clients' as TopTab, label: 'My Clients', count: conversations.length },
            { id: 'team'    as TopTab, label: 'Team',       count: teamMembers.length, urgent: true },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setTopTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                topTab === tab.id ? 'text-[#0d9b8a] border-[#0d9b8a]' : 'text-[#7a9e99] border-transparent hover:text-[#0f1f2e]'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                tab.urgent
                  ? 'bg-[#f3f4f6] text-[#f59e0b]'
                  : topTab === tab.id ? 'bg-[#e1f5ee] text-[#0d9b8a]' : 'bg-[#f3f4f6] text-[#7a9e99]'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-[#e8f0ee]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#7a9e99]" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-3 py-2 text-[12px] bg-[#f6faf8] border border-[#e8f0ee] rounded-lg outline-none focus:border-[#0d9b8a] focus:bg-white transition-all placeholder-[#7a9e99] text-[#0f1f2e]"
            />
          </div>
        </div>

        {/* MY CLIENTS list */}
        {topTab === 'clients' && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-3.5 pt-2 pb-1 text-[10px] font-bold text-[#7a9e99] uppercase tracking-wider">
              Your assigned clients
            </div>
            {filteredConvs.map(conv => {
              const name    = conv.member?.full_name ?? 'Unknown';
              const preview = conv.last_message?.[0]?.content ?? 'No messages yet';
              const isActive = conv.id === selectedConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`flex items-start gap-2.5 px-3.5 py-3 cursor-pointer border-b border-[#f3f4f6] border-l-2 transition-colors ${
                    isActive ? 'bg-[#f0faf8] border-l-[#0d9b8a]' : 'border-l-transparent hover:bg-[#f6faf8]'
                  }`}
                >
                  <Avatar name={name} size={34} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#0f1f2e] truncate">{name}</div>
                    <div className="text-[10px] text-[#7a9e99] mt-0.5 capitalize truncate">
                      {[conv.category, conv.borough].filter(Boolean).join(' · ')}
                    </div>
                    <div className="text-[11px] text-[#7a9e99] truncate mt-0.5">{preview}</div>
                  </div>
                  <div className="text-[10px] text-[#7a9e99] flex-shrink-0 mt-0.5">
                    {conv.last_message?.[0] ? timeLabel(conv.last_message[0].created_at) : ''}
                  </div>
                </div>
              );
            })}
            {filteredConvs.length === 0 && (
              <div className="py-10 text-center text-[13px] text-[#7a9e99]">No conversations yet.</div>
            )}
          </div>
        )}

        {/* TEAM list */}
        {topTab === 'team' && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-3.5 pt-2 pb-1 text-[10px] font-bold text-[#7a9e99] uppercase tracking-wider">Channels</div>
            <div
              onClick={() => setSelectedChannel('all_staff')}
              className={`flex items-center gap-2.5 px-3.5 py-3 cursor-pointer border-b border-[#f3f4f6] border-l-2 transition-colors ${
                selectedChannel === 'all_staff' ? 'bg-[#f0faf8] border-l-[#0d9b8a]' : 'border-l-transparent hover:bg-[#f6faf8]'
              }`}
            >
              <div className="w-[34px] h-[34px] rounded-full bg-[#0b1d2a] flex items-center justify-center text-[14px] font-bold flex-shrink-0" style={{ color: '#2dd4bf' }}>#</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#0f1f2e]">All Staff</div>
                <div className="text-[11px] text-[#7a9e99]">Announcements &amp; updates</div>
              </div>
            </div>

            <div className="px-3.5 pt-3 pb-1 text-[10px] font-bold text-[#7a9e99] uppercase tracking-wider">Direct messages</div>
            {teamMembers.map(member => (
              <div
                key={member.profile_id}
                onClick={() => setSelectedChannel(member.profile_id)}
                className={`flex items-center gap-2.5 px-3.5 py-3 cursor-pointer border-b border-[#f3f4f6] border-l-2 transition-colors ${
                  selectedChannel === member.profile_id ? 'bg-[#f0faf8] border-l-[#0d9b8a]' : 'border-l-transparent hover:bg-[#f6faf8]'
                }`}
              >
                <div className="relative">
                  <Avatar name={member.full_name} size={34}
                    color={member.role === 'Admin' ? '#0b1d2a' : undefined}
                  />
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${member.isActive ? 'bg-[#10b981]' : 'bg-[#f59e0b]'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#0f1f2e] truncate">{member.full_name}</div>
                  <div className="text-[11px] text-[#7a9e99]">{member.role}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f6faf8]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-white border-b border-[#e8f0ee] flex-shrink-0">
          {topTab === 'clients' && selectedConv ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar name={selectedConv.member?.full_name ?? '?'} size={38} />
                <div>
                  <div className="text-[14px] font-bold text-[#0f1f2e]">{selectedConv.member?.full_name}</div>
                  <div className="text-[11px] text-[#7a9e99] mt-0.5 capitalize">
                    {[selectedConv.category, selectedConv.borough, selectedConv.status].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              <button className="px-3 py-1.5 border border-[#e8f0ee] rounded-lg bg-white text-[11px] font-semibold text-[#7a9e99] hover:text-[#0f1f2e] transition-colors">
                View request
              </button>
            </>
          ) : topTab === 'team' ? (
            <div className="flex items-center gap-3">
              {selectedChannel === 'all_staff' ? (
                <div className="w-[38px] h-[38px] rounded-full bg-[#0b1d2a] flex items-center justify-center text-[16px] font-bold" style={{ color: '#2dd4bf' }}>#</div>
              ) : (
                <Avatar name={dmPartner?.full_name ?? '?'} size={38}
                  color={dmPartner?.role === 'Admin' ? '#0b1d2a' : undefined}
                />
              )}
              <div>
                <div className="text-[14px] font-bold text-[#0f1f2e]">
                  {selectedChannel === 'all_staff' ? '# All Staff' : dmPartner?.full_name}
                </div>
                <div className="text-[11px] text-[#7a9e99] mt-0.5">
                  {selectedChannel === 'all_staff' ? 'Read announcements · reply to team' : dmPartner?.role}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">

          {topTab === 'clients' && (
            <>
              {messages.map(msg => {
                const isMe = msg.sender_id === userId;
                const senderName = isMe ? 'You' : (msg.sender?.full_name ?? selectedConv?.member?.full_name ?? 'Unknown');
                return (
                  <MessageBubble
                    key={msg.id}
                    content={msg.content}
                    isOwn={isMe}
                    senderName={senderName}
                    timestamp={new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    avatarUrl={msg.sender?.avatar_url}
                    avatarFallback={initials(senderName)}
                  />
                );
              })}
              {messages.length === 0 && (
                <div className="text-center text-[13px] text-[#7a9e99] py-10">No messages yet. Send the first one.</div>
              )}
            </>
          )}

          {topTab === 'team' && (
            <>
              {/* Pinned announcement */}
              {selectedChannel === 'all_staff' && pinnedMessage && (
                <div className="flex items-start gap-2.5 bg-[#f0faf8] border border-[#c2e8e0] rounded-xl px-3 py-2.5 flex-shrink-0">
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" stroke="#0d9b8a" fill="none" strokeWidth={1.5}>
                    <path d="M13 3H3a1 1 0 00-1 1v7a1 1 0 001 1h2v2l3-2h5a1 1 0 001-1V4a1 1 0 00-1-1z"/>
                  </svg>
                  <div>
                    <div className="text-[10px] font-bold text-[#0d9b8a] uppercase tracking-wide mb-0.5">📌 Pinned</div>
                    <div className="text-[12px] text-[#0f1f2e]">{pinnedMessage.content}</div>
                  </div>
                </div>
              )}

              {channelMessages.map(msg => {
                const isMe = msg.sender_id === userId;
                const senderName = isMe ? 'You' : msg.sender_name;
                return (
                  <MessageBubble
                    key={msg.id}
                    content={msg.content}
                    isOwn={isMe}
                    senderName={senderName}
                    timestamp={timeLabel(msg.created_at)}
                    avatarFallback={initials(senderName)}
                  />
                );
              })}
              {channelMessages.length === 0 && (
                <div className="text-center text-[13px] text-[#7a9e99] py-10">
                  {selectedChannel === 'all_staff' ? 'No announcements yet.' : 'Start a conversation.'}
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 bg-white border-t border-[#e8f0ee] flex items-center gap-2.5 flex-shrink-0">
          <input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder={
              topTab === 'clients'
                ? `Message ${selectedConv?.member?.full_name ?? 'client'}...`
                : selectedChannel === 'all_staff'
                  ? 'Reply to All Staff...'
                  : `Message ${dmPartner?.full_name ?? 'staff'}...`
            }
            className="flex-1 px-4 py-2.5 border border-[#e8f0ee] rounded-xl text-[13px] outline-none focus:border-[#0d9b8a] bg-[#f6faf8] focus:bg-white transition-all text-[#0f1f2e] placeholder-[#7a9e99]"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className="w-9 h-9 rounded-xl bg-[#0d9b8a] flex items-center justify-center hover:bg-[#0b8a7a] transition-colors disabled:opacity-40 flex-shrink-0 border-none cursor-pointer"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

