import { colors } from '@/constants/tokens';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

type CountdownTimerProps = {
  timerChapters: number | null;
  endTimeMs: number | null;
};

// Display format: minutes only (no seconds)
// Examples: "45m", "1:30" (hours:minutes)
const formatTime = (milliseconds: number): string => {
  const totalMinutes = Math.ceil(milliseconds / 60000); // Round up to nearest minute
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }
  return `${minutes}m`;
};

const CountdownTimer = ({
  timerChapters,
  endTimeMs,
}: CountdownTimerProps) => {
  const [remainingTime, setRemainingTime] = useState('');

  useEffect(() => {
    if (!endTimeMs) {
      setRemainingTime('');
      return;
    }

    const updateRemainingTime = () => {
      const now = Date.now();
      const remainingMilliseconds = Math.max(0, endTimeMs - now);
      setRemainingTime(formatTime(remainingMilliseconds));
    };

    updateRemainingTime(); // Initial update

    // Adaptive interval based on remaining time
    // Since we only show minutes, we never need 1-second updates
    const remaining = endTimeMs - Date.now();
    let interval: number;

    if (remaining > 3600000) {
      interval = 60000; // > 1 hour: update every minute
    } else if (remaining > 300000) {
      interval = 30000; // > 5 min: update every 30 seconds
    } else {
      interval = 10000; // <= 5 min: update every 10 seconds (minimum)
    }

    const intervalId = setInterval(updateRemainingTime, interval);
    return () => clearInterval(intervalId);
  }, [endTimeMs]);

  // For chapter-based timer (no countdown needed)
  if (timerChapters && !endTimeMs) {
    return (
      <View style={styles.container}>
        <Text style={styles.timerText}>{timerChapters} Ch</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.timerText}>{remainingTime || '0m'}</Text>
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
    fontFamily: 'Rubik',
    fontSize: 12,
    color: colors.textMuted,
  },
});

export default React.memo(CountdownTimer);
