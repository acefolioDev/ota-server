import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export type MikiAlertTone = 'note' | 'danger' | 'good' | 'update';

export type MikiAlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type MikiAlertRequest = {
  id: number;
  title: string;
  message?: string;
  tone: MikiAlertTone;
  buttons: MikiAlertButton[];
};

const tones: Record<MikiAlertTone, { eyebrow: string; glyph: string; chip: string; scrap: string }> = {
  note: { eyebrow: 'A QUICK NOTE', glyph: '✳', chip: '#FCE8D5', scrap: '#F8F0CB' },
  danger: { eyebrow: 'ONE LAST LOOK', glyph: '!', chip: '#F8DFE6', scrap: '#FCE4E0' },
  good: { eyebrow: 'ALL QUIET', glyph: '✓', chip: '#DDF3E4', scrap: '#F8F0CB' },
  update: { eyebrow: 'JUST CHECKING', glyph: '↻', chip: '#E6E9FF', scrap: '#FCE8D5' },
};

type Listener = (request: MikiAlertRequest) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function showMikiAlert({
  title,
  message,
  tone,
  buttons,
}: {
  title: string;
  message?: string;
  tone?: MikiAlertTone;
  buttons?: MikiAlertButton[];
}) {
  const resolvedButtons = buttons?.length ? buttons : [{ text: 'Got it', style: 'default' as const }];
  const request: MikiAlertRequest = {
    id: nextId++,
    title,
    message,
    tone: tone ?? (resolvedButtons.some(button => button.style === 'destructive') ? 'danger' : 'note'),
    buttons: resolvedButtons,
  };
  listeners.forEach(listener => listener(request));
}

function subscribeMikiAlerts(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function MikiAlertHost() {
  const [current, setCurrent] = useState<MikiAlertRequest | null>(null);
  const queue = useRef<MikiAlertRequest[]>([]);
  const currentRef = useRef<MikiAlertRequest | null>(null);

  useEffect(() => {
    return subscribeMikiAlerts(request => {
      if (currentRef.current) {
        queue.current.push(request);
        return;
      }
      currentRef.current = request;
      setCurrent(request);
    });
  }, []);

  function finish(button?: MikiAlertButton) {
    const next = queue.current.shift() ?? null;
    currentRef.current = next;
    setCurrent(next);
    button?.onPress?.();
  }

  function dismiss() {
    if (!current) {
      return;
    }
    const cancel = current.buttons.find(button => button.style === 'cancel');
    const onlyButton = current.buttons.length === 1 ? current.buttons[0] : undefined;
    finish(cancel ?? (onlyButton?.style === 'destructive' ? undefined : onlyButton));
  }

  const tone = current ? tones[current.tone] : tones.note;

  return (
    <Modal
      visible={current !== null}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent>
      {current ? (
        <View style={styles.scrim}>
          <Pressable accessibilityLabel="Dismiss alert" style={styles.backdrop} onPress={dismiss} />
          <View accessibilityRole="alert" onStartShouldSetResponder={() => true} style={styles.card}>
            <View style={styles.badgeWrap}>
              <View style={[styles.scrap, { backgroundColor: tone.scrap }]} />
              <View style={[styles.badge, { backgroundColor: tone.chip }]}>
                <Text style={styles.glyph}>{tone.glyph}</Text>
              </View>
            </View>
            <Text style={styles.eyebrow}>{tone.eyebrow}</Text>
            <Text style={styles.title}>{current.title}</Text>
            {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
            <View style={[styles.actions, current.buttons.length > 1 && styles.actionsRow]}>
              {current.buttons.map(button => {
                const role = button.style ?? 'default';
                return (
                  <Pressable
                    key={button.text}
                    accessibilityRole="button"
                    onPress={() => finish(button)}
                    style={({ pressed }) => [
                      styles.button,
                      role === 'cancel' ? styles.cancelButton : styles.filledButton,
                      role === 'destructive' && styles.dangerButton,
                      current.buttons.length > 1 && styles.rowButton,
                      pressed && styles.pressed,
                    ]}>
                    <Text
                      style={[
                        styles.buttonText,
                        role === 'cancel' ? styles.cancelText : styles.filledText,
                      ]}>
                      {button.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    alignItems: 'center',
    backgroundColor: 'rgba(32, 34, 30, 0.46)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  backdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    backgroundColor: '#FFFCF8',
    borderRadius: 28,
    maxWidth: 420,
    paddingBottom: 18,
    paddingHorizontal: 22,
    paddingTop: 26,
    width: '100%',
    shadowColor: '#20221E',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 10,
  },
  badgeWrap: {
    height: 64,
    marginBottom: 16,
    width: 64,
  },
  scrap: {
    borderRadius: 18,
    height: 52,
    left: 10,
    position: 'absolute',
    top: 8,
    transform: [{ rotate: '12deg' }],
    width: 52,
  },
  badge: {
    alignItems: 'center',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
    width: 56,
  },
  glyph: {
    color: '#252721',
    fontSize: 24,
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
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 6,
  },
  message: {
    color: '#777A73',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  actions: {
    marginTop: 22,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  rowButton: {
    flex: 1,
  },
  filledButton: {
    backgroundColor: '#252721',
  },
  dangerButton: {
    backgroundColor: '#8E352A',
  },
  cancelButton: {
    backgroundColor: '#F7F7F3',
    borderColor: '#ECEDE8',
    borderWidth: 1,
    flex: 1,
  },
  pressed: {
    opacity: 0.76,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  filledText: {
    color: '#FFFFFF',
  },
  cancelText: {
    color: '#5C5E57',
  },
});
