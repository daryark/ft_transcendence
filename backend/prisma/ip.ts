import type { Request } from "express";

export type RequestLike = Pick<Request, "ip" | "headers" | "socket">;

const COUNTRY_LOOKUP_TIMEOUT_MS = 3000;

function normalizeIpAddress(ip: string): string {
	const trimmed = ip.trim();

	if (trimmed.startsWith("::ffff:")) {
		return trimmed.slice(7);
	}

	return trimmed;
}

function isLocalOrPrivateIp(ip: string): boolean {
	const normalized = normalizeIpAddress(ip);

	return (
		normalized === "127.0.0.1" ||
		normalized === "::1" ||
		normalized === "0.0.0.0" ||
		normalized.toLowerCase() === "localhost" ||
		normalized.startsWith("10.") ||
		normalized.startsWith("192.168.") ||
		/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
	);
}

export function getClientIp(request?: RequestLike): string | null {
	if (!request) {
		return null;
	}

	if (request.ip && !isLocalOrPrivateIp(request.ip)) {
		return normalizeIpAddress(request.ip);
	}

	const forwardedFor = request.headers["x-forwarded-for"];
	if (typeof forwardedFor === "string" && forwardedFor.trim()) {
		const firstForwardedIp = forwardedFor.split(",")[0]?.trim();
		if (firstForwardedIp && !isLocalOrPrivateIp(firstForwardedIp)) {
			return normalizeIpAddress(firstForwardedIp);
		}
	}

	const realIp = request.headers["x-real-ip"];
	if (typeof realIp === "string" && realIp.trim() && !isLocalOrPrivateIp(realIp)) {
		return normalizeIpAddress(realIp);
	}

	const socketIp = request.socket?.remoteAddress;
	if (typeof socketIp === "string" && socketIp.trim() && !isLocalOrPrivateIp(socketIp)) {
		return normalizeIpAddress(socketIp);
	}

	return null;
}

export async function resolveCountryByIp(ip: string | null | undefined): Promise<string | null> {
	if (!ip || isLocalOrPrivateIp(ip)) {
		return null;
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), COUNTRY_LOOKUP_TIMEOUT_MS);

	try {
		const response = await fetch(`https://ipwho.is/${encodeURIComponent(normalizeIpAddress(ip))}`, {
			signal: controller.signal,
			headers: {
				accept: "application/json",
			},
		});

		if (!response.ok) {
			return null;
		}

		const payload = (await response.json()) as { success?: boolean; country?: string };

		if (!payload.success || typeof payload.country !== "string") {
			return null;
		}

		const country = payload.country.trim();
		return country.length > 0 ? country.slice(0, 100) : null;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

export async function resolveCountryFromRequest(request?: RequestLike): Promise<string | null> {
	return resolveCountryByIp(getClientIp(request));
}