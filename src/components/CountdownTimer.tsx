import { colors } from '@/constants/tokens';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';

const CountdownTimer = ({
  initialMilliseconds,
  timerChapters,
}: {
  initialMilliseconds: number;
  timerChapters: number | null;
}) => {
  const initialMinutes = convertMillisecondsToMinutes(initialMilliseconds);
  const [time, setTime] = useState<number>(initialMinutes);
  const timerRef = useRef<number>(0); // Use a ref to store the interval ID

  // console.log('timerChapters', timerChapters);
  // console.log('initialMinutes', initialMilliseconds);
  useEffect(() => {
    if (timerChapters && initialMilliseconds === 0) return;
    setTime(initialMinutes); // Set initial time when initialMinutes changes
    timerRef.current = setInterval(() => {
      setTime((prevTime) => {
        if (prevTime <= 0) {
          clearInterval(timerRef.current); // Stop the timer when it reaches 0
          return 0;
        }
        return prevTime - 1;
      });
    }, 60000); // Update every minute

    return () => clearInterval(timerRef.current);
  }, [initialMinutes, timerChapters]); // Re-run effect when initialMinutes changes

  const formatTime = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.timerText}>
        {timerChapters && initialMilliseconds === 0
          ? `${timerChapters} Ch`
          : formatTime(time)}
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

function convertMillisecondsToMinutes(milliseconds: number) {
  const minutes = milliseconds / 60000;
  return minutes;
}
