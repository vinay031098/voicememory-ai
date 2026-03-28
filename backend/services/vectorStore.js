const { ChromaClient, OpenAIEmbeddingFunction } = require('chromadb');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { Chroma } = require('@langchain/community/vectorstores/chroma');
const { Document } = require('langchain/document');

const COLLECTION_NAME = process.env.CHROMA_COLLECTION || 'voicememory_transcriptions';
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';

let vectorStore = null;

async function getVectorStore() {
  if (!vectorStore) {
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
    });

    vectorStore = await Chroma.fromExistingCollection(embeddings, {
      collectionName: COLLECTION_NAME,
      url: CHROMA_URL,
    }).catch(async () => {
      // Collection doesn't exist yet, create a new one
      return new Chroma(embeddings, {
        collectionName: COLLECTION_NAME,
        url: CHROMA_URL,
      });
    });
  }
  return vectorStore;
}

/**
 * Add a transcription to the vector store
 */
async function addTranscription({ recordingId, title, text, segments, topics, createdAt, userId }) {
  if (!text || text.trim().length === 0) return;

  const store = await getVectorStore();

  // Split long texts into chunks for better retrieval
  const chunks = splitIntoChunks(text, 500);

  const docs = chunks.map((chunk, idx) => new Document({
    pageContent: chunk,
    metadata: {
      recording_id: recordingId,
      title: title || 'Untitled Recording',
      chunk_index: idx,
      total_chunks: chunks.length,
      topics: Array.isArray(topics) ? topics.join(',') : '',
      created_at: createdAt || new Date().toISOString(),
      user_id: userId || 'default',
    }
  }));

  const ids = chunks.map((_, idx) => `${recordingId}_chunk_${idx}`);
  await store.addDocuments(docs, { ids });

  console.log(`Added ${chunks.length} chunks for recording ${recordingId} to vector store`);
}

/**
 * Search the vector store for relevant transcriptions
 */
async function searchTranscriptions(query, options = {}) {
  const store = await getVectorStore();

  const filter = {};
  if (options.userId) filter['user_id'] = options.userId;
  if (options.topic) filter['topics'] = { $contains: options.topic };

  const results = await store.similaritySearchWithScore(
    query,
    options.k || 5,
    Object.keys(filter).length > 0 ? filter : undefined
  );

  return results.map(([doc, score]) => ({
    content: doc.pageContent,
    metadata: doc.metadata,
    score: score,
    recordingId: doc.metadata.recording_id,
    title: doc.metadata.title,
  }));
}

/**
 * Delete all vectors for a specific recording
 */
async function deleteRecordingVectors(recordingId) {
  try {
    const client = new ChromaClient({ path: CHROMA_URL });
    const collection = await client.getCollection({ name: COLLECTION_NAME });
    await collection.delete({ where: { recording_id: recordingId } });
    console.log(`Deleted vectors for recording ${recordingId}`);
  } catch (err) {
    console.error('Error deleting vectors:', err.message);
  }
}

/**
 * Split text into overlapping chunks
 */
function splitIntoChunks(text, chunkSize = 500, overlap = 50) {
  const words = text.split(' ');
  const chunks = [];
  let i = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) chunks.push(chunk.trim());
    i += chunkSize - overlap;
  }

  return chunks.length > 0 ? chunks : [text];
}

module.exports = { addTranscription, searchTranscriptions, deleteRecordingVectors };
