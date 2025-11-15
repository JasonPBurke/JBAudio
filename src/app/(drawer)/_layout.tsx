import { Drawer } from 'expo-router/drawer';
import DrawerContent from '@/components/DrawerContent';

const DrawerLayout = () => {
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        swipeEdgeWidth: 0,
        drawerType: 'slide',
        headerShown: false,
        drawerStyle: { width: '70%' },
      }}
    >
      <Drawer.Screen name='(library)' options={{ title: 'Library' }} />
    </Drawer>
  );
};

export default DrawerLayout;
