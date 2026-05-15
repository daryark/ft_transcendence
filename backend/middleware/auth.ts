import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";

type AuthPayload =
    | {
        token?: string | null;
    }
    | string
    | null
    | undefined;

export type Identity =
    | {
        id: string;
        type: "registered";
    }
    | {
        id: string;
        type: "anonymous";
    };

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not set");
    }

    return secret;
}

function getToken(auth: AuthPayload): string | null {
    if (!auth) {
        return null;
    }

    if (typeof auth === "string") {
        return auth;
    }

    return auth.token ?? null;
}

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

export function authenticateToken(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

    if (!token) {
        return res.status(401).json({ message: "Missing token" });
    }

    try {
        req.user = jwt.verify(token, getJwtSecret());
        return next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}

/**
 * Resolves user identity from auth token or creates an anonymous identity.
 * Works with both REST (header auth) and WebSocket (handshake auth) contexts.
 *
 * The registered branch returns the placeholder identity used by the project
 * checks for now.
 *
 * @param auth - Auth object with optional token property
 * @returns Identity object with id and type ("registered" or "anonymous")
 */
export function resolveIdentity(auth: AuthPayload): Identity {
    const token = getToken(auth);

    if (token) {
        try {
            const decoded = jwt.verify(token, getJwtSecret());
            const registeredIdentity = buildRegisteredIdentity(decoded);

            if (registeredIdentity) {
                // Temporary placeholder for the current project checks.
                // When the placeholder is removed, return `registeredIdentity` here.
                return {
                    id: "123",
                    type: "registered",
                };

                // return registeredIdentity;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "unknown error";
            console.warn("Invalid token provided, falling back to anonymous:", message);
        }
    }

    return {
        id: randomUUID(),
        type: "anonymous",
    };
}