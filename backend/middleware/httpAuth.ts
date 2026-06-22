import { Request, Response, NextFunction } from "express";
import { getJwtSecret } from "../auth/jwt";
import jwt from "jsonwebtoken";
import type { ApiRequest } from "../app";
import { prisma } from "../prisma/prisma";

export async function authenticateToken(req: ApiRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

    if (!token) {
        return res.status(401).json({ message: "Missing token" });
    }

    try {
        const payload = jwt.verify(token, getJwtSecret()) as any;
        const userId = Number(payload?.sub ?? payload?.id);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({ message: "Invalid token subject" });
        }

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                username: true,
                created_at: true,
            },
        });

        if (!user) {
            return res.status(401).json({ message: "User no longer exists" });
        }

        req.user = {
            ...payload,
            sub: user.id,
            id: user.id,
            email: user.email,
            username: user.username,
            created_at: user.created_at,
        };
        return next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}
