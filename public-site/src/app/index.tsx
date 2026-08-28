import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, DateRow, dateBadge, formatTime, formatTimeRange, formatWeekday, monthDayBadge } from '../components/ChurchCard';
import { colors, radii } from '../constants/theme';
import { supabase } from '../lib/supabase';

/*
 * ==========================================
 * PUBLIC HOMEPAGE
 * ==========================================
 *
 * MCBC's real site design: hero, a Visit/Call/Email/Service-times
 * strip, the announcement/event/celebration cards, and a closing
 * banner — no header or footer (this is a single-page site with
 * nowhere else to navigate to).
 *
 * Announcements/events come straight from their tables (public
 * anon RLS policy, published rows only). Birthdays/anniversaries
 * come from `public_celebrations` instead of the `members` table
 * — a small, rotating, name + month/day-only cache kept in sync
 * by compile-weekly-digest, deliberately never exposing a birth
 * or wedding year. Flowers/midweek service still stay off this
 * page entirely — sponsor/speaker/presider names tied to a
 * specific date are more identifying than a first+last name and
 * a month/day, so that boundary stays as-is.
 *
 * Cards/rows come from ../components/ChurchCard — the same
 * component the public Pulse page uses.
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

type Celebration = {
  id: string;
  kind: 'birthday' | 'anniversary';
  display_name: string;
  month_day: string;
  day_label: string;
};

const WIDE_BREAKPOINT = 860;

function todayDateString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [birthdays, setBirthdays] = useState<Celebration[]>([]);
  const [anniversaries, setAnniversaries] = useState<Celebration[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const today = todayDateString();

      const [announcementsResult, eventsResult, celebrationsResult] = await Promise.all([
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
        supabase.from('public_celebrations').select('id, kind, display_name, month_day, day_label'),
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

      if (celebrationsResult.error) {
        console.error('[HOME] Load celebrations error:', celebrationsResult.error);
      } else {
        const celebrations = (celebrationsResult.data ?? []) as Celebration[];
        setBirthdays(celebrations.filter((entry) => entry.kind === 'birthday'));
        setAnniversaries(celebrations.filter((entry) => entry.kind === 'anniversary'));
      }

      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <StatusBar style="dark" />

      {/* ================================ HERO ================================ */}

      <View style={[styles.hero, isWide && styles.heroRow, { paddingTop: insets.top + 40 }]}>
        <View style={styles.heroText}>
          <Text style={styles.heroEyebrow}>Welcome to</Text>
          <Text style={styles.heroTitle}>Malagasang{'\n'}Conservative Baptist Church</Text>
          <View style={styles.heroDivider} />
          <Text style={styles.heroSubtitle}>
            To glorify God by strengthening the body for evangelism and discipleship with the mind to serve
            the community and plant churches.
          </Text>
        </View>

        {isWide && <ChurchGlyph />}
      </View>

      {/* ================================ CONTACT STRIP ================================ */}

      <View style={styles.body}>
        <View style={[styles.contactCard, isWide && styles.contactCardRow]}>
          <ContactItem icon="📍" label="Visit Us">
            <Text style={styles.contactValue}>Villa Susana, Malagasang II-A,</Text>
            <Text style={styles.contactValue}>Imus, Cavite, Philippines</Text>
          </ContactItem>

          <ContactItem icon="📞" label="Call Us">
            <Text style={styles.contactValue}>0968 853 9290</Text>
          </ContactItem>

          <ContactItem icon="✉️" label="Email Us">
            <Text style={styles.contactValue}>malagasangcbc2020@gmail.com</Text>
          </ContactItem>

          <ContactItem icon="🕐" label="Service Times">
            <Text style={styles.contactValue}>Sunday 8:00 AM & 10:00 AM</Text>
            <Text style={styles.contactValue}>Wednesday 7:00 PM</Text>
          </ContactItem>
        </View>

        {/* ================================ CARDS ================================ */}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <View style={[styles.cardGrid, isWide && styles.cardGridRow]}>
            <View style={isWide && styles.cardGridItem}>
              <Card icon="📢" title="Announcements">
                {announcements.length === 0 ? (
                  <Text style={styles.emptyText}>No announcements right now — check back soon.</Text>
                ) : (
                  announcements.map((item, index) => (
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
                      last={index === announcements.length - 1}
                    />
                  ))
                )}
              </Card>
            </View>

            <View style={isWide && styles.cardGridItem}>
              <Card icon="📅" title="Upcoming Events">
                {upcomingEvents.length === 0 ? (
                  <Text style={styles.emptyText}>No upcoming events right now.</Text>
                ) : (
                  upcomingEvents.map((event, index) => (
                    <DateRow
                      key={event.id}
                      badge={dateBadge(event.event_date)}
                      title={event.title}
                      subtitle={`${formatWeekday(event.event_date)} · ${event.start_time ? formatTime(event.start_time) : 'TBA'}`}
                      last={index === upcomingEvents.length - 1}
                    />
                  ))
                )}
              </Card>
            </View>

            <View style={isWide && styles.cardGridItem}>
              <Card icon="🎂" title="Birthdays This Week">
                {birthdays.length === 0 ? (
                  <Text style={styles.emptyText}>No birthdays this week.</Text>
                ) : (
                  birthdays.map((person, index) => (
                    <DateRow
                      key={person.id}
                      badge={monthDayBadge(person.month_day)}
                      title={person.display_name}
                      subtitle={person.day_label}
                      last={index === birthdays.length - 1}
                    />
                  ))
                )}
              </Card>
            </View>

            <View style={isWide && styles.cardGridItem}>
              <Card icon="💍" title="Wedding Anniversaries">
                {anniversaries.length === 0 ? (
                  <Text style={styles.emptyText}>No wedding anniversaries this week.</Text>
                ) : (
                  anniversaries.map((couple, index) => (
                    <DateRow
                      key={couple.id}
                      badge={monthDayBadge(couple.month_day)}
                      title={couple.display_name}
                      subtitle={couple.day_label}
                      last={index === anniversaries.length - 1}
                    />
                  ))
                )}
              </Card>
            </View>
          </View>
        )}

        {/* ================================ CTA BANNER ================================ */}

        <View style={[styles.banner, isWide && styles.bannerRow]}>
          <View style={styles.bannerHeading}>
            <Text style={styles.bannerIcon}>🌱</Text>
            <Text style={styles.bannerTitle}>Be a Part of What{'\n'}God is Doing</Text>
          </View>

          <Text style={styles.bannerText}>
            Whether you are visiting for the first time or looking for a church home, we welcome you with
            open hearts.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

