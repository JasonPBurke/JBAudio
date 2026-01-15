import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

/**
 * This route handles deep links from TrackPlayer notification taps.
 * When the user taps the notification, TrackPlayer sends: sonicbooks:///notification.click
 * This component immediately redirects to the player screen.
 */
export default function NotificationClickRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to player screen immediately
    router.replace('/player');
  }, [router]);
}
