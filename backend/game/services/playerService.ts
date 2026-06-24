import { UserId } from "../../auth/identity";
import Player from "../domain/player";
import { PlayerSchema, PlayerUpdate, PlayerUpdateSchema } from "../domain/player";

const RECONNECT_TIMEOUT_MS = 30_000;

export default class PlayerService {
  private players: Map<UserId, Player>;
  private reconnectTimers: Map<UserId, ReturnType<typeof setTimeout>>;

  constructor() {
    this.players = new Map(); // playerId -> Player
    this.reconnectTimers = new Map();
  }

  get(playerId: UserId): Player | undefined {
    return this.players.get(playerId);
  }

  create(rawPlayer: Player): Player {
    const player = PlayerSchema.parse(rawPlayer);
    if (player === undefined) {
      console.error("Invalid player data");
      throw new Error("Invalid player data");//?! where do i throw it? to the client or just log it and return undefined?? if to the client, how do i emit it from here?? should i pass socket to this service?
    }

    this.players.set(player.id, player);
    return player;
  }

  addProfile(playerId: UserId, profile: Player["profile"]): Player | undefined {
    const player = this.players.get(playerId);
    if (!player) return undefined;

    player.profile = profile;
    return player;
  }

  update(playerId: UserId, rawUpdates: PlayerUpdate): Player | undefined {
    const player = this.players.get(playerId);
    if (!player) return undefined;

    const updates = PlayerUpdateSchema.parse(rawUpdates);
    Object.assign(player, updates); //!what does it mean? mutate original player and link for the player is same??
    return player;
  }

  //!do i need this method, or player will be automatically removed when disconnecting?? if i need it, when should i call it?? on disconnect or after reconnect timeout?? or both??
  delete(playerId: UserId): void {
    this.clearReconnectTimer(playerId);
    this.players.delete(playerId);
  }

  markConnected(playerId: UserId, socketId: string): Player | undefined {
    this.clearReconnectTimer(playerId);

    return this.update(playerId, {
      socketId,
      connected: true,
      disconnectedAt: undefined,
    });
  }

  //!read properly, if i need to throw/emit some error here?!
  markDisconnected(
    playerId: UserId,
    onReconnectExpired: (player: Player) => void,
    timeoutMs = RECONNECT_TIMEOUT_MS
  ): Player | undefined {

    const player = this.update(playerId, {
      connected: false,
      disconnectedAt: Date.now(),
    });
    if (!player) return undefined;

    this.clearReconnectTimer(playerId);
    if (timeoutMs <= 0) {
      onReconnectExpired(player);
      this.delete(playerId);
      return player;
    }

    const timer = setTimeout(() => {
      const currentPlayer = this.players.get(playerId);
      if (!currentPlayer || currentPlayer.connected) return;

      onReconnectExpired(currentPlayer);
      this.delete(playerId);
    }, timeoutMs);

    this.reconnectTimers.set(playerId, timer);
    return player;
  }

  private clearReconnectTimer(playerId: UserId): void {
    const timer = this.reconnectTimers.get(playerId);
    if (!timer) return;

    clearTimeout(timer);
    this.reconnectTimers.delete(playerId);
  }
}
