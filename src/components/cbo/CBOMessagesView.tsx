import { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Search, Eye } from 'lucide-react';
import { getInternalConversations, getOrCreateDirectConversation, messagesApi } from '../../api/messages';
import { requestsApi } from '../../api/requests';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type TopTab = 'clients' | 'team';
type TeamChannel = 'all_staff' | string; // 'all_staff' or a staff profile_id for DMs

interface OrgConversation {
  id: string;
  request_id: string;
  created_at: string;
  member: { id: string; full_name: string; avatar_url?: string } | null;
  assigned_staff?: { id: string; full_name: string } | null;
  category?: string;
  borough?: string;
  status?: string;
  last_message?: { content: string; created_at: string }[];
  unread?: boolean;
}

interface TeamMember {
  profile_id: string;
  full_name: string;
  role: string;
  isActive?: boolean;
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

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function OversightBanner() {
  return (
    <div className="flex items-center gap-2 bg-[#f0faf8] border border-[#c2e8e0] rounded-xl px-3 py-2 flex-shrink-0">
      <Eye className="w-3 h-3 text-[#0d9b8a] flex-shrink-0" />
      <span className="text-[11px] text-[#4b6b65]">
        You're viewing this conversation as an admin. Messages are sent by the assigned caseworker.
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CBOMessagesView({ defaultTopTab = 'clients' }: { defaultTopTab?: TopTab } = {}) {
  const { user } = useAuth();
  const location = useLocation();
  const requestId = new URLSearchParams(location.search).get('requestId');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Client conversations state ──
  const [topTab, setTopTab]                     = useState<TopTab>(defaultTopTab);
  const [conversations, setConversations]       = useState<OrgConversation[]>([]);
  const [selectedConvId, setSelectedConvId]     = useState<string | null>(null);
  const [messages, setMessages]                 = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs]         = useState(true);
  const [searchTerm, setSearchTerm]             = useState('');

  // ── Team state ──
  const [teamMembers, setTeamMembers]           = useState<TeamMember[]>([]);
  const [selectedChannel, setSelectedChannel]   = useState<TeamChannel>('all_staff');
  const [teamConvId, setTeamConvId]             = useState<string | null>(null);
  const [teamConvSubject, setTeamConvSubject]   = useState<string | null>(null);
  const [teamMessages, setTeamMessages]         = useState<Message[]>([]);
  const [newMessage, setNewMessage]             = useState('');
  const [announceText, setAnnounceText]         = useState('');
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [pinAnnouncement, setPinAnnouncement]   = useState(true);

  // ── Org context ──
  const [orgId, setOrgId]   = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // ── Load client conversations ──
  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        setLoadingConvs(true);
        const ctx = await requestsApi.getMyOrgMembership();
        setOrgId(ctx.orgId);
        setUserId(ctx.userId ?? null);

        // Load all org conversations (owners see all, API handles filtering)
        const convs = await messagesApi.getMyOrgConversations();

        // Enrich with assigned staff info from service_requests
        const enriched: OrgConversation[] = await Promise.all(
          convs.map(async (conv: any) => {
            if (!conv.request_id) return conv;
            const { data: req } = await supabase
              .from('service_requests')
              .select('category, borough, status, assigned_staff:profiles!assigned_staff_id(id, full_name)')
              .eq('id', conv.request_id)
              .maybeSingle();
            return {
              ...conv,
              category:       req?.category ?? null,
              borough:        req?.borough ?? null,
              status:         req?.status ?? null,
              assigned_staff: req?.assigned_staff ?? null,
            };
          })
        );
        setConversations(enriched);

        // Auto-select based on requestId param or first conv
        if (enriched.length > 0) {
          const match = requestId ? enriched.find(c => c.request_id === requestId) : null;
          setSelectedConvId(match?.id ?? enriched[0].id);
        }

        // Load team members
        const members = await requestsApi.getOrgTeamMembers();
        setTeamMembers(members.map((m: any) => ({
          profile_id: m.profile_id,
          full_name:  m.full_name ?? 'Staff member',
          role:       m.role === 'owner' ? 'Admin' : 'Caseworker',
          isActive:   true,
        })));
      } finally {
        setLoadingConvs(false);
      }
    }
    void load();
  }, [user, requestId]);

  // ── Load messages for selected client conversation ──
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

  // ── Team messages (real) — internal conversations in `conversations` + `messages` ──
  // Channel mapping:
  // - `all_staff` => a group conversation (creates one if missing)
  // - profile_id  => a direct conversation with that staff member
  useEffect(() => {
    if (!orgId || topTab !== 'team') return;

    let cancelled = false;

    async function ensureAllStaffConversation(): Promise<{ id: string; subject: string | null }> {
      const convs = await getInternalConversations();
      const group = (convs as any[]).find((c) => c.conversation_type === 'group');
      if (group?.id) return { id: group.id as string, subject: (group.subject ?? null) as string | null };

      // Create a group conversation and add all org members as participants.
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          organization_id: orgId,
          conversation_type: 'group',
          title: 'All Staff',
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (convErr) throw convErr;

      const { data: members, error: memErr } = await supabase
        .from('organization_members')
        .select('profile_id')
        .eq('organization_id', orgId);
      if (memErr) throw memErr;

      const ids = Array.from(new Set([...(members ?? []).map((m: any) => m.profile_id).filter(Boolean)]));
      if (ids.length > 0) {
        const { error: partErr } = await supabase.from('conversation_participants').insert(
          ids.map((pid) => ({ conversation_id: conv.id, profile_id: pid }))
        );
        if (partErr) throw partErr;
      }

      return { id: conv.id as string, subject: null };
    }

    async function resolveTeamConversation() {
      if (selectedChannel === 'all_staff') {
        const g = await ensureAllStaffConversation();
        if (!cancelled) {
          setTeamConvId(g.id);
          setTeamConvSubject(g.subject);
        }
        return;
      }

      const convId = await getOrCreateDirectConversation(orgId!, selectedChannel);
      if (!cancelled) {
        setTeamConvId(convId);
        setTeamConvSubject(null);
      }
    }

    void resolveTeamConversation();
    return () => { cancelled = true; };
  }, [orgId, topTab, selectedChannel]);

  useEffect(() => {
    if (!teamConvId || topTab !== 'team') return;

    let active = true;

    async function load() {
      const data = await messagesApi.getMessages(teamConvId!);
      if (active) setTeamMessages(data as unknown as Message[]);
    }

    void load();
    const sub = messagesApi.subscribeToMessages(teamConvId, () => void load());
    return () => {
      active = false;
      void supabase.removeChannel(sub);
    };
  }, [teamConvId, topTab]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, teamMessages]);

  // ── Send team message ──
  async function sendTeamMessage() {
    if (!newMessage.trim() || !teamConvId) return;
    const content = newMessage.trim();
    setNewMessage('');
    await messagesApi.send(teamConvId, content);
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', teamConvId);
  }

  // ── Post announcement ──
  async function postAnnouncement() {
    if (!announceText.trim() || !orgId) return;
    const content = announceText.trim();
    setAnnounceText('');
    setShowAnnounceModal(false);
    setTopTab('team');
    setSelectedChannel('all_staff');

    // Ensure the group channel exists, then send the announcement into it.
    // If pinned, persist the pinned banner content in `conversations.subject` for the group.
    const convs = await getInternalConversations();
    const group = (convs as any[]).find((c) => c.conversation_type === 'group');
    const groupId = group?.id ? (group.id as string) : teamConvId;
    if (!groupId) return;

    await messagesApi.send(groupId, content);
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        ...(pinAnnouncement ? { subject: content } : {}),
      })
      .eq('id', groupId);

    if (pinAnnouncement) setTeamConvSubject(content);
  }

  // ── Derived ──
  const filteredConvs = useMemo(() =>
    conversations.filter(c =>
      c.member?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.assigned_staff?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  [conversations, searchTerm]);

  const selectedConv  = conversations.find(c => c.id === selectedConvId);
  const pinnedMessage = selectedChannel === 'all_staff' ? teamConvSubject : null;
  const channelMessages = teamMessages;

  const dmPartner = teamMembers.find(m => m.profile_id === selectedChannel);

  // ─────────────────────────────────────────────────────────────────────────────

  if (loadingConvs) return <div className="py-20 text-center text-[#7a9e99]">Loading messages...</div>;

  return (
    <div className="flex flex-1 overflow-hidden min-h-0 bg-white rounded-none">

      {/* ── Sidebar ── */}
      <div className="w-[280px] flex-shrink-0 border-r border-[#e8f0ee] flex flex-col">

        {/* Top tabs */}
        <div className="flex border-b border-[#e8f0ee]">
          {([
            { id: 'clients' as TopTab, label: 'Clients',  count: conversations.length },
            { id: 'team'    as TopTab, label: 'Team',     count: teamMembers.length, urgent: true },
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

        {/* CLIENTS list */}
        {topTab === 'clients' && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-3.5 pt-2 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#7a9e99] uppercase tracking-wider">All conversations</span>
              <span className="text-[10px] text-[#7a9e99]">{filteredConvs.length} active</span>
            </div>
            {filteredConvs.map(conv => {
              const name    = conv.member?.full_name ?? 'Unknown';
              const staff   = conv.assigned_staff?.full_name;
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
                    {staff && (
                      <div className="text-[10px] text-[#0d9b8a] font-semibold mt-0.5 truncate">
                        {staff} · <span className="capitalize">{conv.category ?? ''}</span>
                      </div>
                    )}
                    <div className="text-[11px] text-[#7a9e99] truncate mt-0.5">{preview}</div>
                  </div>
                  <div className="text-[10px] text-[#7a9e99] flex-shrink-0 mt-0.5">
                    {conv.last_message?.[0] ? timeLabel(conv.last_message[0].created_at) : ''}
                  </div>
                </div>
              );
            })}
            {filteredConvs.length === 0 && (
              <div className="py-10 text-center text-[13px] text-[#7a9e99]">No conversations found.</div>
            )}
          </div>
        )}

        {/* TEAM list */}
        {topTab === 'team' && (
          <div className="flex-1 overflow-y-auto">
            {/* Channels */}
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
                <div className="text-[11px] text-[#7a9e99] truncate">Team announcements &amp; updates</div>
              </div>
            </div>

            {/* DMs */}
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
                  <Avatar name={member.full_name} size={34} />
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
                  <div className="text-[11px] text-[#7a9e99] mt-0.5">
                    {[selectedConv.assigned_staff?.full_name, selectedConv.category, selectedConv.borough, selectedConv.status]
                      .filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              <button className="px-3 py-1.5 border border-[#e8f0ee] rounded-lg bg-white text-[11px] font-semibold text-[#7a9e99] hover:text-[#0f1f2e] transition-colors">
                View request
              </button>
            </>
          ) : topTab === 'team' ? (
            <>
              <div className="flex items-center gap-3">
                {selectedChannel === 'all_staff' ? (
                  <div className="w-[38px] h-[38px] rounded-full bg-[#0b1d2a] flex items-center justify-center text-[16px] font-bold flex-shrink-0" style={{ color: '#2dd4bf' }}>#</div>
                ) : (
                  <Avatar name={dmPartner?.full_name ?? '?'} size={38} />
                )}
                <div>
                  <div className="text-[14px] font-bold text-[#0f1f2e]">
                    {selectedChannel === 'all_staff' ? '# All Staff' : dmPartner?.full_name}
                  </div>
                  <div className="text-[11px] text-[#7a9e99] mt-0.5">
                    {selectedChannel === 'all_staff' ? `${teamMembers.length} members` : dmPartner?.role}
                  </div>
                </div>
              </div>
              {selectedChannel === 'all_staff' && (
                <button
                  onClick={() => setShowAnnounceModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#0d9b8a] text-[11px] font-semibold text-white hover:bg-[#0b8a7a] transition-colors border-none cursor-pointer"
                >
                  + New announcement
                </button>
              )}
            </>
          ) : (
            <div className="text-[14px] font-bold text-[#0f1f2e]">Select a conversation</div>
          )}
        </div>

        {/* Messages body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">

          {/* Client conversations — oversight mode */}
          {topTab === 'clients' && selectedConvId && (
            <>
              <OversightBanner />
              {messages.map(msg => {
                const isStaff = msg.sender_id !== selectedConv?.member?.id;
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isStaff ? 'justify-end' : 'justify-start'}`}>
                    {!isStaff && (
                      <Avatar name={selectedConv?.member?.full_name ?? '?'} size={28} />
                    )}
                    <div>
                      <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed max-w-[65%] ${
                        isStaff
                          ? 'bg-[#1d4ed8] text-white rounded-br-[4px]'
                          : 'bg-white text-[#0f1f2e] border border-[#e8f0ee] rounded-bl-[4px]'
                      }`}>
                        {msg.content}
                      </div>
                      <div className={`text-[10px] text-[#7a9e99] mt-1.5 ${isStaff ? 'text-right' : 'text-left'}`}>
                        {msg.sender?.full_name ?? 'Unknown'} · {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <div className="text-center text-[13px] text-[#7a9e99] py-10">No messages yet.</div>
              )}
            </>
          )}

          {/* Team messages */}
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
                    <div className="text-[12px] text-[#0f1f2e]">{pinnedMessage}</div>
                  </div>
                </div>
              )}

              {channelMessages.map(msg => {
                const isMe = msg.sender_id === userId;
                const senderName = msg.sender?.full_name ?? 'Unknown';
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && (
                      <Avatar name={senderName} size={28} />
                    )}
                    <div>
                      <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed max-w-[70%] ${
                        isMe
                          ? 'bg-[#0d9b8a] text-white rounded-br-[4px]'
                          : 'bg-white text-[#0f1f2e] border border-[#e8f0ee] rounded-bl-[4px]'
                      }`}>
                        {msg.content}
                      </div>
                      <div className={`text-[10px] text-[#7a9e99] mt-1.5 ${isMe ? 'text-right' : 'text-left'}`}>
                        {isMe ? 'You' : senderName} · {timeLabel(msg.created_at)}
                      </div>
                    </div>
                  </div>
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

        {/* Input — read-only for client oversight, active for team */}
        <div className="px-4 py-3 bg-white border-t border-[#e8f0ee] flex items-center gap-2.5 flex-shrink-0">
          {topTab === 'clients' ? (
            <div className="flex-1 px-4 py-2.5 bg-[#f3f4f6] rounded-xl text-[12px] text-[#7a9e99] border border-[#e8f0ee]">
              Read-only — conversations are managed by the assigned caseworker
            </div>
          ) : (
            <>
              <input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void sendTeamMessage(); }}
                placeholder={selectedChannel === 'all_staff' ? 'Reply to All Staff...' : `Message ${dmPartner?.full_name ?? 'staff'}...`}
                className="flex-1 px-4 py-2.5 border border-[#e8f0ee] rounded-xl text-[13px] outline-none focus:border-[#0d9b8a] bg-[#f6faf8] focus:bg-white transition-all text-[#0f1f2e] placeholder-[#7a9e99]"
              />
              <button
                onClick={() => void sendTeamMessage()}
                disabled={!newMessage.trim()}
                className="w-9 h-9 rounded-xl bg-[#0d9b8a] flex items-center justify-center hover:bg-[#0b8a7a] transition-colors disabled:opacity-40 flex-shrink-0"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Announcement modal ── */}
      {showAnnounceModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[460px] shadow-2xl">
            <div className="text-[15px] font-bold text-[#0f1f2e] mb-1">New announcement</div>
            <div className="text-[12px] text-[#7a9e99] mb-4">Posted to All Staff · visible to your whole team</div>
            <textarea
              value={announceText}
              onChange={e => setAnnounceText(e.target.value)}
              placeholder="Write your announcement..."
              className="w-full h-24 border border-[#e8f0ee] rounded-xl px-3 py-2.5 text-[13px] font-[inherit] text-[#0f1f2e] resize-none outline-none focus:border-[#0d9b8a] transition-colors"
            />
            <label className="flex items-center gap-2 text-[12px] text-[#7a9e99] cursor-pointer mt-3">
              <input type="checkbox" checked={pinAnnouncement} onChange={e => setPinAnnouncement(e.target.checked)} className="accent-[#0d9b8a]" />
              Pin to top of channel
            </label>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setShowAnnounceModal(false)}
                className="px-4 py-2 border border-[#e8f0ee] rounded-lg text-[12px] font-semibold text-[#7a9e99] hover:text-[#0f1f2e] transition-colors bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => void postAnnouncement()}
                disabled={!announceText.trim()}
                className="px-4 py-2 bg-[#0d9b8a] text-white rounded-lg text-[12px] font-semibold hover:bg-[#0b8a7a] transition-colors disabled:opacity-40 cursor-pointer border-none"
              >
                Post announcement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

