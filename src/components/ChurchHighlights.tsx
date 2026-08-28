import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { InfoCard, Section } from '@/components/Section';
import { colors, radii, WIDE_BREAKPOINT } from '@/constants/theme';
import {
  anniversaries as staticAnniversaries,
  announcements,
  birthdays as staticBirthdays,
  flowerSponsor,
  midweekService,
  upcomingEvents,
  type Anniversary,
  type Birthday,
} from '@/constants/homeContent';

/*
 * ==========================================
 * ChurchHighlights
 * ==========================================
 *
 * Shared between the public homepage (src/app/index.tsx) and the
 * signed-in Dashboard, so both read from the same place instead
 * of two copies drifting apart.
 *
 * variant="public" (the homepage): only Announcements and
 * Upcoming Events, since those are genuinely public information.
 * variant="full" (the default, used by the Dashboard): all six
 * sections, including Birthdays/Anniversaries/Flowers/Midweek
 * Service, which all name specific people and so stay behind the
 * authenticated admin session.
 *
 * Birthdays and Anniversaries default to the static placeholder
 * data, but a caller with real, appropriately-scoped data (e.g.
 * the Dashboard, via useUpcomingChurchEvents) can pass it in
 * instead — see each page for why they currently differ here.
 *
 * Below WIDE_BREAKPOINT (phone widths) these stack in a single
 * column, same as before. At or above it (tablet/web), they lay
 * out as a 2-column grid so more is visible without scrolling.
 */

type ChurchHighlightsProps = {
  variant?: 'full' | 'public';
  birthdays?: Birthday[];
  anniversaries?: Anniversary[];
};

export function ChurchHighlights({
  variant = 'full',
  birthdays = staticBirthdays,
  anniversaries = staticAnniversaries,
}: ChurchHighlightsProps = {}) {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  if (variant === 'public') {
    return (
      <View>
        {/* Announcements — one big, centered card per item */}

        {announcements.map((item) => (
          <View key={item.id} style={styles.announcementCard}>
            <Text style={styles.announcementEyebrow}>📢 Announcement</Text>
            <Text style={styles.announcementTitle}>{item.title}</Text>
            <Text style={styles.announcementDate}>{item.date}</Text>
            <Text style={styles.announcementText}>{item.text}</Text>
          </View>
        ))}

        {/* Upcoming Events */}

        <Section icon="📅" title="Upcoming Events" tintBg={colors.successBg} tintColor={colors.success}>
          {upcomingEvents.map((event) => (
            <InfoCard key={event.id} accentColor={colors.success}>
              <Text style={styles.cardDate}>{event.date}</Text>
              <Text style={styles.cardTitle}>{event.title}</Text>
              <Text style={styles.cardText}>{event.text}</Text>
            </InfoCard>
          ))}
        </Section>
      </View>
    );
  }

  return (
    <View style={isWide && styles.grid}>
      {/* Announcements */}

      <View style={isWide && styles.gridItem}>
        <Section icon="📢" title="Announcements" tintBg={colors.accentBg} tintColor={colors.accent}>
          {announcements.map((item) => (
            <InfoCard key={item.id} accentColor={colors.accent}>
              <Text style={styles.cardDate}>{item.date}</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardText}>{item.text}</Text>
            </InfoCard>
          ))}
        </Section>
      </View>

      {variant === 'full' && (
        <>
          {/* Birthdays */}

          <View style={isWide && styles.gridItem}>
            <Section icon="🎂" title="Birthdays This Week" tintBg={colors.pinkBg} tintColor={colors.pinkText}>
              <InfoCard accentColor={colors.pinkText}>
                {birthdays.length === 0 ? (
                  <Text style={styles.emptyText}>No birthdays this week.</Text>
                ) : (
                  birthdays.map((person, index) => (
                    <View key={person.id}>
                      <View style={styles.personRow}>
                        <Text style={styles.personName}>{person.name}</Text>
                        <Text style={styles.cardText}>{person.date}</Text>
                      </View>

                      {index < birthdays.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))
                )}
              </InfoCard>
            </Section>
          </View>

          {/* Anniversaries */}

          <View style={isWide && styles.gridItem}>
            <Section
              icon="💍"
              title="Wedding Anniversaries"
              tintBg={colors.violetBg}
              tintColor={colors.violetText}
            >
              <InfoCard accentColor={colors.violetText}>
                {anniversaries.length === 0 ? (
                  <Text style={styles.emptyText}>No wedding anniversaries this week.</Text>
                ) : (
                  anniversaries.map((couple, index) => (
                    <View key={couple.id}>
                      <View style={styles.personRow}>
                        <Text style={styles.personName}>{couple.names}</Text>
                        <Text style={styles.cardText}>{couple.date}</Text>
                      </View>

                      {index < anniversaries.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))
                )}
              </InfoCard>
            </Section>
          </View>

          {/* Flowers */}

          <View style={isWide && styles.gridItem}>
            <Section icon="🌸" title="Flowers — This Sunday" tintBg={colors.roseBg} tintColor={colors.roseText}>
              <InfoCard accentColor={colors.roseText}>
                <Text style={styles.cardLabel}>Sponsored by</Text>
                <Text style={styles.cardTitle}>{flowerSponsor.sponsoredBy}</Text>
                <Text style={styles.cardText}>{flowerSponsor.message}</Text>
              </InfoCard>
            </Section>
          </View>

          {/* Midweek Service */}

          <View style={isWide && styles.gridItem}>
            <Section
              icon="🎤"
              title="Midweek Service"
              tintBg={colors.adminStatusPendingBg}
              tintColor={colors.adminStatusPendingText}
            >
              <InfoCard accentColor={colors.adminStatusPendingText}>
                <Text style={styles.cardDate}>{midweekService.date}</Text>
                <Text style={styles.cardTitle}>{midweekService.title}</Text>

                <View style={styles.serviceRow}>
                  <Text style={styles.cardLabel}>Speaker</Text>
                  <Text style={styles.serviceValue}>{midweekService.speaker}</Text>
                </View>

                <View style={styles.serviceRow}>
                  <Text style={styles.cardLabel}>Presider</Text>
                  <Text style={styles.serviceValue}>{midweekService.presider}</Text>
                </View>
              </InfoCard>
            </Section>
          </View>
        </>
      )}

      {/* Upcoming Events */}

      <View style={isWide && styles.gridItem}>
        <Section icon="📅" title="Upcoming Events" tintBg={colors.successBg} tintColor={colors.success}>
          {upcomingEvents.map((event) => (
            <InfoCard key={event.id} accentColor={colors.success}>
              <Text style={styles.cardDate}>{event.date}</Text>
              <Text style={styles.cardTitle}>{event.title}</Text>
              <Text style={styles.cardText}>{event.text}</Text>
            </InfoCard>
          ))}
        </Section>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  announcementCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 32,
    paddingHorizontal: 24,
    marginBottom: 28,
  },

  announcementEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.accent,
    marginBottom: 10,
  },

  announcementTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },

  announcementDate: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 6,
  },

  announcementText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 14,
    maxWidth: 440,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  gridItem: {
    width: '48%',
  },

  cardDate: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 5,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  cardText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 5,
  },

  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  cardLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },

  personRow: {
    paddingVertical: 3,
  },

  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },

  serviceRow: {
    marginTop: 16,
  },

  serviceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 3,
  },
});
