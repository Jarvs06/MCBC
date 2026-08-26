import { Link } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const {
    session,
    profile,
    loading: authLoading,
  } = useAuth();

  const isLoggedIn = !!session && !!profile;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.churchName}>
            Church Name
          </Text>

          <Text style={styles.churchSubtitle}>
            Church Information Portal
          </Text>
        </View>

        {/* Authentication Button */}
        {!authLoading && (
          <>
            {isLoggedIn ? (
              <Link
                href="./dashboard"
                asChild
              >
                <Pressable style={styles.loginButton}>
                  <Text style={styles.loginButtonText}>
                    Dashboard
                  </Text>
                </Pressable>
              </Link>
            ) : (
              <Link
                href="/login"
                asChild
              >
                <Pressable style={styles.loginButton}>
                  <Text style={styles.loginButtonText}>
                    Admin Login
                  </Text>
                </Pressable>
              </Link>
            )}
          </>
        )}
      </View>

      {/* Welcome */}
      <View style={styles.welcome}>
        <Text style={styles.welcomeTitle}>
          Welcome to our Church
        </Text>

        <Text style={styles.welcomeText}>
          Stay updated with announcements, upcoming
          activities, birthdays, anniversaries, and
          church services.
        </Text>
      </View>

      {/* Announcements */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          📢 Announcements
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardDate}>
            August 30, 2026
          </Text>

          <Text style={styles.cardTitle}>
            Sunday Worship Service
          </Text>

          <Text style={styles.cardText}>
            Join us this Sunday for our worship service
            at 9:00 AM.
          </Text>
        </View>
      </View>

      {/* Birthdays */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          🎂 Birthdays This Week
        </Text>

        <View style={styles.card}>
          <View style={styles.personRow}>
            <View>
              <Text style={styles.personName}>
                Maria Santos
              </Text>

              <Text style={styles.cardText}>
                August 27
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.personRow}>
            <View>
              <Text style={styles.personName}>
                John Cruz
              </Text>

              <Text style={styles.cardText}>
                August 29
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Wedding Anniversaries */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          💍 Wedding Anniversaries
        </Text>

        <View style={styles.card}>
          <View style={styles.personRow}>
            <View>
              <Text style={styles.personName}>
                Juan & Maria Cruz
              </Text>

              <Text style={styles.cardText}>
                August 28
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Flowers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          🌸 Flowers — This Sunday
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            Sponsored by
          </Text>

          <Text style={styles.cardTitle}>
            Santos Family
          </Text>

          <Text style={styles.cardText}>
            In celebration of God's blessings.
          </Text>
        </View>
      </View>

      {/* Midweek Service */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          🎤 Midweek Service
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardDate}>
            Wednesday, September 2
          </Text>

          <Text style={styles.cardTitle}>
            Midweek Service
          </Text>

          <View style={styles.serviceRow}>
            <Text style={styles.cardLabel}>
              Speaker
            </Text>

            <Text style={styles.serviceValue}>
              Pastor John
            </Text>
          </View>

          <View style={styles.serviceRow}>
            <Text style={styles.cardLabel}>
              Presider
            </Text>

            <Text style={styles.serviceValue}>
              Brother Mark
            </Text>
          </View>
        </View>
      </View>

      {/* Upcoming Events */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          📅 Upcoming Events
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardDate}>
            September 5, 2026
          </Text>

          <Text style={styles.cardTitle}>
            Youth Fellowship
          </Text>

          <Text style={styles.cardText}>
            Join us for our upcoming youth fellowship.
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Church Information Portal
        </Text>

        <Text style={styles.footerSubtext}>
          For church members and visitors
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 50,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 25,
    gap: 15,
  },

  churchName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },

  churchSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 3,
  },

  loginButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },

  loginButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },

  welcome: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 22,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },

  welcomeText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6b7280',
    marginTop: 8,
  },

  section: {
    marginBottom: 22,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  cardDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 5,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },

  cardText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6b7280',
    marginTop: 5,
  },

  cardLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },

  personRow: {
    paddingVertical: 3,
  },

  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },

  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },

  serviceRow: {
    marginTop: 16,
  },

  serviceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 3,
  },

  footer: {
    alignItems: 'center',
    paddingTop: 20,
  },

  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },

  footerSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
});