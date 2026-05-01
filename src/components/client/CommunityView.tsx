import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { forumApi } from "../../api/forum";
import "./CommunityView.css";

/* ─── Types ─────────────────────────────────────────────────────────────── */
type TabId = "ann" | "forum";

type AnnCategory = "Event" | "Update" | "Resource" | "Announcement";

interface OrgAnnouncement {
  id: string;
  title: string;
  body: string;
  category: AnnCategory;
  borough: string | null;
  event_date: string | null;
  image_url: string | null;
  is_pinned: boolean;
  created_at: string;
  org_id: string | null;
  org?: { name: string } | null;
  reactions?: { id: string; user_id: string; type: "like" | "save" }[];
}

interface ForumThread {
  id: string;
  title: string;
  body: string;
  category: string;
  borough: string | null;
  created_at: string;
  author?: { full_name: string | null };
  comment_count?: number;
}

interface ForumComment {
  id: string;
  thread_id: string;
  content: string;
  created_at: string;
  author?: { full_name: string | null; id: string; avatar_url?: string | null };
}

const BOROUGHS = ["Bronx", "Manhattan", "Brooklyn", "Queens", "Staten Island"];

const ANN_CAT_TO_CLASS: Record<AnnCategory, string> = {
  Event: "cat-event",
  Update: "cat-update",
  Resource: "cat-resource",
  Announcement: "cat-announcement",
};

const AVATAR_COLORS = ["#0d9488", "#7c3aed", "#1d4ed8", "#15803d", "#db2777", "#d97706", "#0891b2"];

function initials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "NA";
  return cleaned
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarColor(seed: string): string {
  const s = seed || "x";
  return AVATAR_COLORS[s.charCodeAt(0) % AVATAR_COLORS.length];
}

function dateLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ─── SVG Icons ──────────────────────────────────────────────────────────── */
const IconSearch = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
);
const IconChevron = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
);
const IconPlus = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
);
const IconAnn = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
);
const IconForum = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
);
const IconPin = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z" /></svg>
);
const IconCheck = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
);
const IconClock = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
);
const IconCalendar = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
);
const IconHeart = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
);
const IconBookmark = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
);
const IconClose = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
);
const IconSend = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z" /></svg>
);
const IconUpload = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
);
const IconUser = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);
const IconLines = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
);
const IconBox = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg>
);
const IconInfo = ({ cls }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
);

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function AnnouncementCard({
  ann,
  userId,
  onToggleLike,
  onToggleSave,
}: {
  ann: OrgAnnouncement;
  userId: string | null;
  onToggleLike: (id: string) => void;
  onToggleSave: (id: string) => void;
}) {
  const orgName = ann.org?.name ?? (ann.org_id ? "Organization" : "HealthPowr");
  const orgInitials = initials(orgName);
  const orgColor = avatarColor(orgName);
  const orgBadge = ann.org_id ? "CBO" : "Platform";
  const catClass = ANN_CAT_TO_CLASS[ann.category] ?? "cat-announcement";
  const liked = ann.reactions?.some((r) => r.user_id === userId && r.type === "like") ?? false;
  const saved = ann.reactions?.some((r) => r.user_id === userId && r.type === "save") ?? false;
  const likeCount = ann.reactions?.filter((r) => r.type === "like").length ?? 0;
  const footerIcon: "clock" | "calendar" = ann.event_date ? "calendar" : "clock";
  const footerText = ann.event_date
    ? new Date(ann.event_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : ann.borough ?? "All boroughs";

  return (
    <div className="ann-card">
      {ann.is_pinned && (
        <div className="pin-row">
          <IconPin cls="pin-icon" />
          Pinned
        </div>
      )}
      <div className="ann-header">
        <div className="ann-org-row">
          <div className="ann-avatar" style={{ background: orgColor }}>{orgInitials}</div>
          <div>
            <div className="ann-org-name">
              {orgName}
              <span className="ann-verified">
                <IconCheck cls="check-icon" />
                {orgBadge}
              </span>
            </div>
          </div>
        </div>
        <div className="ann-meta-right">
          <span className={`cat-pill ${catClass}`}>{ann.category}</span>
          <div className="ann-date">{dateLabel(ann.created_at)}</div>
        </div>
      </div>
      <div className="ann-title">{ann.title}</div>
      <div className="ann-body">{ann.body}</div>
      {ann.image_url && <img className="ann-image" src={ann.image_url} alt={ann.title} />}
      <div className="ann-footer">
        <div className="ann-event-info">
          {footerIcon === "clock"
            ? <IconClock cls="event-icon" />
            : <IconCalendar cls="event-icon" />}
          {footerText}
        </div>
        <div className="ann-reactions">
          <button className={`react-btn${liked ? " liked" : ""}`} onClick={() => onToggleLike(ann.id)}>
            <IconHeart cls="react-btn-icon" />
            <span>{likeCount}</span>
          </button>
          <button className={`react-btn${saved ? " saved" : ""}`} onClick={() => onToggleSave(ann.id)}>
            <IconBookmark cls="react-btn-icon" />
            <span>{saved ? "Saved" : "Save"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function AnnSidebar({
  announcements,
  activeCatValue,
  setActiveCatValue,
  topOrgs,
  savedPosts,
}: {
  announcements: OrgAnnouncement[];
  activeCatValue: "" | AnnCategory;
  setActiveCatValue: (v: "" | AnnCategory) => void;
  topOrgs: { name: string; count: number }[];
  savedPosts: OrgAnnouncement[];
}) {
  const catCounts = useMemo(() => {
    const counts: Record<AnnCategory, number> = { Event: 0, Update: 0, Resource: 0, Announcement: 0 };
    announcements.forEach((a) => { counts[a.category] = (counts[a.category] ?? 0) + 1; });
    return counts;
  }, [announcements]);

  const cats: { label: string; value: "" | AnnCategory; count: number; icon: JSX.Element }[] = [
    { label: "All", value: "", count: announcements.length, icon: <IconLines cls="cat-btn-icon" /> },
    { label: "Events", value: "Event", count: catCounts.Event, icon: <IconCalendar cls="cat-btn-icon" /> },
    { label: "Updates", value: "Update", count: catCounts.Update, icon: <IconInfo cls="cat-btn-icon" /> },
    { label: "Resources", value: "Resource", count: catCounts.Resource, icon: <IconBox cls="cat-btn-icon" /> },
    { label: "Announcements", value: "Announcement", count: catCounts.Announcement, icon: <IconAnn cls="cat-btn-icon" /> },
  ];
  return (
    <div>
      <div className="widget">
        <div className="widget-title">Browse by category</div>
        {cats.map((c) => (
          <button key={c.label} className={`cat-btn${activeCatValue === c.value ? " active" : ""}`} onClick={() => setActiveCatValue(c.value)}>
            <div className="cat-btn-inner">{c.icon}{c.label}</div>
            <span className="cat-count">{c.count}</span>
          </button>
        ))}
      </div>
      <div className="widget">
        <div className="widget-title">Organizations posting</div>
        {topOrgs.length === 0 ? (
          <div className="org-sub">No organization posts yet.</div>
        ) : (
          topOrgs.map((o) => (
            <div className="org-row" key={o.name}>
              <div className="ann-avatar" style={{ width: 28, height: 28, fontSize: 10, borderRadius: 7, background: avatarColor(o.name) }}>
                {initials(o.name)}
              </div>
              <div>
                <div className="org-name">{o.name}</div>
                <div className="org-sub">{o.count} post{o.count === 1 ? "" : "s"}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="widget">
        <div className="widget-title">Saved posts</div>
        {savedPosts.length === 0 ? (
          <div className="saved-sub">No saved posts yet.</div>
        ) : (
          savedPosts.slice(0, 5).map((p) => (
            <div className="saved-item" key={p.id}>
              <div className="saved-title">{p.title}</div>
              <div className="saved-sub">{p.org?.name ?? (p.org_id ? "Organization" : "HealthPowr")} · {dateLabel(p.created_at)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ForumPanel({
  threads,
  selectedThread,
  setSelectedThread,
  panelVisible,
  setPanelVisible,
  comments,
  loadingComments,
  onPostComment,
}: {
  threads: ForumThread[];
  selectedThread: ForumThread | null;
  setSelectedThread: (t: ForumThread | null) => void;
  panelVisible: boolean;
  setPanelVisible: (v: boolean) => void;
  comments: ForumComment[];
  loadingComments: boolean;
  onPostComment: (text: string) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const commentBodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setTimeout(() => {
      if (commentBodyRef.current) commentBodyRef.current.scrollTop = commentBodyRef.current.scrollHeight;
    }, 50);
  }, [selectedThread?.id]);

  useEffect(() => {
    setTimeout(() => {
      if (commentBodyRef.current) commentBodyRef.current.scrollTop = commentBodyRef.current.scrollHeight;
    }, 50);
  }, [comments.length]);

  const postComment = () => {
    const text = inputValue.trim();
    if (!text || !selectedThread) return;
    onPostComment(text);
    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); }
  };

  return (
    <div className="forum-layout">
      <div id="thread-list">
        {threads.map((t) => (
          <div
            key={t.id}
            className={`forum-card${selectedThread?.id === t.id && panelVisible ? " selected" : ""}`}
            onClick={() => { setSelectedThread(t); setPanelVisible(true); }}
          >
            <span className="forum-pill">{t.category || "Other"}</span>
            <div className="forum-title">{t.title}</div>
            <div className="forum-body">{t.body}</div>
            <div className="forum-footer">
              <span className="forum-footer-item"><IconForum cls="footer-icon" />{t.comment_count ?? 0} comments</span>
              <span className="forum-footer-item"><IconUser cls="footer-icon" />{t.author?.full_name ?? "Community member"}</span>
              <span className="forum-footer-item"><IconCalendar cls="footer-icon" />{dateLabel(t.created_at)}</span>
            </div>
          </div>
        ))}
        {threads.length === 0 && (
          <div className="no-comments">No discussions found.</div>
        )}
      </div>

      {panelVisible && selectedThread && (
        <div className="comment-panel">
          <div className="comment-panel-header">
            <div className="comment-panel-title">{selectedThread.title}</div>
            <button className="close-panel-btn" onClick={() => setPanelVisible(false)}>
              <IconClose cls="close-panel-icon" />
            </button>
          </div>
          <div className="comment-body" ref={commentBodyRef}>
            {loadingComments ? (
              <div className="no-comments">Loading…</div>
            ) : comments.length === 0 ? (
              <div className="no-comments">No comments yet. Be the first.</div>
            ) : (
              comments.map((c) => {
                const name = c.author?.full_name ?? "Community member";
                const ini = initials(name);
                const color = avatarColor(name);
                return (
                  <div className="comment-item" key={c.id}>
                    <div className="comment-avatar" style={{ background: color }}>{ini}</div>
                    <div className="comment-bubble">
                      <div className="comment-author">{name}</div>
                      <div className="comment-text">{c.content}</div>
                      <div className="comment-time">{dateLabel(c.created_at)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="comment-input-wrap">
            <textarea
              ref={textareaRef}
              className="comment-input"
              placeholder="Add a comment…"
              rows={1}
              value={inputValue}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
            />
            <button className="comment-send-btn" onClick={postComment} disabled={!inputValue.trim()}>
              <IconSend cls="send-icon" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page Component ────────────────────────────────────────────────── */
function CommunityPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("ann");
  const [modalOpen, setModalOpen] = useState(false);

  const [announcements, setAnnouncements] = useState<OrgAnnouncement[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [panelVisible, setPanelVisible] = useState(true);

  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [catFilterAnn, setCatFilterAnn] = useState<"" | AnnCategory>("");
  const [catFilterForum, setCatFilterForum] = useState("");
  const [boroughFilter, setBoroughFilter] = useState("");

  // Modal form state
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formAnnCategory, setFormAnnCategory] = useState<AnnCategory>("Announcement");
  const [formForumCategory, setFormForumCategory] = useState("Housing");
  const [formBorough, setFormBorough] = useState("");
  const [formEventDate, setFormEventDate] = useState("");
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Font is loaded globally via index.html
  }, []);

  const loadAnnouncements = async () => {
    setLoadingAnnouncements(true);
    try {
      const { data, error } = await supabase
        .from("org_announcements")
        .select(`
          *,
          org:organizations!org_id(name),
          reactions:announcement_reactions(id, user_id, type)
        `)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAnnouncements((data ?? []) as OrgAnnouncement[]);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const loadThreads = async () => {
    setLoadingThreads(true);
    try {
      const data = (await forumApi.getThreads()) as ForumThread[];
      setThreads(data);
      if (data.length > 0) setSelectedThread((prev) => prev ?? data[0]);
    } finally {
      setLoadingThreads(false);
    }
  };

  useEffect(() => {
    void loadAnnouncements();
    void loadThreads();
  }, []);

  useEffect(() => {
    if (!selectedThread) return;
    setLoadingComments(true);
    void forumApi.getComments(selectedThread.id).then((data: any) => {
      setComments(data as ForumComment[]);
      setLoadingComments(false);
    });
  }, [selectedThread?.id]);

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      const matchSearch = searchTerm
        ? (a.title + a.body + (a.org?.name ?? "")).toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchCat = catFilterAnn ? a.category === catFilterAnn : true;
      const matchBor = boroughFilter ? (a.borough === boroughFilter || !a.borough) : true;
      return matchSearch && matchCat && matchBor;
    });
  }, [announcements, searchTerm, catFilterAnn, boroughFilter]);

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      const matchSearch = searchTerm
        ? (t.title + t.body).toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchCat = catFilterForum ? (t.category ?? "").toLowerCase() === catFilterForum.toLowerCase() : true;
      const matchBor = boroughFilter ? t.borough === boroughFilter : true;
      return matchSearch && matchCat && matchBor;
    });
  }, [threads, searchTerm, catFilterForum, boroughFilter]);

  const savedPosts = useMemo(() => {
    if (!user) return [];
    return announcements.filter((a) => a.reactions?.some((r) => r.user_id === user.id && r.type === "save"));
  }, [announcements, user]);

  const topOrgs = useMemo(() => {
    const map = new Map<string, number>();
    announcements.forEach((a) => {
      const name = a.org?.name;
      if (!name) return;
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [announcements]);

  async function toggleReaction(annId: string, type: "like" | "save") {
    if (!user) return;
    const ann = announcements.find((a) => a.id === annId);
    if (!ann) return;
    const existing = ann.reactions?.find((r) => r.user_id === user.id && r.type === type);
    if (existing) {
      await supabase.from("announcement_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("announcement_reactions").insert({ announcement_id: annId, user_id: user.id, type });
    }
    const { data } = await supabase
      .from("announcement_reactions")
      .select("id, user_id, type")
      .eq("announcement_id", annId);
    setAnnouncements((prev) => prev.map((a) => (a.id === annId ? { ...a, reactions: (data ?? []) as any } : a)));
  }

  async function postComment(text: string) {
    if (!selectedThread || !user) return;
    await forumApi.addComment(selectedThread.id, text);
    const data = (await forumApi.getComments(selectedThread.id)) as ForumComment[];
    setComments(data);
  }

  function openModal() {
    setFormTitle("");
    setFormBody("");
    setFormAnnCategory("Announcement");
    setFormForumCategory("Housing");
    setFormBorough("");
    setFormEventDate("");
    setFormImageFile(null);
    setFormImagePreview(null);
    setModalOpen(true);
  }

  async function submitPost() {
    if (!formTitle.trim() || !formBody.trim() || !user) return;
    setSubmitting(true);
    try {
      if (activeTab === "ann") {
        let imageUrl: string | null = null;
        if (formImageFile) {
          const ext = formImageFile.name.split(".").pop();
          const path = `announcements/${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from("community").upload(path, formImageFile);
          if (!error) {
            const { data } = supabase.storage.from("community").getPublicUrl(path);
            imageUrl = data.publicUrl;
          }
        }
        const orgId = (await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("profile_id", user.id)
          .maybeSingle()).data?.organization_id ?? null;

        await supabase.from("org_announcements").insert({
          org_id: orgId,
          title: formTitle.trim(),
          body: formBody.trim(),
          category: formAnnCategory,
          borough: formBorough || null,
          event_date: formEventDate || null,
          image_url: imageUrl,
          is_pinned: false,
        });
        await loadAnnouncements();
        setModalOpen(false);
      } else {
        await forumApi.createThread({
          title: formTitle.trim(),
          body: formBody.trim(),
          category: formForumCategory,
          borough: formBorough || undefined,
        });
        await loadThreads();
        setModalOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <main className="main">
        <div className="page-header">
          <div>
            <div className="page-title">Community</div>
            <div className="page-sub">Announcements from organizations and peer discussions</div>
          </div>
          <button className="btn-primary" onClick={openModal}>
            <IconPlus cls="btn-icon" />
            <span>{activeTab === "ann" ? "New post" : "New thread"}</span>
          </button>
        </div>

        <div className="top-tabs">
          <button
            className={`top-tab${activeTab === "ann" ? " active" : ""}`}
            onClick={() => { setActiveTab("ann"); setSearchTerm(""); setCatFilterAnn(""); setCatFilterForum(""); setBoroughFilter(""); }}
          >
            <IconAnn cls="top-tab-icon" />
            Announcements
            <span className="tab-count">{announcements.length}</span>
          </button>
          <button
            className={`top-tab${activeTab === "forum" ? " active" : ""}`}
            onClick={() => { setActiveTab("forum"); setSearchTerm(""); setCatFilterAnn(""); setCatFilterForum(""); setBoroughFilter(""); }}
          >
            <IconForum cls="top-tab-icon" />
            Forum
            <span className="tab-count">{threads.length}</span>
          </button>
        </div>

        {activeTab === "ann" && (
          <div>
            <div className="filters">
              <div className="search-wrap">
                <IconSearch cls="search-icon" />
                <input
                  className="search-input"
                  placeholder="Search announcements…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="select-wrap">
                <select className="filter-select" value={catFilterAnn} onChange={(e) => setCatFilterAnn(e.target.value as any)}>
                  <option value="">All categories</option>
                  <option value="Event">Event</option>
                  <option value="Update">Update</option>
                  <option value="Resource">Resource</option>
                  <option value="Announcement">Announcement</option>
                </select>
                <IconChevron cls="select-arrow" />
              </div>
              <div className="select-wrap">
                <select className="filter-select" value={boroughFilter} onChange={(e) => setBoroughFilter(e.target.value)}>
                  <option value="">All boroughs</option>
                  {BOROUGHS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <IconChevron cls="select-arrow" />
              </div>
            </div>

            <div className="ann-grid">
              <div>
                {loadingAnnouncements ? (
                  <div className="no-comments">Loading announcements…</div>
                ) : filteredAnnouncements.length === 0 ? (
                  <div className="no-comments">No announcements found.</div>
                ) : (
                  filteredAnnouncements.map((ann) => (
                    <AnnouncementCard
                      key={ann.id}
                      ann={ann}
                      userId={user?.id ?? null}
                      onToggleLike={(id) => void toggleReaction(id, "like")}
                      onToggleSave={(id) => void toggleReaction(id, "save")}
                    />
                  ))
                )}
              </div>
              <AnnSidebar
                announcements={announcements}
                activeCatValue={catFilterAnn}
                setActiveCatValue={setCatFilterAnn}
                topOrgs={topOrgs}
                savedPosts={savedPosts}
              />
            </div>
          </div>
        )}

        {activeTab === "forum" && (
          <div>
            <div className="filters">
              <div className="search-wrap">
                <IconSearch cls="search-icon" />
                <input
                  className="search-input"
                  placeholder="Search discussions…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="select-wrap">
                <select className="filter-select" value={catFilterForum} onChange={(e) => setCatFilterForum(e.target.value)}>
                  <option value="">All categories</option>
                  <option value="Housing">Housing</option>
                  <option value="Food">Food</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Employment">Employment</option>
                </select>
                <IconChevron cls="select-arrow" />
              </div>
              <div className="select-wrap">
                <select className="filter-select" value={boroughFilter} onChange={(e) => setBoroughFilter(e.target.value)}>
                  <option value="">All boroughs</option>
                  {["Bronx", "Manhattan", "Brooklyn"].map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <IconChevron cls="select-arrow" />
              </div>
            </div>
            {loadingThreads ? (
              <div className="no-comments">Loading discussions…</div>
            ) : (
              <ForumPanel
                threads={filteredThreads}
                selectedThread={selectedThread}
                setSelectedThread={setSelectedThread}
                panelVisible={panelVisible}
                setPanelVisible={setPanelVisible}
                comments={comments}
                loadingComments={loadingComments}
                onPostComment={(text) => void postComment(text)}
              />
            )}
          </div>
        )}
      </main>

      {modalOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{activeTab === "ann" ? "Post an announcement" : "Start a discussion"}</div>
              <button className="modal-close" onClick={() => setModalOpen(false)}><IconClose cls="close-icon" /></button>
            </div>
            <div className="modal-body">
              <div>
                <label className="form-label">TITLE</label>
                <input className="form-input" placeholder="What's this about?" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              </div>
              <div>
                <label className="form-label">DESCRIPTION</label>
                <textarea className="form-textarea" placeholder="Share details…" value={formBody} onChange={(e) => setFormBody(e.target.value)} />
              </div>

              {activeTab === "ann" ? (
                <>
                  <div className="form-row">
                    <div>
                      <label className="form-label">CATEGORY</label>
                      <select className="form-select" value={formAnnCategory} onChange={(e) => setFormAnnCategory(e.target.value as AnnCategory)}>
                        <option value="Event">Event</option>
                        <option value="Update">Update</option>
                        <option value="Resource">Resource</option>
                        <option value="Announcement">Announcement</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">BOROUGH</label>
                      <select className="form-select" value={formBorough} onChange={(e) => setFormBorough(e.target.value)}>
                        <option value="">All boroughs</option>
                        {BOROUGHS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="form-label">EVENT DATE (OPTIONAL)</label>
                    <input className="form-input" type="date" value={formEventDate} onChange={(e) => setFormEventDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">IMAGE (OPTIONAL)</label>
                    {!formImagePreview ? (
                      <div className="upload-area">
                        <IconUpload cls="upload-icon" />
                        <div className="upload-text">Click to upload an image</div>
                        <div className="upload-hint">JPG, PNG or GIF · max 5MB</div>
                        <input
                          type="file"
                          accept="image/*"
                          className="upload-input"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setFormImageFile(file);
                            const reader = new FileReader();
                            reader.onload = (ev) => setFormImagePreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }}
                        />
                      </div>
                    ) : (
                      <div>
                        <img src={formImagePreview} className="image-preview" alt="Preview" />
                        <button className="remove-image-btn" onClick={() => { setFormImageFile(null); setFormImagePreview(null); }}>
                          <svg style={{ width: 11, height: 11, stroke: "currentColor", fill: "none", strokeWidth: 2, strokeLinecap: "round" }} viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          Remove image
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="form-row">
                    <div>
                      <label className="form-label">CATEGORY</label>
                      <select className="form-select" value={formForumCategory} onChange={(e) => setFormForumCategory(e.target.value)}>
                        <option value="Housing">Housing</option>
                        <option value="Food">Food</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Employment">Employment</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">BOROUGH</label>
                      <select className="form-select" value={formBorough} onChange={(e) => setFormBorough(e.target.value)}>
                        <option value="">All boroughs</option>
                        {BOROUGHS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => void submitPost()} disabled={submitting || !formTitle.trim() || !formBody.trim()}>
                <IconPlus cls="btn-icon" />
                <span>{submitting ? "Posting…" : activeTab === "ann" ? "Post" : "Post thread"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function CommunityView() {
  return <CommunityPage />;
}

