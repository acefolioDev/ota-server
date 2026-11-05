export type Note = {
  id: string;
  title: string;
  body: string;
  color: string;
  pinned: boolean;
  updatedAt: number;
};

export type AppScreen = 'notes' | 'pinned' | 'settings';
