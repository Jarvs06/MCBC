import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import AppModal from '@/components/AppModal';
import { FilterDropdown } from '@/components/FilterDropdown';
import { Pagination } from '@/components/Pagination';
import { useAuth } from '@/contexts/AuthContext';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { colors, radii, WIDE_BREAKPOINT } from '@/constants/theme';
import { useAppModal } from '@/hooks/useAppModal';
import { formatMemberName } from '@/lib/memberHelpers';
import { supabase } from '@/lib/supabase';

/*
 * ==========================================
 * TYPES
 * ==========================================
 */

type Ministry =
  | 'None'
  | 'Choir'
  | 'Media'
  | 'Outreach'
  | 'Pastor'
  | 'Sunday School Teacher'
  | 'Ushering'
  | 'Worship';

type MemberStatus = 'Active' | 'Inactive' | 'Transferred';

type MemberGroup = 'General' | 'Men' | 'Women' | 'Children' | 'Youth' | 'Young Professional';

type Member = {
  id: string;
  member_no: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  birth_date: string | null;
  wedding_date: string | null;
  spouse_id: string | null;
  address: string | null;
  contact_no: string | null;
  baptized: boolean;
  member_group: MemberGroup | string | null;
  ministry: Ministry | string | null;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
};

/*
 * ==========================================
 * FILTER OPTIONS
 * ==========================================
 */

const memberGroups: Array<'All' | MemberGroup> = [
  'All',
  'General',
  'Men',
  'Women',
  'Children',
  'Youth',
  'Young Professional',
];

const ministries: Array<'All' | Ministry> = [
  'All',
  'None',
  'Choir',
  'Media',
  'Outreach',
  'Pastor',
  'Sunday School Teacher',
  'Ushering',
  'Worship',
];

const statuses: Array<'All' | MemberStatus> = ['All', 'Active', 'Inactive', 'Transferred'];

/*
 * ==========================================
 * SCREEN
 * ==========================================
 */

const PAGE_SIZE = 10;

