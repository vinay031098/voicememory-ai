const { ChatOpenAI } = require('@langchain/openai');

const PREDEFINED_TOPICS = [
  'Work', 'Meetings', 'Ideas', 'Personal', 'Health', 'Finance',
  'Learning', 'Goals', 'Travel', 'Shopping', 'Family', 'Fitness',
  'Technology', 'Books', 'Food', 'Entertainment', 'Reminders', 'Other'
];

/**
 * Auto-detect topics in a transcription using GPT
 */
async function detectTopics(text, options = {}) {
  if (!text || text.trim().length < 10) {
    return [{ name: 'Other', confidence: 1.0 }];
  }

  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'gpt-4o-mini',
    temperature: 0,
    maxTokens: 200,
  });

  const availableTopics = options.customTopics
    ? [...PREDEFINED_TOPICS, ...options.customTopics]
    : PREDEFINED_TOPICS;

  const response = await llm.invoke([
    {
      role: 'system',
      content: `You are a topic classifier for voice recordings. Given a transcription, identify 1-3 relevant topics from the provided list.
Return ONLY a JSON array of objects like: [{"name": "Work", "confidence": 0.95}]
Use only topics from the provided list. Confidence should be between 0 and 1.`
    },
    {
      role: 'user',
      content: `Available topics: ${availableTopics.join(', ')}\n\nTranscription:\n${text.substring(0, 1000)}`
    }
  ]);

  try {
    const content = response.content.trim();
    const jsonMatch = content.match(/\[.*\]/s);
    if (jsonMatch) {
      const topics = JSON.parse(jsonMatch[0]);
      return topics
        .filter(t => t.name && typeof t.confidence === 'number')
        .slice(0, 3)
        .map(t => ({
          name: t.name,
          confidence: Math.min(1, Math.max(0, t.confidence))
        }));
    }
  } catch (err) {
    console.error('Failed to parse topics:', err.message);
  }

  return [{ name: 'Other', confidence: 0.5 }];
}

/**
 * Get all unique topics from a list of recordings
 */
function extractUniqueTopics(recordings) {
  const topicMap = new Map();

  recordings.forEach(recording => {
    if (recording.topics) {
      const topics = typeof recording.topics === 'string'
        ? recording.topics.split(',')
        : recording.topics;

      topics.forEach(topic => {
        const name = topic.trim();
        if (name) {
          topicMap.set(name, (topicMap.get(name) || 0) + 1);
        }
      });
    }
  });

  return Array.from(topicMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

module.exports = { detectTopics, extractUniqueTopics, PREDEFINED_TOPICS };
