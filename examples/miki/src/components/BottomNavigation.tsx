import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppScreen } from '../types/note';

const tabs: { screen: AppScreen; label: string; icon: string }[] = [
  { screen: 'notes', label: 'Notes', icon: '▤' },
  { screen: 'pinned', label: 'Pinned', icon: '☆' },
  { screen: 'settings', label: 'Settings', icon: '⌘' },
];

type Props = {
  activeScreen: AppScreen;
  onChange: (screen: AppScreen) => void;
};

export function BottomNavigation({ activeScreen, onChange }: Props) {
  return (
    <View style={styles.container}>
      {tabs.map(tab => {
        const active = activeScreen === tab.screen;
        return (
          <Pressable
            key={tab.screen}
            accessibilityRole="button"
            accessibilityLabel={`Open ${tab.label} screen`}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.screen)}
            style={styles.tab}>
            <Text style={[styles.icon, active && styles.activeText]}>{tab.icon}</Text>
            <Text style={[styles.label, active && styles.activeText]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderColor: '#ECEDE8',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingBottom: 6,
    paddingTop: 8,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    paddingVertical: 4,
  },
  icon: {
    color: '#92948C',
    fontSize: 20,
  },
  label: {
    color: '#92948C',
    fontSize: 11,
    fontWeight: '600',
  },
  activeText: {
    color: '#D87853',
  },
});
