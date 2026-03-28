const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const { ChromaClient } = require('chromadb');
const { v4: uuidv4 } = require('uuid');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const chroma = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' });

/**
 * Transcribe audio file using OpenAI Whisper
 * Supports: mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg, flac, aac
 */
async function transcribeAudio(filePath, language = null) {
  const fileStream = fs.createReadStream(filePath);
  const params = {
    file: fileStream,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['word', 'segment'],
  };
  if (language) params.language = language;

  const transcription = await openai.audio.transcriptions.create(params);
  return {
    text: transcription.text,
    language: transcription.language,
    duration: transcription.duration,
    segments: transcription.segments || [],
    words: transcription.words || [],
  };
}

/**
 * Extract topic/category from transcription using GPT
 */
async function extractTopic(text) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a topic classifier. Given a transcription, extract the main topic in 2-4 words. Return ONLY the topic, nothing else. Examples: "Work Meeting", "Personal Goals", "Shopping List", "Health Notes", "Travel Plans"',
      },
      { role: 'user', content: text },
    ],
    max_tokens: 20,
    temperature: 0.3,
  });
  return response.choices[0].message.content.trim();
}

/**
 * Chunk text into overlapping segments for embedding
 */
function chunkText(text, chunkSize = 500, overlap = 50) {
  const words = text.split(' ');
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) chunks.push(chunk);
    i += chunkSize - overlap;
  }
  return chunks;
}

/**
 * Store transcription chunks in ChromaDB vector store
 */
async function storeInVectorDB(recordingId, text, metadata = {}) {
  const collection = await chroma.getOrCreateCollection({
    name: 'voice_memories',
    metadata: { 'hnsw:space': 'cosine' },
  });

  const topic = metadata.topic || await extractTopic(text);
  const chunks = chunkText(text);

  const embeddings = [];
  for (const chunk of chunks) {
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk,
    });
    embeddings.push(res.data[0].embedding);
  }

  const ids = chunks.map(() => uuidv4());
  const metadatas = chunks.map((_, i) => ({
    recordingId,
    topic,
    chunkIndex: i,
    totalChunks: chunks.length,
    createdAt: new Date().toISOString(),
    ...metadata,
  }));

  await collection.add({
    ids,
    embeddings,
    documents: chunks,
    metadatas,
  });

  return { topic, chunksStored: chunks.length, ids };
}

/**
 * Full pipeline: transcribe + store
 */
async function processRecording(recordingId, filePath, existingMetadata = {}) {
  const transcription = await transcribeAudio(filePath);
  const storeResult = await storeInVectorDB(recordingId, transcription.text, {
    ...existingMetadata,
    duration: transcription.duration,
    language: transcription.language,
  });
  return { transcription, storeResult };
}

module.exports = { transcribeAudio, extractTopic, storeInVectorDB, processRecording };
