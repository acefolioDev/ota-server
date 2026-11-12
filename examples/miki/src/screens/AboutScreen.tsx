import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';

export function AboutScreen() {
  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="MEET MIKI"
        title="About"
        subtitle="A quiet notebook that stays on this device."
      />
      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>WHAT IT IS</Text>
        <Text style={styles.cardTitle}>Little thoughts, kept close</Text>
        <Text style={styles.cardCopy}>
          Write a note, pin the ones you want nearby, and leave the rest of the
          app out of the way.
        </Text>
      </View>
      <Text style={styles.footer}>Miki · Made to stay simple.</Text>
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
  footer: {
    color: '#A1A39B',
    fontSize: 12,
    marginTop: 'auto',
    paddingBottom: 20,
    textAlign: 'center',
  },
});
