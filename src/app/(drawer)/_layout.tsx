import { Drawer } from 'expo-router/drawer';
import DrawerContent from '@/components/DrawerContent';

const DrawerLayout = () => {
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        swipeEdgeWidth: 0,
        drawerType: 'slide',
        drawerStyle: {
          width: '70%',
          backgroundColor: '#1f1f30',
        },
      }}
    >
      <Drawer.Screen
        name='(library)'
        options={{ headerShown: false, title: 'Library' }}
      />
      <Drawer.Screen
        name='settings'
        options={{ headerShown: false, title: 'Settings' }}
      />
    </Drawer>
  );
};

export default DrawerLayout;
