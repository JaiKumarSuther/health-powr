import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = 'hp_notifications_v1';
const MAX_NOTIFICATIONS = 200;
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function safeLoadFromStorage(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Omit<Notification, 'timestamp'> & { timestamp: string }>;
    const now = Date.now();
    const hydrated = parsed.map((n) => ({
      ...n,
      timestamp: new Date(n.timestamp),
    }));
    const cleaned = hydrated
      .filter((n) => Number.isFinite(n.timestamp.getTime()))
      .filter((n) => now - n.timestamp.getTime() <= TTL_MS)
      .slice(0, MAX_NOTIFICATIONS);
    // Persist the cleaned list immediately so storage doesn't grow unbounded.
    safeSaveToStorage(cleaned);
    return cleaned;
  } catch {
    return [];
  }
}

function safeSaveToStorage(notifications: Notification[]) {
  try {
    const trimmed = notifications.slice(0, MAX_NOTIFICATIONS);
    const serializable = trimmed.map((n) => ({
      ...n,
      timestamp: n.timestamp.toISOString(),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // ignore
  }
}

export const __TESTING__ = {
  STORAGE_KEY,
  MAX_NOTIFICATIONS,
  TTL_MS,
  safeLoadFromStorage,
  safeSaveToStorage,
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(() => safeLoadFromStorage());

  useEffect(() => {
    safeSaveToStorage(notifications);
  }, [notifications]);

  const addNotification = useCallback((notificationData: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notificationData,
      id: crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 11),
      timestamp: new Date(),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      markAsRead,
      removeNotification,
      clearAll,
      unreadCount
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}