import type { Note } from '../types/note';

export function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null) return false;
  const note = value as Record<string, unknown>;
  return (
    typeof note.id === 'string' &&
    typeof note.title === 'string' &&
    typeof note.body === 'string' &&
    typeof note.color === 'string' &&
    typeof note.pinned === 'boolean' &&
    typeof note.updatedAt === 'number'
  );
}

export function parseNotes(value: string | null): Note[] {
  if (value === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error('Your saved notes could not be read. The local data is invalid.', {
      cause: error,
    });
  }
  if (!Array.isArray(parsed) || !parsed.every(isNote)) {
    throw new Error('Your saved notes have an unsupported format.');
  }
  return parsed;
}

export function filterNotes(notes: Note[], query: string, pinnedOnly = false): Note[] {
  const normalizedQuery = query.trim().toLowerCase();
  return notes
    .filter(note => !pinnedOnly || note.pinned)
    .filter(
      note =>
        !normalizedQuery ||
        note.title.toLowerCase().includes(normalizedQuery) ||
        note.body.toLowerCase().includes(normalizedQuery),
    )
    .sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.updatedAt - left.updatedAt);
}

export function formatUpdatedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
