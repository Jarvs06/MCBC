import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InfoCard, Section } from '../components/Section';
import { colors, radii } from '../constants/theme';
import { supabase } from '../lib/supabase';

/*
 * ==========================================
 * PUBLIC HOMEPAGE
 * ==========================================
 *
 * Self-contained equivalent of the main app's ChurchHighlights
 * (variant="public") + src/app/index.tsx hero, merged into one
 * file since this project only ever needs the public variant —
 * no admin/full variant, no login CTA, no AuthProvider. Reads
 * only the two tables with a public (anon) RLS policy —
 * announcements and church_events — see the main app's
 * public-church-content migration for why flowers/midweek
 * service/birthdays/anniversaries stay off this page entirely
 * (they name real people).
 */

type Announcement = {
  id: string;
  title: string;
  body: string;
  start_date: string | null;
  start_time: string | null;
  end_time: string | null;
};

type UpcomingEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  location: string | null;
};

function todayDateString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function formatDate(value: string): string {
  const date = parseDateOnly(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
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

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const today = todayDateString();

      const [announcementsResult, eventsResult] = await Promise.all([
        supabase
          .from('announcements')
          .select('id, title, body, start_date, start_time, end_time')
          .eq('status', 'published')
          .or(`start_date.is.null,start_date.lte.${today}`)
          .or(`end_date.is.null,end_date.gte.${today}`)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('church_events')
          .select('id, title, description, event_date, start_time, location')
          .eq('status', 'published')
          .gte('event_date', today)
          .order('event_date', { ascending: true })
          .limit(5),
      ]);

      if (!mounted) return;

      if (announcementsResult.error) {
        console.error('[HOME] Load announcements error:', announcementsResult.error);
      } else {
        setAnnouncements((announcementsResult.data ?? []) as Announcement[]);
      }

      if (eventsResult.error) {
        console.error('[HOME] Load events error:', eventsResult.error);
      } else {
        setUpcomingEvents((eventsResult.data ?? []) as UpcomingEvent[]);
      }

      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="light" />

      <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeIcon}>⛪</Text>
        </View>

        <Text style={styles.heroEyebrow}>Church Name</Text>
        <Text style={styles.heroTitle}>Welcome to our Church</Text>

        <Text style={styles.heroSubtitle}>
          Stay updated with announcements and upcoming church activities and events.
        </Text>
      </View>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <>
            {announcements.length === 0 ? (
              <View style={styles.announcementCard}>
                <Text style={styles.announcementEyebrow}>📢 Announcement</Text>
                <Text style={styles.announcementText}>No announcements right now — check back soon.</Text>
              </View>
            ) : (
              announcements.map((item) => (
                <View key={item.id} style={styles.announcementCard}>
                  <Text style={styles.announcementEyebrow}>📢 Announcement</Text>
                  <Text style={styles.announcementTitle}>{item.title}</Text>
                  {!!item.start_date && (
                    <Text style={styles.announcementDate}>
                      {formatDate(item.start_date)}
                      {formatTimeRange(item.start_time, item.end_time)
                        ? ` · ${formatTimeRange(item.start_time, item.end_time)}`
                        : ''}
                    </Text>
                  )}
                  <Text style={styles.announcementText}>{item.body}</Text>
                </View>
              ))
            )}

            <Section icon="📅" title="Upcoming Events" tintBg={colors.successBg} tintColor={colors.success}>
              <InfoCard accentColor={colors.success}>
                {upcomingEvents.length === 0 ? (
                  <Text style={styles.emptyText}>No upcoming events right now.</Text>
                ) : (
                  upcomingEvents.map((event, index) => (
                    <View key={event.id}>
                      <Text style={styles.cardDate}>
                        {formatDate(event.event_date)}
                        {event.start_time ? ` · ${formatTime(event.start_time)}` : ''}
                      </Text>
                      <Text style={styles.cardTitle}>{event.title}</Text>
                      {!!event.description && <Text style={styles.cardText}>{event.description}</Text>}
                      {index < upcomingEvents.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))
                )}
              </InfoCard>
            </Section>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 50 },

  hero: {
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 20,
    paddingBottom: 46,
    borderBottomLeftRadius: radii.lg + 10,
    borderBottomRightRadius: radii.lg + 10,
  },

  brandBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  brandBadgeIcon: { fontSize: 18 },

  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.55)',
    marginBottom: 8,
  },
  heroTitle: { fontSize: 32, fontWeight: '800', color: colors.surface, lineHeight: 38 },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 10,
    maxWidth: 480,
  },

  body: { paddingHorizontal: 20, paddingTop: 34 },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },

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
  announcementTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  announcementDate: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 6 },
  announcementText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 14,
    maxWidth: 440,
  },

  emptyText: { fontSize: 14, color: colors.textSecondary },
  cardDate: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 5 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  cardText: { fontSize: 14, lineHeight: 21, color: colors.textSecondary, marginTop: 5 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
});
