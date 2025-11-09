// // server/rooms.js
// class Rooms {
//   constructor() {
//     // Map<roomId, { users: Map<socketId, userObj> }>
//     this.rooms = new Map();
//   }

//   ensure(roomId) {
//     if (!this.rooms.has(roomId)) {
//       this.rooms.set(roomId, { users: new Map() });
//     }
//     return this.rooms.get(roomId);
//   }

//   addUser(roomId, user) {
//     const r = this.ensure(roomId);
//     r.users.set(user.id, user);
//   }

//   removeUser(roomId, socketId) {
//     const r = this.ensure(roomId);
//     r.users.delete(socketId);
//   }

//   getUsers(roomId) {
//     const r = this.ensure(roomId);
//     return Array.from(r.users.values());
//   }
// }

// module.exports = Rooms;
// server/rooms.js
class Rooms {
  constructor() {
    // roomId -> { users: Map<socketId, userObj> }
    this.rooms = new Map();
  }

  ensure(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, { users: new Map() });
    }
    return this.rooms.get(roomId);
  }

  addUser(roomId, user) {
    this.ensure(roomId).users.set(user.id, user);
  }

  removeUser(roomId, socketId) {
    this.ensure(roomId).users.delete(socketId);
  }

  getUsers(roomId) {
    return Array.from(this.ensure(roomId).users.values());
  }
}

module.exports = Rooms;
