import https from "node:https";
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
		normalized.length === 0 ||
		normalized.toLowerCase() === "undefined" ||
		normalized.toLowerCase() === "null" ||
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

	const forwardedFor = request.headers["x-forwarded-for"];
	if (typeof forwardedFor === "string" && forwardedFor.trim()) {
		const firstForwardedIp = forwardedFor.split(",")[0]?.trim();
		if (firstForwardedIp) {
			return normalizeIpAddress(firstForwardedIp);
		}
	}

	const cloudflareIp = request.headers["cf-connecting-ip"];
	if (typeof cloudflareIp === "string" && cloudflareIp.trim()) {
		return normalizeIpAddress(cloudflareIp);
	}

	const realIp = request.headers["x-real-ip"];
	if (typeof realIp === "string" && realIp.trim()) {
		return normalizeIpAddress(realIp);
	}

	if (request.ip) {
		return normalizeIpAddress(request.ip);
	}

	const socketIp = request.socket?.remoteAddress;
	if (typeof socketIp === "string" && socketIp.trim()) {
		return normalizeIpAddress(socketIp);
	}

	return null;
}

export async function resolveCountryByIp(ip: string | null | undefined): Promise<string | null> {
	if (!ip) {
		return null;
	}

	// For local/private IPs in development, still try to resolve
	// the caller's actual public IP via the service
	const normalized = normalizeIpAddress(ip);
	
	// Only skip the lookup entirely if the input is clearly invalid/placeholder
	if (
		normalized.length === 0 ||
		normalized.toLowerCase() === "undefined" ||
		normalized.toLowerCase() === "null"
	) {
		return null;
	}

	const lookupUrl = isLocalOrPrivateIp(normalized)
		? "https://ipwho.is/"
		: `https://ipwho.is/${encodeURIComponent(normalized)}`;

	try {
		const payload = await new Promise<{ success?: boolean; country?: string }>((resolve, reject) => {
			const request = https.get(
				lookupUrl,
				{
					headers: {
						accept: "application/json",
					},
				},
				(response) => {
					let body = "";

					response.setEncoding("utf8");
					response.on("data", (chunk) => {
						body += chunk;
					});
					response.on("end", () => {
						if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
							try {
								resolve(JSON.parse(body) as { success?: boolean; country?: string });
							} catch (error) {
								reject(error);
							}
							return;
						}

						reject(new Error(`ipwho.is request failed with status ${response.statusCode ?? "unknown"}`));
					});
				}
			);

			request.setTimeout(COUNTRY_LOOKUP_TIMEOUT_MS, () => {
				request.destroy(new Error("ipwho.is request timed out"));
			});

			request.on("error", reject);
		});

		if (!payload.success || typeof payload.country !== "string") {
			return null;
		}

		const country = payload.country.trim();
		return country.length > 0 ? country.slice(0, 100) : null;
	} catch {
		return null;
	}
}

export async function resolveCountryFromRequest(request?: RequestLike): Promise<string | null> {
	return resolveCountryByIp(getClientIp(request));
}
