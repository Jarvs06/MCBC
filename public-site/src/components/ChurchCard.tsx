import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../constants/theme';

/*
 * ==========================================
 * ChurchCard
 * ==========================================
 *
 * The one card/row pattern shared by the homepage and the public
 * Weekly Pulse page, so the two don't each carry their own copy
 * (mirrors the main app's @/components/ChurchCard — see theme.ts
 * for why this project keeps plain copies instead of importing
 * across the project boundary).
 */

const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export type DateBadge = { month: string; day: string } | 'tba' | null;

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** Current week's Monday, as a local 'YYYY-MM-DD' string — used
 * to split a combined this-week+next-week list (see
 * refresh-public-celebrations, which stores both) into the two
 * groups a "Next Week" divider separates. */
export function currentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

/** Splits a list of items carrying a `week_start` and `day_label`
 * into this week's and next week's, each sorted Monday→Sunday. */
export function splitByWeek<T extends { week_start: string; day_label: string }>(
  items: T[],
  thisWeekStart: string
): { thisWeek: T[]; nextWeek: T[] } {
  const byDay = (a: T, b: T) => WEEKDAY_ORDER.indexOf(a.day_label) - WEEKDAY_ORDER.indexOf(b.day_label);

  return {
    thisWeek: items.filter((item) => item.week_start === thisWeekStart).sort(byDay),
    nextWeek: items.filter((item) => item.week_start !== thisWeekStart).sort(byDay),
  };
}

/** For a full 'YYYY-MM-DD' value. */
export function dateBadge(value: string): DateBadge {
  const date = parseDateOnly(value);
  if (!date) return null;
  return { month: MONTH_ABBR[date.getUTCMonth()], day: String(date.getUTCDate()) };
}

/** For a 'MM-DD' (no year) value, e.g. public_celebrations.month_day. */
export function monthDayBadge(value: string): DateBadge {
  const match = /^(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { month: MONTH_ABBR[Number(match[1]) - 1], day: String(Number(match[2])) };
}

/** For an already-formatted "May 18" value (get-weekly-digest's shape). */
export function formattedDateBadge(value: string): DateBadge {
  const match = /^([A-Za-z]+)\s+(\d{1,2})$/.exec(value);
  if (!match) return null;
  return { month: match[1].slice(0, 3).toUpperCase(), day: match[2] };
}

/** The badge already shows month/day, so a row's subtitle shows
 * the weekday instead of repeating the same date. */
export function formatWeekday(value: string): string {
  const date = parseDateOnly(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, { weekday: 'long', timeZone: 'UTC' });
}

export function formatDate(value: string): string {
  const date = parseDateOnly(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function formatTime(value: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatTimeRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  return [start, end].filter((value): value is string => !!value).map(formatTime).join(' – ');
}

type CardProps = {
  icon: string;
  title: string;
  tintBg?: string;
  children: ReactNode;
};

export function Card({ icon, title, tintBg = colors.accentBg, children }: CardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconBadge, { backgroundColor: tintBg }]}>
          <Text style={styles.cardIcon}>{icon}</Text>
        </View>
        <Text style={styles.cardHeading}>{title}</Text>
      </View>

      {children}
    </View>
  );
}

type DateRowProps = {
  badge: DateBadge;
  title: string;
  subtitle: string;
  last: boolean;
};

export function DateRow({ badge, title, subtitle, last }: DateRowProps) {
  return (
    <View style={[styles.dateRow, !last && styles.rowDivider]}>
      {badge === 'tba' ? (
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeTba}>TBA</Text>
        </View>
      ) : (
        badge && (
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeMonth}>{badge.month}</Text>
            <Text style={styles.dateBadgeDay}>{badge.day}</Text>
          </View>
        )
      )}

      <View style={styles.dateRowText}>
        <Text style={styles.cardTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.cardText}>{subtitle}</Text>}
      </View>
    </View>
  );
}

/** Separates this week's entries from next week's within the
 * same card — a heading plus a light top border, rather than a
 * second card, so the two weeks read as one continuous list. */
export function WeekDivider({ label }: { label: string }) {
  return (
    <View style={styles.weekDivider}>
      <Text style={styles.weekDividerLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 20,
  },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  cardIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: { fontSize: 18 },
  cardHeading: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },

  cardDate: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 5 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardText: { fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 3 },
  cardLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },

  emptyText: { fontSize: 14, color: colors.textSecondary },

  dateRow: { flexDirection: 'row', gap: 14, paddingVertical: 10 },
  dateRowText: { flex: 1, justifyContent: 'center' },

  dateBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  dateBadgeMonth: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4, color: colors.accent },
  dateBadgeDay: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  dateBadgeTba: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, color: colors.textMuted },

  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.background },

  weekDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 10,
    paddingTop: 10,
  },
  weekDividerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: 4,
  },
});
