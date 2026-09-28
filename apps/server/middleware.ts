import { NextResponse, type NextRequest } from "next/server";

import { desktopCorsHeaders } from "@/src/lib/cors";

export function middleware(request: NextRequest) {
  const cors = desktopCorsHeaders(request.headers.get("origin"));

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: cors });
  }

  const response = NextResponse.next();

  if (cors) {
    for (const [key, value] of Object.entries(cors)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
