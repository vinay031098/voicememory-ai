import * as FileSystem from 'expo-file-system';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  // Recordings
  getRecordings: () => request<any[]>('/recordings'),

  getRecording: (id: string) => request<any>(`/recordings/${id}`),

  deleteRecording: (id: string) =>
    request<void>(`/recordings/${id}`, { method: 'DELETE' }),

  uploadRecording: async (uri: string, fileName: string, title: string): Promise<any> => {
    const formData = new FormData();
    formData.append('audio', {
      uri,
      name: fileName,
      type: getAudioMimeType(fileName),
    } as any);
    formData.append('title', title);

    const response = await fetch(`${BASE_URL}/recordings/upload`, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Upload failed');
    }
    return response.json();
  },

  // Transcriptions
  getTranscription: (recordingId: string) =>
    request<any>(`/transcriptions/${recordingId}`),

  retryTranscription: (recordingId: string) =>
    request<any>(`/transcriptions/${recordingId}/retry`, { method: 'POST' }),

  // AI Chat
  chat: (question: string, history?: { role: string; content: string }[]) =>
    request<{ answer: string; sources: any[] }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ question, history }),
    }),

  // Topics
  getTopics: () => request<any[]>('/chat/topics'),

  // Summary for a specific recording
  getRecordingSummary: (recordingId: string) =>
    request<{ summary: string }>(`/chat/summary/${recordingId}`),
};

function getAudioMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/m4a',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}
