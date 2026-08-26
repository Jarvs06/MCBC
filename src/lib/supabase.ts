import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import {
  createClient,
  processLock,
} from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL!;

const supabasePublishableKey =
  process.env
    .EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase =
  createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        ...(Platform.OS !== 'web'
          ? {
              storage: AsyncStorage,
            }
          : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        lock: processLock,
      },
    }
  );