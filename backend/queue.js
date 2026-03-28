const Bull = require('bull');
const { transcribeAudio } = require('./whisper');
const { addToVectorStore } = require('./vectorStore');
const { clusterTopics } = require('./topicClustering');
const { updateRecordingStatus, saveTranscription, getDb } = require('./db');
const { getIO } = require('./socket');

// Use in-memory fallback if Redis not available
let transcriptionQueue;

try {
  transcriptionQueue = new Bull('transcription', {
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
} catch (err) {
  console.warn('[Queue] Redis not available, using in-memory fallback');
  transcriptionQueue = null;
}

// Process jobs
const processTranscription = async (recordingId, filePath) => {
  const io = getIO();
  try {
    // Step 1: Update status to processing
    await updateRecordingStatus(recordingId, 'processing');
    io && io.emit(`recording:${recordingId}`, { status: 'processing', step: 'transcribing' });
    console.log(`[Queue] Transcribing recording ${recordingId}`);

    // Step 2: Whisper transcription
    const transcription = await transcribeAudio(filePath);
    await saveTranscription(recordingId, transcription.text, transcription.language);
    io && io.emit(`recording:${recordingId}`, { status: 'processing', step: 'indexing' });
    console.log(`[Queue] Transcription done for ${recordingId}, indexing...`);

    // Step 3: Generate embeddings and store in ChromaDB
    await addToVectorStore(recordingId, transcription.text);
    io && io.emit(`recording:${recordingId}`, { status: 'processing', step: 'clustering' });

    // Step 4: Topic clustering
    await clusterTopics(recordingId, transcription.text);

    // Step 5: Mark complete
    await updateRecordingStatus(recordingId, 'completed');
    io && io.emit(`recording:${recordingId}`, { status: 'completed', step: 'done' });
    console.log(`[Queue] Recording ${recordingId} fully processed`);
  } catch (err) {
    console.error(`[Queue] Error processing ${recordingId}:`, err);
    await updateRecordingStatus(recordingId, 'failed');
    io && io.emit(`recording:${recordingId}`, { status: 'failed', error: err.message });
    throw err;
  }
};

if (transcriptionQueue) {
  transcriptionQueue.process(async (job) => {
    const { recordingId, filePath } = job.data;
    await processTranscription(recordingId, filePath);
  });

  transcriptionQueue.on('completed', (job) => {
    console.log(`[Queue] Job ${job.id} completed`);
  });

  transcriptionQueue.on('failed', (job, err) => {
    console.error(`[Queue] Job ${job.id} failed:`, err.message);
  });
}

const addTranscriptionJob = async (recordingId, filePath) => {
  if (transcriptionQueue) {
    await transcriptionQueue.add({ recordingId, filePath }, { priority: 1 });
    console.log(`[Queue] Job queued for recording ${recordingId}`);
  } else {
    // In-memory fallback: process asynchronously
    setImmediate(() => processTranscription(recordingId, filePath));
    console.log(`[Queue] Processing inline (no Redis) for ${recordingId}`);
  }
};

module.exports = { addTranscriptionJob, transcriptionQueue };
