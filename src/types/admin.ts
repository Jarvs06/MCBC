/*
 * ==========================================
 * Shared admin types
 * ==========================================
 *
 * Previously redefined identically in add.tsx, edit.tsx,
 * and index.tsx under admin-users/.
 */

export type AdminRole = 'Super Admin' | 'Viewer';

export type AdminStatus = 'Pending' | 'Active' | 'Disabled';

export type AdminProfile = {
  id: string;
  full_name: string;
  role: AdminRole;
  status: AdminStatus;
  approved: boolean;
  created_at: string;
  updated_at: string;
};
