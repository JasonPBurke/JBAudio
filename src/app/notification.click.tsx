import { useEffect } from 'react';
import { useNavigationContainerRef } from 'expo-router';
import { CommonActions } from '@react-navigation/native';

/**
 * This route handles deep links from TrackPlayer notification taps.
 * When the user taps the notification, TrackPlayer sends: sonicbooks:///notification.click
 * This component immediately redirects to the player screen.
 *
 * On cold start, the root layout may not be mounted yet, so we must wait
 * for navigation to be ready before redirecting.
 *
 * We use CommonActions.reset to ensure the drawer is mounted behind the player,
 * so the user can dismiss the player and use the app normally.
 */
export default function NotificationClickRedirect() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    const navigateToPlayer = () => {
      // Reset navigation state with drawer at bottom, player on top
      // This ensures there's a screen to go back to when dismissing player
      navigationRef.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [{ name: '(drawer)' }, { name: 'player' }],
        })
      );
    };

    // Wait for navigation to be ready before redirecting
    // This handles cold starts where root layout hasn't mounted yet
    if (navigationRef.isReady()) {
      navigateToPlayer();
      return;
    }

    // Poll until navigation is ready (cold start case)
    const interval = setInterval(() => {
      if (navigationRef.isReady()) {
        clearInterval(interval);
        navigateToPlayer();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [navigationRef]);
}
