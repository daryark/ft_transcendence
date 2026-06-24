import { z } from "zod";
import { UserIdSchema } from "../../../auth/identity";
import type { RoomId } from "../room";

export const RolesSchema = z.enum(["player", "spectator"]);
export type Roles = z.infer<typeof RolesSchema>;

export const PlayerProfileSchema = z.object({
  nickname: z.string().min(1),
  level: z.number().int().min(1).optional(),
  xp: z.number().int().min(0).optional(),
});

export const PlayerSchema = z.object({
  id: UserIdSchema,
  socketId: z.string().min(1),
  identityType: z.enum(["registered", "anonymous"]).optional(),
  connected: z.boolean(),
  joinedAt: z.number().int().nonnegative(),
  disconnectedAt: z.number().int().nonnegative().optional(),
  role: RolesSchema.optional(),
  roomId: z.custom<RoomId>((value) => typeof value === "string").optional(),
  profile: PlayerProfileSchema.optional(),
});

export const PlayerUpdateSchema = PlayerSchema.partial().strict();

export type Player = z.infer<typeof PlayerSchema>;
export type PlayerUpdate = z.infer<typeof PlayerUpdateSchema>;

export type { Player as default };
