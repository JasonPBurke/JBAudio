import React, { useState } from 'react';
import { Button, Text, View, StyleSheet, ScrollView } from 'react-native';

// Import your native module
import ExpoMediaInfoModule from '../modules/expo-media-info';

export default function MediaInfoTester() {
  const [mediaInfo, setMediaInfo] = useState('');
  const [error, setError] = useState('');

  const handleGetMediaInfo = async () => {
    try {
      // --- IMPORTANT ---
      // Replace this with a REAL file URI from your device's storage.
      // You can use a library like 'expo-document-picker' or 'expo-media-library'
      // to get a valid URI for a media file.
      const fileUri = 'file:///path/to/your/media/file.mp3'; //! <--- CHANGE THIS

      console.log(`Requesting media info for: ${fileUri}`);
      setMediaInfo('');
      setError('');

      const result = await ExpoMediaInfoModule.getMediaInfo(fileUri);

      // Pretty-print the JSON for display
      const parsedResult = JSON.parse(result);
      const formattedResult = JSON.stringify(parsedResult, null, 2);

      console.log('Media Info Received:', formattedResult);
      setMediaInfo(formattedResult);
    } catch (e: any) {
      console.error('Error getting media info:', e);
      setError(e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Button title='Get Media Info' onPress={handleGetMediaInfo} />
      <ScrollView style={styles.scrollView}>
        {mediaInfo ? (
          <Text selectable style={styles.text}>
            {mediaInfo}
          </Text>
        ) : null}
        {error ? (
          <Text selectable style={styles.errorText}>
            Error: {error}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  scrollView: {
    marginTop: 16,
    width: '100%',
  },
  text: {
    fontFamily: 'monospace',
    textAlign: 'left',
  },
  errorText: {
    color: 'red',
  },
});
