class DrawingCanvas {
  constructor(socketClient) {
    // DOM
    this.canvas = document.getElementById('drawingCanvas');
    this.overlay = document.getElementById('cursorCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.octx = this.overlay.getContext('2d');
    this.socket = socketClient;

    // tool + style (defaults)
    this.tool = 'pencil'; // pencil | pen | brush | spray | eraser | select | shape-rect | shape-ellipse | shape-line
    this.color = '#111111';
    this.size = 5;

    // state
    this.isDrawing = false;
    this.currentStroke = null; // current local path/shape (not added to strokes until server confirms)
    this.strokes = [];         // authoritative list from server only
    this.users = [];
    this.you = null;

    // selection (your shapes only)
    this.selectedId = null;
    this.draggingHandle = null;
    this.dragOrigin = null;

    // cursors from others
    this.cursors = new Map(); // id -> {x,y,color}
    this._lastCursorEmit = 0;

    // bind + size
    this._bindUI();
    this._bindSocket();
    this._resize();
    addEventListener('resize', () => this._resize());
  }

  /* ===========================
     UI BINDINGS
     =========================== */
  _bindUI() {
    // Draw on the overlay (so handles/cursors are independent)
    const start = (e) => {
      e.preventDefault();
      const p = this._coords(e);

      // selection / resize?
      if (this._selectionTryStart(p)) return;

      if (this.tool.startsWith('shape-')) {
        // Start shape (local preview only)
        const tmpId = 'tmp-' + Math.random().toString(36).slice(2);
        this.currentStroke = {
          id: tmpId,
          type: this.tool, // 'shape-rect' | 'shape-ellipse' | 'shape-line'
          x: p.x, y: p.y, w: 0, h: 0,
          color: this.color,
          size: this.size,
          ownerId: this.socket.id,
          timestamp: Date.now()
        };
        this.isDrawing = true;
      } else if (this.tool === 'select') {
        return; // handled by _selectionTryStart
      } else {
        // freehand
        const tmpId = 'tmp-' + Math.random().toString(36).slice(2);
        this.currentStroke = {
          id: tmpId,
          type: 'path',
          tool: this.tool,
          color: this.color,
          size: this.size,
          points: [[p.x, p.y]],
          ownerId: this.socket.id,
          timestamp: Date.now()
        };
        this.isDrawing = true;
      }
    };

    const move = (e) => {
      const p = this._coords(e);

      // throttle cursor emits to ~60fps
      const now = performance.now();
      if (now - this._lastCursorEmit > 16) {
        this.socket.emitCursorMove(p.x, p.y);
        this._lastCursorEmit = now;
      }

      if (this.draggingHandle) { this._selectionResize(p); return; }
      if (!this.currentStroke) return;

      if (this.tool.startsWith('shape-')) {
        // live preview — redraw everything + current ghost
        const s = this.currentStroke;
        s.w = p.x - s.x;
        s.h = p.y - s.y;
        this._renderAll();
        this._drawShape(s);
      } else if (this.isDrawing) {
        // path — draw locally + stream chunks (do not add to strokes yet)
        const pts = this.currentStroke.points;
        const last = pts[pts.length - 1];
        if (last[0] !== p.x || last[1] !== p.y) {
          pts.push([p.x, p.y]);
          this._drawStrokeSegment(last, [p.x, p.y], this.currentStroke); // local immediate
          // stream with temp id so peers render smooth too
          this.socket.emitDrawingChunk({
            id: this.currentStroke.id,
            type: 'path',
            tool: this.currentStroke.tool,
            color: this.currentStroke.color,
            size: this.currentStroke.size,
            points: [last, [p.x, p.y]]
          });
        }
      }
    };

    const end = () => {
      if (this.draggingHandle) { this._finishShapeResize(); return; }
      if (!this.currentStroke) return;

      // Normalize + send to server; DO NOT push into strokes locally.
      if (this.tool.startsWith('shape-')) {
        const s = this.currentStroke;
        // normalize to keep x,y as top-left
        let { x, y, w, h } = s;
        if (w < 0) { x = x + w; w = Math.abs(w); }
        if (h < 0) { y = y + h; h = Math.abs(h); }
        const finalized = {
          id: s.id,
          type: s.type,
          x, y, w, h,
          color: s.color,
          size: s.size,
          ownerId: s.ownerId,
          timestamp: s.timestamp
        };
        this.socket.emitStrokeComplete(finalized);
      } else if (this.isDrawing) {
        if (this.currentStroke.points.length > 1) {
          this.socket.emitStrokeComplete(this.currentStroke);
        }
      }

      this.isDrawing = false;
      this.currentStroke = null;
      // After finishing, the server will broadcast canonical stroke we then add.
    };

    // mouse
    this.overlay.addEventListener('mousedown', start);
    this.overlay.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
    // touch
    this.overlay.addEventListener('touchstart', start, { passive: false });
    this.overlay.addEventListener('touchmove', move, { passive: false });
    this.overlay.addEventListener('touchend', end);

    // Tool buttons
    document.querySelectorAll('.tool').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.tool').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        this.tool = btn.dataset.tool;
        this._clearSelection();
      };
    });

    // Color swatches
    document.querySelectorAll('.swatch').forEach(s => {
      s.onclick = () => {
        document.querySelectorAll('.swatch').forEach(x => x.classList.remove('active'));
        s.classList.add('active');
        this.color = s.dataset.color;
        this.currentStroke = null;
      };
    });

    // Custom color
    const custom = document.getElementById('customColor');
    if (custom) {
      custom.oninput = (e) => {
        this.color = e.target.value;
        document.querySelectorAll('.swatch').forEach(x => x.classList.remove('active'));
      };
    }

    // Size
    const sizeInput = document.getElementById('size');
    if (sizeInput) {
      sizeInput.addEventListener('input', (e) => {
        this.size = parseInt(e.target.value, 10);
        const val = document.getElementById('sizeVal');
        if (val) val.textContent = `${this.size}px`;
      });
    }

    // Actions
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const clearBtn = document.getElementById('clearBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const themeBtn = document.getElementById('themeBtn');

    if (undoBtn) undoBtn.onclick = () => this.socket.emitUndoGlobal();
    if (redoBtn) redoBtn.onclick = () => this.socket.emitRedoGlobal();
    if (clearBtn) clearBtn.onclick = () => this.socket.emitClearCanvas();
    if (downloadBtn) downloadBtn.onclick = () => this._download();
    if (themeBtn) themeBtn.onclick = () => document.body.classList.toggle('light');

    // Shortcuts (Global Undo/Redo)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.socket.emitUndoGlobal();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        this.socket.emitRedoGlobal();
      }
    });
  }

  /* ===========================
     SOCKET BINDINGS
     =========================== */
  _bindSocket() {
    // Initial payload
    this.socket.on('init', ({ you, users, canvasState }) => {
      this.you = you;
      this._updateUsers(users);
      this.loadCanvasState(canvasState);
    });

    // Presence
    this.socket.on('usersUpdate', ({ users }) => this._updateUsers(users));
    this.socket.on('userJoined', ({ users }) => this._updateUsers(users));
    this.socket.on('userLeft', ({ users }) => this._updateUsers(users));

    // Canonical state refresh (after undo/redo/clear or new join)
    this.socket.on('canvasState', ({ strokes }) => {
      this.strokes = Array.isArray(strokes) ? strokes : [];
      this._renderAll();
    });

    // Streaming chunks (draw-only, do not mutate strokes)
    this.socket.on('drawingData', ({ stroke }) => {
      if (stroke?.type !== 'path' || !Array.isArray(stroke.points)) return;
      const seg = stroke.points;
      if (seg.length >= 2) {
        this._drawStrokeSegment(seg[0], seg[1], stroke);
      }
    });

    // Authoritative stroke added by server — now we store it
    this.socket.on('strokeComplete', ({ stroke }) => {
      if (!stroke) return;
      this.strokes.push(stroke);
      if (stroke.type === 'path') this._drawPath(stroke); else this._drawShape(stroke);
    });

    // Clear
    this.socket.on('clearCanvas', () => {
      this.strokes = [];
      this._renderAll();
    });

    // Real-time cursors
    this.socket.on('cursorMove', ({ user, x, y }) => {
      this.cursors.set(user.id, { x, y, color: user.color });
      this._drawCursors();
    });

    // Shape live patch (resize/move)
    this.socket.on('shapeUpdate', ({ id, patch }) => {
      const s = this.strokes.find(x => x.id === id);
      if (s) Object.assign(s, patch);
      this._renderAll();
    });

    // Connection chip
    window.addEventListener('status', (ev) => {
      const el = document.getElementById('status');
      if (!el) return;
      const connected = !!ev.detail?.connected;
      el.textContent = connected ? 'Connected' : 'Disconnected';
      el.classList.toggle('online', connected);
    });
  }

  /* ===========================
     CANVAS SIZING
     =========================== */
  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    [this.canvas, this.overlay].forEach(can => {
      can.width = Math.floor(rect.width * dpr);
      can.height = Math.floor(rect.height * dpr);
      can.style.width = rect.width + 'px';
      can.style.height = rect.height + 'px';
      const c = (can === this.canvas ? this.ctx : this.octx);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    this._renderAll();
  }

  _coords(e) {
    const rect = this.overlay.getBoundingClientRect();
    const t = e.touches?.[0];
    const cx = t ? t.clientX : e.clientX;
    const cy = t ? t.clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  }

  /* ===========================
     RENDERING
     =========================== */
  _renderAll() {
    // base layer
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const s of this.strokes) {
      if (s.type === 'path') this._drawPath(s);
      else this._drawShape(s);
    }
    // selection box on top
    if (this.selectedId) this._drawSelectionBox();
    // overlay
    this._drawCursors();
  }

  _drawPath(s) {
    for (let i = 1; i < s.points.length; i++) {
      this._drawStrokeSegment(s.points[i - 1], s.points[i], s);
    }
  }

  _drawStrokeSegment(a, b, s) {
    this.ctx.save();
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';

    if (s.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.lineWidth = (s.size || this.size) * 2;
    } else if (s.tool === 'spray') {
      // Bold splatter (Option B)
      const dots = Math.max(25, (s.size || this.size) * 2);
      this.ctx.fillStyle = s.color || this.color;
      for (let i = 0; i < dots; i++) {
        const r = Math.random() * (s.size || this.size) * 1.2;
        const ang = Math.random() * Math.PI * 2;
        const dx = a[0] + Math.cos(ang) * r;
        const dy = a[1] + Math.sin(ang) * r;
        this.ctx.fillRect(dx, dy, 1.6, 1.6);
      }
      this.ctx.restore();
      return;
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = s.color || this.color;
      const base = s.size || this.size;
      if (s.tool === 'pencil') this.ctx.lineWidth = Math.max(1, base * 0.6);
      else if (s.tool === 'pen') this.ctx.lineWidth = base;
      else if (s.tool === 'brush') { this.ctx.lineWidth = base * 1.6; this.ctx.globalAlpha = 0.85; }
      else this.ctx.lineWidth = base;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(a[0], a[1]);
    this.ctx.lineTo(b[0], b[1]);
    this.ctx.stroke();
    this.ctx.restore();
  }

  _drawShape(s) {
    this.ctx.save();
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.lineWidth = s.size;
    this.ctx.strokeStyle = s.color;

    if (s.type === 'shape-rect') {
      this.ctx.strokeRect(s.x, s.y, s.w, s.h);
    } else if (s.type === 'shape-ellipse') {
      this.ctx.beginPath();
      this.ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, Math.abs(s.w / 2), Math.abs(s.h / 2), 0, 0, Math.PI * 2);
      this.ctx.stroke();
    } else if (s.type === 'shape-line') {
      this.ctx.beginPath();
      this.ctx.moveTo(s.x, s.y);
      this.ctx.lineTo(s.x + s.w, s.y + s.h);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  _drawCursors() {
    // clear overlay fully, then redraw handles + cursors
    this.octx.clearRect(0, 0, this.overlay.width, this.overlay.height);

    // selection handles (overlay)
    if (this.selectedId) {
      const s = this.strokes.find(x => x.id === this.selectedId);
      if (s) {
        const handles = this._getHandles(s);
        for (const h of handles) this._drawHandle(h.x, h.y);
      }
    }

    // other users’ cursors
    for (const [id, c] of this.cursors) {
      if (id === this.socket.id) continue;
      this.octx.save();
      this.octx.fillStyle = c.color || '#ff0';
      this.octx.beginPath();
      this.octx.arc(c.x, c.y, 3, 0, Math.PI * 2);
      this.octx.fill();
      this.octx.restore();
    }
  }

  /* ===========================
     SELECTION & RESIZE (your shapes only)
     =========================== */
  _hitShape(p, onlyMine = true) {
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      const s = this.strokes[i];
      if (!s.type?.startsWith('shape-')) continue;
      if (onlyMine && s.ownerId !== this.socket.id) continue;
      const r = { x: s.x, y: s.y, w: s.w, h: s.h };
      if (s.type === 'shape-line') {
        const x1 = r.x, y1 = r.y, x2 = r.x + r.w, y2 = r.y + r.h;
        const t = Math.max(0, Math.min(1, ((p.x - x1) * (x2 - x1) + (p.y - y1) * (y2 - y1)) / (((x2 - x1) ** 2 + (y2 - y1) ** 2) || 1)));
        const px = x1 + t * (x2 - x1), py = y1 + t * (y2 - y1);
        const dist = Math.hypot(px - p.x, py - p.y);
        if (dist <= Math.max(6, s.size)) return s;
      } else {
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return s;
      }
    }
    return null;
  }

  _selectionTryStart(p) {
    if (this.tool !== 'select') return false;
    const s = this._hitShape(p, true);
    if (!s) { this._clearSelection(); return false; }
    this.selectedId = s.id;
    this._renderAll();
    // handles?
    const handles = this._getHandles(s);
    for (const h of handles) {
      if (p.x >= h.x && p.x <= h.x + 10 && p.y >= h.y && p.y <= h.y + 10) { this.draggingHandle = h.pos; return true; }
    }
    // drag whole shape
    this.draggingHandle = 'move';
    this.dragOrigin = { x: p.x, y: p.y, sx: s.x, sy: s.y };
    return true;
  }

  _getHandles(s) {
    const x = s.x, y = s.y, w = s.w, h = s.h;
    return [
      { pos: 'nw', x: x - 5, y: y - 5 },
      { pos: 'n',  x: x + w / 2 - 5, y: y - 5 },
      { pos: 'ne', x: x + w - 5, y: y - 5 },
      { pos: 'e',  x: x + w - 5, y: y + h / 2 - 5 },
      { pos: 'se', x: x + w - 5, y: y + h - 5 },
      { pos: 's',  x: x + w / 2 - 5, y: y + h - 5 },
      { pos: 'sw', x: x - 5, y: y + h - 5 },
      { pos: 'w',  x: x - 5, y: y + h / 2 - 5 },
    ];
  }

  _drawSelectionBox() {
    const s = this.strokes.find(x => x.id === this.selectedId);
    if (!s) return;
    this.ctx.save();
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeStyle = '#2563eb';
    this.ctx.lineWidth = 1.2;
    if (s.type === 'shape-line') {
      this.ctx.beginPath();
      this.ctx.moveTo(s.x, s.y);
      this.ctx.lineTo(s.x + s.w, s.y + s.h);
      this.ctx.stroke();
    } else {
      this.ctx.strokeRect(s.x, s.y, s.w, s.h);
    }
    this.ctx.restore();
  }

  _drawHandle(x, y) {
    this.octx.save();
    this.octx.fillStyle = '#ffffff';
    this.octx.strokeStyle = '#2563eb';
    this.octx.lineWidth = 1.25;
    this.octx.beginPath();
    this.octx.rect(x, y, 10, 10);
    this.octx.fill();
    this.octx.stroke();
    this.octx.restore();
  }

  _selectionResize(p) {
    const s = this.strokes.find(x => x.id === this.selectedId);
    if (!s) return;

    if (this.draggingHandle === 'move') {
      const dx = p.x - this.dragOrigin.x;
      const dy = p.y - this.dragOrigin.y;
      s.x = this.dragOrigin.sx + dx;
      s.y = this.dragOrigin.sy + dy;
    } else {
      const left = s.x, top = s.y, right = s.x + s.w, bottom = s.y + s.h;
      const setN = () => { s.h = (bottom - p.y); s.y = p.y; };
      const setS = () => { s.h = (p.y - top); };
      const setW = () => { s.w = (right - p.x); s.x = p.x; };
      const setE = () => { s.w = (p.x - left); };
      if (this.draggingHandle.includes('n')) setN();
      if (this.draggingHandle.includes('s')) setS();
      if (this.draggingHandle.includes('w')) setW();
      if (this.draggingHandle.includes('e')) setE();
    }
    this._renderAll(); // live preview locally
  }

  _finishShapeResize() {
    const id = this.selectedId;
    this.draggingHandle = null;
    const s = this.strokes.find(x => x.id === id);
    if (!s) return;
    // send patch to server to sync others
    this.socket.emitShapeUpdate({ id, patch: { x: s.x, y: s.y, w: s.w, h: s.h } });
  }

  _clearSelection() {
    this.selectedId = null;
       this.draggingHandle = null;
    this._renderAll();
  }

  /* ===========================
     DATA APPLY HELPERS
     =========================== */
  loadCanvasState(strokes) {
    this.strokes = Array.isArray(strokes) ? strokes : [];
    this._renderAll();
  }

  /* ===========================
     UTILS
     =========================== */
  _download() {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.canvas.width;
    exportCanvas.height = this.canvas.height;
    const c = exportCanvas.getContext('2d');
    c.drawImage(this.canvas, 0, 0);
    const link = document.createElement('a');
    link.download = 'artming.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  }

  _updateUsers(users) {
    this.users = users || [];
    const badge = document.getElementById('users');
    if (badge) badge.textContent = `${this.users.length} online`;
    const ul = document.getElementById('userList');
    if (ul) {
      ul.innerHTML = '';
      for (const u of this.users) {
        const li = document.createElement('li');
        const dot = document.createElement('span');
        dot.className = 'user-dot';
        dot.style.background = u.color;
        li.appendChild(dot);
        li.appendChild(document.createTextNode(' ' + (u.username || u.id)));
        ul.appendChild(li);
      }
    }
  }
}

window.DrawingCanvas = DrawingCanvas;
