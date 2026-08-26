import { Link } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';

export default function AdminDashboardScreen() {
  const {
    session,
    profile,
    isSuperAdmin,
    isViewer,
    signOut,
  } = useAuth();

  /*
   * Wait for the profile to be loaded.
   */
  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>
          Loading your account...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* ======================================
          HEADER
      ====================================== */}

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            Church Admin
          </Text>

          <Text style={styles.subtitle}>
            Administration Dashboard
          </Text>
        </View>

        <Pressable
          style={styles.signOutButton}
          onPress={signOut}
        >
          <Text style={styles.signOutText}>
            Sign Out
          </Text>
        </Pressable>
      </View>

      {/* ======================================
          WELCOME
      ====================================== */}

      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>
          Welcome, {profile.full_name}
        </Text>

        <Text style={styles.email}>
          {session?.user.email}
        </Text>

        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {profile.role}
          </Text>
        </View>
      </View>

      {/* ======================================
          ADMINISTRATION
          SUPER ADMIN ONLY
      ====================================== */}

      {isSuperAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Administration
          </Text>

          <Link
            href="/admin-users"
            asChild
          >
            <Pressable style={styles.menuCard}>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>
                  Admin Users
                </Text>

                <Text style={styles.menuDescription}>
                  Register users and manage administrator
                  accounts and access.
                </Text>
              </View>

              <Text style={styles.arrow}>
                →
              </Text>
            </Pressable>
          </Link>
        </View>
      )}

      {/* ======================================
          CHURCH MEMBERS
          EVERY ACTIVE USER CAN VIEW
      ====================================== */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Church Members
        </Text>

        <View style={styles.grid}>

          <MenuCard
            title="Members"
            description="View and manage church member information."
            href="/members"
          />

          <MenuCard
            title="Birthdays"
            description="View upcoming member birthdays."
            href="/members"
          />

          <MenuCard
            title="Anniversaries"
            description="View upcoming wedding anniversaries."
            href="/members"
          />

          <MenuCard
            title="Groups"
            description="View church member groups and organizations."
            href="/members"
          />

        </View>
      </View>

      {/* ======================================
          CHURCH INFORMATION
          EVERY ACTIVE USER CAN VIEW
      ====================================== */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Church Information
        </Text>

        <View style={styles.grid}>

          <MenuCard
            title="Announcements"
            description="View church announcements."
            href="/announcements"
          />

          <MenuCard
            title="Sunday Flowers"
            description="View flowers scheduled for Sunday."
            href="/flowers"
          />

          <MenuCard
            title="Services"
            description="View speakers, presiders and church services."
            href="/services"
          />

          <MenuCard
            title="Events"
            description="View upcoming church events."
            href="/events"
          />

        </View>
      </View>

      {/* ======================================
          ACCESS INFORMATION
      ====================================== */}

      {isSuperAdmin && (
        <View style={styles.accessCard}>
          <Text style={styles.accessTitle}>
            Super Admin Access
          </Text>

          <Text style={styles.accessText}>
            You have full access to the system. You can
            add, edit and delete church information,
            manage members and manage administrator
            accounts.
          </Text>
        </View>
      )}

      {isViewer && (
        <View style={styles.accessCard}>
          <Text style={styles.accessTitle}>
            Viewer Access
          </Text>

          <Text style={styles.accessText}>
            Your account has Viewer access. You can view
            the entire church system, but you cannot add,
            edit or delete information.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}


/* ==========================================
   MENU CARD
========================================== */

function MenuCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href as any}
      asChild
    >
      <Pressable style={styles.menuCard}>
        <View style={styles.menuContent}>
          <Text style={styles.menuTitle}>
            {title}
          </Text>

          <Text style={styles.menuDescription}>
            {description}
          </Text>
        </View>

        <Text style={styles.arrow}>
          →
        </Text>
      </Pressable>
    </Link>
  );
}


/* ==========================================
   STYLES
========================================== */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  content: {
    padding: 24,
    paddingBottom: 60,
  },

  /* Header */

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    gap: 20,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
  },

  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },

  /* Sign out */

  signOutButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },

  signOutText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Welcome */

  welcomeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 28,
  },

  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },

  email: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 5,
  },

  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 14,
  },

  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },

  /* Sections */

  section: {
    marginBottom: 28,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },

  grid: {
    gap: 12,
  },

  /* Menu */

  menuCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  menuContent: {
    flex: 1,
  },

  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  menuDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 5,
    lineHeight: 19,
  },

  arrow: {
    fontSize: 20,
    color: '#6b7280',
    marginLeft: 15,
  },

  /* Access information */

  accessCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 20,
  },

  accessTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  accessText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 21,
    marginTop: 6,
  },

  /* Loading */

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
});