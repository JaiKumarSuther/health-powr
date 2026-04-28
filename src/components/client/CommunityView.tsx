import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Calendar,
  CheckCircle,
  Clock,
  Heart,
  MessageSquare,
  Package,
  Pin,
  Plus,
  Search,
  User,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { forumApi } from "../../api/forum";

type TopTab = "announcements" | "forum";
type AnnCategory = "Event" | "Update" | "Resource" | "Announcement";

type OrgAnnouncement = {
  id: string;
  org_id: string;
  title: string;
  body: string;
  category: AnnCategory;
  borough: string | null;
  event_date: string | null;
  image_url: string | null;
  is_pinned: boolean;
  created_at: string;
  org?: { name: string };
  reactions?: { id: string; user_id: string; type: "like" | "save" }[];
};

type ForumThread = {
  id: string;
  title: string;
  body: string;
  category: string;
  borough: string | null;
  created_at: string;
  author?: { full_name: string | null };
  comment_count?: number;
};

type ForumComment = {
  id: string;
  thread_id: string;
  content: string;
  created_at: string;
  author?: { full_name: string | null; id: string };
};

const CAT_COLORS: Record<AnnCategory, string> = {
  Event: "#6d28d9",
  Update: "#1d4ed8",
  Resource: "#15803d",
  Announcement: "#92400e",
};

const AVATAR_COLORS = [
  "#0d9b8a",
  "#7c3aed",
  "#1d4ed8",
  "#15803d",
  "#db2777",
  "#d97706",
];

const BOROUGHS = ["Bronx", "Manhattan", "Brooklyn", "Queens", "Staten Island"];

