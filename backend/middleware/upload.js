const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Supported audio formats
const SUPPORTED_FORMATS = [
  'audio/mpeg',        // .mp3
  'audio/mp3',         // .mp3
  'audio/wav',         // .wav
  'audio/wave',        // .wav
  'audio/x-wav',       // .wav
  'audio/mp4',         // .m4a
  'audio/x-m4a',       // .m4a
  'audio/ogg',         // .ogg
  'audio/flac',        // .flac
  'audio/x-flac',      // .flac
  'audio/aac',         // .aac
  'audio/opus',        // .opus
  'audio/webm',        // .webm
  'audio/x-ms-wma',    // .wma
  'video/webm',        // webm recordings from browser
  'application/octet-stream', // generic binary
];

const SUPPORTED_EXTENSIONS = [
  '.mp3', '.wav', '.m4a', '.ogg', '.flac',
  '.aac', '.opus', '.webm', '.wma', '.mp4'
];

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp3';
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  if (SUPPORTED_FORMATS.includes(mimeType) || SUPPORTED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported audio format: ${mimeType} (${ext}). Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`), false);
  }
};

// Main upload middleware
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
    files: 10 // max 10 files at once
  }
});

// Single audio file upload
const uploadSingle = upload.single('audio');

// Multiple audio files upload
const uploadMultiple = upload.array('audio', 10);

// Error handler for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 500MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 10 files.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

module.exports = { upload, uploadSingle, uploadMultiple, handleUploadError, UPLOADS_DIR };
