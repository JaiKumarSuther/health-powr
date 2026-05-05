import React from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  housing: '#0d9b8a', food: '#10b981', healthcare: '#3b82f6', employment: '#8b5cf6', community: '#f59e0b',
};

export const BOROUGH_COLORS: Record<string, string> = {
  bronx: '#0d9b8a', manhattan: '#3b82f6', brooklyn: '#8b5cf6', queens: '#f59e0b', staten_island: '#10b981',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const hoursAgo = (date: string) => (Date.now() - new Date(date).getTime()) / 36e5;

export const timeLabel = (date: string) => {
  const h = hoursAgo(date);
  if (h < 1) return `${Math.round(h * 60)}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return Math.floor(h / 24) === 1 ? 'Yesterday' : `${Math.floor(h / 24)}d ago`;
};

export const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

// ─── Components ───────────────────────────────────────────────────────────────

export const MetricCard = ({ value, label, trend, trendColor = '#10b981', trendIcon, reviewNow, onReviewNow, sparkPoints }: any) => {
  const max = sparkPoints ? Math.max(...sparkPoints, 1) : 1;
  const pts = sparkPoints?.map((v: any, i: any) => `${(i / (sparkPoints.length - 1)) * 120},${28 - (v / max) * 24 + 2}`).join(' ');

  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col gap-2 min-h-[140px]">
      <div className="flex items-start justify-between">
        <span className="text-[36px] font-medium text-[#0f1f2e] tracking-tight">{value}</span>
        {trend && <span className="text-[11px] font-semibold flex items-center gap-1" style={{ color: trendColor }}>{trendIcon && '⚠'} {trend}</span>}
      </div>
      <span className="text-[12px] text-[#7a9e99]">{label}</span>
      {sparkPoints && (
        <svg width="100%" height="28" viewBox="0 0 120 28" preserveAspectRatio="none" className="mt-auto">
          <polyline stroke="#1d4ed8" strokeWidth={2} fill="none" points={pts}/>
        </svg>
      )}
      {reviewNow && <button onClick={onReviewNow} className="mt-auto pt-3 text-left text-[12px] font-semibold text-[#7a9e99] hover:text-[#0d9b8a]">Review now →</button>}
    </div>
  );
};

export const ReqRow = ({ request, accentColor, showBadge }: any) => {
  const statusColors: any = { new: ['#fef3c7', '#92400e'], in_review: ['#f3f4f6', '#1d4ed8'], responded: ['#dcfce7', '#15803d'] };
  const badge = statusColors[request.status] || ['#f3f4f6', '#6b7280'];

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e8f0ee] hover:bg-[#f6faf8] cursor-pointer" style={accentColor ? { borderLeft: `3px solid ${accentColor}` } : {}}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: CATEGORY_COLORS[request.category?.toLowerCase()] || '#6b7280' }}>
        {initials(request.member?.full_name || 'U')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold truncate">{request.member?.full_name}</div>
        <div className="text-[11px] text-[#7a9e99] truncate">{request.category} · {request.borough}</div>
      </div>
      <div className="text-right">
        <div className="text-[11px] text-[#7a9e99]">{timeLabel(request.created_at)}</div>
        {showBadge && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: badge[0], color: badge[1] }}>{request.status}</span>}
      </div>
    </div>
  );
};

export const HBarChart = ({ items, maxCount }: any) => (
  <div className="flex flex-col gap-[9px] px-4 pb-4 pt-3">
    {items.map((item: any) => (
      <div key={item.label} className="flex items-center gap-2 text-[11px]">
        <span className="text-[#4b6b65] w-[72px] truncate capitalize">{item.label.replace(/_/g, ' ')}</span>
        <div className="flex-1 h-[7px] bg-[#e5e7eb] rounded-full overflow-hidden">
          <div className="h-full" style={{ width: `${(item.count / maxCount) * 100}%`, background: item.color }}/>
        </div>
        <span className="font-semibold w-4 text-right">{item.count}</span>
      </div>
    ))}
  </div>
);

export const CBOOverviewSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="grid grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => <div key={i} className="bg-white h-36 rounded-2xl"/>)}
    </div>
    <div className="grid grid-cols-3 gap-4 h-[400px]">
      <div className="col-span-2 bg-white rounded-2xl"/>
      <div className="bg-white rounded-2xl"/>
    </div>
  </div>
);