function timeLabel(dateStr: string): string {
  const h = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min ago`;
  if (h < 24) return `${Math.round(h)} hr ago`;
  const d = Math.floor(h / 24);
  return d === 1
    ? "Yesterday"
    : new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function initials(name: string): string {
  return name
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarColor(name: string): string {
  const safe = name.trim() || "A";
  return AVATAR_COLORS[safe.charCodeAt(0) % AVATAR_COLORS.length];
}

function VerifiedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600">
      <CheckCircle className="h-[10px] w-[10px]" />
      {label}
    </span>
  );
}

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl font-extrabold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.32,
        background: avatarColor(name),
      }}
    >
      {initials(name)}
    </div>
  );
}

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
  const liked =
    ann.reactions?.some((r) => r.user_id === userId && r.type === "like") ??
    false;
  const saved =
    ann.reactions?.some((r) => r.user_id === userId && r.type === "save") ??
    false;
  const likeCount = ann.reactions?.filter((r) => r.type === "like").length ?? 0;
  const orgName = ann.org?.name ?? "Organization";
  const catColor = CAT_COLORS[ann.category] ?? "#6b7280";

  return (
    <div
      className={[
        "rounded-2xl border bg-white p-5 transition-all",
        "border-slate-200 hover:border-teal-300 hover:shadow-[0_0_0_3px_rgba(13,155,138,0.08)]",
        ann.is_pinned ? "border-l-[3px] border-l-teal-600" : "",
      ].join(" ")}
    >
      {ann.is_pinned ? (
        <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-teal-700">
          <Pin className="h-[11px] w-[11px]" />
          Pinned
        </div>
      ) : null}

      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={orgName} size={34} />
          <div>
            <div className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
              <span className="truncate">{orgName}</span>
              <VerifiedBadge label="CBO" />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-[10px] font-extrabold" style={{ color: catColor }}>
            {ann.category}
          </span>
          <span className="text-[11px] font-semibold text-slate-400">
            {timeLabel(ann.created_at)}
          </span>
        </div>
      </div>

      <div className="mb-2 text-[16px] font-extrabold leading-snug text-slate-900">
        {ann.title}
      </div>
      <div className="line-clamp-3 text-[13px] leading-relaxed text-slate-600">
        {ann.body}
      </div>

      {ann.image_url ? (
        <img
          src={ann.image_url}
          alt={ann.title}
          className="mt-3 max-h-56 w-full rounded-xl object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : null}

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
          {ann.event_date ? (
            <>
              <Calendar className="h-[13px] w-[13px] text-teal-600" />
              {new Date(ann.event_date).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </>
          ) : (
            <>
              <Clock className="h-[13px] w-[13px] text-teal-600" />
              {ann.borough ?? "All boroughs"}
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleLike(ann.id)}
            className={[
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all",
              liked
                ? "border-teal-600 bg-teal-50 text-teal-700"
                : "border-slate-200 text-slate-500 hover:border-teal-300 hover:text-teal-700",
            ].join(" ")}
          >
            <Heart className={["h-3 w-3", liked ? "fill-teal-600 text-teal-600" : ""].join(" ")} />
            {likeCount > 0 ? likeCount : "Like"}
          </button>

          <button
            type="button"
            onClick={() => onToggleSave(ann.id)}
            className={[
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all",
              saved
                ? "border-violet-600 bg-violet-50 text-violet-700"
                : "border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-700",
            ].join(" ")}
          >
            <Bookmark className={["h-3 w-3", saved ? "fill-violet-600 text-violet-600" : ""].join(" ")} />
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ForumThreadCard({
  thread,
  isSelected,
  onClick,
}: {
  thread: ForumThread;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-2xl border bg-white p-5 text-left transition-all",
        isSelected
          ? "border-teal-600 shadow-[0_0_0_3px_rgba(13,155,138,0.08)]"
          : "border-slate-200 hover:border-teal-300",
      ].join(" ")}
    >
      <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-extrabold text-teal-700 capitalize">
        <MessageSquare className="h-3 w-3" />
        {thread.category}
      </span>
      <div className="mb-2 text-[16px] font-extrabold leading-snug text-slate-900">
        {thread.title}
      </div>
      <div className="line-clamp-2 text-[13px] leading-relaxed text-slate-600">
        {thread.body}
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-[11px] font-semibold text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3" />
          {thread.comment_count ?? 0} comments
        </span>
        <span className="inline-flex items-center gap-1.5">
          <User className="h-3 w-3" />
          {thread.author?.full_name ?? "Community member"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          {timeLabel(thread.created_at)}
        </span>
      </div>
    </button>
  );
}

export function CommunityView() {
  const { user } = useAuth();

  const [topTab, setTopTab] = useState<TopTab>("announcements");

  // Announcements state
  const [announcements, setAnnouncements] = useState<OrgAnnouncement[]>([]);
  const [annLoading, setAnnLoading] = useState(true);

  // Forum state
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  // Shared filters
  const [searchTerm, setSearchTerm] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [boroughFilter, setBoroughFilter] = useState("");

  // Create post modal state
  const [showPostModal, setShowPostModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postCategory, setPostCategory] = useState<AnnCategory>("Announcement");
  const [postBorough, setPostBorough] = useState("");
  const [postEventDate, setPostEventDate] = useState("");
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [forumPostCategory, setForumPostCategory] = useState("Housing");
  const [forumPostBorough, setForumPostBorough] = useState("");

  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  async function loadThreadsFromApi(opts?: { category?: string; borough?: string }) {
    const data = await forumApi.getThreads(opts);
    setThreads(data);
    setSelectedThread((prev) => {
      if (!prev) return data.length > 0 ? data[0] : null;
      const stillThere = data.find((t) => t.id === prev.id);
      return stillThere ?? (data.length > 0 ? data[0] : null);
    });
  }

  useEffect(() => {
    async function loadAnnouncements() {
      setAnnLoading(true);
      try {
        const { data } = await supabase
          .from("org_announcements")
          .select(
            `
            *,
            org:organizations!org_id(name),
            reactions:announcement_reactions(id, user_id, type)
          `,
          )
          .order("is_pinned", { ascending: false })
          .order("created_at", { ascending: false });
        setAnnouncements((data ?? []) as OrgAnnouncement[]);
      } finally {
        setAnnLoading(false);
      }
    }
    void loadAnnouncements();
  }, []);

  useEffect(() => {
    // Always have threads ready (forum tab can be opened instantly).
    // When the forum tab is active, keep the list in sync with filter selections using API filtering.
    const opts =
      topTab === "forum"
        ? {
            category: catFilter || undefined,
            borough: boroughFilter || undefined,
          }
        : undefined;
    void loadThreadsFromApi(opts);
  }, [topTab, catFilter, boroughFilter]);

  useEffect(() => {
    if (!selectedThread) return;
    setLoadingComments(true);
    void forumApi.getComments(selectedThread.id).then((data: ForumComment[]) => {
      setComments(data);
      setLoadingComments(false);
      setTimeout(
        () => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    });
  }, [selectedThread]);

  async function toggleReaction(annId: string, type: "like" | "save") {
    if (!user) return;
    const ann = announcements.find((a) => a.id === annId);
    if (!ann) return;

    const existing = ann.reactions?.find(
      (r) => r.user_id === user.id && r.type === type,
    );
    if (existing) {
      await supabase.from("announcement_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("announcement_reactions").insert({
        announcement_id: annId,
        user_id: user.id,
        type,
      });
    }

    const { data } = await supabase
      .from("announcement_reactions")
      .select("id, user_id, type")
      .eq("announcement_id", annId);
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === annId ? { ...a, reactions: (data ?? []) as any } : a)),
    );
  }

  async function postComment() {
    if (!commentText.trim() || !selectedThread || !user) return;
    const content = commentText.trim();
    setCommentText("");
    await forumApi.addComment(selectedThread.id, content);
    const data = await forumApi.getComments(selectedThread.id);
    setComments(data);
    setTimeout(
      () => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  }

  async function submitPost() {
    if (!postTitle.trim() || !postBody.trim()) return;
    if (!user) return;
    setSubmitting(true);
    try {
      if (topTab === "forum") {
        await forumApi.createThread({
          title: postTitle.trim(),
          body: postBody.trim(),
          category: forumPostCategory,
          borough: forumPostBorough || undefined,
        });

        await loadThreadsFromApi({
          category: catFilter || undefined,
          borough: boroughFilter || undefined,
        });

        setPostTitle("");
        setPostBody("");
        setForumPostCategory("Housing");
        setForumPostBorough("");
        setShowPostModal(false);
        return;
      }

      let imageUrl: string | null = null;
      if (postImageFile) {
        const ext = postImageFile.name.split(".").pop() || "jpg";
        const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `announcements/${Date.now()}.${safeExt}`;
        const { error } = await supabase.storage
          .from("community")
          .upload(path, postImageFile, {
            upsert: true,
            contentType: postImageFile.type || "image/jpeg",
          });
        if (!error) {
          const { data } = supabase.storage.from("community").getPublicUrl(path);
          imageUrl = data.publicUrl;
        }
      }

      const { data: orgMem } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", user.id)
        .maybeSingle();

      await supabase.from("org_announcements").insert({
        org_id: orgMem?.organization_id ?? null,
        title: postTitle,
        body: postBody,
        category: postCategory,
        borough: postBorough || null,
        event_date: postEventDate || null,
        image_url: imageUrl,
        is_pinned: false,
      });

      setPostTitle("");
      setPostBody("");
      setPostCategory("Announcement");
      setPostBorough("");
      setPostEventDate("");
      setPostImageFile(null);
      setPostImagePreview(null);
      setShowPostModal(false);

      const { data } = await supabase
        .from("org_announcements")
        .select(`*, org:organizations!org_id(name), reactions:announcement_reactions(id, user_id, type)`)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      setAnnouncements((data ?? []) as OrgAnnouncement[]);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      const matchSearch = searchTerm
        ? (a.title + a.body + (a.org?.name ?? ""))
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        : true;
      const matchCat = catFilter ? a.category === catFilter : true;
      const matchBor = boroughFilter ? a.borough === boroughFilter || !a.borough : true;
      return matchSearch && matchCat && matchBor;
    });
  }, [announcements, searchTerm, catFilter, boroughFilter]);

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      const matchSearch = searchTerm
        ? (t.title + t.body).toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchCat = catFilter ? t.category.toLowerCase() === catFilter.toLowerCase() : true;
      const matchBor = boroughFilter ? t.borough === boroughFilter : true;
      return matchSearch && matchCat && matchBor;
    });
  }, [threads, searchTerm, catFilter, boroughFilter]);

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            Community
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Announcements from organizations and peer discussions
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowPostModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          {topTab === "announcements" ? "New post" : "New thread"}
        </button>
      </div>

      <div className="mb-5 flex gap-2 border-b border-slate-200">
        {[
          { id: "announcements" as TopTab, label: "Announcements", count: announcements.length },
          { id: "forum" as TopTab, label: "Forum", count: threads.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setTopTab(tab.id);
              setSearchTerm("");
              setCatFilter("");
              setBoroughFilter("");
              setShowPostModal(false);
            }}
            className={[
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors",
              "border-b-2 -mb-px",
              topTab === tab.id
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-900",
            ].join(" ")}
          >
            {tab.label}
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                topTab === tab.id ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-600",
              ].join(" ")}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={topTab === "announcements" ? "Search announcements…" : "Search discussions…"}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
          />
        </div>

        <div className="relative">
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
          >
            <option value="">All categories</option>
            {topTab === "announcements"
              ? ["Event", "Update", "Resource", "Announcement"].map((c) => <option key={c}>{c}</option>)
              : ["Housing", "Food", "Healthcare", "Employment", "Other"].map((c) => <option key={c}>{c}</option>)}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400"
            viewBox="0 0 24 24"
            stroke="currentColor"
            fill="none"
            strokeWidth={2}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        <div className="relative">
          <select
            value={boroughFilter}
            onChange={(e) => setBoroughFilter(e.target.value)}
            className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
          >
            <option value="">All boroughs</option>
            {BOROUGHS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400"
            viewBox="0 0 24 24"
            stroke="currentColor"
            fill="none"
            strokeWidth={2}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {topTab === "announcements" ? (
        <div className="space-y-4">
          {annLoading ? (
            <div className="py-16 text-center text-sm font-semibold text-slate-400">
              Loading announcements…
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="py-16 text-center text-sm font-semibold text-slate-400">
              No announcements found.
            </div>
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
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {filteredThreads.length === 0 ? (
              <div className="py-16 text-center text-sm font-semibold text-slate-400">
                No discussions found.
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <ForumThreadCard
                  key={thread.id}
                  thread={thread}
                  isSelected={selectedThread?.id === thread.id}
                  onClick={() => setSelectedThread(thread)}
                />
              ))
            )}
          </div>

          {selectedThread ? (
            <div className="rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold leading-snug text-slate-900">
                    {selectedThread.title}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {selectedThread.author?.full_name ?? "Community member"} ·{" "}
                    {timeLabel(selectedThread.created_at)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedThread(null)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="flex max-h-[70vh] flex-col">
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {loadingComments ? (
                    <div className="py-10 text-center text-sm font-semibold text-slate-400">
                      Loading…
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="py-10 text-center text-sm font-semibold text-slate-400">
                      No comments yet. Be the first.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3.5">
                      {comments.map((comment) => {
                        const name = comment.author?.full_name ?? "Community member";
                        return (
                          <div key={comment.id} className="flex gap-2.5">
                            <div
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                              style={{ background: avatarColor(name) }}
                            >
                              {initials(name)}
                            </div>
                            <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                              <div className="text-[11px] font-extrabold text-slate-700">
                                {name}
                              </div>
                              <div className="mt-1 text-sm leading-relaxed text-slate-600">
                                {comment.content}
                              </div>
                              <div className="mt-1.5 text-[10px] font-semibold text-slate-400">
                                {timeLabel(comment.created_at)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={commentsEndRef} />
                    </div>
                  )}
                </div>

                <div className="flex items-end gap-2 border-t border-slate-200 px-4 py-3">
                  <textarea
                    ref={commentInputRef}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void postComment();
                      }
                    }}
                    placeholder="Add a comment…"
                    rows={1}
                    className="min-h-[40px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                  />
                  <button
                    type="button"
                    onClick={() => void postComment()}
                    disabled={!commentText.trim()}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white transition-colors hover:bg-teal-700 disabled:opacity-40"
                    aria-label="Send"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      stroke="white"
                      fill="none"
                      strokeWidth={2}
                      strokeLinecap="round"
                    >
                      <path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500 lg:block">
              Select a discussion to view comments.
            </div>
          )}
        </div>
      )}

      {showPostModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPostModal(false);
          }}
        >
          <div className="w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div className="text-lg font-extrabold text-slate-900">
                {topTab === "announcements" ? "Post an announcement" : "Start a discussion"}
              </div>
              <button
                type="button"
                onClick={() => setShowPostModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="grid gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold tracking-wide text-slate-400">
                    Title
                  </label>
                  <input
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="What's this about?"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-extrabold tracking-wide text-slate-400">
                    Description
                  </label>
                  <textarea
                    value={postBody}
                    onChange={(e) => setPostBody(e.target.value)}
                    placeholder="Share details…"
                    className="h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                  />
                </div>

                {topTab === "announcements" ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-extrabold tracking-wide text-slate-400">
                          Category
                        </label>
                        <select
                          value={postCategory}
                          onChange={(e) => setPostCategory(e.target.value as AnnCategory)}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
                        >
                          {["Event", "Update", "Resource", "Announcement"].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-extrabold tracking-wide text-slate-400">
                          Borough
                        </label>
                        <select
                          value={postBorough}
                          onChange={(e) => setPostBorough(e.target.value)}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
                        >
                          <option value="">All boroughs</option>
                          {BOROUGHS.map((b) => (
                            <option key={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-extrabold tracking-wide text-slate-400">
                        Event date (optional)
                      </label>
                      <input
                        type="date"
                        value={postEventDate}
                        onChange={(e) => setPostEventDate(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-extrabold tracking-wide text-slate-400">
                        Image (optional)
                      </label>

                      {postImagePreview ? (
                        <div>
                          <img
                            src={postImagePreview}
                            alt="Preview"
                            className="max-h-48 w-full rounded-xl object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setPostImageFile(null);
                              setPostImagePreview(null);
                            }}
                            className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-rose-600"
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200">
                              ✕
                            </span>
                            Remove image
                          </button>
                        </div>
                      ) : (
                        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-6 text-center hover:border-teal-400 hover:bg-teal-50/40">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <Package className="h-4 w-4 text-slate-400" />
                            Click to upload an image
                          </div>
                          <div className="mt-1 text-xs font-medium text-slate-400">
                            JPG or PNG · max 5MB
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setPostImageFile(file);
                              const reader = new FileReader();
                              reader.onload = (ev) =>
                                setPostImagePreview(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold tracking-wide text-slate-400">
                      Category
                    </label>
                    <select
                      value={forumPostCategory}
                      onChange={(e) => setForumPostCategory(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
                    >
                      {["Housing", "Food", "Healthcare", "Employment", "Other"].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>

                    <label className="mt-3 mb-1.5 block text-xs font-extrabold tracking-wide text-slate-400">
                      Borough (optional)
                    </label>
                    <select
                      value={forumPostBorough}
                      onChange={(e) => setForumPostBorough(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
                    >
                      <option value="">All boroughs</option>
                      {BOROUGHS.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowPostModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitPost()}
                disabled={submitting || !postTitle.trim() || !postBody.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-teal-700 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                {submitting ? "Posting…" : topTab === "announcements" ? "Post" : "Post thread"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}