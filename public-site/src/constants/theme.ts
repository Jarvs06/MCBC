/**
 * Design tokens for the public site — the warm cream / forest
 * green palette from MCBC's actual site design (hero, contact
 * strip, announcement/event cards, CTA banner). Mirrors the main
 * app's src/constants/theme.ts in shape only; the values here are
 * deliberately different since this project owns its own visual
 * identity. Kept as a plain copy rather than a shared import (see
 * this file's own history for why this project stays isolated).
 */

export const colors = {
  background: '#f8f6f0',
  surface: '#ffffff',

  border: '#e6e1d6',
  borderInput: '#d8d2c4',

  textPrimary: '#20261f',
  textSecondary: '#6b6558',
  textMuted: '#948d7c',
  textLabel: '#3a4238',

  // Deep forest green — the site's one accent color, used for
  // the eyebrow divider, badge icon text, and the CTA banner.
  accent: '#1f3d2e',
  accentBg: '#e8ede1',

  danger: '#b3402f',
  dangerBg: '#fbeeec',

  success: '#1f3d2e',
  successBg: '#e8ede1',

  // CTA banner ground — a soft tan, distinct from the page's cream.
  bannerBg: '#eeeadf',

  // Section tints for the Pulse page's admin-only sections
  // (Birthdays/Anniversaries/Flowers/Midweek Service) — warm
  // variations that stay in the same family as the accent green
  // rather than the old cool pink/violet/rose set.
  sageBg: '#eef1e6',
  sageText: '#4a5c3a',
  clayBg: '#f3e9e0',
  clayText: '#8a5a3a',
  goldBg: '#f6efdd',
  goldText: '#8a6d1f',
  brickBg: '#f3e5e0',
  brickText: '#9a4a35',
} as const;

export const radii = {
  sm: 9,
  md: 10,
  lg: 14,
  pill: 20,
} as const;
