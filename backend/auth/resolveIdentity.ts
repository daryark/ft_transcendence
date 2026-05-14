import { randomUUID } from "crypto";
// import jwt from "jsonwebtoken";

export type Identity =
    | {
        id: string;
        type: "registered";
    }
    | {
        id: string;
        type: "anonymous";
    };


export function resolveIdentity(auth: string | null): Identity {
    // const token = auth?.token;

    if (auth) {
        return {
            id: "123",
            type: "registered"
        };
    }

    const anonymousId = randomUUID();
    return {
        id: anonymousId,
        type: "anonymous",
    };
}