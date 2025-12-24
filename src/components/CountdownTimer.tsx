import { colors } from '@/constants/tokens';
import React, { useState, useEffect, memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useObserveWatermelonData } from '@/hooks/useObserveWatermelonData';
import database from '@/db';

const formatTime = (milliseconds: number) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60; // Keep seconds for 1-second updates

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
};

const CountdownTimer = memo(
  ({
    timerChapters,
    sleepTime,
  }: {
    timerChapters: number | null;
    sleepTime?: number | null;
  }) => {
    const settingsCollection = useObserveWatermelonData(
      database,
      'settings'
    );
    const observedSleepTime = settingsCollection?.[0]?.sleepTime;
    const effectiveSleepTime = useMemo(
      () =>
        sleepTime !== undefined ? sleepTime : (observedSleepTime ?? null),
      [sleepTime, observedSleepTime]
    );

    const [remainingTime, setRemainingTime] = useState('');

    useEffect(() => {
      const updateRemainingTime = () => {
        if (effectiveSleepTime) {
          const now = Date.now();
          const remainingMilliseconds = Math.max(
            0,
            effectiveSleepTime - now
          );
          setRemainingTime(formatTime(remainingMilliseconds));
        } else {
          setRemainingTime('');
        }
      };

      updateRemainingTime(); // Initial update
      const intervalId = setInterval(updateRemainingTime, 1000); // Update every second

      return () => clearInterval(intervalId);
    }, [effectiveSleepTime]);

    return (
      <View style={styles.container}>
        <Text style={styles.timerText}>
          {timerChapters && !effectiveSleepTime
            ? `${timerChapters} Ch`
            : remainingTime || '00:00'}
        </Text>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});

export default CountdownTimer;
