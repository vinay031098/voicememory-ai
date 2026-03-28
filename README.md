# VoiceMemory AI

> Record, upload, transcribe, and chat with your voice memories using AI.

An iOS & Android app that lets you:
- **Record** live audio with pause/resume
- **Upload** any audio or video format (MP3, WAV, M4A, AAC, OGG, FLAC, MP4, MOV, WEBM)
- **Auto-transcribe** using OpenAI Whisper
- **Ask AI questions** about anything you've ever said: *"What did I talk about last week?"* *"What did I say about my goals?"*
- **Discover topics** automatically clustered from your recordings

## Tech Stack

### Backend (Node.js)
- Express.js REST API
- OpenAI Whisper (transcription)
- OpenAI GPT-4o (AI chat)
- LangChain (RAG pipeline)
- ChromaDB (vector embeddings)
- SQLite (metadata)
- Multer (file uploads)

### Frontend (React Native)
- Expo SDK
- TypeScript
- React Navigation (bottom tabs + stack)
- Expo AV (recording)
- Expo Document Picker (file upload)
- Zustand (state management)
- NativeWind (styling)

## Project Structure

```
voicememory-ai/
├── backend/           # Node.js Express API
│   ├── server.js      # Entry point
│   ├── db.js          # SQLite database
│   ├── upload.js      # Multer file upload config
│   ├── whisper.js     # OpenAI Whisper transcription
│   ├── vectorStore.js # ChromaDB embeddings
│   ├── aiChat.js      # LangChain RAG chat
│   ├── topicClustering.js
│   ├── package.json
│   └── routes/
│       ├── recordings.js
│       ├── transcriptions.js
│       └── chat.js
└── app/               # React Native Expo app
    ├── App.tsx
    ├── app.json
    ├── babel.config.js
    ├── tsconfig.json
    └── src/
        ├── navigation/  # React Navigation setup
        ├── screens/     # All app screens
        │   ├── HomeScreen.tsx
        │   ├── RecordScreen.tsx
        │   ├── UploadScreen.tsx
        │   ├── ChatScreen.tsx
        │   ├── TopicsScreen.tsx
        │   └── RecordingDetailScreen.tsx
        ├── services/
        │   └── api.ts   # Backend API client
        └── store/
            └── useStore.ts  # Zustand global state
```

## Quick Start

### 1. Clone & Setup Backend

```bash
git clone https://github.com/vinay031098/voicememory-ai.git
cd voicememory-ai/backend
npm install

# Copy and fill in environment variables
cp ../.env.example .env
# Edit .env — add your OPENAI_API_KEY

npm start
# Backend runs on http://localhost:3000
```

### 2. Setup Frontend

```bash
cd ../app
npm install

# Create .env file
echo "EXPO_PUBLIC_API_URL=http://YOUR_MACHINE_IP:3000/api" > .env

npx expo start
# Scan QR code with Expo Go app
```

### 3. Get Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Add it to `backend/.env`:
   ```
   OPENAI_API_KEY=sk-...
   ```

## Environment Variables

See `.env.example` for all required variables.

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI key for Whisper + GPT |
| `PORT` | Backend port (default: 3000) |
| `WHISPER_MODEL` | Whisper model (default: whisper-1) |
| `CHAT_MODEL` | Chat model (default: gpt-4o) |

## Features

### Voice Recording
- Live mic recording with animated waveform
- Pause and resume recording
- Auto-upload and transcribe after stopping

### File Upload
- Support for 9+ audio/video formats
- Files up to 500MB
- Automatic title extraction from filename

### AI Memory Chat
- Ask natural language questions
- Get answers sourced from your recordings
- View which recordings each answer came from
- Pre-built question suggestions

### Topic Discovery
- Automatic topic clustering across all recordings
- Color-coded topic cards
- Expandable summaries per topic

## License

MIT
