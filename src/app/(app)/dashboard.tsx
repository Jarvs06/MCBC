import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChurchHighlights } from '@/components/ChurchHighlights';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useUpcomingChurchEvents } from '@/hooks/useUpcomingChurchEvents';

/*
 * ==========================================
 * Dashboard
 * ==========================================
 *
 * The sidebar (see @/components/AppShell) owns page navigation
 * and Sign Out, so this screen just greets the signed-in user
 * and then shows the same church-info sections as the public
 * homepage (see @/components/ChurchHighlights), so admins don't
 * have to leave the app to see what's current.
 */

export default function AdminDashboardScreen() {
  const { profile } = useAuth();
  const { birthdays, anniversaries } = useUpcomingChurchEvents();

  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading your account...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Overview of your account and the latest church updates.</Text>
      </View>

      <ChurchHighlights birthdays={birthdays} anniversaries={anniversaries} />
    </ScrollView>
  );
}

// ========================================
// Styles
// ========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: 24,
    paddingBottom: 60,
  },

  header: {
    marginBottom: 25,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },

  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.statusInactiveBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },

  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.statusInactiveText,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  loadingText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 12,
  },
});
