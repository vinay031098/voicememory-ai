const { Server } = require('socket.io');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);

    // Client subscribes to a specific recording's updates
    socket.on('subscribe:recording', (recordingId) => {
      socket.join(`recording:${recordingId}`);
      console.log(`[Socket] Client ${socket.id} subscribed to recording ${recordingId}`);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Client disconnected:', socket.id);
    });
  });

  console.log('[Socket] WebSocket server initialized');
  return io;
};

const getIO = () => io;

// Emit to all subscribers of a recording
const emitRecordingUpdate = (recordingId, data) => {
  if (io) {
    io.to(`recording:${recordingId}`).emit('recording:update', { recordingId, ...data });
    // Also broadcast globally for home screen list refresh
    io.emit(`recording:${recordingId}`, data);
  }
};

// Emit streaming chat tokens
const emitChatToken = (sessionId, token, done = false) => {
  if (io) {
    io.to(`chat:${sessionId}`).emit('chat:token', { token, done });
  }
};

module.exports = { initSocket, getIO, emitRecordingUpdate, emitChatToken };
