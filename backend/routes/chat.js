const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../models/db');
const { answerQuestion, generateSummary } = require('../services/aiChat');

// POST ask a question to the AI
router.post('/ask', async (req, res) => {
  try {
    const { question, sessionId, userId = 'default' } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const db = getDB();
    let currentSessionId = sessionId;

    // Create or get session
    if (!currentSessionId) {
      currentSessionId = uuidv4();
      db.prepare('INSERT INTO chat_sessions (id, user_id, title) VALUES (?, ?, ?)')
        .run(currentSessionId, userId, question.substring(0, 60));
    }

    // Get conversation history
    const history = db.prepare(
      'SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 20'
    ).all(currentSessionId);

    // Get AI answer
    const result = await answerQuestion(question, { history, userId });

    // Save messages to DB
    const userMsgId = uuidv4();
    const aiMsgId = uuidv4();

    db.prepare('INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)')
      .run(userMsgId, currentSessionId, 'user', question);

    db.prepare('INSERT INTO chat_messages (id, session_id, role, content, sources) VALUES (?, ?, ?, ?, ?)')
      .run(aiMsgId, currentSessionId, 'assistant', result.answer, JSON.stringify(result.sources));

    res.json({
      sessionId: currentSessionId,
      messageId: aiMsgId,
      answer: result.answer,
      sources: result.sources,
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET all chat sessions
router.get('/sessions', (req, res) => {
  try {
    const db = getDB();
    const { userId = 'default' } = req.query;
    const sessions = db.prepare(
      'SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(userId);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET messages for a session
router.get('/sessions/:sessionId', (req, res) => {
  try {
    const db = getDB();
    const messages = db.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
    ).all(req.params.sessionId);

    res.json(messages.map(m => ({
      ...m,
      sources: m.sources ? JSON.parse(m.sources) : []
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a chat session
router.delete('/sessions/:sessionId', (req, res) => {
  try {
    const db = getDB();
    db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(req.params.sessionId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET daily/weekly AI summary
router.get('/summary', async (req, res) => {
  try {
    const db = getDB();
    const { period = 'daily', userId = 'default' } = req.query;

    const daysBack = period === 'weekly' ? 7 : 1;
    const transcriptions = db.prepare(`
      SELECT r.title, tr.text, r.created_at
      FROM recordings r
      JOIN transcriptions tr ON tr.recording_id = r.id
      WHERE r.user_id = ? AND tr.status = 'completed'
        AND r.created_at >= datetime('now', '-${daysBack} days')
      ORDER BY r.created_at DESC
    `).all(userId);

    const summary = await generateSummary(transcriptions, period);
    res.json({ period, summary, recordingCount: transcriptions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
