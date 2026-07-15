import { create } from 'zustand';

/**
 * A single source of truth for whether the app is foregrounded.
 *
 * Fed by the one AppState listener in src/app/_layout.tsx. Consumers read it
 * imperatively via `useAppStateStore.getState().isActive` inside event
 * handlers so they can go dormant while backgrounded WITHOUT subscribing
 * (no re-render, no effect teardown/re-subscribe churn on every transition).
 *
 * The player screen stays mounted while backgrounded (so returning to the app
 * lands on the same screen and avoids a costly remount), but its per-tick
 * progress handlers early-return on `!isActive` — nothing invisible should
 * burn CPU. See PlayerProgressBar / useProgressReanimated / etc.
 */
interface AppStateStore {
  isActive: boolean;
  setActive: (isActive: boolean) => void;
}

export const useAppStateStore = create<AppStateStore>()((set) => ({
  isActive: true,
  setActive: (isActive) => set({ isActive }),
}));
