import jwt from "jsonwebtoken";
import { describe, expect, test } from "@jest/globals";
import { getJwtSecret, getToken } from "../../auth/jwt";
import { resolveIdentity } from "../../auth/identity";

describe("auth helpers", () => {
  test("getToken reads token strings and auth payload objects", () => {
    expect(getToken("abc")).toBe("abc");
    expect(getToken({ token: "def" })).toBe("def");
    expect(getToken({ token: null })).toBeNull();
    expect(getToken(undefined)).toBeNull();
  });

  test("getJwtSecret fails loudly when JWT_SECRET is missing", () => {
    const previousSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    expect(() => getJwtSecret()).toThrow("JWT_SECRET is not set");

    process.env.JWT_SECRET = previousSecret;
  });

  test("resolveIdentity creates anonymous identities without a token", () => {
    process.env.JWT_SECRET = "test-secret";

    const identity = resolveIdentity(null);

    expect(identity.type).toBe("anonymous");
    expect(identity.id).toEqual(expect.any(String));
    expect(identity.id).not.toHaveLength(0);
  });

  test("resolveIdentity extracts registered ids from signed tokens", () => {
    process.env.JWT_SECRET = "test-secret";
    const token = jwt.sign({ id: 123 }, process.env.JWT_SECRET);

    expect(resolveIdentity({ token })).toEqual({
      id: "123",
      type: "registered",
    });
  });

  test("resolveIdentity rejects tokens without a user id claim", () => {
    process.env.JWT_SECRET = "test-secret";
    const token = jwt.sign({ role: "player" }, process.env.JWT_SECRET);

    expect(() => resolveIdentity(token)).toThrow("Invalid token");
  });
});
