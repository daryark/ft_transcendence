export default class Player {
  id: string;        // stable identity
  socketId: string;  // current connection
  roomId?: string;

  constructor(id: string, socketId: string) {
    this.id = id;
    this.socketId = socketId;
  }

  attachSocket(socketId: string) {
    this.socketId = socketId;
  }
}
