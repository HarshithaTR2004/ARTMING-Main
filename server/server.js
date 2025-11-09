// // // server/server.js
// // const path = require('path');
// // const express = require('express');
// // const http = require('http');
// // const { Server } = require('socket.io');
// // const { randomUUID } = require('crypto');

// // const Rooms = require('./rooms');
// // const DrawingState = require('./drawing-state');

// // const app = express();
// // const server = http.createServer(app);
// // const io = new Server(server, { cors: { origin: '*' } });

// // // serve /client
// // app.use(express.static(path.join(__dirname, '..', 'client')));

// // const rooms = new Rooms();
// // const drawingState = new DrawingState();

// // function makeUser(id) {
// //   const colors = ['#22d3ee','#60a5fa','#34d399','#f472b6','#fbbf24','#f87171','#a78bfa','#f59e0b'];
// //   const color = colors[Math.floor(Math.random() * colors.length)];
// //   return { id, color, username: `Guest-${id.slice(0, 4)}` };
// // }

// // io.on('connection', (socket) => {
// //   const roomId = socket.handshake.query?.room || 'main';
// //   socket.join(roomId);

// //   const user = makeUser(socket.id);
// //   rooms.addUser(roomId, user);

// //   // init payload
// //   const users = rooms.getUsers(roomId);
// //   const strokes = drawingState.getState(roomId);
// //   socket.emit('init', { you: user, users, canvasState: strokes });

// //   io.to(roomId).emit('usersUpdate', { users });

// //   // cursors
// //   socket.on('cursorMove', ({ x, y }) => {
// //     io.to(roomId).emit('cursorMove', { user, x, y });
// //   });

// //   // streaming chunks (no state mutation here)
// //   socket.on('drawingChunk', (chunk) => {
// //     socket.to(roomId).emit('drawingData', { stroke: { ...chunk, id: chunk.id } });
// //   });

// //   // stroke complete (path or shape)
// //   socket.on('strokeComplete', (stroke) => {
// //     const id = stroke.id || randomUUID();
// //     const canonical = {
// //       ...stroke,
// //       id,
// //       ownerId: stroke.ownerId || socket.id,
// //       timestamp: stroke.timestamp || Date.now()
// //     };
// //     drawingState.addStroke(roomId, canonical);
// //     io.to(roomId).emit('strokeComplete', { stroke: canonical });
// //   });

// //   // live shape patch (resize/move)
// //   socket.on('shapeUpdate', ({ id, patch }) => {
// //     io.to(roomId).emit('shapeUpdate', { id, patch });
// //   });

// //   // clear all
// //   socket.on('clearCanvas', () => {
// //     drawingState.clear(roomId);
// //     io.to(roomId).emit('clearCanvas');
// //   });

// //   // GLOBAL undo/redo — always broadcast full new canonical state
// //   socket.on('undoGlobal', () => {
// //     drawingState.undoGlobal(roomId);
// //     io.to(roomId).emit('canvasState', { strokes: drawingState.getState(roomId) });
// //   });

// //   socket.on('redoGlobal', () => {
// //     drawingState.redoGlobal(roomId);
// //     io.to(roomId).emit('canvasState', { strokes: drawingState.getState(roomId) });
// //   });

// //   socket.on('requestCanvasState', () => {
// //     socket.emit('canvasState', { strokes: drawingState.getState(roomId) });
// //   });

// //   socket.on('disconnect', () => {
// //     rooms.removeUser(roomId, socket.id);
// //     io.to(roomId).emit('usersUpdate', { users: rooms.getUsers(roomId) });
// //   });
// // });

// // // SPA fallback
// // app.get('*', (_, res) => {
// //   res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
// // });

// // const PORT = process.env.PORT || 3000;
// // server.listen(PORT, () => console.log(`ArtMing server running on http://localhost:${PORT}`));
// // server/server.js
// const path = require('path');
// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');
// const { randomUUID } = require('crypto');

// const Rooms = require('./rooms');
// const DrawingState = require('./drawing-state');

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server, { cors: { origin: '*' } });

// // serve static client
// app.use(express.static(path.join(__dirname, '..', 'client')));

// const rooms = new Rooms();
// const drawingState = new DrawingState();

// function makeUser(id) {
//   const colors = ['#22d3ee','#60a5fa','#34d399','#f472b6','#fbbf24','#f87171','#a78bfa','#f59e0b'];
//   const color = colors[Math.floor(Math.random() * colors.length)];
//   return { id, color, username: `Guest-${id.slice(0, 4)}` };
// }

// io.on('connection', (socket) => {
//   const roomId = socket.handshake.query?.room || 'main';
//   socket.join(roomId);

//   // track user
//   const user = makeUser(socket.id);
//   rooms.addUser(roomId, user);

//   // send initial state to the new client
//   socket.emit('init', {
//     you: user,
//     users: rooms.getUsers(roomId),
//     canvasState: drawingState.getState(roomId)
//   });

//   // notify everyone who is online (this should NOT clear canvas)
//   io.to(roomId).emit('usersUpdate', { users: rooms.getUsers(roomId) });

//   // ── cursors (stateless)
//   socket.on('cursorMove', ({ x, y }) => {
//     socket.to(roomId).emit('cursorMove', { user, x, y });
//   });

