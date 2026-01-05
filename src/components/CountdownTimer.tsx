import { colors } from '@/constants/tokens';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useObserveWatermelonData } from '@/hooks/useObserveWatermelonData';
import database from '@/db';

const CountdownTimer = ({
  timerChapters,
  endTimeMs,
}: {
  timerChapters: number | null;
  endTimeMs?: number | null;
}) => {
  const settingsCollection = useObserveWatermelonData(database, 'settings');
  const sleepTime = settingsCollection?.[0]?.sleepTime;

  const [remainingTime, setRemainingTime] = useState('');

  const effectiveEnd = endTimeMs ?? sleepTime ?? null;

  useEffect(() => {
    const updateRemainingTime = () => {
      if (effectiveEnd) {
        const now = Date.now();
        const remainingMilliseconds = Math.max(0, effectiveEnd - now);
        setRemainingTime(formatTime(remainingMilliseconds));
      } else {
        setRemainingTime('');
      }
    };

    updateRemainingTime(); // Initial update
    const intervalId = setInterval(updateRemainingTime, 1000); // Update every second

    return () => clearInterval(intervalId);
  }, [effectiveEnd]);

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

  return (
    <View style={styles.container}>
      <Text style={styles.timerText}>
        {timerChapters && !effectiveEnd
          ? `${timerChapters} Ch`
          : remainingTime || '00:00'}
      </Text>
    </View>
  );
};

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
