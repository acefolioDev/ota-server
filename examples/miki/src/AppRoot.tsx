import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from './components/BottomNavigation';
import { MikiAlertHost } from './components/MikiAlert';
import { NoteEditorModal } from './components/NoteEditorModal';
import { useNotes } from './hooks/useNotes';
import type { AppScreen, Note } from './types/note';
import { NotesScreen } from './screens/NotesScreen';
import { PinnedScreen } from './screens/PinnedScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { useOtaUpdates } from './hooks/useOtaUpdates';

export default function AppRoot() {
  const { isCheckingUpdates, checkForUpdate } = useOtaUpdates();

  const [activeScreen, setActiveScreen] = useState<AppScreen>('notes');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const { notes, isLoading, storageError, saveNote, togglePinned, deleteNote } = useNotes();

  function openEditor(note: Note | null = null) {
    setEditingNote(note);
    setEditorVisible(true);
  }

  function handleSave(title: string, body: string, note: Note | null) {
    if (saveNote(title, body, note)) {
      setEditorVisible(false);
    }
  }

  useEffect(() => {
    checkForUpdate(true);
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.content}>
          {activeScreen === 'notes' ? (
            <NotesScreen
              notes={notes}
              isLoading={isLoading}
              storageError={storageError}
              onCreate={() => openEditor()}
              onEdit={openEditor}
              onTogglePinned={togglePinned}
              onDelete={deleteNote}
            />
          ) : activeScreen === 'pinned' ? (
            <PinnedScreen
              notes={notes}
              isLoading={isLoading}
              onEdit={openEditor}
              onTogglePinned={togglePinned}
              onDelete={deleteNote}
            />
          ) : (
            <SettingsScreen noteCount={notes.length} storageError={storageError} />
          )}
        </View>
        <BottomNavigation activeScreen={activeScreen} onChange={setActiveScreen} />
        <NoteEditorModal
          visible={editorVisible}
          note={editingNote}
          onClose={() => setEditorVisible(false)}
          onSave={handleSave}
        />
        <MikiAlertHost />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F7F7F3',
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
