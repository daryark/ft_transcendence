import jwt, { JwtPayload } from "jsonwebtoken";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getJwtSecret, getToken } from "./jwt";
import type { AuthPayload } from "./jwt";

export const UserIdSchema = z.string().min(1).brand<"UserId">();
export type UserId = z.infer<typeof UserIdSchema>;

export const IdentitySchema = z.object({
    id: UserIdSchema,
    type: z.enum(["registered", "anonymous"]),
});

export type Identity = z.infer<typeof IdentitySchema>;

function buildRegisteredIdentity(decoded: string | JwtPayload): Identity | null {
    if (typeof decoded === "string") {
        return null;
    }

    const rawUserId = decoded.id ?? decoded.sub ?? decoded.userId;

    if (rawUserId === undefined || rawUserId === null) {
        return null;
    }

    return {
        id: UserIdSchema.parse(String(rawUserId)),
        type: "registered",
    };
}

export function resolveIdentity(auth: AuthPayload): Identity {
    const token = getToken(auth);

    if (!token) {
        return {
            id: UserIdSchema.parse(randomUUID()),
            type: "anonymous",
        };
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const identity = buildRegisteredIdentity(decoded);

    if (!identity) {
        throw new Error("Invalid token");
    }

    return identity;
}
