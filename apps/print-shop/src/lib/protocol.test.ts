import { describe, expect, it } from "vitest"

import { createRpcRequest, protocolVersion, rpcMethods } from "./protocol"

describe("agent protocol", () => {
  it("keeps the JSON-RPC 2.0 envelope stable", () => {
    const request = createRpcRequest(rpcMethods.printersList, {})
    expect(request.jsonrpc).toBe("2.0")
    expect(request.method).toBe("printers.list")
    expect(request.id).toBeTruthy()
    expect(protocolVersion).toBe("1.0.0")
  })
})
