/**
 * Optional answers the owner supplies before launch (PRD 10.3).
 * `null` means "not provided": the dependent FAQ item or Money row is not rendered.
 * TODO(owner): fill these in when the answers are confirmed.
 */
export const ownerInputs: {
  readonly settlementTiming: string | null
  readonly setupTime: string | null
  readonly maxFiles: string | null
  readonly orderIssue: string | null
  readonly orderTime: string | null
} = {
  settlementTiming: null,
  setupTime: null,
  maxFiles: null,
  orderIssue: null,
  orderTime: null,
}
