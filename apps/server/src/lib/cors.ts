const DEFAULT_ORIGINS = [
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "https://tauri.localhost",
  "http://tauri.localhost",
  "tauri://localhost",
  "http://localhost:3002",
  "http://127.0.0.1:3002",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function extraOrigins(value: string | undefined) {
  return (
    value
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  );
}

function allowedOrigins() {
  return new Set([
    ...DEFAULT_ORIGINS,
    ...extraOrigins(process.env.DESKTOP_ORIGIN),
    ...extraOrigins(process.env.PRINT_USER_ORIGIN),
  ]);
}

export function isAllowedDesktopOrigin(origin: string | null) {
  if (!origin) {
    return false;
  }

  return allowedOrigins().has(origin);
}

export function desktopCorsHeaders(origin: string | null) {
  if (!isAllowedDesktopOrigin(origin)) {
    return undefined;
  }

  return {
    "Access-Control-Allow-Origin": origin as string,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}
