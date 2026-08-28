import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Card,
  currentWeekStart,
  DateRow,
  dateBadge,
  formatDate,
  formatTime,
  formatTimeRange,
  formatWeekday,
  monthDayBadge,
  splitByWeek,
  WeekDivider,
} from '../components/ChurchCard';
import { colors, radii } from '../constants/theme';
import { supabase } from '../lib/supabase';

/*
 * ==========================================
 * PUBLIC HOMEPAGE
 * ==========================================
 *
 * MCBC's real site design: hero (with the service schedule), a
 * Visit/Call/Email link strip, the announcement/event/celebration/
 * flowers/midweek-service cards, and a closing banner — no header
 * or footer (this is a single-page site with nowhere else to
 * navigate to).
 *
 * Announcements/events come straight from their tables (public
 * anon RLS policy, published rows only). Birthdays/anniversaries
 * come from `public_celebrations` instead of the `members` table
 * — a small, rotating, name + month/day-only cache kept in sync
 * by compile-weekly-digest, deliberately never exposing a birth
 * or wedding year. Flowers/Midweek Service come from the
 * `*_public` views rather than the base tables — both base tables
 * carry a `notes` column that was never meant to be public (see
 * the public-flowers-midweek migration).
 *
 * Cards/rows come from ../components/ChurchCard — the same
 * component the public Pulse page uses.
 */

const MAPS_URL = 'https://maps.app.goo.gl/cRsnrSphFAg5B5ej7';
const PHONE_URL = 'tel:09688539290';
const EMAIL_URL = 'mailto:malagasangcbc2020@gmail.com';

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
  week_start: string;
};

type FlowerSponsor = { service_date: string; sponsored_by: string; message: string | null };

type MidweekService = {
  service_date: string;
  service_time: string | null;
  speaker: string | null;
  presider: string | null;
};

const WIDE_BREAKPOINT = 860;

function todayDateString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/** This week's + next week's Monday-Sunday bounds, as local
 * 'YYYY-MM-DD' strings — Flowers/Midweek Service show one record
 * per week, so their query spans both weeks instead of just
 * grabbing the next upcoming row regardless of how far out it is. */
