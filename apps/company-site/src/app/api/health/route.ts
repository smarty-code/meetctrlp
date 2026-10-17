import { NextResponse } from "next/server"

/**
 * Healthcheck endpoint for production uptime monitors
 * Governed by PRD Section 3.1 & 9.13
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "company-site",
    },
    { status: 200 }
  )
}
