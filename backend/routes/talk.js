const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { queryVectorStore } = require('../services/vectorStore');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ dest: 'uploads/temp/', limits: { fileSize: 25 * 1024 * 1024 } });

// In-memory conversation sessions
const sessions = new Map();

/**
 * POST /api/talk/transcribe
 * Accepts audio blob, returns transcript instantly
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
  try {
    const audioStream = fs.createReadStream(req.file.path);
    const transcript = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      response_format: 'json',
    });
    fs.unlink(req.file.path, () => {});
    res.json({ text: transcript.text, language: transcript.language });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    console.error('[Talk] Transcription error:', err);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

/**
 * POST /api/talk/respond
 * Given transcript text + session history, returns AI response (streaming SSE)
 * AI uses RAG to pull relevant memories and respond conversationally
 */
router.post('/respond', async (req, res) => {
  const { text, sessionId, mode = 'conversation' } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  // Get or create session
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { history: [], createdAt: Date.now() });
  }
  const session = sessions.get(sessionId);

  try {
    // RAG: fetch relevant memories
    const memoryChunks = await queryVectorStore(text, 6);
    const memoryContext = memoryChunks.length > 0
      ? memoryChunks.map((c, i) =>
          `[Memory ${i + 1} - ${c.metadata?.title || 'Recording'}, ${c.metadata?.date || ''}]: ${c.pageContent}`
        ).join('\n\n')
      : 'No specific memories found for this topic yet.';

    const systemPrompt = `You are the user's personal AI memory assistant. You have access to everything they have ever spoken or recorded. You know their thoughts, experiences, decisions, goals, and daily life deeply.

Current mode: ${mode}

RELEVANT MEMORIES FROM THEIR RECORDINGS:
${memoryContext}

Behavior rules:
- Speak naturally like a close friend who knows them well
- Reference specific memories when relevant (mention dates/titles)
- Ask thoughtful follow-up questions to keep the conversation going
- Notice patterns (e.g., "You've mentioned stress about work several times")
- Be warm, insightful, and personal — not robotic
- Keep responses concise for voice (2-4 sentences max)
- Never say you are an AI in a cold way — you are their memory companion`;

    // Build message history
    const messages = [
      { role: 'system', content: systemPrompt },
      ...session.history.slice(-10), // last 10 turns
      { role: 'user', content: text },
    ];

    // Set up SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const stream = await openai.chat.completions.create({
      model: process.env.CHAT_MODEL || 'gpt-4o',
      messages,
      stream: true,
      max_tokens: 200,
      temperature: 0.85,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        fullResponse += token;
        res.write(`data: ${JSON.stringify({ token, done: false })}\n\n`);
      }
    }

    // Save to session history
    session.history.push({ role: 'user', content: text });
    session.history.push({ role: 'assistant', content: fullResponse });

    res.write(`data: ${JSON.stringify({ token: '', done: true, fullText: fullResponse })}\n\n`);
    res.end();
  } catch (err) {
    console.error('[Talk] Response error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/talk/tts
 * Convert text to speech audio, returns audio buffer
 */
router.post('/tts', async (req, res) => {
  const { text, voice = 'nova' } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });
  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice, // alloy, echo, fable, onyx, nova, shimmer
      input: text.substring(0, 4096),
      speed: 1.0,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('[Talk] TTS error:', err);
    res.status(500).json({ error: 'TTS failed' });
  }
});

/**
 * DELETE /api/talk/session/:sessionId
 * Clear conversation session
 */
router.delete('/session/:sessionId', (req, res) => {
  sessions.delete(req.params.sessionId);
  res.json({ success: true });
});

/**
 * GET /api/talk/session/:sessionId
 * Get session history
 */
router.get('/session/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  res.json(session || { history: [] });
});

// Cleanup old sessions every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  for (const [id, session] of sessions.entries()) {
    if (session.createdAt < oneHourAgo) sessions.delete(id);
  }
}, 3600000);

module.exports = router;
