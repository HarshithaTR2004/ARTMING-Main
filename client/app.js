document.addEventListener('DOMContentLoaded', () => {
  const socketClient = new SocketClient(window.SERVER_URL);
  const canvas = new DrawingCanvas(socketClient);

  window.socketClient = socketClient;
  window.drawingCanvas = canvas;
  // in your canvas/app code
  document.getElementById('undoBtn').onclick = () => socketClient.emitUndoGlobal();
  document.getElementById('redoBtn').onclick = () => socketClient.emitRedoGlobal();

  // Request full canvas state after connect
  socketClient.socket.on("connect", () => {
    socketClient.requestCanvasState();
  });
});
