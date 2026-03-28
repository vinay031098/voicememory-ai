const { ChatOpenAI } = require('@langchain/openai');
const { ConversationalRetrievalQAChain } = require('langchain/chains');
const { BufferMemory, ChatMessageHistory } = require('langchain/memory');
const { HumanMessage, AIMessage } = require('@langchain/core/messages');
const { searchTranscriptions } = require('./vectorStore');

/**
 * Answer a question using stored transcriptions
 */
async function answerQuestion(question, options = {}) {
  const { history = [], userId = 'default', k = 5 } = options;

  // Search for relevant transcriptions
  const relevantDocs = await searchTranscriptions(question, { userId, k });

  if (relevantDocs.length === 0) {
    return {
      answer: "I couldn't find any relevant recordings to answer your question. Try recording more voice notes or uploading audio files first.",
      sources: [],
    };
  }

  // Build context from relevant documents
  const context = relevantDocs
    .map((doc, idx) => `[Recording: "${doc.title}" | Score: ${(1 - doc.score).toFixed(2)}]\n${doc.content}`)
    .join('\n\n---\n\n');

  // Build conversation history
  const historyText = history
    .slice(-6) // last 3 exchanges
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 1000,
  });

  const systemPrompt = `You are VoiceMemory AI, a personal AI assistant with access to the user's voice recordings and notes.
Your job is to answer questions about what the user has said in their recordings.

Guidelines:
- Answer based ONLY on the provided recording transcriptions
- Be specific and cite which recording the information comes from
- If asked about a topic not in the recordings, say so clearly
- Keep answers concise but complete
- Use the recording titles when referencing specific recordings
- If you can pinpoint a time range from segments, mention it

Previous conversation:
${historyText || 'None'}

Relevant recording transcriptions:
${context}`;

  const response = await llm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question }
  ]);

  // Deduplicate sources by recording_id
  const seenIds = new Set();
  const sources = relevantDocs
    .filter(doc => {
      if (seenIds.has(doc.recordingId)) return false;
      seenIds.add(doc.recordingId);
      return true;
    })
    .slice(0, 3)
    .map(doc => ({
      recordingId: doc.recordingId,
      title: doc.title,
      relevance: parseFloat((1 - doc.score).toFixed(3)),
      createdAt: doc.metadata.created_at,
    }));

  return {
    answer: response.content,
    sources,
  };
}

/**
 * Generate a daily/weekly summary from recent recordings
 */
async function generateSummary(transcriptions, period = 'daily') {
  if (!transcriptions || transcriptions.length === 0) {
    return `No recordings found for your ${period} summary.`;
  }

  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.4,
    maxTokens: 500,
  });

  const content = transcriptions
    .map(t => `Title: ${t.title}\nDate: ${t.created_at}\nContent: ${t.text}`)
    .join('\n\n---\n\n');

  const response = await llm.invoke([
    {
      role: 'system',
      content: `You are VoiceMemory AI creating a ${period} summary of a user's voice recordings. Be concise, highlight key themes and important items. Use bullet points.`
    },
    {
      role: 'user',
      content: `Create a ${period} summary from these recordings:\n\n${content}`
    }
  ]);

  return response.content;
}

module.exports = { answerQuestion, generateSummary };
