import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MikiMark } from './MikiMark';

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  showMark?: boolean;
};

export function ScreenHeader({ eyebrow, title, subtitle, showMark = false }: Props) {
  return (
    <View style={styles.container}>
      <View style={showMark ? styles.lockup : undefined}>
        {showMark ? <MikiMark size={62} /> : null}
        <View style={showMark ? styles.copy : undefined}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>
            {title}<Text style={styles.titleDot}>.</Text>
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 22,
    marginTop: 16,
  },
  lockup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  copy: {
    flex: 1,
  },
  eyebrow: {
    color: '#80837B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: '#20221E',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.8,
    marginTop: 3,
  },
  titleDot: {
    color: '#E48A64',
  },
  subtitle: {
    color: '#777A73',
    fontSize: 14,
    marginTop: 2,
  },
});
