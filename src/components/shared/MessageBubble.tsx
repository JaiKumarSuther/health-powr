
interface MessageBubbleProps {
  content: string;
  isOwn: boolean;
  senderName?: string;
  timestamp: string;
  avatarUrl?: string;
  avatarFallback?: string;
}

export function MessageBubble({
  content,
  isOwn,
  senderName,
  timestamp,
  avatarUrl,
  avatarFallback
}: MessageBubbleProps) {
  return (
    <div className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {!isOwn && (
        <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={senderName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] font-bold text-teal-600">{avatarFallback || '?'}</span>
          )}
        </div>
      )}
      <div className={`max-w-[75%] sm:max-w-[65%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed break-words shadow-sm ${
            isOwn
              ? 'bg-[#0d9b8a] text-white rounded-br-[4px]'
              : 'bg-white text-[#0f1f2e] border border-[#e8f0ee] rounded-bl-[4px]'
          }`}
        >
          {content}
        </div>
        <div className={`flex items-center gap-1.5 mt-1.5 text-[10px] text-[#7a9e99] ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className="font-medium">{isOwn ? 'You' : senderName}</span>
          <span>·</span>
          <span>{timestamp}</span>
        </div>
      </div>
    </div>
  );
}