/*
 * ==========================================
 * ContactItem
 * ==========================================
 */

function ContactItem({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <View style={styles.contactItem}>
      <View style={styles.contactIconBadge}>
        <Text style={styles.contactIcon}>{icon}</Text>
      </View>

      <View>
        <Text style={styles.contactLabel}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

/*
 * ==========================================
 * ChurchGlyph
 * ==========================================
 *
 * A small flat line illustration built from plain Views (no
 * image asset, no new dependency) — a simple nod to the site
 * design's hero sketch, in the same muted tone.
 */

function ChurchGlyph() {
  return (
    <View style={glyphStyles.wrap}>
      <View style={glyphStyles.crossV} />
      <View style={glyphStyles.crossH} />
      <View style={glyphStyles.roof} />
      <View style={glyphStyles.body}>
        <View style={glyphStyles.door} />
        <View style={[glyphStyles.window, glyphStyles.windowLeft]} />
        <View style={[glyphStyles.window, glyphStyles.windowRight]} />
      </View>
      <View style={glyphStyles.ground} />
    </View>
  );
}

const GLYPH_TONE = '#c9c2ad';

const glyphStyles = StyleSheet.create({
  wrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  crossV: {
    position: 'absolute',
    top: 6,
    width: 3,
    height: 22,
    backgroundColor: GLYPH_TONE,
  },
  crossH: {
    position: 'absolute',
    top: 14,
    width: 15,
    height: 3,
    backgroundColor: GLYPH_TONE,
  },
  roof: {
    width: 0,
    height: 0,
    borderLeftWidth: 78,
    borderRightWidth: 78,
    borderBottomWidth: 60,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: GLYPH_TONE,
    marginTop: 34,
  },
  body: {
    width: 148,
    height: 100,
    borderWidth: 3,
    borderColor: GLYPH_TONE,
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 14,
  },
  door: {
    position: 'absolute',
    bottom: 0,
    width: 26,
    height: 44,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: GLYPH_TONE,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
  },
  window: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: GLYPH_TONE,
    borderRadius: 3,
  },
  windowLeft: { marginRight: 40 },
  windowRight: { marginLeft: 40 },
  ground: {
    width: 190,
    height: 3,
    backgroundColor: GLYPH_TONE,
    marginTop: 10,
  },
});

// ==========================================
// Styles
// ==========================================

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  pageContent: { flexGrow: 1, paddingBottom: 40 },

  hero: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 48,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  heroText: { maxWidth: 560 },

  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  heroDivider: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginVertical: 18,
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 25,
    color: colors.textSecondary,
  },

  body: { paddingHorizontal: 24, paddingBottom: 56, maxWidth: 1100, alignSelf: 'center', width: '100%' },

  contactCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 22,
    gap: 20,
    marginBottom: 32,
  },
  contactCardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  contactItem: { flexDirection: 'row', gap: 12, flexShrink: 1 },
  contactIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactIcon: { fontSize: 16 },
  contactLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
  contactValue: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  loadingContainer: { paddingVertical: 40, alignItems: 'center' },

  cardGrid: { gap: 20, marginBottom: 32 },
  cardGridRow: { flexDirection: 'row', flexWrap: 'wrap' },
  cardGridItem: { flexBasis: '45%', flexGrow: 1 },

  emptyText: { fontSize: 14, color: colors.textSecondary },

  banner: {
    backgroundColor: colors.bannerBg,
    borderRadius: radii.lg,
    padding: 26,
    gap: 16,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bannerIcon: { fontSize: 22 },
  bannerTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: colors.textPrimary },
  bannerText: { fontSize: 14, lineHeight: 21, color: colors.textSecondary, maxWidth: 380 },
});
