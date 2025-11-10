import { Text } from 'react-native';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import { colors } from '@/constants/tokens';

type ProgressCircleProps = {
  size: number;
};

const ProgressCircle = ({ size }: ProgressCircleProps) => {
  return (
    <AnimatedCircularProgress
      style={{ position: 'absolute', bottom: 6, left: 6 }}
      duration={3000}
      rotation={0}
      size={size}
      width={2}
      fill={100}
      tintColor={colors.primary}
      onAnimationComplete={() => console.log('onAnimationComplete')}
      backgroundColor='#3d5875'
      children={(value: any) => (
        <Text
          style={{
            color: 'white',
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
