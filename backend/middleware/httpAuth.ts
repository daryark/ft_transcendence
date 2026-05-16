import { Request, Response, NextFunction } from "express";
import { getJwtSecret } from "../auth/jwt";
import jwt from "jsonwebtoken";
import type { ApiRequest } from "../app";

export function authenticateToken(req: ApiRequest, res: Response, next: NextFunction) {
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