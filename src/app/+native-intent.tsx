/**
 * Intercepts incoming native deep links before Expo Router resolves them.
 *
 * TrackPlayer hard-codes `trackplayer://notification.click` as the data URI on
 * the notification's tap intent (MusicService.kt), so every notification tap
 * arrives as a deep link. We previously routed it to /player via the
 * notification.click route (see notification.click.tsx.disabled); now we
 * swallow it so a tap just foregrounds the app in whatever state it was left
 * in, or launches at the normal initial route on cold start.
 *
 * Returning null tells the router to ignore the URL entirely.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  if (path.includes('notification.click')) {
    return null;
  }
  return path;
}
