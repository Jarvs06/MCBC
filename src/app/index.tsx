import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChurchHighlights } from '@/components/ChurchHighlights';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const { session, profile, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();

  const isLoggedIn = !!session && !!profile;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Dark hero needs light status bar icons for contrast; reverts
          automatically when this screen unmounts. */}
      <StatusBar style="light" />

      {/* ================================ HERO ================================ */}

      <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <View style={styles.heroTopRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeIcon}>⛪</Text>
          </View>

          {!authLoading && (
            <Link href={isLoggedIn ? './dashboard' : '/login'} asChild>
              <Pressable
                style={styles.heroCta}
                accessibilityRole="button"
                accessibilityLabel={isLoggedIn ? 'Go to dashboard' : 'Admin login'}
              >
                <Text style={styles.heroCtaText}>{isLoggedIn ? 'Dashboard' : 'Admin Login'}</Text>
              </Pressable>
            </Link>
          )}
        </View>

        <Text style={styles.heroEyebrow}>Church Name</Text>
        <Text style={styles.heroTitle}>Welcome to our Church</Text>

        <Text style={styles.heroSubtitle}>
          Stay updated with announcements and upcoming church activities and events.
        </Text>
      </View>

      <View style={styles.body}>
        <ChurchHighlights variant="public" />
      </View>
    </ScrollView>
  );
}

/*
 * ==========================================
 * GLANCE STAT
 * ==========================================
 */

function GlanceStat({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <View style={styles.glanceStat}>
      <Text style={styles.glanceIcon}>{icon}</Text>
      <Text style={styles.glanceValue}>{value}</Text>
      <Text style={styles.glanceLabel}>
        {label}
        {value === 1 ? '' : 's'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingBottom: 50,
  },

  // Hero

  hero: {
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 46,
    borderBottomLeftRadius: radii.lg + 10,
    borderBottomRightRadius: radii.lg + 10,
  },

  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  brandBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandBadgeIcon: {
    fontSize: 18,
  },

  heroCta: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },

  heroCtaText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },

  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.55)',
    marginBottom: 8,
  },

  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.surface,
    lineHeight: 38,
  },

  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 10,
    maxWidth: 480,
  },

  // At a glance (floats over the hero's bottom edge)

  glanceCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginHorizontal: 20,
    marginTop: -28,
    paddingVertical: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },

  glanceStat: {
    flex: 1,
    alignItems: 'center',
  },

  glanceDivider: {
    width: 1,
    backgroundColor: colors.border,
  },

  glanceIcon: {
    fontSize: 18,
    marginBottom: 4,
  },

  glanceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },

  glanceLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Body

  body: {
    paddingHorizontal: 20,
    paddingTop: 34,
  },

  footer: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  footerIcon: {
    fontSize: 20,
    marginBottom: 6,
  },

  footerText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  footerSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
});
