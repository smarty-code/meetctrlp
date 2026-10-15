import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  claimsFor,
  claimsMatch,
  decodeJwtPayload,
  principalFromClaims,
  systemPrincipal,
} from "./principal.ts";

function fakeJwt(payload: Record<string, unknown>) {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(payload)}.signature`;
}

describe("shop principal", () => {
  it("builds a principal from complete claims", () => {
    assert.deepEqual(principalFromClaims("uid-1", { shopId: "s1", shopUserId: "u1", role: "OWNER", email: "x" }), {
      uid: "uid-1",
      shopId: "s1",
      shopUserId: "u1",
      role: "OWNER",
    });
  });

  it("rejects missing or malformed claims", () => {
    assert.equal(principalFromClaims("uid-1", {}), undefined);
    assert.equal(principalFromClaims("uid-1", { shopId: "s1", shopUserId: "u1" }), undefined);
    assert.equal(principalFromClaims("uid-1", { shopId: "s1", shopUserId: "u1", role: "ADMIN" }), undefined);
    assert.equal(principalFromClaims("uid-1", { shopId: "", shopUserId: "u1", role: "STAFF" }), undefined);
    assert.equal(principalFromClaims("uid-1", { shopId: 7, shopUserId: "u1", role: "STAFF" }), undefined);
  });

  it("compares claims with the stored user", () => {
    const expected = claimsFor({ id: "u1", shopId: "s1", role: "MANAGER" });
    assert.deepEqual(expected, { shopId: "s1", shopUserId: "u1", role: "MANAGER" });
    assert.equal(claimsMatch({ ...expected, iat: 1 }, expected), true);
    assert.equal(claimsMatch({ ...expected, role: "STAFF" }, expected), false);
    assert.equal(claimsMatch(undefined, expected), false);
  });

  it("decodes a JWT payload without verifying it", () => {
    assert.deepEqual(decodeJwtPayload(fakeJwt({ shopId: "s1" })), { shopId: "s1" });
    assert.equal(decodeJwtPayload("not-a-jwt"), undefined);
    assert.equal(decodeJwtPayload("a.%%%.c"), undefined);
  });

  it("marks system actors", () => {
    assert.deepEqual(systemPrincipal("s1", "payment-provider"), {
      uid: "system:payment-provider",
      shopId: "s1",
      shopUserId: "payment-provider",
      role: "OWNER",
    });
  });
});
