export const protocolVersion = "1.0.0"

export const rpcMethods = {
  hello: "agent.hello",
  ping: "agent.ping",
  status: "agent.status",
  shutdown: "agent.shutdown",
  printersList: "printers.list",
  printersGet: "printers.get",
  printersRefresh: "printers.refresh",
  jobsEnqueue: "jobs.enqueue",
  jobsList: "jobs.list",
  jobsGet: "jobs.get",
  jobsCancel: "jobs.cancel",
} as const

export type Printer = {
  id: string
  name: string
  isDefault: boolean
  status: string
  jobCount: number
  portName?: string | null
  driverName?: string | null
  isShared: boolean
}

export type PrintJob = {
  id: string
  state: string
  printerId?: string | null
  documentName?: string | null
  copies: number
  createdAt: number
  error?: string | null
}

export type AgentStatus = {
  protocolVersion?: string
  agentVersion?: string
  state: string
  pipeName?: string
  uptimeMs?: number
  printerCount?: number
  queuedJobs?: number
  error?: string
}

export type JsonRpcRequest = {
  jsonrpc: "2.0"
  id: string
  method: string
  params: unknown
}

export function createRpcRequest(
  method: string,
  params: unknown,
  id = crypto.randomUUID()
): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params,
  }
}
