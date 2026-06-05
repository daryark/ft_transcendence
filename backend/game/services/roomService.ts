import Room, { RoomId } from "../domain/room";
import Config from "../config/config.types";
import { Server } from "socket.io";
import { ServerToClientEvents } from "../../sockets/gameHandlers";
import Player from "../domain/player";
import { UserId } from "../../auth/identity";

export type RoomServiceRoomState = Pick<Room, "id" | "status" | "players">;

export default class RoomService {
  private rooms: Map<RoomId, Room>;
  private queue: UserId[];
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
      players: new Map(),
      state: null,
      engine: null,
      ...config
    };

    if (config.roomConfig.public) room.spectators = new Map();

    while (this.rooms.has(room.id)) {
      room.id = this.generateRoomId();
    }
    console.log('Creating room with ID:', room.id);//*tmp log

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
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.engine?.stop();
    this.clearRoomSpectators(room);
    this.cleanRoomState(room);
    this.rooms.delete(roomId);
  }

  isEmpty(roomId: RoomId): boolean {
    return this.rooms.get(roomId)?.players.size === 0;
  }

  addPlayer(roomId: RoomId, player: Player): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    //check in config.roomConfig if anonymousAllowed, if room is public, maxPlayers, unrankedAllowed, rankLimit and (levelLimit??)

    if (!room.players.has(player.id)) {
      player.roomId = roomId;
      player.role = "player";
      room.players.set(player.id, player);
    }
  }

  addSpectator(roomId: RoomId, spectator: Player): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (!room.spectators) return;

    if (!room.spectators.has(spectator.id)) {
      spectator.roomId = roomId;
      spectator.role = "spectator";
      room.spectators.set(spectator.id, spectator);
    }
  }

  removePlayer(roomId: RoomId, playerId: Player["id"]): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (player) {
      player.roomId = undefined; // Clear player's room association
      player.role = undefined; // and role association
      room.players.delete(playerId);
    }
  }

  removeSpectator(roomId: RoomId, spectatorId: Player["id"]): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const spectator = room.spectators?.get(spectatorId);
    if (spectator) {
      spectator.roomId = undefined; // Clear spectator's room association
      spectator.role = undefined; // and role association
      room.spectators?.delete(spectatorId);
    }
  }

  enqueue(playerId: UserId): void { //socket.id or player? (playerId (tockent/uuid))
    this.queue.push(playerId);
  }

  dequeue(playerId: UserId): UserId[] {
    return this.queue = this.queue.filter(p => p !== playerId);
  }

  broadcast(roomId: RoomId, event: ServerToClientEvents, data: any): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    this.io.to(roomId).emit(event, data);
  }

  private clearRoomSpectators(room: Room): void {
    for (const spectator of room.spectators?.values() || []) {
      spectator.roomId = undefined;
      spectator.role = undefined;
    }
    room.spectators?.clear();
  }

  private cleanRoomState(room: Room): void {
    room.status = "ended";
    room.engine = null;
    room.state = null;
  }

  clearRooms(): void {
    for (const room of this.rooms.values()) {
      room.engine?.stop();
      for (const player of room.players.values()) {
        player.roomId = undefined;
        player.role = undefined;
      }
      room.players.clear();
      this.clearRoomSpectators(room);
      this.cleanRoomState(room);
    }
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
