import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Note } from '../types/note';

type Props = {
  visible: boolean;
  note: Note | null;
  onClose: () => void;
  onSave: (title: string, body: string, note: Note | null) => void;
};

export function NoteEditorModal({ visible, note, onClose, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (visible) {
      setTitle(note?.title ?? '');
      setBody(note?.body ?? '');
    }
  }, [note, visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" onPress={onClose}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.label}>{note ? 'EDIT NOTE' : 'NEW NOTE'}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => onSave(title, body, note)}>
              <Text style={styles.save}>Save</Text>
            </Pressable>
          </View>
          <TextInput
            autoFocus
            accessibilityLabel="Note title"
            value={title}
            onChangeText={setTitle}
            placeholder="Give it a title"
            placeholderTextColor="#A6A7A2"
            style={styles.titleInput}
            returnKeyType="next"
          />
          <TextInput
            accessibilityLabel="Note body"
            value={body}
            onChangeText={setBody}
            placeholder="Start wherever you are..."
            placeholderTextColor="#A6A7A2"
            style={styles.bodyInput}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.footnote}>Saved privately on this device.</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F7F7F3',
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  cancel: {
    color: '#73756E',
    fontSize: 14,
  },
  label: {
    color: '#8A8C84',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  save: {
    color: '#D87853',
    fontSize: 14,
    fontWeight: '700',
  },
  titleInput: {
    color: '#252721',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginTop: 30,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  bodyInput: {
    color: '#50524B',
    flex: 1,
    fontSize: 16,
    lineHeight: 25,
    paddingHorizontal: 0,
    paddingTop: 12,
  },
  footnote: {
    color: '#999B94',
    fontSize: 11,
    paddingBottom: 12,
    textAlign: 'center',
  },
});
