import { beforeEach, describe, expect, it, vi } from "vitest";

const user = {
  id: 7,
  email: "player@example.com",
  username: "PLAYER",
  created_at: null,
};

async function loadApiModules() {
  vi.resetModules();
  const session = await import("../../src/auth/session");
  const client = await import("../../src/api/client");
  return { session, client };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("can skip auth headers for public requests", async () => {
    const { session, client } = await loadApiModules();
    session.saveSession({ user, token: "secret-token" });
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await client.apiRequest("/api/public", { skipAuth: true });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBeNull();
  });

  it("clears the current session when an authenticated request returns 401", async () => {
    const { session, client } = await loadApiModules();
    session.saveSession({ user, token: "expired-token" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(client.apiRequest("/api/private")).rejects.toMatchObject({
      message: "Your session has expired. Please sign in again.",
      status: 401,
    });
    expect(session.getSession()).toBeNull();
  });

  it("preserves caller aborts as AbortError", async () => {
    const { client } = await loadApiModules();
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }),
    );

    const request = client.apiRequest("/api/slow", {
      signal: controller.signal,
    });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});
