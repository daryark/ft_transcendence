import jwt, { JwtPayload } from "jsonwebtoken";
import { randomUUID } from "crypto";
import { getJwtSecret, getToken } from "./jwt";
import type { AuthPayload } from "./jwt";

export type Identity = {
        id: string;
        type: "registered" | "anonymous";
    };

function buildRegisteredIdentity(decoded: string | JwtPayload): Identity | null {
    if (typeof decoded === "string") {
        return null;
    }

    const rawUserId = decoded.id ?? decoded.sub ?? decoded.userId;

    if (rawUserId === undefined || rawUserId === null) {
        return null;
    }

    return {
        id: String(rawUserId),
        type: "registered",
    };
}

export function resolveIdentity(auth: AuthPayload): Identity {
    const token = getToken(auth);

    if (!token) {
        return {
            id: randomUUID(),
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

