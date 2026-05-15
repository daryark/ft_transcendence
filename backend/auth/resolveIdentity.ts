import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET!;

export type Identity =
    | {
        id: string;
        type: "registered";
    }
    | {
        id: string;
        type: "anonymous";
    };

type HandshakeAuth = {
    token?: string;
};

export function resolveIdentity(auth?: HandshakeAuth): Identity {
    const token = auth?.token;

    if (token) {
        try {
            const { userId } = jwt.verify(token, JWT_SECRET) as { userId: string };

            return {
                id: userId,
                type: "registered",
            };
        } catch {
            // invalid token -> continue as anonymous
        }
    }

    return {
        id: randomUUID(),
        type: "anonymous",
    };
}