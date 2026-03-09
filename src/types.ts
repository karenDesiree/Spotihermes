export interface User {
  username: string;
  role: 'admin' | 'user';
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  audioUrl: string;
  lyrics: string | null;
  createdAt: string;
}
