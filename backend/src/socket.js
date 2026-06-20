/**
 * Socket.IO singleton. `init(server)` is called once at startup; everything else
 * uses `getIO()` to emit real-time events to connected browsers.
 */
const { Server } = require('socket.io');

let io = null;

function init(server) {
  io = new Server(server, { cors: { origin: '*' } });
  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized — call init(server) first.');
  return io;
}

module.exports = { init, getIO };
