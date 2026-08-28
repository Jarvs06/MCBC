import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../constants/theme';

/*
 * Copied from the main app's src/components/Section.tsx (see
 * theme.ts for why this project keeps plain copies).
 */

type SectionProps = {
  icon: string;
  title: string;
  tintBg?: string;
  tintColor?: string;
  children: ReactNode;
};

export function Section({ icon, title, tintBg = colors.accentBg, tintColor = colors.accent, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.badge, { backgroundColor: tintBg }]}>
          <Text style={styles.badgeIcon}>{icon}</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: tintColor }]}>{title}</Text>
      </View>

      {children}
    </View>
  );
}

type InfoCardProps = {
  accentColor?: string;
  children: ReactNode;
};

export function InfoCard({ accentColor, children }: InfoCardProps) {
  return <View style={[styles.card, accentColor && { borderLeftWidth: 4, borderLeftColor: accentColor }]}>{children}</View>;
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 34,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },

  badge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeIcon: {
    fontSize: 18,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
});
