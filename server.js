const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

// serve static (index.html)
app.use(express.static('.'));

const positions = {}; // id -> latest position
const socketToId = {}; // socket.id -> visitor id

io.on('connection', (socket) => {
  console.log('connected', socket.id);

  // send existing positions to new client
  Object.values(positions).forEach(pos => socket.emit('position', pos));

  // register visitor id (client should emit register when starting)
  socket.on('register', (data) => {
    if (!data || !data.id) return;
    socketToId[socket.id] = data.id;
    console.log('registered', socket.id, '->', data.id);
    // if we have a last known pos for this id, update displayName if provided
    if (positions[data.id] && data.displayName) {
      positions[data.id].displayName = data.displayName;
      io.emit('position', positions[data.id]);
    }
  });

  socket.on('position', (data) => {
    if (!data || !data.id) return;
    // Simple check: only accept positions from matching socket mapping (or accept if no mapping yet)
    const mapped = socketToId[socket.id];
    if (mapped && mapped !== data.id) return;
    if (!mapped) socketToId[socket.id] = data.id;

    positions[data.id] = {
      id: data.id,
      displayName: data.displayName || data.id,
      lat: data.lat,
      lng: data.lng,
      accuracy: data.accuracy,
      timestamp: data.timestamp || Date.now()
    };
    io.emit('position', positions[data.id]);
  });

  socket.on('stopTracking', (payload) => {
    if (!payload || !payload.id) return;
    if (positions[payload.id]) {
      delete positions[payload.id];
      io.emit('disconnectUser', payload.id);
    }
  });

  socket.on('disconnect', () => {
    const id = socketToId[socket.id];
    if (id && positions[id]) {
      delete positions[id];
      io.emit('disconnectUser', id);
    }
    delete socketToId[socket.id];
    console.log('disconnected', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
