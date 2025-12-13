import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors } from './tokens';

export const StackScreenWithSearchBar: NativeStackNavigationOptions = {
  headerTintColor: colors.text,
  headerTransparent: true,
  headerTitleStyle: {
    fontSize: 36,
  },
};
