import { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Search, Eye, ChevronLeft, X, Pin } from 'lucide-react';
import { getInternalConversations, getOrCreateDirectConversation, messagesApi } from '../../api/messages';
import { requestsApi } from '../../api/requests';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { MessageBubble } from '../shared/MessageBubble';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';

// ─── Types ────────────────────────────────────────────────────────────────────

type TopTab = 'clients' | 'team';
type TeamChannel = 'all_staff' | string;

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
    <div className="flex items-start gap-2 bg-[#f0faf8] border border-[#c2e8e0] rounded-xl px-3 py-2 flex-shrink-0">
      <Eye className="w-3 h-3 text-[#0d9b8a] flex-shrink-0 mt-0.5" />
      <span className="text-[11px] text-[#4b6b65] leading-relaxed">
        You're viewing this conversation as an admin. Messages are sent by the assigned caseworker.
      </span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonSidebar() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3.5 pt-2 pb-1">
        <div className="w-24 h-3 bg-gray-100 rounded animate-pulse" />
      </div>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-start gap-2.5 px-3.5 py-3 border-b border-[#f3f4f6] animate-pulse">
          <div className="w-[34px] h-[34px] rounded-full bg-gray-100 flex-shrink-0" />
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="w-1/2 h-3.5 bg-gray-100 rounded mb-1.5" />
            <div className="w-3/4 h-3 bg-gray-50 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CBOMessagesView({ defaultTopTab = 'clients' }: { defaultTopTab?: TopTab } = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const requestId = new URLSearchParams(location.search).get('requestId');
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Container-based responsive breakpoints
  const [containerWidth, setContainerWidth] = useState(0);
  const isMobile = containerWidth > 0 && containerWidth <= 640;
  const isNarrow = containerWidth > 0 && containerWidth <= 900;

  // Dynamic sidebar width based on container
  const sidebarWidth = isNarrow ? 240 : 280;

  // ── Mobile state ──
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // ── Client conversations state ──
  const [topTab, setTopTab] = useState<TopTab>(defaultTopTab);
  const [conversations, setConversations] = useState<OrgConversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // ── Team state ──
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<TeamChannel>('all_staff');
  const [teamConvId, setTeamConvId] = useState<string | null>(null);
  const [teamConvSubject, setTeamConvSubject] = useState<string | null>(null);
  const [teamMessages, setTeamMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [announceText, setAnnounceText] = useState('');
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [pinAnnouncement, setPinAnnouncement] = useState(true);

  // ── Org context ──
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const userKey = user?.id ?? "";

  // ── Container ResizeObserver ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const bootstrapQuery = useQuery({
    queryKey: queryKeys.cboMessagesBootstrap(userKey, topTab, requestId ?? undefined),
    enabled: !!userKey,
    queryFn: async () => {
      const ctx = await requestsApi.getMyOrgMembership();
      const members = await requestsApi.getOrgTeamMembers();
      let normalized: OrgConversation[] = [];
      if (topTab === 'clients') {
        const convs = await messagesApi.getMyOrgConversations();
        normalized = (convs ?? []).map((conv: any) => ({
          ...conv,
          category: conv?.category ?? null,
          borough: conv?.borough ?? null,
          status: conv?.status ?? null,
          assigned_staff: conv?.assigned_staff ?? null,
        }));
      }
      return {
        orgId: ctx.orgId,
        userId: ctx.userId ?? null,
        members: members.map((m: any) => ({
          profile_id: m.profile_id,
          full_name: m.full_name ?? 'Staff member',
          role: m.role === 'owner' ? 'Admin' : 'Caseworker',
          isActive: true,
        })) as TeamMember[],
        conversations: normalized,
      };
    },
  });

  useEffect(() => {
    if (!bootstrapQuery.data) return;
    setOrgId(bootstrapQuery.data.orgId);
    setUserId(bootstrapQuery.data.userId);
    setTeamMembers(bootstrapQuery.data.members);
    if (topTab === 'clients') {
      setConversations(bootstrapQuery.data.conversations);
      if (bootstrapQuery.data.conversations.length > 0) {
        const match = requestId
          ? bootstrapQuery.data.conversations.find(c => c.request_id === requestId)
          : null;
        setSelectedConvId(match?.id ?? bootstrapQuery.data.conversations[0].id);
      }
    }
  }, [bootstrapQuery.data, requestId, topTab]);

  // ── Load messages for selected client conversation ──
  useEffect(() => {
    if (!selectedConvId || topTab !== 'clients') return;
    const convId = selectedConvId;
    async function load() {
      try {
        const data = await messagesApi.getMessages(convId, { limit: 50 });
        setMessages(data);
      } catch (err) {
        console.error('[CBOMessagesView] Failed to load messages:', err);
      }
    }
    void load();

    const sub = messagesApi.subscribeToMessages(convId, (msg: any) => {
      setMessages(prev => {
        const cast = msg as Message;
        if (prev.some(m => m.id === cast.id)) return prev;
        const last = prev[prev.length - 1];
        if (!last) return [cast];
        if (+new Date(cast.created_at) >= +new Date(last.created_at)) return [...prev, cast];
        const next = [...prev, cast];
        next.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        return next;
      });
    });
    return () => { void supabase.removeChannel(sub); };
  }, [selectedConvId, topTab]);

  useEffect(() => {
    if (topTab !== 'clients' || !selectedConvId) return;
    const selected = conversations.find((c) => c.id === selectedConvId);
    if (!selected?.request_id) return;
    if (selected.category && selected.status && selected.borough) return;

    let active = true;
    void messagesApi
      .getConversationRequestDetails(selected.request_id)
      .then((details: any) => {
        if (!active || !details) return;
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConvId
              ? {
                  ...conv,
                  category: details.category ?? conv.category,
                  borough: details.borough ?? conv.borough,
                  status: details.status ?? conv.status,
                  assigned_staff: details.assigned_staff ?? conv.assigned_staff,
                }
              : conv,
          ),
        );
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [topTab, selectedConvId, conversations]);

  // ── Team conversation resolution ──
  useEffect(() => {
    if (!orgId || topTab !== 'team') return;
    let cancelled = false;

    async function ensureAllStaffConversation(): Promise<{ id: string; subject: string | null }> {
      const convs = await getInternalConversations();
      const group = (convs as any[]).find(c => c.conversation_type === 'group');
      if (group?.id) return { id: group.id as string, subject: (group.title ?? null) as string | null };

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
          ids.map(pid => ({ conversation_id: conv.id, profile_id: pid }))
        );
        if (partErr) throw partErr;
      }

      return { id: conv.id as string, subject: null };
    }

    async function resolveTeamConversation() {
      try {
        if (selectedChannel === 'all_staff') {
          const g = await ensureAllStaffConversation();
          if (!cancelled) { setTeamConvId(g.id); setTeamConvSubject(g.subject); }
          return;
        }
        const convId = await getOrCreateDirectConversation(orgId!, selectedChannel);
        if (!cancelled) { setTeamConvId(convId); setTeamConvSubject(null); }
      } catch (err) {
        console.error('[resolveTeamConversation]', err);
      }
    }

    void resolveTeamConversation();
    return () => { cancelled = true; };
  }, [orgId, topTab, selectedChannel]);

  // ── Load team messages ──
  const teamMessagesQuery = useQuery({
    queryKey: queryKeys.messages(teamConvId ?? ""),
    enabled: topTab === 'team' && !!teamConvId,
    queryFn: async () => (await messagesApi.getMessages(teamConvId!)) as unknown as Message[],
  });

  useEffect(() => {
    if (teamMessagesQuery.data) {
      setTeamMessages(teamMessagesQuery.data);
    }
  }, [teamMessagesQuery.data]);

  useEffect(() => {
    if (!teamConvId || topTab !== 'team') return;
    const sub = messagesApi.subscribeToMessages(teamConvId, (msg: any) => {
      queryClient.setQueryData(queryKeys.messages(teamConvId), (prev: Message[] | undefined) => {
        const next = prev ?? [];
        const cast = msg as Message;
        if (next.some((m) => m.id === cast.id)) return next;
        const merged = [...next, cast];
        merged.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        return merged;
      });
    });
    return () => {
      void supabase.removeChannel(sub);
    };
  }, [queryClient, teamConvId, topTab]);

  // ── Auto scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, teamMessages]);

  // ── Send team message ──
  async function sendTeamMessage() {
    if (!newMessage.trim() || !teamConvId) return;
    const content = newMessage.trim();
    setNewMessage('');
    await messagesApi.send(teamConvId, content);
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', teamConvId);
  }

  // ── Post announcement ──
  async function postAnnouncement() {
    if (!announceText.trim() || !orgId) return;
    const content = announceText.trim();
    setAnnounceText('');
    setShowAnnounceModal(false);
    setTopTab('team');
    setSelectedChannel('all_staff');

    const convs = await getInternalConversations();
    const group = (convs as any[]).find(c => c.conversation_type === 'group');
    const groupId = group?.id ? (group.id as string) : teamConvId;
    if (!groupId) return;

    await messagesApi.send(groupId, content);
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString(), ...(pinAnnouncement ? { title: content } : {}) })
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

  const selectedConv = conversations.find(c => c.id === selectedConvId);
  const pinnedMessage = selectedChannel === 'all_staff' ? teamConvSubject : null;
  const dmPartner = teamMembers.find(m => m.profile_id === selectedChannel);

  // ─── Loading state ─────────────────────────────────────────────────────────

  if ((bootstrapQuery.isLoading && !bootstrapQuery.data) || (topTab === 'team' && !orgId && !!user)) {
    return (
      <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-white">
        {/* Sidebar skeleton */}
        <div
          className="flex-shrink-0 border-r border-[#e8f0ee] flex flex-col"
          style={{ width: isMobile ? '100%' : sidebarWidth }}
        >
          <div className="flex border-b border-[#e8f0ee] animate-pulse">
            <div className="flex-1 py-4 m-1 bg-gray-100 rounded" />
            <div className="flex-1 py-4 m-1 bg-gray-50 rounded" />
          </div>
          <div className="px-3 py-2.5 border-b border-[#e8f0ee] animate-pulse">
            <div className="w-full h-9 bg-gray-50 rounded-lg" />
          </div>
          <SkeletonSidebar />
        </div>

        {/* Chat skeleton — hidden on mobile */}
        {!isMobile && (
          <div className="flex-1 flex flex-col min-w-0 bg-[#f6faf8] animate-pulse">
            <div className="px-4 py-3 border-b border-[#e8f0ee] bg-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100" />
              <div>
                <div className="w-32 h-4 bg-gray-100 rounded mb-1.5" />
                <div className="w-20 h-3 bg-gray-50 rounded" />
              </div>
            </div>
            <div className="flex-1 p-6 flex flex-col gap-4">
              <div className="w-2/3 h-16 bg-white rounded-2xl rounded-tl-sm self-start shadow-sm" />
              <div className="w-1/2 h-12 bg-[#0d9b8a]/15 rounded-2xl rounded-tr-sm self-end" />
              <div className="w-3/4 h-20 bg-white rounded-2xl rounded-tl-sm self-start shadow-sm" />
            </div>
            <div className="p-4 bg-white border-t border-[#e8f0ee]">
              <div className="w-full h-11 bg-gray-50 rounded-xl" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Sidebar content ────────────────────────────────────────────────────────

  const sidebarContent = (
    <div
      className="flex-shrink-0 border-r border-[#e8f0ee] flex flex-col bg-white"
      style={{ width: isMobile ? '100%' : sidebarWidth }}
    >
      {/* Tabs */}
      <div className="flex border-b border-[#e8f0ee]">
        {([
          { id: 'clients' as TopTab, label: 'Clients', count: conversations.length },
          { id: 'team' as TopTab, label: 'Team', count: teamMembers.length, accent: true },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => { setTopTab(tab.id); setMobileView('list'); }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${topTab === tab.id
              ? 'text-[#0d9b8a] border-[#0d9b8a]'
              : 'text-[#7a9e99] border-transparent hover:text-[#0f1f2e]'
              }`}
          >
            {tab.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab.accent
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
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7a9e99]" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-3 py-2 text-[12px] bg-[#f6faf8] border border-[#e8f0ee] rounded-lg outline-none focus:border-[#0d9b8a] focus:bg-white transition-all placeholder-[#7a9e99] text-[#0f1f2e]"
          />
        </div>
      </div>

      {/* Client list */}
      {topTab === 'clients' && (
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-3.5 pt-2.5 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#7a9e99] uppercase tracking-wider">All conversations</span>
            <span className="text-[10px] text-[#7a9e99]">{filteredConvs.length} active</span>
          </div>
          {filteredConvs.map(conv => {
            const name = conv.member?.full_name ?? 'Unknown';
            const staff = conv.assigned_staff?.full_name;
            const preview = conv.last_message?.[0]?.content ?? 'No messages yet';
            const isActive = conv.id === selectedConvId;
            return (
              <div
                key={conv.id}
                onClick={() => {
                  setSelectedConvId(conv.id);
                  if (isMobile) setMobileView('chat');
                }}
                className={`flex items-start gap-2.5 px-3.5 py-3 cursor-pointer border-b border-[#f3f4f6] border-l-2 transition-all ${isActive
                  ? 'bg-[#f0faf8] border-l-[#0d9b8a]'
                  : 'border-l-transparent hover:bg-[#f6faf8] active:bg-[#f0faf8]'
                  }`}
              >
                <Avatar name={name} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#0f1f2e] truncate">{name}</div>
                  {staff && (
                    <div className="text-[10px] text-[#0d9b8a] font-semibold mt-0.5 truncate">
                      {staff}{conv.category ? ` · ${conv.category}` : ''}
                    </div>
                  )}
                  <div className="text-[11px] text-[#7a9e99] truncate mt-0.5">{preview}</div>
                </div>
                {conv.last_message?.[0] && (
                  <span className="text-[10px] text-[#7a9e99] flex-shrink-0 mt-0.5 ml-1">
                    {timeLabel(conv.last_message[0].created_at)}
                  </span>
                )}
              </div>
            );
          })}
          {filteredConvs.length === 0 && (
            <div className="py-10 text-center text-[13px] text-[#7a9e99]">No conversations found.</div>
          )}
        </div>
      )}

      {/* Team list */}
      {topTab === 'team' && (
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-3.5 pt-2.5 pb-1 text-[10px] font-bold text-[#7a9e99] uppercase tracking-wider">Channels</div>
          <div
            onClick={() => {
              setSelectedChannel('all_staff');
              if (isMobile) setMobileView('chat');
            }}
            className={`flex items-center gap-2.5 px-3.5 py-3 cursor-pointer border-b border-[#f3f4f6] border-l-2 transition-all ${selectedChannel === 'all_staff'
              ? 'bg-[#f0faf8] border-l-[#0d9b8a]'
              : 'border-l-transparent hover:bg-[#f6faf8] active:bg-[#f0faf8]'
              }`}
          >
            <div className="w-[34px] h-[34px] rounded-full bg-[#0b1d2a] flex items-center justify-center text-[14px] font-bold flex-shrink-0" style={{ color: '#2dd4bf' }}>#</div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#0f1f2e]">All Staff</div>
              <div className="text-[11px] text-[#7a9e99] truncate">Team announcements &amp; updates</div>
            </div>
          </div>

          <div className="px-3.5 pt-3 pb-1 text-[10px] font-bold text-[#7a9e99] uppercase tracking-wider">Direct messages</div>
          {teamMembers.map(member => (
            <div
              key={member.profile_id}
              onClick={() => {
                setSelectedChannel(member.profile_id);
                if (isMobile) setMobileView('chat');
              }}
              className={`flex items-center gap-2.5 px-3.5 py-3 cursor-pointer border-b border-[#f3f4f6] border-l-2 transition-all ${selectedChannel === member.profile_id
                ? 'bg-[#f0faf8] border-l-[#0d9b8a]'
                : 'border-l-transparent hover:bg-[#f6faf8] active:bg-[#f0faf8]'
                }`}
            >
              <div className="relative flex-shrink-0">
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
  );

  // ─── Chat area ─────────────────────────────────────────────────────────────

  const chatArea = (
    <div className="flex-1 flex flex-col min-w-0 bg-[#f6faf8]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#e8f0ee] flex-shrink-0 min-h-[60px]">
        {topTab === 'clients' && selectedConv ? (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              {isMobile && (
                <button
                  onClick={() => setMobileView('list')}
                  className="p-1 -ml-1 text-[#7a9e99] hover:bg-[#f6faf8] rounded-lg border-none bg-transparent cursor-pointer flex-shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <Avatar name={selectedConv.member?.full_name ?? '?'} size={36} />
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-[#0f1f2e] truncate">{selectedConv.member?.full_name}</div>
                <div className="text-[11px] text-[#7a9e99] truncate">
                  {[selectedConv.assigned_staff?.full_name, selectedConv.category, selectedConv.borough, selectedConv.status]
                    .filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
            <button className="ml-2 px-3 py-1.5 border border-[#e8f0ee] rounded-lg bg-white text-[11px] font-semibold text-[#7a9e99] hover:text-[#0f1f2e] transition-colors flex-shrink-0 whitespace-nowrap cursor-pointer">
              View request
            </button>
          </>
        ) : topTab === 'team' ? (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              {isMobile && (
                <button
                  onClick={() => setMobileView('list')}
                  className="p-1 -ml-1 text-[#7a9e99] hover:bg-[#f6faf8] rounded-lg border-none bg-transparent cursor-pointer flex-shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {selectedChannel === 'all_staff' ? (
                <div className="w-9 h-9 rounded-full bg-[#0b1d2a] flex items-center justify-center text-[15px] font-bold flex-shrink-0" style={{ color: '#2dd4bf' }}>#</div>
              ) : (
                <Avatar name={dmPartner?.full_name ?? '?'} size={36} />
              )}
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-[#0f1f2e] truncate">
                  {selectedChannel === 'all_staff' ? '# All Staff' : dmPartner?.full_name}
                </div>
                <div className="text-[11px] text-[#7a9e99]">
                  {selectedChannel === 'all_staff' ? `${teamMembers.length} members` : dmPartner?.role}
                </div>
              </div>
            </div>
            {selectedChannel === 'all_staff' && (
              <button
                onClick={() => setShowAnnounceModal(true)}
                className={`ml-2 flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-[#0d9b8a] text-white hover:bg-[#0b8a7a] transition-colors border-none cursor-pointer font-semibold ${isMobile ? 'w-8 h-8 justify-center' : 'px-3 py-1.5 text-[11px]'
                  }`}
                title="New announcement"
              >
                {isMobile ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    <span className="whitespace-nowrap">New announcement</span>
                  </>
                )}
              </button>
            )}
          </>
        ) : (
          <div className="text-[14px] font-bold text-[#0f1f2e]">Select a conversation</div>
        )}
      </div>

      {/* Messages body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 flex flex-col gap-3">
        {topTab === 'clients' && selectedConvId && (
          <>
            <OversightBanner />
            {messages.map(msg => {
              const isMe = msg.sender_id === userId;
              const senderName = msg.sender?.full_name ?? 'Unknown';
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
              <div className="text-center text-[13px] text-[#7a9e99] py-10">No messages yet.</div>
            )}
          </>
        )}

        {topTab === 'team' && (
          <>
            {selectedChannel === 'all_staff' && pinnedMessage && (
              <div className="flex items-start gap-2.5 bg-[#f0faf8] border border-[#c2e8e0] rounded-xl px-3 py-2.5 flex-shrink-0">
                <Pin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#0d9b8a]" />
                <div>
                  <div className="text-[10px] font-bold text-[#0d9b8a] uppercase tracking-wide mb-0.5">Pinned</div>
                  <div className="text-[12px] text-[#0f1f2e] leading-relaxed">{pinnedMessage}</div>
                </div>
              </div>
            )}
            {teamMessages.map(msg => {
              const isMe = msg.sender_id === userId;
              const senderName = msg.sender?.full_name ?? 'Unknown';
              return (
                <MessageBubble
                  key={msg.id}
                  content={msg.content}
                  isOwn={isMe}
                  senderName={senderName}
                  timestamp={timeLabel(msg.created_at)}
                  avatarUrl={msg.sender?.avatar_url}
                  avatarFallback={initials(senderName)}
                />
              );
            })}
            {teamMessages.length === 0 && (
              <div className="text-center text-[13px] text-[#7a9e99] py-10">
                {selectedChannel === 'all_staff' ? 'No announcements yet.' : 'Start a conversation.'}
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="px-3 py-3 bg-white border-t border-[#e8f0ee] flex items-center gap-2 flex-shrink-0">
        {topTab === 'clients' ? (
          <div className="flex-1 px-4 py-2.5 bg-[#f3f4f6] rounded-xl text-[12px] text-[#7a9e99] border border-[#e8f0ee] select-none">
            Read-only — conversations are managed by the assigned caseworker
          </div>
        ) : (
          <>
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) void sendTeamMessage(); }}
              placeholder={selectedChannel === 'all_staff' ? 'Reply to All Staff...' : `Message ${dmPartner?.full_name ?? 'staff'}...`}
              className="flex-1 min-w-0 px-3.5 py-2.5 border border-[#e8f0ee] rounded-xl text-[13px] outline-none focus:border-[#0d9b8a] bg-[#f6faf8] focus:bg-white transition-all text-[#0f1f2e] placeholder-[#7a9e99]"
            />
            <button
              onClick={() => void sendTeamMessage()}
              disabled={!newMessage.trim()}
              className="w-9 h-9 rounded-xl bg-[#0d9b8a] flex items-center justify-center hover:bg-[#0b8a7a] transition-colors disabled:opacity-40 flex-shrink-0 border-none cursor-pointer"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-white">

      {/* Mobile: show sidebar or chat exclusively */}
      {isMobile ? (
        <>
          {mobileView === 'list' && sidebarContent}
          {mobileView === 'chat' && chatArea}
        </>
      ) : (
        /* Desktop/tablet: side-by-side */
        <>
          {sidebarContent}
          {chatArea}
        </>
      )}

      {/* ── Announcement modal ── */}
      {showAnnounceModal && (
        <div
          className="fixed inset-0 bg-black/25 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowAnnounceModal(false); }}
        >
          <div className="bg-white w-full sm:max-w-[460px] sm:rounded-2xl rounded-t-2xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="text-[15px] font-bold text-[#0f1f2e]">New announcement</div>
                <div className="text-[12px] text-[#7a9e99] mt-0.5">Posted to All Staff · visible to your whole team</div>
              </div>
              <button
                onClick={() => setShowAnnounceModal(false)}
                className="p-1 rounded-lg hover:bg-[#f6faf8] transition-colors border-none bg-transparent cursor-pointer text-[#7a9e99] flex-shrink-0 ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={announceText}
              onChange={e => setAnnounceText(e.target.value)}
              placeholder="Write your announcement..."
              className="w-full h-28 border border-[#e8f0ee] rounded-xl px-3 py-2.5 mt-4 text-[13px] font-[inherit] text-[#0f1f2e] resize-none outline-none focus:border-[#0d9b8a] transition-colors bg-[#f6faf8] focus:bg-white placeholder-[#7a9e99]"
              autoFocus
            />
            <label className="flex items-center gap-2 text-[12px] text-[#4b6b65] cursor-pointer mt-3 select-none">
              <input
                type="checkbox"
                checked={pinAnnouncement}
                onChange={e => setPinAnnouncement(e.target.checked)}
                className="accent-[#0d9b8a] w-3.5 h-3.5"
              />
              Pin to top of channel
            </label>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setShowAnnounceModal(false)}
                className="flex-1 sm:flex-initial px-4 py-2 border border-[#e8f0ee] rounded-lg text-[12px] font-semibold text-[#7a9e99] hover:text-[#0f1f2e] transition-colors bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => void postAnnouncement()}
                disabled={!announceText.trim()}
                className="flex-1 sm:flex-initial px-4 py-2 bg-[#0d9b8a] text-white rounded-lg text-[12px] font-semibold hover:bg-[#0b8a7a] transition-colors disabled:opacity-40 cursor-pointer border-none"
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