import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { colors } from '@/constants/tokens';

const SettingsScreen = ({ navigation }: any) => {
  return (
    <View style={styles.container}>
      <Text style={{ color: colors.text }}> my settings page</Text>
    </View>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    marginTop: 90,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1f1f30',
  },
});
