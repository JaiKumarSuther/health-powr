import { useEffect, useMemo, useRef, useState } from "react";
import { Edit2, Image, Pin, Plus, Search, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

type AnnSource = "all" | "platform" | "cbo";

type AdminAnnouncement = {
  id: string;
  org_id: string | null;
  title: string;
  body: string;
  category: string;
  borough: string | null;
  event_date: string | null;
  image_url: string | null;
  is_pinned: boolean;
  created_at: string;
  org?: { name: string } | null;
};

const BOROUGHS = ["Bronx", "Manhattan", "Brooklyn", "Queens", "Staten Island"];

function timeLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AdminAnnouncementsView() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<AnnSource>("all");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminAnnouncement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCategory, setFormCategory] = useState("Announcement");
  const [formBorough, setFormBorough] = useState("");
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const [formPin, setFormPin] = useState(false);

  const imgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("org_announcements")
        .select("*, org:organizations!org_id(name)")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      setAnnouncements((data ?? []) as AdminAnnouncement[]);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditTarget(null);
    setFormTitle("");
    setFormBody("");
    setFormCategory("Announcement");
    setFormBorough("");
    setFormImageFile(null);
    setFormImagePreview(null);
    setFormPin(false);
    setShowModal(true);
  }

  function openEdit(ann: AdminAnnouncement) {
    setEditTarget(ann);
    setFormTitle(ann.title);
    setFormBody(ann.body);
    setFormCategory(ann.category);
    setFormBorough(ann.borough ?? "");
    setFormImagePreview(ann.image_url);
    setFormImageFile(null);
    setFormPin(ann.is_pinned);
    setShowModal(true);
  }

  async function submit() {
    if (!formTitle.trim() || !formBody.trim()) return;
    if (!user) return;
    setSubmitting(true);
    try {
      let imageUrl = editTarget?.image_url ?? null;
      if (formImageFile) {
        const ext = formImageFile.name.split(".").pop() || "jpg";
        const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `announcements/${Date.now()}.${safeExt}`;
        const { error } = await supabase.storage.from("community").upload(path, formImageFile, {
          upsert: true,
          contentType: formImageFile.type || "image/jpeg",
        });
        if (!error) {
          const { data } = supabase.storage.from("community").getPublicUrl(path);
          imageUrl = data.publicUrl;
        }
      } else if (!formImagePreview) {
        imageUrl = null;
      }

      const payload = {
        title: formTitle,
        body: formBody,
        category: formCategory,
        borough: formBorough || null,
        image_url: imageUrl,
        is_pinned: formPin,
        org_id: null as string | null, // platform-level post
      };

      if (editTarget) {
        await supabase.from("org_announcements").update(payload).eq("id", editTarget.id);
      } else {
        await supabase.from("org_announcements").insert(payload);
      }

      setShowModal(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePin(ann: AdminAnnouncement) {
    await supabase
      .from("org_announcements")
      .update({ is_pinned: !ann.is_pinned })
      .eq("id", ann.id);
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this announcement? This cannot be undone.")) return;
    await supabase.from("org_announcements").delete().eq("id", id);
    await load();
  }

  const filtered = useMemo(() => {
    return announcements.filter((a) => {
      const matchSearch = searchTerm
        ? (a.title + a.body).toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchSource =
        sourceFilter === "platform" ? !a.org_id : sourceFilter === "cbo" ? !!a.org_id : true;
      return matchSearch && matchSource;
    });
  }, [announcements, searchTerm, sourceFilter]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">
            Announcements
          </h1>
          <p className="text-[12px] text-slate-500 mt-1">
            Platform-wide posts visible to all users and organizations
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl text-[13px] font-semibold hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New announcement
        </button>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search announcements…"
            className="w-full h-9 pl-8 pr-3 border border-slate-200 rounded-xl text-[13px] text-slate-900 outline-none focus:border-teal-600 bg-white"
          />
        </div>
        <div className="relative">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as AnnSource)}
            className="h-9 pl-3 pr-7 border border-slate-200 rounded-xl text-[13px] text-slate-900 outline-none focus:border-teal-600 bg-white appearance-none cursor-pointer"
          >
            <option value="all">All sources</option>
            <option value="platform">Platform (admin)</option>
            <option value="cbo">From CBOs</option>
          </select>
          <svg
            className="absolute right-2.5 top-3 w-3 h-3 text-slate-400 pointer-events-none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            fill="none"
            strokeWidth={2}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-[13px] text-slate-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-slate-400">
          No announcements found.
        </div>
      ) : (
        filtered.map((ann) => {
          const isPlatform = !ann.org_id;
          return (
            <div
              key={ann.id}
              className={`bg-white border border-slate-200 rounded-2xl p-5 ${
                ann.is_pinned ? "border-l-[3px] border-l-amber-500" : ""
              }`}
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-600 mb-1.5">
                {isPlatform ? (
                  <>
                    {ann.is_pinned ? (
                      <>
                        <Pin className="w-3 h-3 text-amber-500" />
                        <span className="text-amber-600 font-bold">Pinned</span>
                        <span className="text-slate-200">·</span>
                      </>
                    ) : null}
                    HealthPowr Platform
                  </>
                ) : (
                  <>
                    {ann.org?.name ?? "Organization"}
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-full">
                      CBO
                    </span>
                    {ann.is_pinned ? (
                      <>
                        <span className="text-slate-200">·</span>
                        <Pin className="w-3 h-3 text-amber-500" />
                        <span className="text-amber-600 font-bold">Pinned</span>
                      </>
                    ) : null}
                  </>
                )}
              </div>

              <div className="text-[15px] font-bold text-slate-900 leading-snug mb-1.5">
                {ann.title}
              </div>
              <div className="text-[12px] text-slate-500 leading-relaxed line-clamp-2">
                {ann.body}
              </div>

              {ann.image_url ? (
                <img
                  src={ann.image_url}
                  alt={ann.title}
                  className="w-full rounded-xl object-cover max-h-40 mt-3"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : null}

              <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-slate-200">
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span>{timeLabel(ann.created_at)}</span>
                  {ann.borough ? <span>{ann.borough}</span> : null}
                  <span>{ann.category}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void togglePin(ann)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
                      ann.is_pinned
                        ? "border-amber-200 text-amber-700 bg-amber-50"
                        : "border-slate-200 text-slate-500 hover:border-teal-300 hover:text-teal-700"
                    }`}
                  >
                    <Pin className="w-[11px] h-[11px]" />
                    {ann.is_pinned ? "Pinned" : "Pin"}
                  </button>

                  {isPlatform ? (
                    <button
                      type="button"
                      onClick={() => openEdit(ann)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-500 hover:border-teal-300 hover:text-teal-700 transition-all"
                    >
                      <Edit2 className="w-[11px] h-[11px]" />
                      Edit
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void remove(ann.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-500 hover:border-rose-300 hover:text-rose-600 transition-all"
                  >
                    <Trash2 className="w-[11px] h-[11px]" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {showModal ? (
        <div
          className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-[460px] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
              <div className="text-[16px] font-extrabold text-slate-900">
                {editTarget ? "Edit announcement" : "New announcement"}
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50"
              >
                <X className="w-3 h-3 text-slate-500" />
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 tracking-wider mb-1.5">
                  Title
                </label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="What's this announcement about?"
                  className="w-full h-9 px-3 border border-slate-200 rounded-xl text-[13px] text-slate-900 outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Details visible to all users and organizations…"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-900 outline-none focus:border-teal-600 resize-none h-20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-xl text-[13px] text-slate-900 outline-none bg-white"
                  >
                    {["Announcement", "Event", "Update", "Resource"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 tracking-wider mb-1.5">
                    Borough (optional)
                  </label>
                  <select
                    value={formBorough}
                    onChange={(e) => setFormBorough(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-xl text-[13px] text-slate-900 outline-none bg-white"
                  >
                    <option value="">All boroughs</option>
                    {BOROUGHS.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 tracking-wider mb-1.5">
                  Image (optional)
                </label>
                {formImagePreview ? (
                  <div>
                    <img
                      src={formImagePreview}
                      alt="Preview"
                      className="w-full rounded-xl object-cover max-h-36"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFormImageFile(null);
                        setFormImagePreview(null);
                        if (imgInputRef.current) imgInputRef.current.value = "";
                      }}
                      className="flex items-center gap-1 text-[11px] text-slate-500 bg-none border-none cursor-pointer mt-1.5 hover:text-rose-600"
                    >
                      <X className="w-2.5 h-2.5" />
                      Remove image
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-5 cursor-pointer hover:border-teal-600 hover:bg-teal-50 transition-colors">
                    <Image className="w-5 h-5 text-slate-500 mb-1.5" />
                    <span className="text-[12px] text-slate-600 font-medium">
                      Click to upload an image
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">JPG or PNG · max 5MB</span>
                    <input
                      ref={imgInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setFormImageFile(file);
                        const reader = new FileReader();
                        reader.onload = (ev) =>
                          setFormImagePreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                )}
              </div>

              <label className="flex items-center gap-2 text-[13px] text-slate-900 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={formPin}
                  onChange={(e) => setFormPin(e.target.checked)}
                  className="accent-teal-600"
                />
                Pin to top of announcement board
              </label>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-500 bg-white hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting || !formTitle.trim() || !formBody.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-[13px] font-semibold hover:bg-teal-700 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                {submitting ? "Posting…" : editTarget ? "Save changes" : "Post announcement"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

