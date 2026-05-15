export type AuthPayload =
    | {
        token?: string | null;
    }
    | string
    | null
    | undefined;
    
export function getToken(auth: AuthPayload): string | null {
        if (!auth) {
            return null;
        }
    
        if (typeof auth === "string") {
            return auth;
        }
    
        return auth.token ?? null;
    }

export function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not set");
    }

    return secret;
}