import { useEffect, useState } from 'react';

import { formatMemberName } from '@/lib/memberHelpers';
import { supabase } from '@/lib/supabase';
import type { Anniversary, Birthday } from '@/constants/homeContent';

/*
 * ==========================================
 * useUpcomingChurchEvents
 * ==========================================
 *
 * Computes real "upcoming this week" birthdays and wedding
 * anniversaries from the members table, for the signed-in
 * Dashboard. Requires an authenticated, active/approved admin
 * session — member-crypto (and the members table's RLS policy)
 * reject anonymous callers, so this hook is NOT safe to use on
 * the public homepage as-is. See ChurchHighlights for how the
 * two pages diverge here.
 *
 * Birth dates recur every year, so "upcoming" compares month+day
 * only (ignoring year) against today, wrapping across a year
 * boundary (e.g. today Dec 29, birthday Jan 2 => 4 days away).
 */

const DEFAULT_WINDOW_DAYS = 7;

type DecryptedMember = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  birth_date: string | null;
  wedding_date: string | null;
  spouse_id: string | null;
};

type MonthDay = { month: number; day: number };

function parseMonthDay(value: string): MonthDay | null {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return { month: Number(match[1]), day: Number(match[2]) };
}

function formatMonthDay(monthDay: MonthDay): string {
  const date = new Date(Date.UTC(2020, monthDay.month - 1, monthDay.day));

  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Days from today until the next occurrence of this month/day
 * (0 = today, wraps to next year if it already passed this year).
 */
function daysUntilNext(monthDay: MonthDay, today: Date): number {
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  let next = Date.UTC(today.getFullYear(), monthDay.month - 1, monthDay.day);

  if (next < todayUTC) {
    next = Date.UTC(today.getFullYear() + 1, monthDay.month - 1, monthDay.day);
  }

  return Math.round((next - todayUTC) / (1000 * 60 * 60 * 24));
}

export function useUpcomingChurchEvents(windowDays: number = DEFAULT_WINDOW_DAYS) {
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        const { data: encryptedMembers, error } = await supabase
          .from('members')
          .select('id, first_name, middle_name, last_name, suffix, birth_date, wedding_date, spouse_id')
          .eq('status', 'Active');

        if (error || !encryptedMembers) {
          console.error('[UPCOMING EVENTS] Load error:', error);
          if (mounted) {
            setBirthdays([]);
            setAnniversaries([]);
          }
          return;
        }

        if (encryptedMembers.length === 0) {
          if (mounted) {
            setBirthdays([]);
            setAnniversaries([]);
          }
          return;
        }

        const { data: cryptoResponse, error: cryptoError } = await supabase.functions.invoke(
          'member-crypto',
          { body: { action: 'decrypt', data: encryptedMembers } }
        );

        if (cryptoError || !cryptoResponse?.success || !Array.isArray(cryptoResponse.data)) {
          console.error('[UPCOMING EVENTS] Decryption failed:', cryptoError);
          if (mounted) {
            setBirthdays([]);
            setAnniversaries([]);
          }
          return;
        }

        const members = cryptoResponse.data as DecryptedMember[];
        const membersById = new Map(members.map((member) => [member.id, member]));
        const today = new Date();

        /*
         * ------------------------------------
         * Birthdays
         * ------------------------------------
         */
        const rankedBirthdays = members
          .map((member) => {
            const monthDay = member.birth_date ? parseMonthDay(member.birth_date) : null;
            if (!monthDay) return null;

            const daysAway = daysUntilNext(monthDay, today);
            if (daysAway > windowDays) return null;

            return {
              id: member.id,
              name: formatMemberName(member),
              date: formatMonthDay(monthDay),
              daysAway,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
          .sort((a, b) => a.daysAway - b.daysAway);

        /*
         * ------------------------------------
         * Wedding anniversaries
         * ------------------------------------
         *
         * Both spouses carry the same wedding_date, so dedupe by
         * pairing on a sorted (memberId, spouseId) key — otherwise
         * the same anniversary would show up twice.
         */
        const seenPairs = new Set<string>();

        const rankedAnniversaries = members
          .map((member) => {
            const monthDay = member.wedding_date ? parseMonthDay(member.wedding_date) : null;
            if (!monthDay) return null;

            const daysAway = daysUntilNext(monthDay, today);
            if (daysAway > windowDays) return null;

            const spouse = member.spouse_id ? membersById.get(member.spouse_id) : undefined;
            const pairKey = spouse ? [member.id, spouse.id].sort().join(':') : member.id;

            if (seenPairs.has(pairKey)) return null;
            seenPairs.add(pairKey);

            return {
              id: pairKey,
              names: spouse
                ? `${formatMemberName(member)} & ${formatMemberName(spouse)}`
                : formatMemberName(member),
              date: formatMonthDay(monthDay),
              daysAway,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
          .sort((a, b) => a.daysAway - b.daysAway);

        if (mounted) {
          setBirthdays(rankedBirthdays.map(({ daysAway: _daysAway, ...rest }) => rest));
          setAnniversaries(rankedAnniversaries.map(({ daysAway: _daysAway, ...rest }) => rest));
        }
      } catch (error) {
        console.error('[UPCOMING EVENTS] Unexpected error:', error);

        if (mounted) {
          setBirthdays([]);
          setAnniversaries([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [windowDays]);

  return { birthdays, anniversaries, loading };
}
