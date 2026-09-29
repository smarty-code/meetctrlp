const TARGET = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "")

type RouteContext = { params: Promise<{ path: string[] }> }

async function proxy(request: Request, context: RouteContext) {
  const { path } = await context.params
  const incoming = new URL(request.url)
  const url = `${TARGET}/api/${path.join("/")}${incoming.search}`
  const headers = new Headers(request.headers)
  headers.delete("host")
  headers.delete("connection")
  const forwarded =
    request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "127.0.0.1"
  headers.set("x-forwarded-for", forwarded)

  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer()

  const response = await fetch(url, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
  })

  const out = new Headers(response.headers)
  out.delete("content-encoding")
  return new Response(response.body, { status: response.status, headers: out })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const OPTIONS = proxy
