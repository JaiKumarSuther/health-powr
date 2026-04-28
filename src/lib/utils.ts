import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AVATAR_COLORS = [
  '#0D9488', // teal-600
  '#D97706', // amber-600
  '#0F766E', // teal-700
  '#5B21B6', // violet-800
  '#475569', // slate-600
  '#DC2626', // red-600
] as const;

export function getAvatarColor(name: string) {
  const s = (name ?? '').trim();
  if (!s) return AVATAR_COLORS[0];
  const idx = s.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export function getInitials(name: string, max = 2) {
  const tokens = (name ?? '')
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  if (tokens.length === 0) return '—';
  const initials = tokens
    .slice(0, max)
    .map((t) => t[0]?.toUpperCase() ?? '')
    .join('');
  return initials || '—';
}
