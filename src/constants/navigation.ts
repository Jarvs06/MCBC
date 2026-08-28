/*
 * ==========================================
 * Sidebar navigation items
 * ==========================================
 *
 * Single source of truth for the authenticated app's sidebar
 * (see @/components/AppShell). Centralized here so a new page
 * only needs one new entry instead of touching layout code.
 */

import type { Href } from 'expo-router';

export type NavItem = {
  key: string;
  label: string;
  icon: string;
  href: Href;
  superAdminOnly?: boolean;
};

export const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/dashboard' },
  { key: 'members', label: 'Members', icon: '👥', href: '/members' },
  { key: 'admin-users', label: 'Admin Users', icon: '🛡️', href: '/admin-users', superAdminOnly: true },
  { key: 'announcements', label: 'Announcements', icon: '📢', href: '/announcements' },
  { key: 'flowers', label: 'Flowers', icon: '🌸', href: '/flowers' },
  { key: 'services', label: 'Services', icon: '🎤', href: '/services' },
  { key: 'events', label: 'Events', icon: '📅', href: '/events' },
];
