import { Stack } from 'expo-router';

/**
 * Nested stack for the series create/edit flow. Steps push within this stack so
 * native back = previous step. Working state lives in seriesDraftStore (reset on
 * entry). This whole group is one entry on the root stack, so popping it (native
 * back from the first step) reveals the library with its toggle state intact.
 */
export default function SeriesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
