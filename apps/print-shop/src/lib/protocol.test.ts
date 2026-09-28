import { describe, expect, it } from "vitest"

import { createRpcRequest, looksLikeEmail, protocolVersion, rpcMethods } from "./protocol"

describe("agent protocol", () => {
  it("keeps the JSON-RPC 2.0 envelope stable", () => {
    const request = createRpcRequest(rpcMethods.printersList, {})
    expect(request.jsonrpc).toBe("2.0")
    expect(request.method).toBe("printers.list")
    expect(request.id).toBeTruthy()
    expect(protocolVersion).toBe("1.0.0")
  })

  it("treats phone numbers as non-email identifiers", () => {
    expect(looksLikeEmail("owner@shop.com")).toBe(true)
    expect(looksLikeEmail("9876543210")).toBe(false)
    expect(looksLikeEmail("+919876543210")).toBe(false)
  })
})
