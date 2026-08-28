/**
 * Design tokens for the public site. Mirrors the main app's
 * src/constants/theme.ts — kept as a plain copy rather than a
 * shared import, since this project is intentionally an
 * isolated Expo project (its own package.json/app.json) so
 * that no admin-panel or login code can ever end up in what
 * gets exported and deployed to GitHub Pages.
 */

export const colors = {
  background: '#f8fafc',
  surface: '#ffffff',

  border: '#e5e7eb',
  borderInput: '#d1d5db',

  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  textLabel: '#374151',

  accent: '#2563eb',
  accentBg: '#eff6ff',

  danger: '#dc2626',
  dangerBg: '#fef2f2',
  dangerBorder: '#fecaca',

  success: '#15803d',
  successBg: '#f0fdf4',

  // Section accent tints
  pinkBg: '#fdf2f8',
  pinkText: '#be185d',
  violetBg: '#f5f3ff',
  violetText: '#6d28d9',
  roseBg: '#fff1f2',
  roseText: '#be123c',
  adminStatusPendingBg: '#fffbeb',
  adminStatusPendingText: '#b45309',
} as const;

export const radii = {
  sm: 9,
  md: 10,
  lg: 14,
  pill: 20,
} as const;
