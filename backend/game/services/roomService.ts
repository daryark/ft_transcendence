import Room, { RoomId } from "../domain/room";
// import Player from "../domain/player";
import Config from "../config/config.types";
import { Server } from "socket.io";
import { ServerToClientEvents } from "../../sockets/gameHandlers";

export type RoomServiceRoomState = Pick<Room, "id" | "status" | "players">;

export interface RoomServiceApi {
  createRoom(config: Config): Room;
  generateRoomId(): RoomId;
  getRoom(roomId: RoomId): Room | undefined;
  deleteRoom(roomId: RoomId): void;
  addPlayer(roomId: RoomId, player: string): void;
  addSpectator(roomId: RoomId, spectator: string): void;
  removePlayer(roomId: RoomId, player: string): void;
  removeSpectator(roomId: RoomId, spectator: string): void;
  enqueue(playerId: string): void;
  dequeue(socketId: string): string[];
  broadcast(roomId: RoomId, event: string, data: any): void;
  clearRooms(): void;
  getRoomState(roomId: RoomId): RoomServiceRoomState | null;
}

export default class RoomService implements RoomServiceApi {
  private rooms: Map<RoomId, Room>;
  private queue: string[];
  private io: Server;

  constructor(io: Server) {
    this.rooms = new Map();
    this.queue = new Array();
    this.io = io;
  }

  createRoom(config: Config): Room {
    let room: Room = {
      id: this.generateRoomId() as RoomId,
      status: 'lobby',
      players: [],
      state: null,
      engine: null,
      ...config
    };

    if (config.roomConfig.public) room.spectators = [];

    while (this.rooms.has(room.id)) {
      room.id = this.generateRoomId();
    }

    this.rooms.set(room.id, room);
    return room;
  }

  generateRoomId(): RoomId {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result as RoomId;
  }

  getRoom(roomId: RoomId): Room | undefined {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: RoomId): void {
    this.rooms.delete(roomId);
  }


  addPlayer(roomId: RoomId, player: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (!room.players.includes(player)) {
      room.players.push(player);
    }
  }

  addSpectator(roomId: RoomId, spectator: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (!Array.isArray(room.spectators)) return; //throw err ?

    if (!room.spectators.includes(spectator)) {
      room.spectators.push(spectator);
    }
  }

  removePlayer(roomId: RoomId, player: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter((p: string) => p !== player);
    if (room.players.length === 0) {
      this.deleteRoom(roomId);
    }
  }

  removeSpectator(roomId: RoomId, spectator: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (!Array.isArray(room.spectators)) return;

    room.spectators = room.spectators.filter((s: string) => s !== spectator);
  }

  enqueue(playerId: string): void { //socket.id or player? (playerId (tockent/uuid))
    this.queue.push(playerId);
  }

  dequeue(socketId: string): string[] {
    return this.queue = this.queue.filter(p => p !== socketId);
  }

  broadcast(roomId: RoomId, event: ServerToClientEvents, data: any): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    this.io.to(roomId).emit(event, data);
  }

  clearRooms(): void {
    this.rooms.clear();
  }

  getRoomState(roomId: RoomId): RoomServiceRoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      id: room.id,
      status: room.status,
      players: room.players
    };
  }
}


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.