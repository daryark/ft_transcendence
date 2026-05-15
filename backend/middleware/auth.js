const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

    if (!token) {
        return res.status(401).json({ message: "Missing token" });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        return next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}

/**
 * Resolves user identity from auth token or creates an anonymous identity.
 * Works with both REST (header auth) and WebSocket (handshake auth) contexts.
 * 
 * @param {Object|null} auth - Auth object with optional token property
 * @returns {Object} Identity object with id and type ("registered" or "anonymous")
 */
function resolveIdentity(auth) {
    const token = auth?.token;

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            return {
                id: decoded.id || decoded.sub || decoded.userId,
                type: "registered",
            };
        } catch (error) {
            console.warn("Invalid token provided, falling back to anonymous:", error.message);
        }
    }

    // Create anonymous identity
    const anonymousId = randomUUID();
    return {
        id: anonymousId,
        type: "anonymous",
    };
}

module.exports = {
    authenticateToken,
    resolveIdentity,
};