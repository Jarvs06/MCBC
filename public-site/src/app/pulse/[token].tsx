import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Card,
  DateRow,
  dateBadge,
  formatDate,
  formattedDateBadge,
  formatTime,
  formatTimeRange,
  formatWeekday,
} from '../../components/ChurchCard';
import { colors, radii } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

/*
 * ==========================================
 * PUBLIC WEEKLY PULSE
 * ==========================================
 *
 * Top-level route (outside (app)/), reached only via a share
 * link — no AppShell sidebar, same visual weight as the public
 * homepage. Renders directly from get-weekly-digest's response
 * rather than through a self-fetching component, since that
 * response is already whatever an anonymous or admin caller is
 * allowed to see — this screen just renders it, checking for the
 * privileged-only fields before showing those sections.
 *
 * Cards/rows come from ../../components/ChurchCard — the same
 * component the homepage uses.
 */

const WIDE_BREAKPOINT = 860;

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

function formatWeekRange(start: string, end: string): string {
  const startMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  const endMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(end);
  if (!startMatch || !endMatch) return `${start} – ${end}`;
  const startDate = new Date(Date.UTC(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3])));
  const endDate = new Date(Date.UTC(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3])));
  return `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}

export default function PublicPulseScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

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
        <ActivityIndicator size="large" color={colors.accent} />
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

      <View style={[styles.body, isWide && styles.grid]}>
        <View style={isWide && styles.gridItem}>
          <Card icon="📢" title="Announcements">
            {content.announcements.length === 0 ? (
              <Text style={styles.emptyText}>No announcements this week.</Text>
            ) : (
              content.announcements.map((item, index) => (
                <DateRow
                  key={item.id}
                  badge={item.start_date ? dateBadge(item.start_date) : 'tba'}
                  title={item.title}
                  subtitle={
                    item.start_date
                      ? `${formatWeekday(item.start_date)} · ${
                          formatTimeRange(item.start_time, item.end_time) ?? 'TBA'
                        }`
                      : 'TBA'
                  }
                  last={index === content.announcements.length - 1}
                />
              ))
            )}
          </Card>
        </View>

        {hasPrivateSections && (
          <>
            <View style={isWide && styles.gridItem}>
              <Card icon="🎂" title="Birthdays" tintBg={colors.sageBg}>
                {(content.birthdays ?? []).length === 0 ? (
                  <Text style={styles.emptyText}>No birthdays this week.</Text>
                ) : (
                  (content.birthdays ?? []).map((person, index) => (
                    <DateRow
                      key={person.id}
                      badge={formattedDateBadge(person.date)}
                      title={person.name}
                      subtitle={person.dayLabel}
                      last={index === (content.birthdays ?? []).length - 1}
                    />
                  ))
                )}
              </Card>
            </View>

            <View style={isWide && styles.gridItem}>
              <Card icon="💍" title="Wedding Anniversaries" tintBg={colors.clayBg}>
                {(content.anniversaries ?? []).length === 0 ? (
                  <Text style={styles.emptyText}>No wedding anniversaries this week.</Text>
                ) : (
                  (content.anniversaries ?? []).map((couple, index) => (
                    <DateRow
                      key={couple.id}
                      badge={formattedDateBadge(couple.date)}
                      title={couple.names}
                      subtitle={couple.dayLabel}
                      last={index === (content.anniversaries ?? []).length - 1}
                    />
                  ))
                )}
              </Card>
            </View>

            <View style={isWide && styles.gridItem}>
              <Card icon="🌸" title="Flowers" tintBg={colors.goldBg}>
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
              </Card>
            </View>

            <View style={isWide && styles.gridItem}>
              <Card icon="🎤" title="Midweek Service" tintBg={colors.brickBg}>
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
              </Card>
            </View>
          </>
        )}

        <View style={isWide && styles.gridItem}>
          <Card icon="📅" title="Events">
            {content.events.length === 0 ? (
              <Text style={styles.emptyText}>No events this week.</Text>
            ) : (
              content.events.map((event, index) => (
                <DateRow
                  key={event.id}
                  badge={dateBadge(event.event_date)}
                  title={event.title}
                  subtitle={`${formatWeekday(event.event_date)} · ${
                    formatTimeRange(event.start_time, event.end_time) ?? 'TBA'
                  }`}
                  last={index === content.events.length - 1}
                />
              ))
            )}
          </Card>
        </View>
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
    backgroundColor: colors.accent,
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
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
  },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#ffffff' },

  body: { paddingHorizontal: 20, paddingTop: 34 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  gridItem: { flexBasis: '45%', flexGrow: 1 },

  emptyText: { fontSize: 14, color: colors.textSecondary },

  cardDate: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 5 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardText: { fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 3 },
  cardLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
});
