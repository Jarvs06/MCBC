/*
 * ==========================================
 * Homepage content
 * ==========================================
 *
 * TEMPORARY: this data is hardcoded. The admin panel
 * already manages Announcements, Events, and Flowers
 * (see admin-users/announcements, /events, /flowers),
 * but this public homepage does not yet read from them.
 *
 * Each shape here matches what those admin screens would
 * plausibly write to Supabase, so swapping a section to
 * live data later should mean replacing the constant below
 * with a `supabase.from(...).select(...)` result of the
 * same shape — not restructuring the screen.
 */

export type Announcement = {
  id: string;
  date: string;
  title: string;
  text: string;
};

export type Birthday = {
  id: string;
  name: string;
  date: string;
};

export type Anniversary = {
  id: string;
  names: string;
  date: string;
};

export type FlowerSponsor = {
  id: string;
  sponsoredBy: string;
  message: string;
};

export type MidweekService = {
  date: string;
  title: string;
  speaker: string;
  presider: string;
};

export type UpcomingEvent = {
  id: string;
  date: string;
  title: string;
  text: string;
};

export const announcements: Announcement[] = [
  {
    id: '1',
    date: 'August 30, 2026',
    title: 'Sunday Worship Service',
    text: 'Join us this Sunday for our worship service at 9:00 AM.',
  },
];

export const birthdays: Birthday[] = [
  { id: '1', name: 'Maria Santos', date: 'August 27' },
  { id: '2', name: 'John Cruz', date: 'August 29' },
];

export const anniversaries: Anniversary[] = [
  { id: '1', names: 'Juan & Maria Cruz', date: 'August 28' },
];

export const flowerSponsor: FlowerSponsor = {
  id: '1',
  sponsoredBy: 'Santos Family',
  message: "In celebration of God's blessings.",
};

export const midweekService: MidweekService = {
  date: 'Wednesday, September 2',
  title: 'Midweek Service',
  speaker: 'Pastor John',
  presider: 'Brother Mark',
};

export const upcomingEvents: UpcomingEvent[] = [
  {
    id: '1',
    date: 'September 5, 2026',
    title: 'Youth Fellowship',
    text: 'Join us for our upcoming youth fellowship.',
  },
];
