import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { colors } from '@/constants/tokens';

const settings = () => {
  return (
    <View style={styles.container}>
      <Text style={{ color: colors.text }}>settings</Text>
    </View>
  );
};

export default settings;

const styles = StyleSheet.create({
  container: {
    marginTop: 90,
    width: '60%',
    height: '60%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1f1f30',
    borderColor: colors.textMuted,
    borderWidth: 1,
    borderRadius: 4,
  },
});