//   // ── streaming draw chunks (no canonical mutation here)
//   socket.on('drawingChunk', (chunk) => {
//     socket.to(roomId).emit('drawingData', { stroke: { ...chunk, id: chunk.id } });
//   });

//   // ── stroke/shape complete → canonical
//   socket.on('strokeComplete', (stroke) => {
//     const id = stroke.id || randomUUID();
//     const canonical = {
//       ...stroke,
//       id,
//       ownerId: stroke.ownerId || socket.id,
//       timestamp: stroke.timestamp || Date.now()
//     };
//     drawingState.addStroke(roomId, canonical);
//     io.to(roomId).emit('strokeComplete', { stroke: canonical });
//   });

//   // ── live shape resize/move patches (forward-only)
//   socket.on('shapeUpdate', ({ id, patch }) => {
//     io.to(roomId).emit('shapeUpdate', { id, patch });
//   });

//   // ── clear all
//   socket.on('clearCanvas', () => {
//     drawingState.clear(roomId);
//     io.to(roomId).emit('clearCanvas');
//   });

//   // ── GLOBAL UNDO / REDO
//   socket.on('undoGlobal', () => {
//     drawingState.undoGlobal(roomId);
//     // Always broadcast full canonical strokes after undo/redo
//     io.to(roomId).emit('canvasState', { strokes: drawingState.getState(roomId) });
//   });

//   socket.on('redoGlobal', () => {
//     drawingState.redoGlobal(roomId);
//     io.to(roomId).emit('canvasState', { strokes: drawingState.getState(roomId) });
//   });

//   // ── explicit refresh
//   socket.on('requestCanvasState', () => {
//     socket.emit('canvasState', { strokes: drawingState.getState(roomId) });
//   });

//   // ── disconnect
//   socket.on('disconnect', () => {
//     rooms.removeUser(roomId, socket.id);
//     io.to(roomId).emit('usersUpdate', { users: rooms.getUsers(roomId) });
//   });
// });

// // SPA fallback
// app.get('*', (_, res) => {
//   res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
// });

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//   console.log(`ArtMing server running on http://localhost:${PORT}`);
// });
// server/server.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const Rooms = require('./rooms');
const DrawingState = require('./drawing-state');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// serve static client
app.use(express.static(path.join(__dirname, '..', 'client')));

const rooms = new Rooms();
const drawingState = new DrawingState();

function makeUser(id) {
  const colors = ['#22d3ee','#60a5fa','#34d399','#f472b6','#fbbf24','#f87171','#a78bfa','#f59e0b'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return { id, color, username: `Guest-${id.slice(0, 4)}` };
}

io.on('connection', (socket) => {
  const roomId = socket.handshake.query?.room || 'main';
  socket.join(roomId);

  // track user
  const user = makeUser(socket.id);
  rooms.addUser(roomId, user);

  // send initial state to the new client
  socket.emit('init', {
    you: user,
    users: rooms.getUsers(roomId),
    canvasState: drawingState.getState(roomId)
  });

  // notify everyone who is online (this should NOT clear canvas)
  io.to(roomId).emit('usersUpdate', { users: rooms.getUsers(roomId) });

  // ── cursors (stateless)
  socket.on('cursorMove', ({ x, y }) => {
    socket.to(roomId).emit('cursorMove', { user, x, y });
  });

  // ── streaming draw chunks (no canonical mutation here)
  socket.on('drawingChunk', (chunk) => {
    socket.to(roomId).emit('drawingData', { stroke: { ...chunk, id: chunk.id } });
  });

  // ── stroke/shape complete → canonical
  socket.on('strokeComplete', (stroke) => {
    const id = stroke.id || randomUUID();
    const canonical = {
      ...stroke,
      id,
      ownerId: stroke.ownerId || socket.id,
      timestamp: stroke.timestamp || Date.now()
    };
    drawingState.addStroke(roomId, canonical);
    io.to(roomId).emit('strokeComplete', { stroke: canonical });
  });

  // ── live shape resize/move patches (forward-only)
  socket.on('shapeUpdate', ({ id, patch }) => {
    io.to(roomId).emit('shapeUpdate', { id, patch });
  });

  // ── clear all
  socket.on('clearCanvas', () => {
    drawingState.clear(roomId);
    io.to(roomId).emit('clearCanvas');
  });

  // ── GLOBAL UNDO / REDO
  socket.on('undoGlobal', () => {
    drawingState.undoGlobal(roomId);
    // Always broadcast full canonical strokes after undo/redo
    io.to(roomId).emit('canvasState', { strokes: drawingState.getState(roomId) });
  });

  socket.on('redoGlobal', () => {
    drawingState.redoGlobal(roomId);
    io.to(roomId).emit('canvasState', { strokes: drawingState.getState(roomId) });
  });

  // ── explicit refresh
  socket.on('requestCanvasState', () => {
    socket.emit('canvasState', { strokes: drawingState.getState(roomId) });
  });

  // ── disconnect
  socket.on('disconnect', () => {
    rooms.removeUser(roomId, socket.id);
    io.to(roomId).emit('usersUpdate', { users: rooms.getUsers(roomId) });
  });
});

// SPA fallback
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ArtMing server running on http://localhost:${PORT}`);
});
