import { StackScreenWithSearchBar } from '@/constants/layout';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

const LibraryScreenLayout = () => {
  const { colors } = useTheme();

  return (
    <View style={[{ backgroundColor: colors.overlay, flex: 1 }]}>
      <Stack>
        <Stack.Screen
          name='index'
          options={{
            ...StackScreenWithSearchBar,
            headerTitle: 'Library',
            headerShown: false,
          }}
        />
      </Stack>
    </View>
  );
};

export default LibraryScreenLayout;
