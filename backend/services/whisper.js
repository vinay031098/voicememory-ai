const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

let openaiClient = null;

function getOpenAIClient() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Transcribe an audio file using OpenAI Whisper API
 * @param {string} filePath - Path to the audio file
 * @param {Object} options - Transcription options
 * @returns {Object} Transcription result with text, segments, language
 */
async function transcribeAudio(filePath, options = {}) {
  const openai = getOpenAIClient();

  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }

  const fileStats = fs.statSync(filePath);
  const fileSizeMB = fileStats.size / (1024 * 1024);

  // Whisper API limit is 25MB
  if (fileSizeMB > 25) {
    throw new Error(`File too large for Whisper API: ${fileSizeMB.toFixed(1)}MB (max 25MB)`);
  }

  const audioStream = fs.createReadStream(filePath);
  const ext = path.extname(filePath).toLowerCase().replace('.', '');

  console.log(`Transcribing: ${path.basename(filePath)} (${fileSizeMB.toFixed(2)}MB)`);

  const params = {
    file: audioStream,
    model: options.model || 'whisper-1',
    language: options.language || undefined,
    response_format: 'verbose_json',
    timestamp_granularities: ['segment', 'word'],
    temperature: options.temperature || 0,
    prompt: options.prompt || undefined,
  };

  const response = await openai.audio.transcriptions.create(params);

  const segments = (response.segments || []).map(seg => ({
    id: seg.id,
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
    words: seg.words || []
  }));

  return {
    text: response.text,
    language: response.language || 'en',
    duration: response.duration || 0,
    segments,
  };
}

/**
 * Get a summary of the transcription content
 */
async function summarizeTranscription(text, options = {}) {
  const openai = getOpenAIClient();

  if (!text || text.trim().length < 20) {
    return 'Recording is too short to summarize.';
  }

  const response = await openai.chat.completions.create({
    model: options.model || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that creates concise, accurate summaries of voice recordings. Keep summaries to 2-3 sentences maximum.'
      },
      {
        role: 'user',
        content: `Summarize this voice recording transcription:\n\n${text}`
      }
    ],
    max_tokens: 150,
    temperature: 0.3
  });

  return response.choices[0]?.message?.content || 'Could not generate summary.';
}

module.exports = { transcribeAudio, summarizeTranscription };
