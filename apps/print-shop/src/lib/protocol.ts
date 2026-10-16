export const protocolVersion = "1.0.0"
export const appVersion = "0.1.0"

export const rpcMethods = {
  hello: "agent.hello",
  ping: "agent.ping",
  status: "agent.status",
  shutdown: "agent.shutdown",
  printersList: "printers.list",
  printersGet: "printers.get",
  printersRefresh: "printers.refresh",
  printersTestPage: "printers.testPage",
  jobsEnqueue: "jobs.enqueue",
  jobsList: "jobs.list",
  jobsGet: "jobs.get",
  jobsCancel: "jobs.cancel",
  secretsGetRefreshToken: "secrets.getRefreshToken",
  secretsSetRefreshToken: "secrets.setRefreshToken",
  secretsClearRefreshToken: "secrets.clearRefreshToken",
  hostIdentity: "host.identity",
  hostTelemetry: "host.telemetry",
  hostExportLog: "host.exportLog",
} as const

export type PrinterOptions = {
  colorModes: string[]
  paperSizes: string[]
  paperSizeLabels: string[]
  orientations: string[]
  duplexModes: string[]
  inputTrays: string[]
  printQualities: string[]
  copiesMin: number
  copiesMax: number
  currentColorMode?: string | null
  currentPaperSize?: string | null
  currentOrientation?: string | null
  currentInputTray?: string | null
  currentPrintQuality?: string | null
  currentCopies: number
  raw: string[]
}

export type PrinterOffered = {
  bw: boolean
  color: boolean
  a4: boolean
  a3: boolean
}

export type Printer = {
  id: string
  name: string
  isDefault: boolean
  status: string
  jobCount: number
  portName?: string | null
  driverName?: string | null
  isShared: boolean
  systemName?: string | null
  statusReason?: string | null
  isColorCapable?: boolean
  isDuplexCapable?: boolean
  supportedPaperSizes?: string[]
  maximumCopies?: number
  isWindowsDefault?: boolean
  options?: PrinterOptions | null
  cloudId?: string
  enabled?: boolean
  offered?: PrinterOffered
  isShopDefault?: boolean
  capabilities?: string[]
  defaultPrintSettings?: Record<string, unknown> | null
}

export type CloudPrinter = {
  id: string
  agentId?: string | null
  name: string
  systemName: string
  driverName?: string | null
  portName?: string | null
  status: string
  statusReason?: string | null
  isDefault: boolean
  enabled: boolean
  offered: PrinterOffered
  isColorCapable: boolean
  isDuplexCapable: boolean
  supportedPaperSizes: string[]
  options?: PrinterOptions | null
  capabilities: string[]
  activeJobsCount: number
  maximumCopies: number
  defaultPrintSettings?: Record<string, unknown> | null
}

export type PrintJob = {
  id: string
  state: string
  printerId?: string | null
  documentName?: string | null
  copies: number
  createdAt: number
  error?: string | null
  cloudJobId?: string | null
  cloudOrderId?: string | null
  cloudDocumentId?: string | null
  /** The cloud lease this row prints under; a row from an earlier lease is a superseded attempt. */
  leaseId?: string | null
  /** "revoked" when the server took the lease back: the row is never printed (if not started) or reported. */
  reportState?: "none" | "pending" | "acked" | "rejected" | "revoked"
  pagesTotal?: number
  pagesPrinted?: number
  startedAt?: number | null
  completedAt?: number | null
  spoolerJobId?: number | null
}

export type PrintJobStatus =
  | "QUEUED"
  | "DISPATCHING"
  | "PRINTING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"

export type CloudPrintJob = {
  id: string
  orderId: string
  documentId: string
  printerId: string
  printerName: string
  agentId: string | null
  status: PrintJobStatus
  pagesTotal: number
  pagesPrinted: number
  spoolerJobId: number | null
  retryCount: number
  requestedOverrides: Record<string, unknown>
  resolvedSettings: Record<string, unknown>
  errorCode: string | null
  errorMessage: string | null
  createdAt: string | null
  updatedAt: string | null
  startedAt: string | null
  completedAt: string | null
  /** When this job's current lease was taken; a DISPATCHING job older than 15 minutes can be rescued. */
  claimedAt?: string | null
  leaseId?: string | null
}

export type ShopOrderStatus =
  | "SUBMITTED"
  | "SHOP_ACCEPTED"
  | "PRINTING"
  | "READY"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED"

