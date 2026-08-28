/*
 * ==========================================
 * Member form helpers
 * ==========================================
 *
 * Text normalization and date parsing used when creating or
 * editing a member record. Pulled out of members/add.tsx so
 * members/edit.tsx (and any other member form) can reuse the
 * exact same rules instead of re-implementing them.
 */

/**
 * Trims whitespace (including non-breaking spaces) and treats
 * the literal placeholder text "not mentioned" as empty.
 */
export function normalizeOptionalText(value: string | null | undefined): string {
  const normalized = (value ?? '').replace(/\u00a0/g, ' ').trim();

  if (normalized.toLowerCase() === 'not mentioned') {
    return '';
  }

  return normalized;
}

/**
 * Alias for a required field — same normalization rules, but the
 * caller is expected to separately check the result isn't empty.
 */
export function normalizeRequiredText(value: string | null | undefined): string {
  return normalizeOptionalText(value);
}

/**
 * Parses a strict YYYY-MM-DD string into a UTC Date, rejecting
 * anything that isn't a real calendar date (e.g. 2024-02-30).
 * Returns null for any invalid or malformed input.
 */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date;
}

/**
 * Today's date at UTC midnight, for future-date comparisons
 * (birth date / wedding date cannot be in the future).
 */
export function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * Builds a "Last, First Middle, Suffix" display name (surname
 * first), normalizing and filtering out empty pieces. Matches
 * the Last Name, First Name [Middle Initial] convention already
 * used by the spreadsheet import. Used for spouse-selector labels
 * and similar "full name" displays.
 */
export function formatMemberName(parts: {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  suffix?: string | null;
}): string {
  const lastName = normalizeRequiredText(parts.last_name);

  const givenName = [normalizeRequiredText(parts.first_name), normalizeOptionalText(parts.middle_name)]
    .filter(Boolean)
    .join(' ');

  const suffix = normalizeOptionalText(parts.suffix);

  return [[lastName, givenName].filter(Boolean).join(', '), suffix].filter(Boolean).join(', ');
}
