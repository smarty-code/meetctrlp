const DEFAULT_ORIGINS = [
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "https://tauri.localhost",
  "http://tauri.localhost",
  "tauri://localhost",
];

function allowedOrigins() {
  const extra = process.env.DESKTOP_ORIGIN?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([...DEFAULT_ORIGINS, ...(extra ?? [])]);
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
