const PREFIX = "[print-shop]"

export function shopLog(scope: string, ...args: unknown[]) {
  console.info(PREFIX, scope, ...args)
}

export function shopWarn(scope: string, ...args: unknown[]) {
  console.warn(PREFIX, scope, ...args)
}

export function shopError(scope: string, ...args: unknown[]) {
  console.error(PREFIX, scope, ...args)
}
