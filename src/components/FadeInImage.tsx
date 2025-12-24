import React, { useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

type FadeInImageProps = React.ComponentProps<typeof Animated.Image> & {
  style?: any;
};

export const FadeInImage = ({ style, ...props }: FadeInImageProps) => {
  const opacity = useRef(new Animated.Value(0)).current;

  const onLoad = () => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.Image
      style={[styles.image, { opacity }, style]}
      source={props.source}
      resizeMode={props.resizeMode}
      onLoad={onLoad}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  image: {
    ...StyleSheet.absoluteFillObject,
  },
});
