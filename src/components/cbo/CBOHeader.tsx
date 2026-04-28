import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Menu, LogOut, UserCog, ChevronDown, X, CheckCircle2 } from 'lucide-react';
import type { User } from '../../types/user';
import { createPortal } from "react-dom";
import { useIsMobile } from "../../hooks/useIsMobile";

interface CBOHeaderProps {
  user: User;
  onLogout: () => void;
  onMenuClick: () => void;
  membershipRole?: 'owner' | 'admin' | 'member' | null;
  onAccountSettings?: () => void;
}

export function CBOHeader({ user, onLogout, onMenuClick, membershipRole, onAccountSettings }: CBOHeaderProps) {
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const isMobile = useIsMobile();
  const profileBtnRef = useRef<HTMLButtonElement | null>(null);
  void membershipRole;

  const initials = user.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();

  const profilePopoverPos = useMemo(() => {
    const btn = profileBtnRef.current;
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const width = 224;
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, r.right - width));
    return { top: r.bottom + 10, left, width };
  }, [showProfile]);

  useEffect(() => {
    if (!showProfile) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowProfile(false);
    const onScroll = () => setShowProfile(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [showProfile]);

  useEffect(() => {
    if (!isMobile) return;
    if (showNotifications) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showNotifications, isMobile]);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 h-14 md:h-16 flex items-center flex-shrink-0">
      <div className="w-full px-4 md:px-6 lg:px-8 flex items-center justify-between">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-50 transition-colors text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-2.5">
            <img
              src="/healthPowr-logo.png"
              alt="HealthPowr Logo"
              className="h-8 md:h-[40px] w-auto flex-shrink-0"
              draggable={false}
            />
            <span className="hidden sm:inline text-[16px] md:text-[18px] font-extrabold tracking-tight text-slate-900">
              <span className="text-teal-600">Health</span>
              <span className="text-emerald-500">Powr</span>
            </span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Right: Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Notification bell */}
          <div className="relative">
            <button 
              onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-50 transition-colors relative text-gray-500"
            >
              <Bell className="w-5 h-5" />
            </button>
            
            {showNotifications && (
              isMobile
                ? createPortal(
                    <>
                      <div
                        onClick={() => setShowNotifications(false)}
                        style={{
                          position: "fixed",
                          inset: 0,
                          zIndex: 9000,
                          backgroundColor: "rgba(15,23,42,0.4)",
                          backdropFilter: "blur(2px)",
                          opacity: showNotifications ? 1 : 0,
                          transition: "opacity 0.2s ease",
                          pointerEvents: showNotifications ? "all" : "none",
                        }}
                      />
                      <div
                        style={{
                          position: "fixed",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          zIndex: 9001,
                          maxHeight: "86vh",
                          minHeight: "45vh",
                          backgroundColor: "#ffffff",
                          borderRadius: "28px 28px 0 0",
                          boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
                          display: "flex",
                          flexDirection: "column",
                          transform: showNotifications ? "translateY(0)" : "translateY(100%)",
                          transition: "transform 0.4s cubic-bezier(0.34,1.1,0.64,1)",
                          paddingBottom: "env(safe-area-inset-bottom)",
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: "#e2e8f0",
                            margin: "12px auto 0",
                            flexShrink: 0,
                          }}
                        />
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
                          <div className="min-w-0">
                            <h3 className="text-base font-extrabold text-slate-900">Notifications</h3>
                            <p className="text-xs text-slate-400 mt-0.5">You’re up to date</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowNotifications(false)}
                            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
                            aria-label="Close"
                          >
                            <X className="w-4 h-4 text-slate-500" />
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto flex items-center justify-center px-6">
                          <div className="text-center">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                              <CheckCircle2 className="w-6 h-6 text-slate-400" />
                            </div>
                            <p className="text-sm font-semibold text-slate-700">All caught up</p>
                            <p className="text-xs text-slate-400 mt-1">No notifications yet.</p>
                          </div>
                        </div>
                      </div>
                    </>,
                    document.body,
                  )
                : (
                    <div
                      className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden"
                      style={{
                        width: 380,
                        maxWidth: "calc(100vw - 32px)",
                        right: 0,
                      }}
                    >
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
                        <div className="text-sm font-semibold text-slate-900">Notifications</div>
                      </div>
                      <div className="max-h-[380px] overflow-y-auto">
                        <div className="px-4 py-8 text-center text-sm text-slate-500">
                          No notifications yet.
                        </div>
                      </div>
                    </div>
                  )
            )}
          </div>

          <div className="h-6 w-px bg-gray-200 hidden md:block"></div>

          {/* Avatar */}
          <div className="relative">
            <button 
              ref={profileBtnRef}
              onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-gray-50 transition-colors text-left min-h-[44px]"
            >
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.name}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 object-cover shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-teal-50 flex items-center justify-center shadow-sm flex-shrink-0">
                  <span className="text-teal-600 font-semibold text-xs md:text-sm">
                    {initials}
                  </span>
                </div>
              )}
              <div className="hidden lg:block">
                <p className="text-[14px] font-medium text-gray-900 leading-tight">{user.name}</p>
                <p className="text-[12px] text-gray-400 mt-0.5">{user.organization}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 hidden lg:block" />
            </button>
            
            {showProfile && (
              createPortal(
                <>
                  <button
                    type="button"
                    aria-label="Close profile menu"
                    onClick={() => setShowProfile(false)}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 9000,
                      background: 'transparent',
                    }}
                  />
                  <div
                    className="bg-white rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.12)] border border-gray-100 overflow-hidden"
                    style={{
                      position: 'fixed',
                      zIndex: 9001,
                      top: profilePopoverPos?.top ?? 72,
                      left: profilePopoverPos?.left ?? 12,
                      width: profilePopoverPos?.width ?? 224,
                    }}
                  >
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                      <p className="font-semibold text-gray-900 text-sm">{user.name}</p>
                      <p className="text-[13px] text-gray-500 mt-0.5 truncate">{user.email}</p>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={() => { onAccountSettings?.(); setShowProfile(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[14px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors min-h-[44px]"
                      >
                        <UserCog className="w-[18px] h-[18px]" />
                        <span>Account Settings</span>
                      </button>
                      <div className="h-px bg-gray-100 my-1"></div>
                      <button
                        onClick={() => { onLogout(); setShowProfile(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[14px] font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[44px]"
                      >
                        <LogOut className="w-[18px] h-[18px]" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>,
                document.body,
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
