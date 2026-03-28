import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Recording {
  id: string;
  title: string;
  duration: number;
  created_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_size: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  timestamp: Date;
}

interface AppState {
  // Recordings
  recordings: Recording[];
  setRecordings: (recordings: Recording[]) => void;
  addRecording: (recording: Recording) => void;
  removeRecording: (id: string) => void;
  updateRecordingStatus: (id: string, status: Recording['status']) => void;

  // Chat
  chatHistory: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;

  // Settings
  apiUrl: string;
  setApiUrl: (url: string) => void;

  // App state
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  recordings: [],
  setRecordings: (recordings) => set({ recordings }),
  addRecording: (recording) =>
    set((state) => ({ recordings: [recording, ...state.recordings] })),
  removeRecording: (id) =>
    set((state) => ({ recordings: state.recordings.filter((r) => r.id !== id) })),
  updateRecordingStatus: (id, status) =>
    set((state) => ({
      recordings: state.recordings.map((r) => r.id === id ? { ...r, status } : r),
    })),

  chatHistory: [],
  addChatMessage: (message) =>
    set((state) => ({ chatHistory: [...state.chatHistory, message] })),
  clearChatHistory: () => set({ chatHistory: [] }),

  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api',
  setApiUrl: (url) => set({ apiUrl: url }),

  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),
  error: null,
  setError: (error) => set({ error }),
}));