function getTwoWeekWindow(): { thisWeekStart: string; thisWeekEnd: string; nextWeekEnd: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);

  const format = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const thisWeekEnd = new Date(monday);
  thisWeekEnd.setDate(monday.getDate() + 6);

  const nextWeekEnd = new Date(monday);
  nextWeekEnd.setDate(monday.getDate() + 13);

  return { thisWeekStart: format(monday), thisWeekEnd: format(thisWeekEnd), nextWeekEnd: format(nextWeekEnd) };
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
  const [flowerSponsors, setFlowerSponsors] = useState<FlowerSponsor[]>([]);
  const [midweekServices, setMidweekServices] = useState<MidweekService[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const today = todayDateString();
      const { thisWeekStart, nextWeekEnd } = getTwoWeekWindow();

      const [announcementsResult, eventsResult, celebrationsResult, flowersResult, serviceResult] = await Promise.all([
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
        supabase.from('public_celebrations').select('id, kind, display_name, month_day, day_label, week_start'),
        supabase
          .from('flower_sponsors_public')
          .select('service_date, sponsored_by, message')
          .gte('service_date', thisWeekStart)
          .lte('service_date', nextWeekEnd)
          .order('service_date', { ascending: true })
          .limit(2),
        supabase
          .from('midweek_services_public')
          .select('service_date, service_time, speaker, presider')
          .gte('service_date', thisWeekStart)
          .lte('service_date', nextWeekEnd)
          .order('service_date', { ascending: true })
          .limit(2),
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

      if (flowersResult.error) {
        console.error('[HOME] Load flowers error:', flowersResult.error);
      } else {
        setFlowerSponsors((flowersResult.data ?? []) as FlowerSponsor[]);
      }

      if (serviceResult.error) {
        console.error('[HOME] Load midweek service error:', serviceResult.error);
      } else {
        setMidweekServices((serviceResult.data ?? []) as MidweekService[]);
      }

      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const thisWeekStart = currentWeekStart();
  const { thisWeekEnd } = getTwoWeekWindow();

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

        {/* ================================ SERVICE TIMES ================================ */}

        <View style={styles.serviceTimesCard}>
          <Text style={styles.serviceTimesLabel}>🕐 Service Times</Text>

          <ServiceTimeRow name="Sunday School" value="8:00 AM – 9:00 AM" />
          <ServiceTimeRow name="Worship Service" value="9:00 AM – 11:00 AM" />
          <ServiceTimeRow name="Midweek Service (Wednesday)" value="7:00 PM" />
        </View>
      </View>

      {/* ================================ CONTACT STRIP ================================ */}

      <View style={styles.body}>
        <View style={[styles.contactCard, isWide && styles.contactCardRow]}>
          <ContactItem
            icon="📍"
            label="Visit Us"
            value={['Villa Susana, Imus, Cavite']}
            href={MAPS_URL}
            external
          />
          <ContactItem icon="📞" label="Call Us" value="0968 853 9290" href={PHONE_URL} />
          <ContactItem icon="✉️" label="Email Us" value="malagasangcbc2020@gmail.com" href={EMAIL_URL} />
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
              <Card icon="🎂" title="Birthdays" tintBg={colors.sageBg}>
                {(() => {
                  const { thisWeek, nextWeek } = splitByWeek(birthdays, thisWeekStart);
                  return (
                    <>
                      {thisWeek.length === 0 ? (
                        <Text style={styles.emptyText}>No birthday celebrant this week.</Text>
                      ) : (
                        thisWeek.map((person, index) => (
                          <DateRow
                            key={person.id}
                            badge={monthDayBadge(person.month_day)}
                            title={person.display_name}
                            subtitle={person.day_label}
                            last={index === thisWeek.length - 1}
                          />
                        ))
                      )}

                      <WeekDivider label="Next Week" />

                      {nextWeek.length === 0 ? (
                        <Text style={styles.emptyText}>No birthday celebrant next week.</Text>
                      ) : (
                        nextWeek.map((person, index) => (
                          <DateRow
                            key={person.id}
                            badge={monthDayBadge(person.month_day)}
                            title={person.display_name}
                            subtitle={person.day_label}
                            last={index === nextWeek.length - 1}
                          />
                        ))
                      )}
                    </>
                  );
                })()}
              </Card>
            </View>

            <View style={isWide && styles.cardGridItem}>
              <Card icon="💍" title="Wedding Anniversaries" tintBg={colors.clayBg}>
                {(() => {
                  const { thisWeek, nextWeek } = splitByWeek(anniversaries, thisWeekStart);
                  return (
                    <>
                      {thisWeek.length === 0 ? (
                        <Text style={styles.emptyText}>No wedding celebrant for this week.</Text>
                      ) : (
                        thisWeek.map((couple, index) => (
                          <DateRow
                            key={couple.id}
                            badge={monthDayBadge(couple.month_day)}
                            title={couple.display_name}
                            subtitle={couple.day_label}
                            last={index === thisWeek.length - 1}
                          />
                        ))
                      )}

                      <WeekDivider label="Next Week" />

                      {nextWeek.length === 0 ? (
                        <Text style={styles.emptyText}>No wedding celebrant for next week.</Text>
                      ) : (
                        nextWeek.map((couple, index) => (
                          <DateRow
                            key={couple.id}
                            badge={monthDayBadge(couple.month_day)}
                            title={couple.display_name}
                            subtitle={couple.day_label}
                            last={index === nextWeek.length - 1}
                          />
                        ))
                      )}
                    </>
                  );
                })()}
              </Card>
            </View>

            <View style={isWide && styles.cardGridItem}>
              <Card icon="🌸" title="Flowers" tintBg={colors.goldBg}>
                {flowerSponsors.length === 0 ? (
                  <Text style={styles.emptyText}>TBA</Text>
                ) : (
                  (() => {
                    let dividerShown = false;
                    return flowerSponsors.map((sponsor) => {
                      const showDivider = !dividerShown && sponsor.service_date > thisWeekEnd;
                      if (showDivider) dividerShown = true;

                      return (
                        <View key={sponsor.service_date} style={showDivider ? undefined : styles.stackedEntry}>
                          {showDivider && <WeekDivider label="Next Week" />}
                          <Text style={styles.cardDate}>{formatDate(sponsor.service_date)}</Text>
                          <Text style={styles.cardLabel}>Sponsored by</Text>
                          <Text style={styles.cardTitle}>{sponsor.sponsored_by}</Text>
                          {!!sponsor.message && <Text style={styles.cardText}>{sponsor.message}</Text>}
                        </View>
                      );
                    });
                  })()
                )}
              </Card>
            </View>

            <View style={isWide && styles.cardGridItem}>
              <Card icon="🎤" title="Midweek Service" tintBg={colors.brickBg}>
                {midweekServices.length === 0 ? (
                  <Text style={styles.emptyText}>TBA</Text>
                ) : (
                  (() => {
                    let dividerShown = false;
                    return midweekServices.map((service) => {
                      const showDivider = !dividerShown && service.service_date > thisWeekEnd;
                      if (showDivider) dividerShown = true;

                      return (
                        <View key={service.service_date} style={showDivider ? undefined : styles.stackedEntry}>
                          {showDivider && <WeekDivider label="Next Week" />}
                          <Text style={styles.cardDate}>
                            {formatDate(service.service_date)}
                            {service.service_time ? ` · ${formatTime(service.service_time)}` : ''}
                          </Text>
                          <Text style={styles.cardLabel}>Speaker</Text>
                          <Text style={styles.cardTitle}>{service.speaker || '—'}</Text>
                          <Text style={[styles.cardLabel, { marginTop: 10 }]}>Presider</Text>
                          <Text style={styles.cardTitle}>{service.presider || '—'}</Text>
                        </View>
                      );
                    });
                  })()
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
 * ServiceTimeItem
 * ==========================================
 */

function ServiceTimeRow({ name, value }: { name: string; value: string }) {
  return (
    <View style={styles.serviceTimeRow}>
      <Text style={styles.serviceTimeName}>{name}</Text>
      <Text style={styles.serviceTimeValue}>{value}</Text>
    </View>
  );
}

/*
 * ==========================================
 * ContactItem
 * ==========================================
 */

function ContactItem({
  icon,
  label,
  value,
  href,
  external,
}: {
  icon: string;
  label: string;
  value: string | string[];
  href: string;
  external?: boolean;
}) {
  const lines = Array.isArray(value) ? value : [value];

  return (
    <Link href={href as `${string}:${string}`} asChild {...(external ? { target: '_blank' } : {})}>
      <Pressable style={styles.contactItem} accessibilityRole="link">
        <View style={styles.contactIconBadge}>
          <Text style={styles.contactIcon}>{icon}</Text>
        </View>

        <View>
          <Text style={styles.contactLabel}>{label}</Text>
          {lines.map((line, index) => (
            <Text key={index} style={styles.contactValue}>
              {line}
            </Text>
          ))}
        </View>
      </Pressable>
    </Link>
  );
}

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
  heroText: { flex: 1, maxWidth: 560 },

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

  serviceTimesCard: {
    width: '100%',
    maxWidth: 360,
    marginTop: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 22,
    gap: 12,
  },
  serviceTimesLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.accent,
    marginBottom: 6,
  },
  serviceTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  serviceTimeName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  serviceTimeValue: { fontSize: 14, color: colors.textSecondary },

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
    justifyContent: 'space-around',
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
  stackedEntry: { marginBottom: 4 },
  cardDate: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 5 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardText: { fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 3 },
  cardLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },

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
