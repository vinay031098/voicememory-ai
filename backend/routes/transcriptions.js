const express = require('express');
const router = express.Router();
const { getDB } = require('../models/db');
const { transcribeAudio } = require('../services/whisper');
const { addTranscription } = require('../services/vectorStore');
const { detectTopics } = require('../services/topicClustering');
const { v4: uuidv4 } = require('uuid');

// GET transcription for a recording
router.get('/:recordingId', (req, res) => {
  try {
    const db = getDB();
    const transcription = db.prepare(
      'SELECT * FROM transcriptions WHERE recording_id = ?'
    ).get(req.params.recordingId);

    if (!transcription) {
      return res.status(404).json({ error: 'Transcription not found' });
    }

    res.json({
      ...transcription,
      segments: transcription.segments ? JSON.parse(transcription.segments) : []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST retry transcription for a recording
router.post('/:recordingId/retry', async (req, res) => {
  try {
    const db = getDB();
    const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(req.params.recordingId);

    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    const existing = db.prepare('SELECT * FROM transcriptions WHERE recording_id = ?').get(req.params.recordingId);
    const transcriptionId = existing ? existing.id : uuidv4();

    if (existing) {
      db.prepare("UPDATE transcriptions SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(existing.id);
    } else {
      db.prepare("INSERT INTO transcriptions (id, recording_id, status) VALUES (?, ?, 'processing')")
        .run(transcriptionId, req.params.recordingId);
    }

    res.json({ message: 'Transcription started', transcriptionId });

    // Process async
    (async () => {
      try {
        const result = await transcribeAudio(recording.filepath);

        db.prepare(`
          UPDATE transcriptions SET text = ?, language = ?, segments = ?, status = 'completed',
          updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(result.text, result.language, JSON.stringify(result.segments), transcriptionId);

        db.prepare('UPDATE recordings SET duration = ? WHERE id = ?').run(result.duration, recording.id);

        const topics = await detectTopics(result.text);
        db.prepare('DELETE FROM topics WHERE recording_id = ?').run(recording.id);
        topics.forEach(topic => {
          db.prepare('INSERT INTO topics (id, recording_id, name, confidence) VALUES (?, ?, ?, ?)')
            .run(uuidv4(), recording.id, topic.name, topic.confidence);
        });

        await addTranscription({
          recordingId: recording.id, title: recording.title,
          text: result.text, topics: topics.map(t => t.name), userId: recording.user_id
        });
      } catch (err) {
        console.error('Retry transcription failed:', err.message);
        db.prepare("UPDATE transcriptions SET status = 'failed' WHERE id = ?").run(transcriptionId);
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET transcription status
router.get('/:recordingId/status', (req, res) => {
  try {
    const db = getDB();
    const transcription = db.prepare(
      'SELECT id, status, created_at, updated_at FROM transcriptions WHERE recording_id = ?'
    ).get(req.params.recordingId);

    if (!transcription) {
      return res.json({ status: 'not_started' });
    }

    res.json(transcription);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
