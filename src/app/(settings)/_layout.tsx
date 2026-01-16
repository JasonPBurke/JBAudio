import { Stack } from 'expo-router';

const SettingsLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
};

export default SettingsLayout;
