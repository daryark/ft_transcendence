import Player from "../domain/player";

export default class PlayerService {
  private players: Map<string, Player>;

  constructor() {
    this.players = new Map(); // playerId -> Player
  }

  getOrCreate(playerId: string, socketId: string): Player {
    let p = this.players.get(playerId);

    if (!p) {
      p = new Player(playerId, socketId);
      this.players.set(playerId, p);
    } else {
      p.attachSocket(socketId); // reconnect
    }

    return p;
  }

  get(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }
}