import * as Updates from 'expo-updates';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type UpdateDownloadPhase = 'idle' | 'downloading' | 'applying';

type UpdateDownloadState = {
  phase: UpdateDownloadPhase;
  progress: number;
};

const listeners = new Set<(state: UpdateDownloadState) => void>();
let state: UpdateDownloadState = { phase: 'idle', progress: 0 };

function emit(next: UpdateDownloadState) {
  state = next;
  listeners.forEach(listener => listener(state));
}

export function beginUpdateDownload() {
  emit({ phase: 'downloading', progress: 0 });
}

export function setUpdateDownloadProgress(progress: number) {
  if (state.phase !== 'downloading') return;
  const next = Math.min(1, Math.max(0, progress));
  if (Math.abs(next - state.progress) < 0.005) return;
  emit({ phase: 'downloading', progress: next });
}

export function beginUpdateApply() {
  emit({ phase: 'applying', progress: 1 });
}

export function resetUpdateDownload() {
  if (state.phase === 'idle') return;
  emit({ phase: 'idle', progress: 0 });
}

export const mikiReloadScreen = {
  backgroundColor: '#F7F7F3',
  fade: true,
  spinner: {
    enabled: true,
    color: '#E48A64',
    size: 'small' as const,
  },
};

export function UpdateDownloadHost() {
  const updates = Updates.useUpdates();
  const [download, setDownload] = useState(state);

  useEffect(() => {
    return subscribe(setDownload);
  }, []);

  useEffect(() => {
    if (updates.isDownloading && typeof updates.downloadProgress === 'number') {
      setUpdateDownloadProgress(updates.downloadProgress);
    }
  }, [updates.downloadProgress, updates.isDownloading]);

  if (download.phase === 'idle') return null;

  const percent = Math.round(download.progress * 100);
  const applying = download.phase === 'applying';

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.scrim} />
      <View style={styles.card} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
        <View style={styles.badgeWrap}>
          <View style={styles.scrap} />
          <View style={styles.badge}>
            <Text style={styles.glyph}>↻</Text>
          </View>
        </View>
        <Text style={styles.eyebrow}>{applying ? 'ALMOST THERE' : 'A FRESH PAGE'}</Text>
        <Text style={styles.title}>{applying ? 'Opening the new Miki' : 'Downloading Miki'}</Text>
        <Text style={styles.message}>
          {applying ? 'Your notes stay right where you left them.' : 'The rest of Miki stays put while this arrives.'}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.percent}>{percent}%</Text>
      </View>
    </View>
  );
}

function subscribe(listener: (state: UpdateDownloadState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  scrim: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: 'rgba(247, 247, 243, 0.72)',
  },
  card: {
    backgroundColor: '#FFFCF8',
    borderRadius: 28,
    maxWidth: 420,
    paddingBottom: 18,
    paddingHorizontal: 22,
    paddingTop: 22,
    width: '100%',
    shadowColor: '#20221E',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  badgeWrap: {
    height: 58,
    marginBottom: 14,
    width: 58,
  },
  scrap: {
    backgroundColor: '#FCE8D5',
    borderRadius: 16,
    height: 46,
    left: 10,
    position: 'absolute',
    top: 8,
    transform: [{ rotate: '12deg' }],
    width: 46,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: '#E6E9FF',
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
    width: 50,
  },
  glyph: {
    color: '#252721',
    fontSize: 22,
    fontWeight: '700',
  },
  eyebrow: {
    color: '#80837B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: '#20221E',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginTop: 6,
  },
  message: {
    color: '#777A73',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  track: {
    backgroundColor: '#ECEDE8',
    borderRadius: 999,
    height: 8,
    marginTop: 18,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: '#E48A64',
    borderRadius: 999,
    height: '100%',
  },
  percent: {
    color: '#252721',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
});
