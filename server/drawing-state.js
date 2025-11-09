// // server/drawing-state.js
// class DrawingState {
//   constructor() {
//     // Map<roomId, { strokes: [], history: [], redoStack: [] }>
//     this.roomStates = new Map();
//   }

//   ensureRoom(roomId) {
//     if (!this.roomStates.has(roomId)) {
//       this.roomStates.set(roomId, {
//         strokes: [],
//         history: [],     // [{ type:'add', strokeId }]
//         redoStack: []    // [stroke objects]
//       });
//     }
//     return this.roomStates.get(roomId);
//   }

//   getState(roomId) {
//     return this.ensureRoom(roomId).strokes;
//   }

//   addStroke(roomId, stroke) {
//     const st = this.ensureRoom(roomId);
//     st.strokes.push(stroke);
//     st.history.push({ type: 'add', strokeId: stroke.id });
//     st.redoStack = []; // new op invalidates redo
//   }

//   undoGlobal(roomId) {
//     const st = this.ensureRoom(roomId);
//     // find last "add"
//     for (let i = st.history.length - 1; i >= 0; i--) {
//       const h = st.history[i];
//       if (h.type === 'add') {
//         // remove history entry
//         st.history.splice(i, 1);
//         // remove the stroke itself
//         const idx = st.strokes.findIndex(s => s.id === h.strokeId);
//         if (idx !== -1) {
//           const [removed] = st.strokes.splice(idx, 1);
//           st.redoStack.push(removed);
//           return removed;
//         }
//       }
//     }
//     return null;
//   }

//   redoGlobal(roomId) {
//     const st = this.ensureRoom(roomId);
//     if (st.redoStack.length === 0) return null;
//     const restored = st.redoStack.pop();
//     st.strokes.push(restored);
//     st.history.push({ type: 'add', strokeId: restored.id });
//     return restored;
//   }

//   clear(roomId) {
//     const st = this.ensureRoom(roomId);
//     st.strokes = [];
//     st.history = [];
//     st.redoStack = [];
//   }
// }

// module.exports = DrawingState;
// server/drawing-state.js
class DrawingState {
  constructor() {
    // roomId -> { strokes: [], history: [], redoStack: [] }
    this.roomStates = new Map();
  }

  ensureRoom(roomId) {
    if (!this.roomStates.has(roomId)) {
      this.roomStates.set(roomId, {
        strokes: [],
        history: [],        // [{type:'add', strokeId}]
        redoStack: []       // [stroke]
      });
    }
    return this.roomStates.get(roomId);
  }

  getState(roomId) {
    // always return a shallow copy to avoid accidental client mutation
    const st = this.ensureRoom(roomId);
    return st.strokes.slice();
  }

  addStroke(roomId, stroke) {
    const st = this.ensureRoom(roomId);
    st.strokes.push(stroke);
    st.history.push({ type: 'add', strokeId: stroke.id });
    // any new draw invalidates redo
    st.redoStack = [];
  }

  // GLOBAL UNDO: remove the last "add" op (whoever drew it)
  undoGlobal(roomId) {
    const st = this.ensureRoom(roomId);
    if (!st.history.length) return null;

    // scan backward for last add
    for (let i = st.history.length - 1; i >= 0; i--) {
      const h = st.history[i];
      if (h.type === 'add') {
        st.history.splice(i, 1);

        const idx = st.strokes.findIndex(s => s.id === h.strokeId);
        if (idx !== -1) {
          const [removed] = st.strokes.splice(idx, 1);
          st.redoStack.push(removed);
          return removed;
        }
      }
    }
    return null;
  }

  // GLOBAL REDO: restore only what was undone by global undo
  redoGlobal(roomId) {
    const st = this.ensureRoom(roomId);
    if (!st.redoStack.length) return null;

    const restored = st.redoStack.pop();
    st.strokes.push(restored);
    st.history.push({ type: 'add', strokeId: restored.id });
    return restored;
  }

  clear(roomId) {
    const st = this.ensureRoom(roomId);
    st.strokes = [];
    st.history = [];
    st.redoStack = [];
  }
}

module.exports = DrawingState;
