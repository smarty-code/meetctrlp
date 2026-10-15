/** Edge-safe: no Node built-ins (used from middleware). */
export function printUserOrigin() {
  return (process.env.PRINT_USER_ORIGIN ?? "http://localhost:3002").replace(/\/$/, "");
}
