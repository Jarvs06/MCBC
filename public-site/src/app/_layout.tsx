import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/*
 * No auth, no session, no AuthProvider — this project only ever
 * has two routes (the homepage and the public Pulse share page),
 * both meant for anonymous visitors. See public-site/README.md.
 */

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="pulse/[token]" />
      </Stack>
    </SafeAreaProvider>
  );
}
