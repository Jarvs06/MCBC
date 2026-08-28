import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InfoCard, Section } from '../../components/Section';
import { colors, radii } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

/*
 * ==========================================
 * PUBLIC WEEKLY PULSE
 * ==========================================
 *
 * Copy of the main app's src/app/pulse/[token].tsx, kept
 * byte-for-byte equivalent in behavior (see theme.ts for why
 * this project uses plain copies instead of cross-project
 * imports). If that file changes, mirror the change here.
 */

type DigestContent = {
  announcements: {
    id: string;
    title: string;
    body: string;
    start_date: string | null;
    end_date: string | null;
    start_time: string | null;
    end_time: string | null;
  }[];
  events: {
    id: string;
    title: string;
    description: string | null;
    event_date: string;
    start_time: string | null;
    end_time: string | null;
    location: string | null;
  }[];
  flowerSponsor?: { service_date: string; sponsored_by: string; message: string | null; arrangement: string | null } | null;
  midweekService?: { service_date: string; service_time: string | null; speaker: string | null; presider: string | null } | null;
  birthdays?: { id: string; name: string; date: string; dayLabel: string }[];
  anniversaries?: { id: string; names: string; date: string; dayLabel: string }[];
};

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function formatWeekRange(start: string, end: string): string {
  const startMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  const endMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(end);
  if (!startMatch || !endMatch) return `${start} – ${end}`;
  const startDate = new Date(Date.UTC(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3])));
  const endDate = new Date(Date.UTC(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3])));
  return `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}

function formatTime(value: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatTimeRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  return [start, end].filter((value): value is string => !!value).map(formatTime).join(' – ');
}

export default function PublicPulseScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [weekRange, setWeekRange] = useState<string | null>(null);
  const [content, setContent] = useState<DigestContent | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!token) {
        if (mounted) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('get-weekly-digest', {
          body: { token },
        });

        if (!mounted) return;

        if (error || !data?.success) {
          setNotFound(true);
          return;
        }

        setWeekRange(formatWeekRange(data.week_start, data.week_end));
        setContent(data.content as DigestContent);
      } catch (loadError) {
        console.error('[PUBLIC PULSE] Load error:', loadError);
        if (mounted) setNotFound(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [token]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (notFound || !content) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: insets.top }]}>
        <Text style={styles.notFoundIcon}>📰</Text>
        <Text style={styles.notFoundTitle}>This link isn&apos;t available</Text>
        <Text style={styles.notFoundText}>The weekly pulse you&apos;re looking for may have been unpublished.</Text>
      </View>
    );
  }

  const hasPrivateSections = content.birthdays !== undefined;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.heroEyebrow}>Weekly Pulse</Text>
        <Text style={styles.heroTitle}>{weekRange}</Text>
      </View>

      <View style={styles.body}>
        <Section icon="📢" title="Announcements" tintBg={colors.accentBg} tintColor={colors.accent}>
          <InfoCard accentColor={colors.accent}>
            {content.announcements.length === 0 ? (
              <Text style={styles.emptyText}>No announcements this week.</Text>
            ) : (
              content.announcements.map((item, index) => (
                <View key={item.id}>
                  {!!item.start_date && (
                    <Text style={styles.cardDate}>
                      {formatDate(item.start_date)}
                      {formatTimeRange(item.start_time, item.end_time)
                        ? ` · ${formatTimeRange(item.start_time, item.end_time)}`
                        : ''}
                    </Text>
                  )}
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardText}>{item.body}</Text>
                  {index < content.announcements.length - 1 && <View style={styles.divider} />}
                </View>
              ))
            )}
          </InfoCard>
        </Section>

        {hasPrivateSections && (
          <>
            <Section icon="🎂" title="Birthdays" tintBg={colors.pinkBg} tintColor={colors.pinkText}>
              <InfoCard accentColor={colors.pinkText}>
                {(content.birthdays ?? []).length === 0 ? (
                  <Text style={styles.emptyText}>No birthdays this week.</Text>
                ) : (
                  (content.birthdays ?? []).map((person, index) => (
                    <View key={person.id}>
                      <View style={styles.personRow}>
                        <Text style={styles.personName}>{person.name}</Text>
                        <Text style={styles.cardText}>{person.date}</Text>
                      </View>
                      {index < (content.birthdays ?? []).length - 1 && <View style={styles.divider} />}
                    </View>
                  ))
                )}
              </InfoCard>
            </Section>

            <Section icon="💍" title="Wedding Anniversaries" tintBg={colors.violetBg} tintColor={colors.violetText}>
              <InfoCard accentColor={colors.violetText}>
                {(content.anniversaries ?? []).length === 0 ? (
                  <Text style={styles.emptyText}>No wedding anniversaries this week.</Text>
                ) : (
                  (content.anniversaries ?? []).map((couple, index) => (
                    <View key={couple.id}>
                      <View style={styles.personRow}>
                        <Text style={styles.personName}>{couple.names}</Text>
                        <Text style={styles.cardText}>{couple.date}</Text>
                      </View>
                      {index < (content.anniversaries ?? []).length - 1 && <View style={styles.divider} />}
                    </View>
                  ))
                )}
              </InfoCard>
            </Section>

            <Section icon="🌸" title="Flowers" tintBg={colors.roseBg} tintColor={colors.roseText}>
              <InfoCard accentColor={colors.roseText}>
                {content.flowerSponsor ? (
                  <>
                    <Text style={styles.cardDate}>{formatDate(content.flowerSponsor.service_date)}</Text>
                    <Text style={styles.cardLabel}>Sponsored by</Text>
                    <Text style={styles.cardTitle}>{content.flowerSponsor.sponsored_by}</Text>
                    {!!content.flowerSponsor.arrangement && (
                      <Text style={styles.cardText}>Arrangement: {content.flowerSponsor.arrangement}</Text>
                    )}
                    {!!content.flowerSponsor.message && <Text style={styles.cardText}>{content.flowerSponsor.message}</Text>}
                  </>
                ) : (
                  <Text style={styles.emptyText}>No flower sponsor set for this week.</Text>
                )}
              </InfoCard>
            </Section>

            <Section icon="🎤" title="Midweek Service" tintBg={colors.adminStatusPendingBg} tintColor={colors.adminStatusPendingText}>
              <InfoCard accentColor={colors.adminStatusPendingText}>
                {content.midweekService ? (
                  <>
                    <Text style={styles.cardDate}>
                      {formatDate(content.midweekService.service_date)}
                      {content.midweekService.service_time ? ` · ${formatTime(content.midweekService.service_time)}` : ''}
                    </Text>
                    <Text style={styles.cardLabel}>Speaker</Text>
                    <Text style={styles.cardTitle}>{content.midweekService.speaker || '—'}</Text>
                    <Text style={[styles.cardLabel, { marginTop: 10 }]}>Presider</Text>
                    <Text style={styles.cardTitle}>{content.midweekService.presider || '—'}</Text>
                  </>
                ) : (
                  <Text style={styles.emptyText}>No midweek service scheduled this week.</Text>
                )}
              </InfoCard>
            </Section>
          </>
        )}

        <Section icon="📅" title="Events" tintBg={colors.successBg} tintColor={colors.success}>
          <InfoCard accentColor={colors.success}>
            {content.events.length === 0 ? (
              <Text style={styles.emptyText}>No events this week.</Text>
            ) : (
              content.events.map((event, index) => (
                <View key={event.id}>
                  <Text style={styles.cardDate}>
                    {formatDate(event.event_date)}
                    {formatTimeRange(event.start_time, event.end_time)
                      ? ` · ${formatTimeRange(event.start_time, event.end_time)}`
                      : ''}
                  </Text>
                  <Text style={styles.cardTitle}>{event.title}</Text>
                  {!!event.description && <Text style={styles.cardText}>{event.description}</Text>}
                  {!!event.location && <Text style={styles.cardText}>📍 {event.location}</Text>}
                  {index < content.events.length - 1 && <View style={styles.divider} />}
                </View>
              ))
            )}
          </InfoCard>
        </Section>
      </View>
    </ScrollView>
  );
}

// ==========================================
// Styles
// ==========================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 50 },

  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },

  notFoundIcon: { fontSize: 40, marginBottom: 14 },
  notFoundTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  notFoundText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
  },

  hero: {
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: radii.lg + 10,
    borderBottomRightRadius: radii.lg + 10,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.55)',
    marginBottom: 8,
  },
  heroTitle: { fontSize: 28, fontWeight: '800', color: colors.surface },

  body: { paddingHorizontal: 20, paddingTop: 34 },

  emptyText: { fontSize: 14, color: colors.textSecondary },

  cardDate: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 5 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  cardText: { fontSize: 14, lineHeight: 21, color: colors.textSecondary, marginTop: 5 },
  cardLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },

  personRow: { paddingVertical: 3 },
  personName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
});
