// client/websocket.js
class SocketClient {
  constructor(serverUrl) {
    // Use same origin if no serverUrl is provided
    this.socket = io(serverUrl || undefined, { transports: ['websocket'] });
    this.id = null;

    // When connected
    this.socket.on('connect', () => {
      this.id = this.socket.id;
      this._emitStatus(true);
    });

    // When disconnected
    this.socket.on('disconnect', () => {
      this._emitStatus(false);
    });

    // NOTE: Do NOT re-emit server events back to the server.
    // We just expose .on(...) so canvas.js and app.js can subscribe normally.
  }

  // Subscribe directly to socket.io events
  on(eventName, handler) {
    this.socket.on(eventName, handler);
  }

  // Emitters for drawing events
  emitCursorMove(x, y) {
    this.socket.emit('cursorMove', { x, y });
  }

  emitDrawingChunk(chunk) {
    this.socket.emit('drawingChunk', chunk);
  }

  emitStrokeComplete(stroke) {
    this.socket.emit('strokeComplete', stroke);
  }

  emitShapeUpdate(patch) {
    this.socket.emit('shapeUpdate', patch);
  }

  emitClearCanvas() {
    this.socket.emit('clearCanvas');
  }

  requestCanvasState() {
    this.socket.emit('requestCanvasState');
  }

  // ✅ GLOBAL undo/redo (fixed to match server events)
  emitUndoGlobal() {
    this.socket.emit('undo');
  }

  emitRedoGlobal() {
    this.socket.emit('redo');
  }

  // Connection status update helper
  _emitStatus(connected) {
    const event = new CustomEvent('status', { detail: { connected } });
    window.dispatchEvent(event);
  }
}

// Expose globally
window.SocketClient = SocketClient;
