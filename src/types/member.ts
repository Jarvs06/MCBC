/*
 * ==========================================
 * Shared member types
 * ==========================================
 *
 * Previously redefined (with drifting field lists) in
 * members/add.tsx, members/edit.tsx, members/[id].tsx,
 * members/index.tsx, and members/import.tsx.
 */

export type Gender = 'Male' | 'Female';

export type MemberGroup = 'General' | 'Men' | 'Women' | 'Children' | 'Youth' | 'Young Professional';

export type Ministry =
  | 'None'
  | 'Choir'
  | 'Media'
  | 'Outreach'
  | 'Pastor'
  | 'Sunday School Teacher'
  | 'Ushering'
  | 'Worship';

export type MemberStatus = 'Active' | 'Inactive' | 'Transferred' | 'Moved Away' | 'Deceased';

export type Member = {
  id: string;
  member_no: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  birth_date: string | null;
  gender: string | null;
  spouse_id: string | null;
  wedding_date: string | null;
  address: string | null;
  contact_no: string | null;
  baptized: boolean;
  status: string;
  member_group: string;
  ministry: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * The subset of a member's name fields needed to build a
 * display name (see formatMemberName in @/lib/memberHelpers).
 */
export type MemberNameParts = Pick<Member, 'first_name' | 'middle_name' | 'last_name' | 'suffix'>;

/**
 * Shape used for spouse-selection pick lists, where only the
 * name fields (and id) are fetched/decrypted.
 */
export type MemberOption = Pick<Member, 'id' | 'first_name' | 'middle_name' | 'last_name' | 'suffix'>;