export type ShopOrderDocument = {
  id: string
  docId?: string
  originalFilename: string
  pageCount: number
  copies: number
  colorMode: "BW" | "COLOR"
  paperSize: "A4" | "A3"
  fileSizeBytes?: number
  sha256Hash?: string
  shreddedAt?: string | null
  config?: {
    colorMode?: "BW" | "COLOR"
    copies?: number
    paperSize?: "A4" | "A3"
    pageSelection?: string
  }
}

export type ShopOrderQueueError = {
  documentId: string
  /** An upper-case code, or "QUEUE_FAILED". */
  code: string
  /** The server's text, e.g. "no compatible online printer is available". */
  message: string
  at: string
}

export type ShopOrder = {
  id: string
  orderNumber: string
  shopId: string
  status: ShopOrderStatus
  customerPhone: string | null
  pickupCode: string
  amounts: { subtotalMinorUnits: number; taxMinorUnits: number; totalMinorUnits: number }
  payment: { method: "CASH" | "ONLINE"; status: "PENDING" | "PAID" }
  documents: ShopOrderDocument[]
  /** Documents of an accepted order that couldn't be queued; cleared once they are. Older servers omit it. */
  queueErrors?: ShopOrderQueueError[]
  rejection: { reason: string | null; category: string | null }
  lifecycle: {
    submittedAt: string | null
    acceptedAt: string | null
    readyAt: string | null
    completedAt: string | null
    paidAt?: string | null
    printingAt?: string | null
    rejectedAt?: string | null
    cancelledAt?: string | null
  }
  createdAt: string | null
  updatedAt: string | null
}

/** Changes to the order board: from `GET .../board` (implementation plan 8.4) or the operator's own actions. */
export type OrderBoardEvent =
  | { type: "BOARD_SNAPSHOT"; orders: ShopOrder[]; jobs: CloudPrintJob[] }
  | { type: "BOARD_DELTA"; orders: ShopOrder[]; jobs: CloudPrintJob[] }
  | { type: "ORDER_STATUS_CHANGED"; order: ShopOrder }
  | { type: "PRINT_JOB_CHANGED"; job: CloudPrintJob }

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

export type ShopUserRole = "OWNER" | "MANAGER" | "STAFF"
export type ShopUserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED"

export type ShopUser = {
  id: string
  shopId: string
  name: string
  email: string | null
  phone: string | null
  role: ShopUserRole
  status: ShopUserStatus
  lastLoginAt: string | null
}

export type AuthTokens = {
  idToken: string
  refreshToken: string
  expiresIn: number
}

export type AuthSession = {
  user: ShopUser
  tokens: AuthTokens
}

export type ShopAddress = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
}

export type ShopProfile = {
  id: string
  name: string
  slug?: string | null
  customerUrl?: string | null
  phone: string | null
  email: string | null
  status: string
  address: string | null
  addressParts?: ShopAddress
}

export type ShopBusinessHour = {
  dayOfWeek: number
  /** Canonical 24-hour "HH:mm"; shown to operators in 12-hour form. */
  opensAt: string
  closesAt: string
  isClosed: boolean
  isOpen24Hours: boolean
  /** Server-rendered 12-hour text, present on reads only. */
  label?: string
}

export type ShopConfig = {
  service: string
  pricing: {
    currency: "INR"
    unit: "PER_PAGE"
    bwA4PricePaise: number
    colorA4PricePaise: number
    colorA3PricePaise: number
    updatedAt: string | null
  }
  capabilities: {
    bwPrinting: true
    colorPrinting: boolean
    a4Printing: true
    a3Printing: boolean
  }
  orderAutomation: OrderAutomation
  businessHours: ShopBusinessHour[]
  openNow: boolean
  /** "Open until 9:00 PM", "Opens tomorrow at 9:00 AM", ... (absent from older servers). */
  openStatusLabel?: string
  todayHoursLabel?: string
  isOpen24x7?: boolean
}

export type ShopNotification = {
  id: string
  kind: "new-order" | "print-failed" | "printer-offline"
  title: string
  detail: string
  createdAt: string
}

export type OrderAutomation = {
  autoAcceptPaidOnline: boolean
  autoDispatchAcceptedOrders: boolean
  cashRequiresOperatorAcceptance: boolean
}

export type ShopStaffMember = {
  id: string
  name: string
  role: ShopUserRole
  status: ShopUserStatus
  lastLoginAt: string | null
}

export type HostIdentity = {
  deviceIdentifier: string
  hostname: string
  osVersion: string
  appVersion: string
  agentVersion: string
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

export function looksLikeEmail(value: string) {
  return value.includes("@")
}
