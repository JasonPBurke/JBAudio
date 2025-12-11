import {
  Keyboard,
  KeyboardAvoidingViewProps,
  Platform,
} from 'react-native';
import { useEffect, useState } from 'react';

export function useBehavior() {
  const defaultValue: KeyboardAvoidingViewProps['behavior'] =
    Platform.OS === 'ios' ? 'padding' : 'height';

  const [behavior, setBehavior] =
    useState<KeyboardAvoidingViewProps['behavior']>(defaultValue);

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', () => {
      setBehavior(defaultValue);
    });
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setBehavior(undefined);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  return behavior;
}
