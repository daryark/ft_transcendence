import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveSession } from "../auth/session";
import { ApiError, apiJson } from "./client";

const user = {
  id: 7,
  email: "player@example.com",
  username: "PLAYER",
  created_at: null,
};

afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});

describe("apiJson", () => {
  it("attaches the current bearer token", async () => {
    saveSession({ user, token: "test-token" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiJson("/api/test")).resolves.toEqual({ ok: true });

    const request = fetchMock.mock.calls[0];
    const init = request?.[1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer test-token",
    );
  });

  it("normalizes backend errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Room is full", code: "FULL" }), {
          headers: { "Content-Type": "application/json" },
          status: 409,
        }),
      ),
    );

    await expect(apiJson("/api/test")).rejects.toMatchObject({
      message: "Room is full",
      status: 409,
      code: "FULL",
    } satisfies Partial<ApiError>);
  });
});
