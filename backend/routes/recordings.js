const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { uploadSingle, uploadMultiple, handleUploadError, UPLOADS_DIR } = require('../middleware/upload');
const { getDB } = require('../models/db');
const { transcribeAudio } = require('../services/whisper');
const { addTranscription, deleteRecordingVectors } = require('../services/vectorStore');
const { detectTopics } = require('../services/topicClustering');

// GET all recordings
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { page = 1, limit = 20, topic, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT r.*, 
        GROUP_CONCAT(t.name) as topics,
        tr.text as transcript,
        tr.status as transcription_status
      FROM recordings r
      LEFT JOIN topics t ON t.recording_id = r.id
      LEFT JOIN transcriptions tr ON tr.recording_id = r.id
    `;
    const params = [];

    if (topic) {
      query += ` WHERE t.name = ?`;
      params.push(topic);
    }
    if (search) {
      query += topic ? ` AND` : ` WHERE`;
      query += ` (r.title LIKE ? OR tr.text LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY r.id ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const recordings = db.prepare(query).all(...params);
    const total = db.prepare('SELECT COUNT(*) as count FROM recordings').get();

    res.json({
      recordings: recordings.map(formatRecording),
      pagination: { page: parseInt(page), limit: parseInt(limit), total: total.count }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single recording
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const recording = db.prepare(`
      SELECT r.*, GROUP_CONCAT(t.name) as topics,
        tr.text as transcript, tr.status as transcription_status, tr.segments
      FROM recordings r
      LEFT JOIN topics t ON t.recording_id = r.id
      LEFT JOIN transcriptions tr ON tr.recording_id = r.id
      WHERE r.id = ? GROUP BY r.id
    `).get(req.params.id);

    if (!recording) return res.status(404).json({ error: 'Recording not found' });
    res.json(formatRecording(recording));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST upload new recording
router.post('/', (req, res, next) => {
  uploadSingle(req, res, async (err) => {
    if (err) return handleUploadError(err, req, res, next);
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

    try {
      const db = getDB();
      const id = uuidv4();
      const title = req.body.title || `Recording ${new Date().toLocaleDateString()}`;
      const userId = req.body.userId || 'default';

      db.prepare(`
        INSERT INTO recordings (id, title, filename, filepath, size, format, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, title, req.file.filename, req.file.path,
        req.file.size, path.extname(req.file.filename).replace('.', ''), userId);

      // Trigger async transcription
      transcribeAndProcess(id, req.file.path, title, userId).catch(console.error);

      const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(id);
      res.status(201).json(formatRecording(recording));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

// PATCH update recording title
router.patch('/:id', (req, res) => {
  try {
    const db = getDB();
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    db.prepare('UPDATE recordings SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(title, req.params.id);

    const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(req.params.id);
    if (!recording) return res.status(404).json({ error: 'Recording not found' });
    res.json(formatRecording(recording));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE recording
router.delete('/:id', async (req, res) => {
  try {
    const db = getDB();
    const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(req.params.id);
    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    // Delete file from disk
    if (fs.existsSync(recording.filepath)) fs.unlinkSync(recording.filepath);

    // Delete from vector store
    await deleteRecordingVectors(req.params.id).catch(console.error);

    // Delete from DB (cascades to transcriptions and topics)
    db.prepare('DELETE FROM recordings WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: 'Recording deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Background transcription + topic detection
async function transcribeAndProcess(recordingId, filePath, title, userId) {
  const db = getDB();
  const transcriptionId = uuidv4();

  // Create pending transcription record
  db.prepare(`INSERT INTO transcriptions (id, recording_id, status) VALUES (?, ?, 'processing')`).
    run(transcriptionId, recordingId);

  try {
    const result = await transcribeAudio(filePath);

    // Update transcription
    db.prepare(`
      UPDATE transcriptions SET text = ?, language = ?, segments = ?, status = 'completed',
        updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(result.text, result.language, JSON.stringify(result.segments), transcriptionId);

    // Update recording duration
    db.prepare('UPDATE recordings SET duration = ? WHERE id = ?').run(result.duration, recordingId);

    // Detect topics
    const topics = await detectTopics(result.text);
    topics.forEach(topic => {
      db.prepare(`INSERT INTO topics (id, recording_id, name, confidence) VALUES (?, ?, ?, ?)`).
        run(uuidv4(), recordingId, topic.name, topic.confidence);
    });

    // Add to vector store
    await addTranscription({
      recordingId, title, text: result.text,
      topics: topics.map(t => t.name), userId
    });

    console.log(`Transcription complete for recording ${recordingId}`);
  } catch (err) {
    console.error(`Transcription failed for ${recordingId}:`, err.message);
    db.prepare(`UPDATE transcriptions SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).
      run(transcriptionId);
  }
}

function formatRecording(r) {
  return {
    ...r,
    topics: r.topics ? r.topics.split(',').filter(Boolean) : [],
    segments: r.segments ? JSON.parse(r.segments) : [],
    audioUrl: `/uploads/${r.filename}`,
  };
}

module.exports = router;
