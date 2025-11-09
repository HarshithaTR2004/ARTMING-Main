document.addEventListener('DOMContentLoaded', () => {
  const socketClient = new SocketClient(window.SERVER_URL);
  const canvas = new DrawingCanvas(socketClient);

  // expose for debugging
  window.socketClient = socketClient;
  window.drawingCanvas = canvas;

  socket.on('undo', () => {
  const removed = drawingState.undoGlobal(roomId);
  io.to(roomId).emit('canvasState', {strokes: drawingState.getState(roomId)});
});

socket.on('redo', () => {
  const added = drawingState.redoGlobal(roomId);
  io.to(roomId).emit('canvasState', {strokes: drawingState.getState(roomId)});
});

  // initial state
  setTimeout(()=> socketClient.requestCanvasState(), 400);
});
