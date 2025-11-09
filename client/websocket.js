// // client/websocket.js
// class SocketClient {
//   constructor(serverUrl) {
//     this.socket = io(serverUrl || undefined, { transports: ['websocket'] });
//     this.id = null;

//     this.socket.on('connect', () => {
//       this.id = this.socket.id;
//       window.dispatchEvent(new CustomEvent('status', { detail: { connected: true }}));
//     });

//     this.socket.on('disconnect', () => {
//       window.dispatchEvent(new CustomEvent('status', { detail: { connected: false }}));
//     });

//     // direct forward - NO LOOPING BACK
//     this.on = (ev, fn) => this.socket.on(ev, fn);
//   }

//   // called by canvas.js
//   emitCursorMove(x, y) { this.socket.emit('cursorMove', { x, y }); }
//   emitDrawingChunk(c) { this.socket.emit('drawingChunk', c); }
//   emitStrokeComplete(s) { this.socket.emit('strokeComplete', s); }
//   emitShapeUpdate(p) { this.socket.emit('shapeUpdate', p); }
//   emitClearCanvas() { this.socket.emit('clearCanvas'); }
//   emitUndoGlobal() { this.socket.emit('undoGlobal'); }
//   emitRedoGlobal() { this.socket.emit('redoGlobal'); }
//   requestCanvasState() { this.socket.emit('requestCanvasState'); }
// }

// window.SocketClient = SocketClient;
// client/websocket.js
class SocketClient {
  constructor(serverUrl) {
    // If serverUrl is undefined, io() uses same origin
    this.socket = io(serverUrl || undefined, { transports: ['websocket'] });
    this.id = null;

    this.socket.on('connect', () => {
      this.id = this.socket.id;
      this._emitStatus(true);
    });

    this.socket.on('disconnect', () => {
      this._emitStatus(false);
    });

    // NOTE: Do NOT re-emit server events back to server.
    // We just expose .on(...) so canvas can subscribe normally.
  }

  // Subscribe directly to socket.io events
  on(name, fn) { this.socket.on(name, fn); }

  // Wrappers used by canvas.js
  emitCursorMove(x, y) { this.socket.emit('cursorMove', { x, y }); }
  emitDrawingChunk(chunk) { this.socket.emit('drawingChunk', chunk); }
  emitStrokeComplete(stroke) { this.socket.emit('strokeComplete', stroke); }
  emitShapeUpdate(patch) { this.socket.emit('shapeUpdate', patch); }
  emitClearCanvas() { this.socket.emit('clearCanvas'); }
  requestCanvasState() { this.socket.emit('requestCanvasState'); }

  // GLOBAL undo/redo
  emitUndoGlobal() { this.socket.emit('undoGlobal'); }
  emitRedoGlobal() { this.socket.emit('redoGlobal'); }

  // status chip helper
  _emitStatus(connected) {
    const evt = new CustomEvent('status', { detail: { connected } });
    window.dispatchEvent(evt);
  }
}

window.SocketClient = SocketClient;
