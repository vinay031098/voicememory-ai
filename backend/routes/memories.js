const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const { ChromaClient } = require('chromadb');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const chroma = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' });

/**
 * GET /api/memories/search
 * Semantic search through all voice memories
 */
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 10, topic } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

    const collection = await chroma.getOrCreateCollection({ name: 'voice_memories' });

    // Generate embedding for the query
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: q,
    });
    const queryEmbedding = embeddingRes.data[0].embedding;

    // Build where filter
    const whereFilter = topic ? { topic: { $eq: topic } } : undefined;

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: parseInt(limit),
      where: whereFilter,
    });

    const memories = results.ids[0].map((id, i) => ({
      id,
      content: results.documents[0][i],
      metadata: results.metadatas[0][i],
      score: results.distances ? 1 - results.distances[0][i] : null,
    }));

    res.json({ query: q, count: memories.length, memories });
  } catch (err) {
    console.error('[Memories] Search error:', err);
    res.status(500).json({ error: 'Memory search failed', details: err.message });
  }
});

/**
 * GET /api/memories/topics
 * Get all unique topics from memories
 */
router.get('/topics', async (req, res) => {
  try {
    const collection = await chroma.getOrCreateCollection({ name: 'voice_memories' });
    const all = await collection.get();
    const topics = [...new Set(all.metadatas.map(m => m.topic).filter(Boolean))];
    res.json({ topics });
  } catch (err) {
    console.error('[Memories] Topics error:', err);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

/**
 * GET /api/memories/timeline
 * Get memories sorted by date with optional topic filter
 */
router.get('/timeline', async (req, res) => {
  try {
    const { topic, page = 1, limit = 20 } = req.query;
    const collection = await chroma.getOrCreateCollection({ name: 'voice_memories' });

    const whereFilter = topic ? { topic: { $eq: topic } } : undefined;
    const all = await collection.get({ where: whereFilter });

    const items = all.ids.map((id, i) => ({
      id,
      content: all.documents[i],
      metadata: all.metadatas[i],
    })).sort((a, b) => new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt));

    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginated = items.slice(start, start + parseInt(limit));

    res.json({ total: items.length, page: parseInt(page), limit: parseInt(limit), memories: paginated });
  } catch (err) {
    console.error('[Memories] Timeline error:', err);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

/**
 * DELETE /api/memories/:id
 * Delete a specific memory chunk
 */
router.delete('/:id', async (req, res) => {
  try {
    const collection = await chroma.getOrCreateCollection({ name: 'voice_memories' });
    await collection.delete({ ids: [req.params.id] });
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    console.error('[Memories] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

/**
 * GET /api/memories/stats
 * Get memory statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const collection = await chroma.getOrCreateCollection({ name: 'voice_memories' });
    const all = await collection.get();
    const topics = {};
    all.metadatas.forEach(m => {
      if (m.topic) topics[m.topic] = (topics[m.topic] || 0) + 1;
    });
    res.json({
      totalChunks: all.ids.length,
      topicBreakdown: topics,
      topTopics: Object.entries(topics).sort((a, b) => b[1] - a[1]).slice(0, 10),
    });
  } catch (err) {
    console.error('[Memories] Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
