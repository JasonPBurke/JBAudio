import { useSleepTimerStore, SleepTimerStatus } from '@/setup/sleepTimer';

export const useSleepTimer = (): SleepTimerStatus => useSleepTimerStore();
