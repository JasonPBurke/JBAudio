import { FloatingPlayer } from '@/components/FloatingPlayer';
import { StackScreenWithSearchBar } from '@/constants/layout';
import { Stack } from 'expo-router';
import { View } from 'react-native';

const LibraryScreenLayout = () => {
  return (
    <View style={[{ backgroundColor: '#fff', flex: 1 }]}>
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
      <FloatingPlayer
        style={{
          position: 'absolute',
          left: 8,
          right: 8,
          bottom: 10,
        }}
      />
    </View>
  );
};

export default LibraryScreenLayout;
