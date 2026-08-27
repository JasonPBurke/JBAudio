import {
  getPlaybackState,
  pause,
  play,
  seekBy,
  State,
} from '@/player/trackPlayer';

/**
 * Handles Event.RemotePlayPause — the single "toggle" media key
 * (KEYCODE_MEDIA_PLAY_PAUSE) sent by steering-wheel controls, Bluetooth
 * AVRCP, and some Android Auto head units. The native layer consumes the
 * key event and emits `remote-play-pause`; without this handler the toggle
 * is a silent no-op.
 *
 * `onPlay` runs before playback starts (used for footprint recording, to
 * match the RemotePlay handler); its failure must never block playback.
 */
export async function handleRemotePlayPause(
  onPlay?: () => Promise<void> | void,
): Promise<void> {
  const { state } = await getPlaybackState();

  if (state === State.Playing || state === State.Buffering) {
    await pause();
    return;
  }

  if (onPlay) {
    try {
      await onPlay();
    } catch {
      // Non-fatal — playback must proceed even if the callback fails
    }
  }
  // QoL: repeat 1s of audio on resume, matching the in-app play button.
  await seekBy(-1);
  await play();
}
