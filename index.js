import TrackPlayer from 'react-native-track-player';
import playbackService from './src/setup/service';

// The playback service MUST be registered in the app entry, not in a route
// module. Route modules (e.g. src/app/_layout.tsx) only execute when the
// router renders them; in a headless start — Android Auto connecting while
// the app process has no UI — they never run, leaving the 'TrackPlayer'
// headless task unregistered and all remote controls dead.
TrackPlayer.registerPlaybackService(() => playbackService);
console.log('[entry] index.js evaluated, playback service registered');

require('expo-router/entry');