export default function MembersScreen() {
  const { isSuperAdmin, isViewer, isActive } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  // Below this, 3 stat columns squeeze too tight — stack them instead.
  const isCompact = width < 380;

  // ----------------------------------------
  // State
  // ----------------------------------------

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const [memberGroupFilter, setMemberGroupFilter] = useState<'All' | MemberGroup>('All');
  const [ministryFilter, setMinistryFilter] = useState<'All' | Ministry>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | MemberStatus>('All');
  const [openFilter, setOpenFilter] = useState<'memberGroup' | 'ministry' | 'status' | null>(null);

  const [page, setPage] = useState(1);

  const modal = useAppModal();

  /*
   * ========================================
   * ACCESS
   * ========================================
   */

  const canViewMembers = isActive && (isSuperAdmin || isViewer);

  /*
   * ========================================
   * LOAD MEMBERS
   * ========================================
   *
   * Database contains encrypted sensitive fields. We:
   *
   * 1. Read the member records.
   * 2. Send them to member-crypto.
   * 3. Decrypt them server-side.
   * 4. Sort them locally.
   * 5. Store them in state.
   *
   * We intentionally do NOT order by first_name / last_name in
   * Supabase because those fields are encrypted.
   */

  const loadMembers = useCallback(async () => {
    if (!canViewMembers) {
      setMembers([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    console.log('[MEMBERS] Loading members...');

    try {
      setLoading(true);

      /*
       * ------------------------------------
       * Get encrypted records
       * ------------------------------------
       *
       * address/contact_no are intentionally excluded here — they
       * aren't shown on this list, only on the member detail
       * screen — so they're neither fetched nor decrypted for
       * every row on every load.
       */
      const { data: encryptedMembers, error: membersError } = await supabase.from('members')
        .select(`
          id,
          member_no,
          first_name,
          middle_name,
          last_name,
          suffix,
          birth_date,
          wedding_date,
          spouse_id,
          member_group,
          baptized,
          ministry,
          status,
          created_at,
          updated_at
        `);

      if (membersError) {
        console.error('[MEMBERS] Query failed:', membersError);

        setMembers([]);

        modal.show(
          'Unable to Load Members',
          membersError.code === '42501'
            ? 'You do not have permission to view member records.'
            : 'The member records could not be loaded. Please try again.'
        );

        return;
      }

      /*
       * ------------------------------------
       * No records
       * ------------------------------------
       */
      if (!encryptedMembers || encryptedMembers.length === 0) {
        console.log('[MEMBERS] No members found.');
        setMembers([]);
        return;
      }

      console.log('[MEMBERS] Encrypted members loaded:', encryptedMembers.length);

      /*
       * ------------------------------------
       * Decrypt through Edge Function
       * ------------------------------------
       */
      const { data: cryptoResponse, error: cryptoError } = await supabase.functions.invoke(
        'member-crypto',
        {
          body: {
            action: 'decrypt',
            data: encryptedMembers,
          },
        }
      );

      if (cryptoError) {
        console.error('[MEMBERS] Decryption failed:', cryptoError);

        /*
         * Do not expose raw Edge Function responses or
         * implementation details.
         */
        if (cryptoError instanceof FunctionsHttpError) {
          try {
            const response = await cryptoError.context;
            const responseText = await response.text();

            console.error('[MEMBERS] Edge Function response:', responseText);
          } catch (error) {
            console.error('[MEMBERS] Could not read Edge Function error:', error);
          }
        }

        setMembers([]);

        modal.show(
          'Decryption Failed',
          'The member information could not be decrypted. Please try again.'
        );

        return;
      }

      /*
       * ------------------------------------
       * Validate crypto response
       * ------------------------------------
       */
      if (!cryptoResponse || cryptoResponse.success !== true || !Array.isArray(cryptoResponse.data)) {
        console.error('[MEMBERS] Invalid crypto response:', cryptoResponse);

        setMembers([]);

        modal.show('Unable to Read Members', 'The server returned an invalid member response.');

        return;
      }

      /*
       * ------------------------------------
       * Convert response
       * ------------------------------------
       */
      const decryptedMembers = cryptoResponse.data as Member[];

      /*
       * ------------------------------------
       * Sort locally
       * ------------------------------------
       *
       * Because last_name and first_name are encrypted in
       * PostgreSQL, database ordering cannot be used.
       */
      decryptedMembers.sort((a, b) => {
        const lastNameA = (a.last_name ?? '').trim().toLowerCase();
        const lastNameB = (b.last_name ?? '').trim().toLowerCase();
        const lastNameComparison = lastNameA.localeCompare(lastNameB);

        if (lastNameComparison !== 0) {
          return lastNameComparison;
        }

        const firstNameA = (a.first_name ?? '').trim().toLowerCase();
        const firstNameB = (b.first_name ?? '').trim().toLowerCase();

        return firstNameA.localeCompare(firstNameB);
      });

      console.log('[MEMBERS] Decrypted members:', decryptedMembers.length);

      setMembers(decryptedMembers);
    } catch (error) {
      console.error('[MEMBERS] Unexpected loading error:', error);

      setMembers([]);

      modal.show('Unable to Load Members', 'Something went wrong while loading the member records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewMembers]);

  /*
   * ========================================
   * INITIAL LOAD
   * ========================================
   */
  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  /*
   * ========================================
   * REFRESH
   * ========================================
   */
  function handleRefresh() {
    if (!canViewMembers) {
      return;
    }

    setRefreshing(true);
    void loadMembers();
  }

  /*
   * ========================================
   * FORMAT DATE
   * ========================================
   */
  function formatDate(date: string | null) {
    if (!date) {
      return 'Not provided';
    }

    const [year, month, day] = date.split('-').map(Number);

    if (!year || !month || !day) {
      return date;
    }

    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Not provided';
    }

    return parsedDate.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /*
   * ========================================
   * FILTER MEMBERS
   * ========================================
   *
   * Filtering happens AFTER decryption. This is important
   * because encrypted names cannot be searched with SQL
   * ILIKE / LIKE.
   */

  const normalizedSearch = search.trim().toLowerCase();

  const filteredMembers = members.filter((member) => {
    const fullName = formatMemberName(member).toLowerCase();
    const memberNumber = (member.member_no ?? '').toLowerCase();

    const matchesSearch =
      !normalizedSearch ||
      fullName.includes(normalizedSearch) ||
      memberNumber.includes(normalizedSearch);

    const matchesMemberGroup =
      memberGroupFilter === 'All' || member.member_group === memberGroupFilter;

    const matchesMinistry = ministryFilter === 'All' || member.ministry === ministryFilter;

    const matchesStatus = statusFilter === 'All' || member.status === statusFilter;

    return matchesSearch && matchesMemberGroup && matchesMinistry && matchesStatus;
  });

  /*
   * ========================================
   * PAGINATION
   * ========================================
   *
   * currentPage is clamped against the live filtered count rather
   * than reset via an effect, so narrowing a filter down to fewer
   * pages than the current page never shows a blank page — it
   * just falls back to the last real page automatically.
   */

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  /*
   * ========================================
   * ACCESS CHECK
   * ========================================
   *
   * Super Admin:
   * - Can view members.
   * - Can use the Add Member action.
   *
   * Viewer:
   * - Can view members.
   * - Cannot use the Add Member action.
   *
   * The UI check is only for UX. Supabase RLS / server-side
   * policies must enforce the same permissions.
   */
  if (!canViewMembers) {
    return (
      <View style={styles.center}>
        <Text style={styles.accessTitle}>Access Restricted</Text>
        <Text style={styles.accessText}>Your account does not have access to the member records.</Text>
      </View>
    );
  }

  /*
   * ========================================
   * UI
   * ========================================
   */
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* ================================ HEADER ================================ */}

        <View style={[styles.header, isWide && styles.headerWide]}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Members</Text>
            <Text style={styles.subtitle}>View and manage church member records.</Text>
          </View>

          {isActive && isSuperAdmin && (
            <Pressable
              style={styles.addButton}
              onPress={() => router.push('/(app)/members/add')}
              accessibilityRole="button"
              accessibilityLabel="Add member"
            >
              <Text style={styles.addButtonText}>+ Add Member</Text>
            </Pressable>
          )}
        </View>

        {/* ================================ SUMMARY ================================ */}

        <View style={[styles.summary, isCompact && styles.summaryCompact]}>
          <View style={[styles.summaryItem, isCompact && styles.summaryItemCompact]}>
            <Text style={styles.summaryNumber}>{members.length}</Text>
            <Text style={styles.summaryLabel}>Total Members</Text>
          </View>

          <View style={[styles.summaryItem, isCompact && styles.summaryItemCompact]}>
            <Text style={styles.summaryNumber}>
              {members.filter((member) => member.status === 'Active').length}
            </Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>

          <View
            style={[
              styles.summaryItem,
              isCompact ? [styles.summaryItemCompact, styles.summaryItemCompactLast] : styles.summaryItemLast,
            ]}
          >
            <Text style={styles.summaryNumber}>{members.filter((member) => member.baptized).length}</Text>
            <Text style={styles.summaryLabel}>Baptized</Text>
          </View>
        </View>

        {/* ================================ SEARCH ================================ */}

        <View style={styles.searchContainer}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or member number..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* ================================ FILTERS ================================ */}

        <View style={styles.filterRow}>
          <FilterDropdown
            label="Member Group"
            placeholder="All Member Groups"
            value={memberGroupFilter}
            options={memberGroups}
            isOpen={openFilter === 'memberGroup'}
            onToggle={() => setOpenFilter((current) => (current === 'memberGroup' ? null : 'memberGroup'))}
            onSelect={(item) => {
              setMemberGroupFilter(item);
              setOpenFilter(null);
            }}
          />

          <FilterDropdown
            label="Ministry"
            placeholder="All Ministries"
            value={ministryFilter}
            options={ministries}
            isOpen={openFilter === 'ministry'}
            onToggle={() => setOpenFilter((current) => (current === 'ministry' ? null : 'ministry'))}
            onSelect={(item) => {
              setMinistryFilter(item);
              setOpenFilter(null);
            }}
          />

          <FilterDropdown
            label="Status"
            placeholder="All Statuses"
            value={statusFilter}
            options={statuses}
            isOpen={openFilter === 'status'}
            onToggle={() => setOpenFilter((current) => (current === 'status' ? null : 'status'))}
            onSelect={(item) => {
              setStatusFilter(item);
              setOpenFilter(null);
            }}
          />
        </View>

        {/* ================================ RESULTS HEADER ================================ */}

        <View style={[styles.resultHeader, isWide && styles.resultHeaderWide]}>
          <Text style={styles.resultTitle}>Member Records</Text>
          <Text style={styles.resultCount}>
            {filteredMembers.length === 0
              ? '0 found'
              : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(
                  currentPage * PAGE_SIZE,
                  filteredMembers.length
                )} of ${filteredMembers.length}`}
          </Text>
        </View>

        {/* ================================ LOADING ================================ */}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading members...</Text>
          </View>
        )}

        {/* ================================ EMPTY ================================ */}

        {!loading && filteredMembers.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Members Found</Text>
            <Text style={styles.emptyText}>No member records match your current search and filters.</Text>
          </View>
        )}

        {/* ================================ MEMBERS ================================ */}

        {!loading && (
          <View style={isWide && styles.membersGrid}>
            {paginatedMembers.map((member) => (
              <View key={member.id} style={isWide && styles.membersGridItem}>
                <Pressable
                  style={[styles.memberCard, isCompact && styles.memberCardCompact, isWide && styles.memberCardWide]}
                  onPress={() => router.push(`/(app)/members/${member.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${formatMemberName(member)}`}
                >
                  <View style={[styles.memberHeader, isCompact && styles.memberHeaderCompact]}>
                    <View style={styles.memberNameContainer}>
                      <Text style={styles.memberName}>{formatMemberName(member)}</Text>

                      {member.member_no && <Text style={styles.memberNumber}>{member.member_no}</Text>}
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        member.status === 'Active' && styles.statusActive,
                        member.status === 'Inactive' && styles.statusInactive,
                        member.status === 'Transferred' && styles.statusTransferred,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          member.status === 'Active' && styles.statusTextActive,
                          member.status === 'Inactive' && styles.statusTextInactive,
                          member.status === 'Transferred' && styles.statusTextTransferred,
                        ]}
                      >
                        {member.status}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.memberMeta, isCompact && styles.memberMetaCompact]}>
                    <Text style={styles.metaText}>{member.member_group ?? 'General'}</Text>
                    <Text style={styles.metaSeparator}>•</Text>
                    <Text style={styles.metaText}>{member.ministry ?? 'No Ministry'}</Text>
                    <Text style={styles.metaSeparator}>•</Text>
                    <Text style={styles.metaText}>{member.baptized ? 'Baptized' : 'Not Baptized'}</Text>
                  </View>

                  {member.birth_date && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Birthday</Text>
                      <Text style={styles.detailValue}>{formatDate(member.birth_date)}</Text>
                    </View>
                  )}

                  {member.wedding_date && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Wedding Anniversary</Text>
                      <Text style={styles.detailValue}>{formatDate(member.wedding_date)}</Text>
                    </View>
                  )}

                  <View style={styles.cardSpacer} />

                  <View style={styles.viewRow}>
                    <Text style={styles.viewText}>View member details →</Text>
                  </View>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* ================================ PAGINATION ================================ */}

        {!loading && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPrev={() => setPage(currentPage - 1)}
            onNext={() => setPage(currentPage + 1)}
          />
        )}
      </ScrollView>

      {/* ================================ MODAL ================================ */}

      <AppModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        buttonText="OK"
        onClose={modal.hide}
      />
    </View>
  );
}

/*
 * ==========================================
 * STYLES
 * ==========================================
 */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 24,
    paddingBottom: 60,
    position: 'relative',
  },

  header: {
    flexDirection: 'column',
    gap: 16,
    marginBottom: 24,
  },

  headerWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 5,
  },

  addButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.textPrimary,
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  addButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },

  summary: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    marginBottom: 20,
  },

  summaryCompact: {
    flexDirection: 'column',
  },

  summaryItem: {
    flex: 1,
    paddingVertical: 18,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },

  summaryItemLast: {
    borderRightWidth: 0,
  },

  summaryItemCompact: {
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 14,
  },

  summaryItemCompactLast: {
    borderBottomWidth: 0,
  },

  summaryNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },

  searchContainer: {
    marginBottom: 18,
  },

  searchInput: {
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.sm,
    paddingHorizontal: 15,
    fontSize: 15,
    color: colors.textPrimary,
  },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
    zIndex: 1000,
  },

  resultHeader: {
    flexDirection: 'column',
    marginTop: 8,
    marginBottom: 15,
    gap: 4,
  },

  resultHeaderWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },

  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  resultCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },

  loadingText: {
    color: colors.textSecondary,
    marginTop: 12,
  },

  emptyContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 30,
    alignItems: 'center',
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 7,
    lineHeight: 20,
  },

  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginHorizontal: -8,
  },

  membersGridItem: {
    width: '50%',
    paddingHorizontal: 8,
  },

  memberCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },

  memberCardCompact: {
    padding: 16,
    gap: 12,
  },

  memberCardWide: {
    flex: 1,
  },

  cardSpacer: {
    flex: 1,
  },

  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },

  memberHeaderCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },

  memberNameContainer: {
    flex: 1,
  },

  memberName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 22,
  },

  memberNumber: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
  },

  statusBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  statusActive: {
    backgroundColor: colors.statusActiveBg,
  },

  statusInactive: {
    backgroundColor: colors.statusInactiveBg,
  },

  statusTransferred: {
    backgroundColor: colors.statusTransferredBg,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  statusTextActive: {
    color: colors.statusActiveText,
  },

  statusTextInactive: {
    color: colors.statusInactiveText,
  },

  statusTextTransferred: {
    color: colors.statusTransferredText,
  },

  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  memberMetaCompact: {
    flexWrap: 'wrap',
    rowGap: 6,
    marginTop: 4,
  },

  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  metaSeparator: {
    fontSize: 13,
    color: colors.textMuted,
    marginHorizontal: 7,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },

  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  detailValue: {
    fontSize: 12,
    color: colors.textLabel,
    fontWeight: '600',
  },

  viewRow: {
    alignItems: 'flex-end',
    marginTop: 14,
  },

  viewText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  accessTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  accessText: {
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },

});