import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function scoreColor(score: number): string {
  if (score >= 0.7) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 0.4) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

export function scoreBadgeClass(score: number): string {
  if (score >= 0.7) return 'badge-green';
  if (score >= 0.4) return 'badge-amber';
  return 'badge-red';
}

export function formatScore(score: number): string {
  return (score * 100).toFixed(1) + '%';
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function proficiencyColor(p: string): string {
  const map: Record<string, string> = {
    advanced: 'badge-green',
    intermediate: 'badge-blue',
    beginner: 'badge-amber',
  };
  return map[p] ?? 'badge-purple';
}
