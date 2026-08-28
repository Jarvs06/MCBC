import { usePathname, useRouter, type Href } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navItems } from '@/constants/navigation';
import { colors, radii, WIDE_BREAKPOINT } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

/*
 * ==========================================
 * AppShell
 * ==========================================
 *
 * Wraps every authenticated (app) route with a persistent
 * sidebar so a signed-in user can jump between pages without
 * going back through the dashboard.
 *
 * - Wide screens (tablet/web, >= WIDE_BREAKPOINT): the sidebar
 *   is always visible alongside the page content.
 * - Narrow screens (phone): the sidebar hides behind a
 *   hamburger button and slides in as an overlay drawer, so it
 *   never eats phone screen space.
 */

const SIDEBAR_WIDTH = 290;

export function AppShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const insets = useSafeAreaInsets();

  if (isWide) {
    return (
      <View style={styles.wideContainer}>
        <View style={styles.sidebar}>
          <SidebarContent />
        </View>

        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.narrowContainer}>
      <TopBar onMenuPress={() => setDrawerOpen(true)} />

      <View style={[styles.content, { paddingBottom: insets.bottom }]}>{children}</View>

      <Modal
        visible={drawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={styles.drawerOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDrawerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />

          <View style={styles.drawerPanel}>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

/*
 * ==========================================
 * Top bar (narrow screens)
 * ==========================================
 */

function TopBar({ onMenuPress }: { onMenuPress: () => void }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const currentLabel =
    navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ??
    'Church Admin';

  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
      <Pressable
        style={styles.menuButton}
        onPress={onMenuPress}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
      >
        <Text style={styles.menuIcon}>☰</Text>
      </Pressable>

      <Text style={styles.topBarTitle}>{currentLabel}</Text>
    </View>
  );
}

/*
 * ==========================================
 * Sidebar content
 * ==========================================
 *
 * Shared between the permanent wide-screen sidebar and the
 * narrow-screen drawer. `onNavigate` is only passed by the
 * drawer, so it can close itself after a link is tapped.
 */

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { profile, isSuperAdmin, signOut } = useAuth();

  const visibleItems = navItems.filter((item) => !item.superAdminOnly || isSuperAdmin);

  function goTo(href: Href) {
    router.push(href);
    onNavigate?.();
  }

  return (
    <View style={[styles.sidebarContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.brand}>
        <Text style={styles.brandTitle}>Church Admin</Text>
        <Text style={styles.brandSubtitle}>Administration Portal</Text>
      </View>

      <ScrollView style={styles.navList} contentContainerStyle={styles.navListContent}>
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Pressable
              key={item.key}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => goTo(item.href)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sidebarFooter}>
        {profile && (
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile.full_name.charAt(0).toUpperCase()}</Text>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile.full_name}
              </Text>

              <Text style={styles.profileRole}>{profile.role}</Text>
            </View>
          </View>
        )}

        <Pressable
          style={styles.signOutButton}
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

/*
 * ==========================================
 * Styles
 * ==========================================
 */

const styles = StyleSheet.create({
  // Wide layout

  wideContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },

  sidebar: {
    width: SIDEBAR_WIDTH,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
  },

  content: {
    flex: 1,
  },

  // Narrow layout

  narrowContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  menuButton: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  menuIcon: {
    fontSize: 18,
    color: colors.textPrimary,
  },

  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },

  drawerPanel: {
    width: SIDEBAR_WIDTH,
    maxWidth: '80%',
    backgroundColor: colors.surface,
  },

  // Sidebar content (shared)

  sidebarContent: {
    flex: 1,
  },

  brand: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },

  brandTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  brandSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  navList: {
    flex: 1,
  },

  navListContent: {
    paddingHorizontal: 12,
    gap: 2,
  },

  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: radii.sm,
  },

  navItemActive: {
    backgroundColor: colors.accentBg,
  },

  navIcon: {
    fontSize: 16,
    width: 20,
    textAlign: 'center',
  },

  navLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textLabel,
  },

  navLabelActive: {
    color: colors.accent,
  },

  sidebarFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },

  profileInfo: {
    flex: 1,
  },

  profileName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  profileRole: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },

  signOutButton: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },

  signOutText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textLabel,
  },
});
