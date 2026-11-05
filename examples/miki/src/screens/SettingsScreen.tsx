import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { useOtaUpdates } from '../hooks/useOtaUpdates';

type Props = {
  noteCount: number;
  storageError: string | null;
};

export function SettingsScreen({ noteCount, storageError }: Props) {
  const { isCheckingUpdates, checkForUpdate } = useOtaUpdates();

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="A LITTLE ABOUT MIKI"
        title="Settings"
        subtitle="A calm place for your notes."
      />
      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>YOUR NOTES</Text>
        <Text style={styles.cardTitle}>
          {noteCount} {noteCount === 1 ? 'thought' : 'thoughts'} saved
        </Text>
        <Text style={styles.cardCopy}>Your notes stay on this device.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>APP UPDATES</Text>
        <Text style={styles.cardTitle}>Keep Miki up to date</Text>
        <Text style={styles.cardCopy}>
          Check for the latest improvements without reinstalling the app.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={checkForUpdate}
          disabled={isCheckingUpdates}
          style={({ pressed }) => [
            styles.updateButton,
            pressed && styles.pressed,
            isCheckingUpdates && styles.disabled,
          ]}>
          <Text style={styles.updateButtonText}>
            {isCheckingUpdates ? 'Checking…' : '↻  Check for updates'}
          </Text>
        </Pressable>
      </View>
      {storageError ? (
        <View accessibilityRole="alert" style={styles.errorBanner}>
          <Text style={styles.errorText}>{storageError}</Text>
        </View>
      ) : null}
      <Text style={styles.footer}>Miki · Little thoughts, kept close.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#ECEDE8',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    padding: 18,
  },
  cardEyebrow: {
    color: '#96988F',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  cardTitle: {
    color: '#292B25',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 9,
  },
  cardCopy: {
    color: '#777A73',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  updateButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#252721',
    borderRadius: 14,
    marginTop: 16,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  pressed: {
    opacity: 0.76,
  },
  disabled: {
    opacity: 0.55,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#FCE4E0',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: '#8E352A',
    fontSize: 13,
  },
  footer: {
    color: '#A1A39B',
    fontSize: 12,
    marginTop: 'auto',
    paddingBottom: 20,
    textAlign: 'center',
  },
});
