import { colors, fontSize } from '@/constants/tokens';
import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  View,
  ViewStyle,
  Text,
  StyleProp,
} from 'react-native';

interface Props {
  title?: string;
  style?: StyleProp<ViewStyle>;
  onClick?: () => void;
}

const ButtonComponent = ({ title = 'Modal', style, onClick }: Props) => {
  return (
    <TouchableOpacity onPress={onClick} style={[styles.button, style]}>
      <View>
        <Text style={styles.buttonText}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: 20,
  },
  buttonText: {
    fontSize: fontSize.sm,
  },
});

export default ButtonComponent;
