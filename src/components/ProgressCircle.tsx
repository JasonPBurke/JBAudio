import { Text, Animated, Easing } from 'react-native';
import { useRef } from 'react';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import { colors } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
// import { bookTimeRemaining } from './BookTimeRemaining';

type ProgressCircleProps = {
  size: number;
};

const ProgressCircle = ({ size }: ProgressCircleProps) => {
  const rotation = useRef(new Animated.Value(0)).current;
  const circularProgressRef = useRef<AnimatedCircularProgress>(null);

  const spin = () => {
    rotation.setValue(0);
    Animated.timing(rotation, {
      toValue: 1,
      duration: 4200,
      easing: Easing.elastic(1),
      useNativeDriver: true,
    }).start(() => {
      // Optionally, reset the rotation or perform other actions after the spin
    });
  };

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${6 * 360}deg`], // 6 rotations (6 * 360 = 2160)
  });

  // const timeRemaining = bookTimeRemaining();
  // console.log('timeRemaining', timeRemaining);

  return (
    <AnimatedCircularProgress
      ref={circularProgressRef}
      style={{
        position: 'absolute',
        bottom: 6,
        left: 6,
        transform: [{ rotateY: rotate }],
      }}
      duration={3000}
      rotation={0}
      size={size}
      width={2}
      fill={100}
      tintColor={withOpacity(colors.primary, 0.73)}
      onAnimationComplete={spin}
      backgroundColor={withOpacity(colors.textMuted, 0.64)}
      children={(value: any) => (
        <Text
          style={{
            color: withOpacity(colors.textMuted, 0.64),
            fontSize: 12,
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          {value.toFixed(0)}%
          {/* {Math.round(progress.currentTime / 1000)} */}
        </Text>
      )}
    />
  );
};

export default ProgressCircle;
