document.addEventListener('DOMContentLoaded', () => {
  const socketClient = new SocketClient(window.SERVER_URL);
  const canvas = new DrawingCanvas(socketClient);

  window.socketClient = socketClient;
  window.drawingCanvas = canvas;
  // in your canvas/app code
  undoBtn.onclick = () => socketClient.emitUndo();
  redoBtn.onclick = () => socketClient.emitRedo();

  // Request full canvas state after connect
  socketClient.socket.on("connect", () => {
    socketClient.requestCanvasState();
  });
});
