import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { colors } from '@/constants/tokens';

type Props = DrawerContentComponentProps;

const DrawerContent = (props: Props) => {
  const handleSettingsPress = () => {
    props.navigation.closeDrawer(); //? could leave the drawer open
    // Navigate to the settings screen using Expo Router's navigation
    props.navigation.navigate('settings');
  };

  return (
    <DrawerContentScrollView {...props} style={styles.drawerContainer}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerHeaderText}>Settings</Text>
      </View>
      {/* Render default drawer items */}
      <DrawerItemList {...props} />
      {/* Custom Settings Button */}
      <TouchableOpacity
        style={styles.customItem}
        onPress={handleSettingsPress}
      >
        <Text style={styles.customItemText}>Settings</Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  drawerContainer: {
    backgroundColor: '#ceced3',
  },
  drawerHeader: {
    padding: 20,
    backgroundColor: '#6200ee',
  },
  drawerHeaderText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  customItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  customItemText: {
    fontSize: 16,
    color: '#333',
  },
});

export default DrawerContent;
