export default class Player {
  private id: string;        // stable identity
  private socketId: string;  // current connection
  private roomId?: string;

  constructor(id: string, socketId: string) {
    this.id = id;
    this.socketId = socketId;
  }

  attachSocket(socketId: string) {
    this.socketId = socketId;
  }

  //  getId() {
  //    return this.id;
  //  }
  //
  //  getSocketId() {
  //    return this.socketId;
  //  }
  //
  //  getRoomId() {
  //    return this.roomId;
  //  }
  //
  //  joinRoom(roomId: string) {
  //    this.roomId = roomId;
  //  }
  //
  //  leaveRoom() {
  //    this.roomId = undefined;
  //  }
}
