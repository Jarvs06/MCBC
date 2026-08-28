/**
 * Design tokens for the app. Single flat palette (no light/dark
 * mode split) — see `colors`, `radii`, and `spacing` below.
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

  statusActiveBg: '#dcfce7',
  statusActiveText: '#166534',
  statusInactiveBg: '#f3f4f6',
  statusInactiveText: '#4b5563',
  statusTransferredBg: '#fef3c7',
  statusTransferredText: '#92400e',


  adminStatusActiveBg: '#ecfdf5',
  adminStatusActiveText: '#047857',
  adminStatusPendingBg: '#fffbeb',
  adminStatusPendingText: '#b45309',
  adminStatusDisabledBg: '#fef2f2',
  adminStatusDisabledText: '#b91c1c',

  // Section accent tints (homepage section icon badges)
  pinkBg: '#fdf2f8',
  pinkText: '#be185d',
  violetBg: '#f5f3ff',
  violetText: '#6d28d9',
  roseBg: '#fff1f2',
  roseText: '#be123c',
} as const;

export const radii = {
  sm: 9,
  md: 10,
  lg: 14,
  pill: 20,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/**
 * Screen width (in dp) at which layouts switch from a
 * phone-style single column to a wider tablet/web layout — the
 * sidebar (AppShell) and the church-info grid (ChurchHighlights)
 * both key off this same value so "wide" means the same thing
 * everywhere.
 */
export const WIDE_BREAKPOINT = 900;