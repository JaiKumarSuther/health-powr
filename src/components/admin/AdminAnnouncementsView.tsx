import { useEffect, useMemo, useState, useRef } from 'react';
import { Pin, Edit2, Trash2, Plus, Search, Image, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type AnnSource = 'all' | 'platform' | 'cbo';

interface AdminAnnouncement {
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
}

const BOROUGHS = ['Bronx', 'Manhattan', 'Brooklyn', 'Queens', 'Staten Island'];

function timeLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AdminAnnouncementsView() {
  useAuth();
  const [announcements, setAnnouncements]   = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading]               = useState(true);
  const [searchTerm, setSearchTerm]         = useState('');
  const [sourceFilter, setSourceFilter]     = useState<AnnSource>('all');
  const [showModal, setShowModal]           = useState(false);
  const [editTarget, setEditTarget]         = useState<AdminAnnouncement | null>(null);
  const [submitting, setSubmitting]         = useState(false);
  const [actionError, setActionError]       = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle]           = useState('');
  const [formBody, setFormBody]             = useState('');
  const [formCategory, setFormCategory]     = useState('Announcement');
  const [formBorough, setFormBorough]       = useState('');
  const [formImageFile, setFormImageFile]   = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const [formPin, setFormPin]               = useState(false);

  const imgInputRef = useRef<HTMLInputElement>(null);

  // ── Load ──
  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setActionError(null);
      const { data, error } = await supabase
        .from('org_announcements')
        .select('*, org:organizations!org_id(name)')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAnnouncements((data ?? []) as AdminAnnouncement[]);
    } catch (e) {
      console.error("[AdminAnnouncementsView:load] Failed to load announcements", e);
      setActionError(e instanceof Error ? e.message : "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }

  // ── Open modal ──
  function openNew() {
    setEditTarget(null);
    setFormTitle(''); setFormBody(''); setFormCategory('Announcement');
    setFormBorough(''); setFormImageFile(null); setFormImagePreview(null); setFormPin(false);
    setShowModal(true);
  }

  function openEdit(ann: AdminAnnouncement) {
    setEditTarget(ann);
    setFormTitle(ann.title); setFormBody(ann.body); setFormCategory(ann.category);
    setFormBorough(ann.borough ?? ''); setFormImagePreview(ann.image_url);
    setFormImageFile(null); setFormPin(ann.is_pinned);
    setShowModal(true);
  }

  // ── Submit ──
  async function submit() {
    if (!formTitle.trim() || !formBody.trim()) return;
    setSubmitting(true);
    try {
      setActionError(null);
      let imageUrl = editTarget?.image_url ?? null;
      if (formImageFile) {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        const maxBytes = 5 * 1024 * 1024;
        if (!allowedTypes.includes(formImageFile.type)) {
          setActionError("Invalid file type. Please upload a JPG, PNG, or WebP image.");
          return;
        }
        if (formImageFile.size > maxBytes) {
          setActionError("Image too large. Max size is 5MB.");
          return;
        }
        const ext = formImageFile.name.split('.').pop();
        const path = `announcements/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('community').upload(path, formImageFile);
        if (uploadErr) throw uploadErr;
        const { data: pub } = supabase.storage.from('community').getPublicUrl(path);
        imageUrl = pub.publicUrl;
      } else if (!formImagePreview) {
        imageUrl = null;
      }

      const payload = {
        title:      formTitle,
        body:       formBody,
        category:   formCategory,
        borough:    formBorough || null,
        image_url:  imageUrl,
        is_pinned:  formPin,
        org_id:     null,   // platform-level post — no org
      };

      if (editTarget) {
        const { error } = await supabase.from('org_announcements').update(payload).eq('id', editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('org_announcements').insert(payload);
        if (error) throw error;
      }
      setShowModal(false);
      await load();
    } catch (e) {
      console.error("[AdminAnnouncementsView:submit] Failed to save announcement", e);
      setActionError(e instanceof Error ? e.message : "Failed to save announcement.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Toggle pin ──
  async function togglePin(ann: AdminAnnouncement) {
    try {
      setActionError(null);
      const { error } = await supabase.from('org_announcements').update({ is_pinned: !ann.is_pinned }).eq('id', ann.id);
      if (error) throw error;
      await load();
    } catch (e) {
      console.error("[AdminAnnouncementsView:togglePin] Failed", e);
      setActionError(e instanceof Error ? e.message : "Failed to update pin.");
    }
  }

  // ── Delete ──
  async function remove(id: string) {
    if (!window.confirm('Remove this announcement? This cannot be undone.')) return;
    try {
      setActionError(null);
      const { error } = await supabase.from('org_announcements').delete().eq('id', id);
      if (error) throw error;
      await load();
    } catch (e) {
      console.error("[AdminAnnouncementsView:remove] Failed", e);
      setActionError(e instanceof Error ? e.message : "Failed to delete announcement.");
    }
  }

  // ── Filtered ──
  const filtered = useMemo(() => {
    return announcements.filter(a => {
      const matchSearch = searchTerm ? (a.title + a.body).toLowerCase().includes(searchTerm.toLowerCase()) : true;
      const matchSource = sourceFilter === 'platform' ? !a.org_id
        : sourceFilter === 'cbo' ? !!a.org_id
        : true;
      return matchSearch && matchSource;
    });
  }, [announcements, searchTerm, sourceFilter]);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0f1f2e] tracking-tight">Announcements</h1>
          <p className="text-[12px] text-[#7a9e99] mt-1">Platform-wide posts visible to all users and organizations</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-[#0d9b8a] text-white px-4 py-2.5 rounded-xl text-[13px] font-semibold hover:bg-[#0b8a7a] transition-colors border-none cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          New announcement
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#7a9e99]" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search announcements…"
            className="w-full h-9 pl-8 pr-3 border border-[#e8f0ee] rounded-xl text-[13px] font-[inherit] text-[#0f1f2e] outline-none focus:border-[#0d9b8a] bg-white"
          />
        </div>
        <div className="relative">
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value as AnnSource)}
            className="h-9 pl-3 pr-7 border border-[#e8f0ee] rounded-xl text-[13px] font-[inherit] text-[#0f1f2e] outline-none focus:border-[#0d9b8a] bg-white appearance-none cursor-pointer"
          >
            <option value="all">All sources</option>
            <option value="platform">Platform (admin)</option>
            <option value="cbo">From CBOs</option>
          </select>
          <svg className="absolute right-2.5 top-3 w-3 h-3 text-[#7a9e99] pointer-events-none" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth={2}><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {actionError}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-16 text-center text-[13px] text-[#7a9e99]">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-[#7a9e99]">No announcements found.</div>
      ) : (
        filtered.map(ann => {
          const isPlatform = !ann.org_id;
          return (
            <div key={ann.id} className={`bg-white border border-[#e8f0ee] rounded-2xl p-5 ${ann.is_pinned ? 'border-l-[3px] border-l-[#f59e0b]' : ''}`}>
              {/* Org row */}
              <div className="flex items-center gap-2 text-[12px] font-semibold text-[#4b6b65] mb-1.5">
                {isPlatform ? (
                  <>
                    {ann.is_pinned && <Pin className="w-3 h-3 text-[#f59e0b]" />}
                    {ann.is_pinned && <span className="text-[#f59e0b] font-bold">Pinned</span>}
                    {ann.is_pinned && <span className="text-[#e8f0ee]">·</span>}
                    HealthPowr Platform
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth={1.8} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>
                    {ann.org?.name ?? 'Organization'}
                    <span className="text-[10px] font-bold text-[#0d9b8a] bg-[#e1f5ee] px-1.5 py-0.5 rounded-full">CBO</span>
                    {ann.is_pinned && <><span className="text-[#e8f0ee]">·</span><Pin className="w-3 h-3 text-[#f59e0b]" /><span className="text-[#f59e0b] font-bold">Pinned</span></>}
                  </>
                )}
              </div>

              {/* Content */}
              <div className="text-[15px] font-bold text-[#0f1f2e] leading-snug mb-1.5">{ann.title}</div>
              <div className="text-[12px] text-[#7a9e99] leading-relaxed line-clamp-2">{ann.body}</div>

              {ann.image_url && (
                <img src={ann.image_url} alt={ann.title} className="w-full rounded-xl object-cover max-h-40 mt-3" />
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-[#e8f0ee]">
                <div className="flex items-center gap-3 text-[11px] text-[#7a9e99]">
                  <span>{timeLabel(ann.created_at)}</span>
                  {ann.borough && <span>{ann.borough}</span>}
                  <span>{ann.category}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => void togglePin(ann)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                      ann.is_pinned
                        ? 'border-[#fde68a] text-[#f59e0b] bg-[#fffbeb]'
                        : 'border-[#e8f0ee] text-[#7a9e99] hover:border-[#0d9b8a] hover:text-[#0d9b8a]'
                    }`}
                  >
                    <Pin className="w-[11px] h-[11px]" />
                    {ann.is_pinned ? 'Pinned' : 'Pin'}
                  </button>
                  {isPlatform && (
                    <button
                      onClick={() => openEdit(ann)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#e8f0ee] text-[11px] font-semibold text-[#7a9e99] hover:border-[#0d9b8a] hover:text-[#0d9b8a] transition-all cursor-pointer"
                    >
                      <Edit2 className="w-[11px] h-[11px]" />
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => void remove(ann.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#e8f0ee] text-[11px] font-semibold text-[#7a9e99] hover:border-[#dc2626] hover:text-[#dc2626] transition-all cursor-pointer"
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

      {/* ── Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-[460px] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#e8f0ee]">
              <div className="text-[16px] font-extrabold text-[#0f1f2e]">
                {editTarget ? 'Edit announcement' : 'New announcement'}
              </div>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-lg border border-[#e8f0ee] bg-white flex items-center justify-center cursor-pointer hover:bg-[#f6faf8]">
                <X className="w-3 h-3 text-[#7a9e99]" />
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold text-[#7a9e99] tracking-wider mb-1.5">Title</label>
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="What's this announcement about?" className="w-full h-9 px-3 border border-[#e8f0ee] rounded-xl text-[13px] font-[inherit] text-[#0f1f2e] outline-none focus:border-[#0d9b8a]" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#7a9e99] tracking-wider mb-1.5">Description</label>
                <textarea value={formBody} onChange={e => setFormBody(e.target.value)} placeholder="Details visible to all users and organizations…" className="w-full px-3 py-2.5 border border-[#e8f0ee] rounded-xl text-[13px] font-[inherit] text-[#0f1f2e] outline-none focus:border-[#0d9b8a] resize-none h-20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#7a9e99] tracking-wider mb-1.5">Category</label>
                  <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className="w-full h-9 px-3 border border-[#e8f0ee] rounded-xl text-[13px] font-[inherit] text-[#0f1f2e] outline-none bg-white">
                    {['Announcement','Event','Update','Resource'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#7a9e99] tracking-wider mb-1.5">Borough (optional)</label>
                  <select value={formBorough} onChange={e => setFormBorough(e.target.value)} className="w-full h-9 px-3 border border-[#e8f0ee] rounded-xl text-[13px] font-[inherit] text-[#0f1f2e] outline-none bg-white">
                    <option value="">All boroughs</option>
                    {BOROUGHS.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-[11px] font-bold text-[#7a9e99] tracking-wider mb-1.5">Image (optional)</label>
                {formImagePreview ? (
                  <div>
                    <img src={formImagePreview} alt="Preview" className="w-full rounded-xl object-cover max-h-36" />
                    <button
                      onClick={() => { setFormImageFile(null); setFormImagePreview(null); if (imgInputRef.current) imgInputRef.current.value = ''; }}
                      className="flex items-center gap-1 text-[11px] text-[#7a9e99] bg-none border-none cursor-pointer mt-1.5 hover:text-[#dc2626]"
                    >
                      <X className="w-2.5 h-2.5" />
                      Remove image
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#e8f0ee] rounded-xl p-5 cursor-pointer hover:border-[#0d9b8a] hover:bg-[#f0fdf4] transition-colors">
                    <Image className="w-5 h-5 text-[#7a9e99] mb-1.5" />
                    <span className="text-[12px] text-[#7a9e99] font-medium">Click to upload an image</span>
                    <span className="text-[11px] text-[#7a9e99] mt-0.5 opacity-70">JPG or PNG · max 5MB</span>
                    <input
                      ref={imgInputRef}
                      type="file" accept="image/*" className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setFormImageFile(file);
                        const reader = new FileReader();
                        reader.onload = ev => setFormImagePreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                )}
              </div>

              <label className="flex items-center gap-2 text-[13px] text-[#0f1f2e] font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={formPin}
                  onChange={e => setFormPin(e.target.checked)}
                  className="accent-[#0d9b8a]"
                />
                Pin to top of announcement board
              </label>
            </div>

            <div className="px-6 py-4 border-t border-[#e8f0ee] flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-[#e8f0ee] rounded-xl text-[13px] font-semibold text-[#7a9e99] bg-white cursor-pointer hover:text-[#0f1f2e]">
                Cancel
              </button>
              <button
                onClick={() => void submit()}
                disabled={submitting || !formTitle.trim() || !formBody.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[#0d9b8a] text-white rounded-xl text-[13px] font-semibold border-none cursor-pointer hover:bg-[#0b8a7a] disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                {submitting ? 'Posting…' : editTarget ? 'Save changes' : 'Post announcement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

