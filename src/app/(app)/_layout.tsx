import {
  Redirect,
  Stack,
} from 'expo-router';

import {
  useAuth,
} from '@/contexts/AuthContext';

export default function AppLayout() {
  const {
    session,
    loading,
    profile,
  } = useAuth();

  if (loading) {
    return null;
  }

  if (!session) {
    return (
      <Redirect href="/login" />
    );
  }

  if (!profile) {
    return null;
  }

  if (
    profile.status !==
    'Active'
  ) {
    return (
      <Redirect href="/" />
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}